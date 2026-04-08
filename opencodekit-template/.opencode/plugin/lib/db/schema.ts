/**
 * Database Schema & Manager
 *
 * Contains all SQL schema definitions, migration logic, and the
 * singleton database connection manager.
 */

import { Database } from "bun:sqlite";
import { appendFileSync, existsSync, renameSync } from "node:fs";
import path from "node:path";

// ============================================================================
// Recovery Logger
// ============================================================================

/**
 * Log recovery messages to a file instead of stderr.
 * Writing to stderr corrupts the TUI in OpenCode.
 */
function logRecovery(message: string): void {
	try {
		const logPath = path.join(process.cwd(), ".opencode/memory-recovery.log");
		const timestamp = new Date().toISOString();
		appendFileSync(logPath, `[${timestamp}] ${message}\n`);
	} catch {
		// If we can't even write a log file, silently continue
	}
}

// ============================================================================
// Schema v2
// ============================================================================

const SCHEMA_VERSION = 2;

const SCHEMA_SQL = `
-- Schema versioning for migrations
CREATE TABLE IF NOT EXISTS schema_versions (
  id INTEGER PRIMARY KEY,
  version INTEGER UNIQUE NOT NULL,
  applied_at TEXT NOT NULL
);

-- Observations table (v2: added source column)
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('decision','bugfix','feature','pattern','discovery','learning','warning')),
  title TEXT NOT NULL,
  subtitle TEXT,
  facts TEXT,
  narrative TEXT,
  concepts TEXT,
  files_read TEXT,
  files_modified TEXT,
  confidence TEXT CHECK(confidence IN ('high','medium','low')) DEFAULT 'high',
  bead_id TEXT,
  supersedes INTEGER,
  superseded_by INTEGER,
  valid_until TEXT,
  markdown_file TEXT,
  source TEXT CHECK(source IN ('manual','curator','imported')) DEFAULT 'manual',
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  updated_at TEXT,
  FOREIGN KEY(supersedes) REFERENCES observations(id) ON DELETE SET NULL,
  FOREIGN KEY(superseded_by) REFERENCES observations(id) ON DELETE SET NULL
);

-- FTS5 with porter stemming (v2 upgrade)
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  title,
  subtitle,
  narrative,
  facts,
  concepts,
  content='observations',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_created ON observations(created_at_epoch DESC);
CREATE INDEX IF NOT EXISTS idx_observations_bead_id ON observations(bead_id);
CREATE INDEX IF NOT EXISTS idx_observations_superseded ON observations(superseded_by) WHERE superseded_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source);

-- Memory files table
CREATE TABLE IF NOT EXISTS memory_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  mode TEXT CHECK(mode IN ('replace', 'append')) DEFAULT 'replace',
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  updated_at TEXT,
  updated_at_epoch INTEGER
);

CREATE INDEX IF NOT EXISTS idx_memory_files_path ON memory_files(file_path);




-- Temporal messages table (v2: raw message capture)
CREATE TABLE IF NOT EXISTS temporal_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  message_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  time_created INTEGER NOT NULL,
  distillation_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(distillation_id) REFERENCES distillations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_temporal_session ON temporal_messages(session_id, time_created);
CREATE INDEX IF NOT EXISTS idx_temporal_undistilled ON temporal_messages(session_id) WHERE distillation_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_temporal_time ON temporal_messages(time_created DESC);

-- Distillations table (v2: compressed message summaries)
CREATE TABLE IF NOT EXISTS distillations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  terms TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 0,
  compression_ratio REAL NOT NULL DEFAULT 0.0,
  time_start INTEGER NOT NULL,
  time_end INTEGER NOT NULL,
  time_created INTEGER NOT NULL,
  meta_distillation_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(meta_distillation_id) REFERENCES distillations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_distillations_session ON distillations(session_id, time_created DESC);
CREATE INDEX IF NOT EXISTS idx_distillations_time ON distillations(time_created DESC);

-- FTS5 for distillations (v2)
CREATE VIRTUAL TABLE IF NOT EXISTS distillations_fts USING fts5(
  content,
  terms,
  content='distillations',
  content_rowid='id',
  tokenize='porter unicode61'
);
`;

// FTS5 sync triggers
const FTS_TRIGGERS_SQL = `
-- Observations FTS sync triggers
CREATE TRIGGER IF NOT EXISTS observations_fts_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;

CREATE TRIGGER IF NOT EXISTS observations_fts_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, facts, concepts)
  VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.facts, old.concepts);
END;

CREATE TRIGGER IF NOT EXISTS observations_fts_au AFTER UPDATE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, facts, concepts)
  VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.facts, old.concepts);
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;

-- Distillations FTS sync triggers (v2)
CREATE TRIGGER IF NOT EXISTS distillations_fts_ai AFTER INSERT ON distillations BEGIN
  INSERT INTO distillations_fts(rowid, content, terms)
  VALUES (new.id, new.content, new.terms);
END;

CREATE TRIGGER IF NOT EXISTS distillations_fts_ad AFTER DELETE ON distillations BEGIN
  INSERT INTO distillations_fts(distillations_fts, rowid, content, terms)
  VALUES('delete', old.id, old.content, old.terms);
END;

CREATE TRIGGER IF NOT EXISTS distillations_fts_au AFTER UPDATE ON distillations BEGIN
  INSERT INTO distillations_fts(distillations_fts, rowid, content, terms)
  VALUES('delete', old.id, old.content, old.terms);
  INSERT INTO distillations_fts(rowid, content, terms)
  VALUES (new.id, new.content, new.terms);
END;
`;

// Migration from v1 to v2
const MIGRATION_V1_TO_V2 = `
-- Add source column to observations
ALTER TABLE observations ADD COLUMN source TEXT CHECK(source IN ('manual','curator','imported')) DEFAULT 'manual';

-- Add source index
CREATE INDEX IF NOT EXISTS idx_observations_source ON observations(source);

-- Create distillations table (before temporal_messages due to FK dependency)
CREATE TABLE IF NOT EXISTS distillations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  terms TEXT NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 0,
  compression_ratio REAL NOT NULL DEFAULT 0.0,
  time_start INTEGER NOT NULL,
  time_end INTEGER NOT NULL,
  time_created INTEGER NOT NULL,
  meta_distillation_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(meta_distillation_id) REFERENCES distillations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_distillations_session ON distillations(session_id, time_created DESC);
CREATE INDEX IF NOT EXISTS idx_distillations_time ON distillations(time_created DESC);

-- Create distillations FTS5
CREATE VIRTUAL TABLE IF NOT EXISTS distillations_fts USING fts5(
  content,
  terms,
  content='distillations',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Create temporal_messages table
CREATE TABLE IF NOT EXISTS temporal_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  message_id TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  time_created INTEGER NOT NULL,
  distillation_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(distillation_id) REFERENCES distillations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_temporal_session ON temporal_messages(session_id, time_created);
CREATE INDEX IF NOT EXISTS idx_temporal_undistilled ON temporal_messages(session_id) WHERE distillation_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_temporal_time ON temporal_messages(time_created DESC);
`;

// ============================================================================
// Database Manager
// ============================================================================

let dbInstance: Database | null = null;

/**
 * Get or create the memory database instance.
 * Uses singleton pattern to reuse connection.
 */
export function getMemoryDB(): Database {
	if (dbInstance) return dbInstance;

	const dbPath = path.join(process.cwd(), ".opencode/memory.db");

	try {
		dbInstance = new Database(dbPath, { create: true });
	} catch (err) {
		// Database file may be corrupted — attempt recovery
		const recovered = attemptDBRecovery(dbPath, err);
		if (!recovered) {
			throw new Error(
				`Failed to open memory database: ${err instanceof Error ? err.message : String(err)}. ` +
					`Recovery also failed. Try manually deleting ${dbPath} to start fresh.`,
			);
		}
		dbInstance = recovered;
	}

	// Verify database integrity
	try {
		const result = dbInstance.query("PRAGMA integrity_check").get() as {
			integrity_check: string;
		} | null;
		if (result && result.integrity_check !== "ok") {
			logRecovery(
				`[memory-db] Integrity check failed: ${result.integrity_check}`,
			);
			// Close bad instance and attempt recovery
			dbInstance.close();
			dbInstance = null;
			const recovered = attemptDBRecovery(dbPath, new Error("integrity check failed"));
			if (!recovered) {
				throw new Error(
					`Memory database integrity check failed and recovery failed. ` +
						`Try manually deleting ${dbPath} to start fresh.`,
				);
			}
			dbInstance = recovered;
		}
	} catch (err) {
		if (
			err instanceof Error &&
			err.message.includes("recovery failed")
		) {
			throw err;
		}
		// integrity_check itself failed — try recovery
		logRecovery(
			`[memory-db] Integrity check query failed: ${err instanceof Error ? err.message : String(err)}`,
		);
		dbInstance?.close();
		dbInstance = null;
		const recovered = attemptDBRecovery(dbPath, err);
		if (!recovered) {
			throw new Error(
				`Memory database is corrupted and recovery failed. ` +
					`Try manually deleting ${dbPath} to start fresh.`,
			);
		}
		dbInstance = recovered;
	}

	// Enable WAL mode for better concurrency
	dbInstance.run("PRAGMA journal_mode = WAL");
	dbInstance.run("PRAGMA foreign_keys = ON");

	// Initialize schema
	initializeSchema(dbInstance);

	return dbInstance;
}

/**
 * Attempt to recover from a corrupted database.
 * Strategy: WAL checkpoint first, then backup corrupt file + create fresh.
 */
function attemptDBRecovery(
	dbPath: string,
	originalError: unknown,
): Database | null {
	logRecovery(
		`[memory-db] Database recovery triggered: ${originalError instanceof Error ? originalError.message : String(originalError)}`,
	);

	// Step 1: Try WAL checkpoint recovery (if file exists and is openable)
	try {
		if (existsSync(dbPath)) {
			let tempDB: Database | undefined;
			try {
				tempDB = new Database(dbPath);
				tempDB.run("PRAGMA wal_checkpoint(TRUNCATE)");
				tempDB.close();
				tempDB = undefined;
			} catch {
				tempDB?.close();
				throw new Error("WAL checkpoint failed");
			}
			// Try reopening after WAL checkpoint
			const db = new Database(dbPath, { create: true });
			const check = db.query("PRAGMA integrity_check").get() as {
				integrity_check: string;
			} | null;
			if (check?.integrity_check === "ok") {
				logRecovery("[memory-db] WAL checkpoint recovery succeeded.");
				return db;
			}
			db.close();
		}
	} catch {
		// WAL recovery failed, continue to backup + recreate
	}

	// Step 2: Backup corrupt file and create fresh database
	try {
		if (existsSync(dbPath)) {
			const backupPath = `${dbPath}.corrupt.${Date.now()}`;
			renameSync(dbPath, backupPath);
			logRecovery(
				`[memory-db] Corrupt database backed up to: ${backupPath}`,
			);

			// Also clean up WAL/SHM files
			for (const suffix of ["-wal", "-shm"]) {
				const walPath = dbPath + suffix;
				if (existsSync(walPath)) {
					renameSync(walPath, `${backupPath}${suffix}`);
				}
			}
		}

		const freshDB = new Database(dbPath, { create: true });
		logRecovery(
			"[memory-db] Fresh database created. Previous observations are in the backup file.",
		);
		return freshDB;
	} catch (backupErr) {
		logRecovery(
			`[memory-db] Recovery failed: ${backupErr instanceof Error ? backupErr.message : String(backupErr)}`,
		);
		return null;
	}
}

/**
 * Close the database connection (for cleanup).
 */
export function closeMemoryDB(): void {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}

/**
 * Initialize database schema with migration support.
 */
function initializeSchema(db: Database): void {
	let currentVersion = 0;

	try {
		const versionRow = db
			.query("SELECT MAX(version) as version FROM schema_versions")
			.get() as {
			version: number | null;
		} | null;
		currentVersion = versionRow?.version ?? 0;
	} catch {
		// schema_versions table doesn't exist, need full init
	}

	if (currentVersion >= SCHEMA_VERSION) {
		return; // Schema is up to date
	}

	if (currentVersion === 0) {
		// Fresh install — run full v2 schema
		db.exec(SCHEMA_SQL);

		// Run FTS triggers
		try {
			db.exec(FTS_TRIGGERS_SQL);
		} catch {
			// Triggers may already exist
		}
	} else {
		// Run incremental migrations
		if (currentVersion < 2) {
			migrateV1ToV2(db);
		}
	}

	// Record schema version
	db.run(
		"INSERT OR REPLACE INTO schema_versions (id, version, applied_at) VALUES (1, ?, ?)",
		[SCHEMA_VERSION, new Date().toISOString()],
	);
}

/**
 * Migrate from schema v1 to v2.
 * Adds: source column, temporal_messages, distillations, porter FTS5.
 */
function migrateV1ToV2(db: Database): void {
	// Run structural changes (new tables, columns)
	for (const stmt of MIGRATION_V1_TO_V2.split(";")) {
		const trimmed = stmt.trim();
		if (trimmed) {
			try {
				db.run(trimmed);
			} catch {
				// Statement may fail if already applied (e.g. column exists)
			}
		}
	}

	// Upgrade observations_fts to porter stemming
	try {
		// Drop old triggers first
		db.run("DROP TRIGGER IF EXISTS observations_fts_ai");
		db.run("DROP TRIGGER IF EXISTS observations_fts_ad");
		db.run("DROP TRIGGER IF EXISTS observations_fts_au");

		// Drop old FTS table
		db.run("DROP TABLE IF EXISTS observations_fts");

		// Recreate with porter tokenizer
		db.run(`
			CREATE VIRTUAL TABLE observations_fts USING fts5(
				title, subtitle, narrative, facts, concepts,
				content='observations', content_rowid='id',
				tokenize='porter unicode61'
			)
		`);

		// Rebuild FTS index from existing data
		db.run("INSERT INTO observations_fts(observations_fts) VALUES('rebuild')");
	} catch {
		// FTS migration failed, non-fatal — search still works via LIKE fallback
	}

	// Create new triggers (observations + distillations)
	try {
		db.exec(FTS_TRIGGERS_SQL);
	} catch {
		// Triggers may already exist
	}
}

import * as p from "@clack/prompts";
import color from "picocolors";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve the .opencode directory path.
 * Handles two cases:
 * 1. Standard project: cwd has .opencode/ subdirectory
 * 2. Global config dir: cwd IS the opencode config dir (has opencode.json directly)
 * Returns null if neither case applies.
 */
export function resolveOpencodePath(): string | null {
  const nested = join(process.cwd(), ".opencode");
  if (existsSync(nested)) return nested;

  // Running from inside a config dir (e.g. ~/.config/opencode/)
  if (existsSync(join(process.cwd(), "opencode.json"))) return process.cwd();

  return null;
}

/**
 * Resolve opencode path or show "not initialized" error and return null.
 */
export function requireOpencodePath(): string | null {
  const resolved = resolveOpencodePath();
  if (!resolved) {
    notInitialized();
    return null;
  }
  return resolved;
}

/**
 * Display a styled error message with optional fix suggestion
 */
export function showError(message: string, fix?: string): void {
  console.log();
  p.log.error(`${color.red("✗")} ${message}`);
  if (fix) {
    p.log.info(`  ${color.dim(`→ ${fix}`)}`);
  }
  console.log();
}

/**
 * Display "not initialized" error - common across commands
 */
export function notInitialized(): void {
  showError("Not an OpenCodeKit project", "Run: ock init");
}

/**
 * Display "not found" error for a resource
 */
export function notFound(resource: string, name?: string): void {
  const msg = name ? `${resource} "${name}" not found` : `${resource} not found`;
  showError(msg);
}

/**
 * Display "already exists" error
 */
export function alreadyExists(resource: string, name: string): void {
  showError(`${resource} "${name}" already exists`);
}

/**
 * Display unknown action error with available options
 */
export function unknownAction(action: string, available: string[]): void {
  showError(
    `Unknown action: ${action}`,
    `Available: ${available.map((a) => color.cyan(a)).join(", ")}`,
  );
}

/**
 * Display a styled warning
 */
export function showWarning(message: string, suggestion?: string): void {
  p.log.warn(`${color.yellow("!")} ${message}`);
  if (suggestion) {
    p.log.info(`  ${color.dim(`→ ${suggestion}`)}`);
  }
}

/**
 * Display empty state with suggestion
 */
export function showEmpty(resource: string, createCmd?: string): void {
  p.log.info(color.dim(`No ${resource} found`));
  if (createCmd) {
    p.log.info(color.dim(`→ Run: ${color.cyan(createCmd)}`));
  }
}

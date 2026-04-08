import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// ── Types ──────────────────────────────────────────────────────────────

interface LintIssue {
	skill: string;
	rule: string;
	severity: "error" | "warning";
	message: string;
	fix?: string;
}

interface LintResult {
	ok: boolean;
	issues: LintIssue[];
	stats: {
		total: number;
		passed: number;
		failed: number;
		warnings: number;
	};
}

// ── Constants ──────────────────────────────────────────────────────────

const ALLOWED_TAGS = new Set([
	"workflow",
	"debugging",
	"testing",
	"planning",
	"code-quality",
	"agent-coordination",
	"context",
	"ui",
	"design",
	"research",
	"integration",
	"apple",
	"git",
	"devops",
	"mcp",
	"automation",
	"documentation",
]);

const REQUIRED_FRONTMATTER = [
	"name",
	"description",
	"version",
	"tags",
	"dependencies",
] as const;
const MAX_LINES = 500;
const MAX_LINES_WARNING = 400;
const MIN_TAGS = 1;
const MAX_TAGS = 5;

// ── Frontmatter Parser ────────────────────────────────────────────────

interface Frontmatter {
	raw: string;
	fields: Record<string, unknown>;
}

function parseFrontmatter(content: string): Frontmatter | null {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return null;

	const raw = match[1];
	const fields: Record<string, unknown> = {};

	for (const line of raw.split("\n")) {
		// Handle simple key: value
		const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
		if (kvMatch) {
			const [, key, value] = kvMatch;
			// Parse arrays like [tag1, tag2]
			const arrayMatch = value.match(/^\[([^\]]*)\]$/);
			if (arrayMatch) {
				fields[key] = arrayMatch[1]
					.split(",")
					.map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
					.filter(Boolean);
			} else {
				fields[key] = value.replace(/^['"]|['"]$/g, "").trim();
			}
		}
		// Handle multiline description with >
		if (line.match(/^(\w[\w-]*):\s*>$/)) {
			const key = line.split(":")[0].trim();
			fields[key] = "(multiline)";
		}
		// Handle key with no value (empty array or object)
		const emptyKey = line.match(/^(\w[\w-]*):\s*$/);
		if (emptyKey) {
			fields[emptyKey[1]] = undefined;
		}
	}

	return { raw, fields };
}

// ── Lint Rules ────────────────────────────────────────────────────────

function lintSkill(skillDir: string, skillName: string): LintIssue[] {
	const issues: LintIssue[] = [];
	const skillPath = join(skillDir, "SKILL.md");

	if (!existsSync(skillPath)) {
		issues.push({
			skill: skillName,
			rule: "file-exists",
			severity: "error",
			message: "Missing SKILL.md file",
			fix: "Create SKILL.md with proper frontmatter and content",
		});
		return issues;
	}

	const content = readFileSync(skillPath, "utf-8");
	const lines = content.split("\n");
	const lineCount = lines.length;

	// ── Rule: Line count ──
	if (lineCount > MAX_LINES) {
		issues.push({
			skill: skillName,
			rule: "max-lines",
			severity: "error",
			message: `SKILL.md is ${lineCount} lines (max ${MAX_LINES}). Move detailed content to references/`,
			fix: "Extract examples, advanced patterns, and detailed docs to references/ subdirectory",
		});
	} else if (lineCount > MAX_LINES_WARNING) {
		issues.push({
			skill: skillName,
			rule: "max-lines-warning",
			severity: "warning",
			message: `SKILL.md is ${lineCount} lines (warning threshold: ${MAX_LINES_WARNING})`,
			fix: "Consider moving some content to references/ to keep SKILL.md lean",
		});
	}

	// ── Rule: Frontmatter ──
	const frontmatter = parseFrontmatter(content);
	if (!frontmatter) {
		issues.push({
			skill: skillName,
			rule: "frontmatter-exists",
			severity: "error",
			message:
				"Missing YAML frontmatter (--- delimited block at start of file)",
			fix: "Add YAML frontmatter with name, description, version, tags, dependencies",
		});
	} else {
		for (const field of REQUIRED_FRONTMATTER) {
			if (
				!(field in frontmatter.fields) ||
				frontmatter.fields[field] === undefined
			) {
				issues.push({
					skill: skillName,
					rule: `frontmatter-${field}`,
					severity: "error",
					message: `Missing required frontmatter field: ${field}`,
					fix: `Add '${field}:' to YAML frontmatter`,
				});
			}
		}

		// Validate tags
		const tags = frontmatter.fields.tags;
		if (Array.isArray(tags)) {
			if (tags.length < MIN_TAGS) {
				issues.push({
					skill: skillName,
					rule: "tags-min",
					severity: "warning",
					message: `Only ${tags.length} tag(s) — recommend at least ${MIN_TAGS}`,
				});
			}
			if (tags.length > MAX_TAGS) {
				issues.push({
					skill: skillName,
					rule: "tags-max",
					severity: "warning",
					message: `${tags.length} tags — recommend at most ${MAX_TAGS}`,
				});
			}
			for (const tag of tags) {
				if (!ALLOWED_TAGS.has(tag)) {
					issues.push({
						skill: skillName,
						rule: "tags-allowed",
						severity: "warning",
						message: `Unknown tag '${tag}'. Allowed: ${[...ALLOWED_TAGS].join(", ")}`,
						fix: `Replace '${tag}' with one of the allowed tags`,
					});
				}
			}
		}

		// Validate dependencies is an array
		const deps = frontmatter.fields.dependencies;
		if (deps !== undefined && !Array.isArray(deps)) {
			issues.push({
				skill: skillName,
				rule: "dependencies-array",
				severity: "warning",
				message: "dependencies should be an array (use [] for none)",
			});
		}

		// Validate name matches directory
		const name = frontmatter.fields.name;
		if (typeof name === "string" && name !== skillName) {
			issues.push({
				skill: skillName,
				rule: "name-match",
				severity: "warning",
				message: `Frontmatter name '${name}' doesn't match directory '${skillName}'`,
				fix: `Update name to '${skillName}' or rename directory`,
			});
		}
	}

	// ── Rule: When to Use section ──
	const hasWhenToUse = /^##\s+When\s+to\s+Use/im.test(content);
	if (!hasWhenToUse) {
		issues.push({
			skill: skillName,
			rule: "when-to-use",
			severity: "error",
			message: "Missing '## When to Use' section",
			fix: "Add '## When to Use' section after the H1 title with specific trigger conditions",
		});
	}

	// ── Rule: When NOT to Use section ──
	const hasWhenNotToUse = /^##\s+When\s+NOT\s+to\s+Use/im.test(content);
	if (!hasWhenNotToUse) {
		issues.push({
			skill: skillName,
			rule: "when-not-to-use",
			severity: "warning",
			message: "Missing '## When NOT to Use' section",
			fix: "Add '## When NOT to Use' section to prevent incorrect skill loading",
		});
	}

	// ── Rule: H1 title exists ──
	const hasH1 = /^#\s+\S/m.test(content);
	if (!hasH1) {
		issues.push({
			skill: skillName,
			rule: "h1-title",
			severity: "error",
			message: "Missing H1 title (# Title)",
			fix: "Add a descriptive H1 title after the frontmatter",
		});
	}

	// ── Rule: References depth ──
	const refsDir = join(skillDir, "references");
	if (existsSync(refsDir) && statSync(refsDir).isDirectory()) {
		const entries = readdirSync(refsDir);
		const nestedDirs = entries.filter((entry) =>
			statSync(join(refsDir, entry)).isDirectory(),
		);
		if (nestedDirs.length > 0) {
			issues.push({
				skill: skillName,
				rule: "refs-depth",
				severity: "warning",
				message: `${nestedDirs.length} nested director${nestedDirs.length === 1 ? "y" : "ies"} in references/. Prefer flat structure`,
				fix: "Consider flattening nested references/ subdirectories to one level deep",
			});
		}
	}

	return issues;
}

// ── Main ──────────────────────────────────────────────────────────────

function lintAllSkills(projectRoot: string): LintResult {
	const skillsDir = join(projectRoot, ".opencode", "skill");
	const issues: LintIssue[] = [];
	let total = 0;
	const failedSkills = new Set<string>();
	let warningCount = 0;

	if (!existsSync(skillsDir)) {
		return {
			ok: false,
			issues: [
				{
					skill: "(root)",
					rule: "skills-dir",
					severity: "error",
					message: `Skills directory not found: ${skillsDir}`,
				},
			],
			stats: { total: 0, passed: 0, failed: 0, warnings: 0 },
		};
	}

	const entries = readdirSync(skillsDir).filter((name) => {
		const fullPath = join(skillsDir, name);
		return statSync(fullPath).isDirectory() && !name.startsWith(".");
	});

	for (const skillName of entries.sort()) {
		total++;
		const skillIssues = lintSkill(join(skillsDir, skillName), skillName);
		issues.push(...skillIssues);

		const hasError = skillIssues.some((i) => i.severity === "error");
		const warnCount = skillIssues.filter(
			(i) => i.severity === "warning",
		).length;

		if (hasError) failedSkills.add(skillName);
		warningCount += warnCount;
	}

	return {
		ok: failedSkills.size === 0,
		issues,
		stats: {
			total,
			passed: total - failedSkills.size,
			failed: failedSkills.size,
			warnings: warningCount,
		},
	};
}

// ── CLI ───────────────────────────────────────────────────────────────

function main() {
	const args = process.argv.slice(2);
	const isCheck = args.includes("--check");
	const isJson = args.includes("--json");
	const projectRoot = args.find((a) => !a.startsWith("--")) || process.cwd();

	const result = lintAllSkills(projectRoot);

	if (isJson) {
		console.log(JSON.stringify(result, null, 2));
		process.exit(result.ok ? 0 : 1);
	}

	// Pretty output
	const { stats, issues } = result;

	console.log("\n╭─────────────────────────────────────╮");
	console.log("│         Skill Lint Report           │");
	console.log("╰─────────────────────────────────────╯\n");

	console.log(
		`  Skills: ${stats.total}  Passed: ${stats.passed}  Failed: ${stats.failed}  Warnings: ${stats.warnings}\n`,
	);

	if (issues.length === 0) {
		console.log("  ✓ All skills pass lint checks\n");
		process.exit(0);
	}

	// Group by skill
	const bySkill = new Map<string, LintIssue[]>();
	for (const issue of issues) {
		const existing = bySkill.get(issue.skill) || [];
		existing.push(issue);
		bySkill.set(issue.skill, existing);
	}

	for (const [skill, skillIssues] of bySkill) {
		const hasError = skillIssues.some((i) => i.severity === "error");
		const icon = hasError ? "✗" : "⚠";
		console.log(`  ${icon} ${skill}`);
		for (const issue of skillIssues) {
			const sev = issue.severity === "error" ? "ERR " : "WARN";
			console.log(`    ${sev} [${issue.rule}] ${issue.message}`);
			if (issue.fix) {
				console.log(`         fix: ${issue.fix}`);
			}
		}
		console.log();
	}

	if (isCheck) {
		process.exit(result.ok ? 0 : 1);
	}
}

main();

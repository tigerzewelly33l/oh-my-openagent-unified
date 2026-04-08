import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
	notFound,
	requireOpencodePath,
	showEmpty,
	unknownAction,
} from "../utils/errors.js";
import { SkillActionSchema, parseAction } from "../utils/schemas.js";

interface SkillFrontmatter {
	name?: string;
	description?: string;
	version?: string;
	license?: string;
}

interface SkillInfo {
	name: string;
	path: string;
	frontmatter: SkillFrontmatter;
}

export async function skillCommand(action?: string) {
	const validatedAction = parseAction(SkillActionSchema, action);

	const opencodePath = requireOpencodePath();

	if (!opencodePath) {
		return;
	}

	const skillDir = join(opencodePath, "skill");

	switch (validatedAction) {
		case "list":
			listSkills(skillDir);
			break;

		case "create":
			await createSkill(skillDir);
			break;

		case "show": {
			const skillName = process.argv[4];
			await viewSkill(skillDir, skillName);
			break;
		}

		case "delete": {
			const skillName = process.argv[4];
			await removeSkill(skillDir, skillName);
			break;
		}

		case "edit":
			// TODO: Implement edit skill
			unknownAction("edit", ["list", "show", "create", "delete"]);
			break;

		default:
			unknownAction(action ?? "undefined", [
				"list",
				"show",
				"create",
				"delete",
				"edit",
			]);
	}
}

function parseFrontmatter(content: string): SkillFrontmatter {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};

	const frontmatter: SkillFrontmatter = {};
	const lines = match[1].split("\n");

	let currentKey: string | null = null;
	let multilineValue = "";

	for (const line of lines) {
		// Check for multiline continuation (starts with spaces)
		if (currentKey && line.match(/^\s+\S/)) {
			multilineValue += ` ${line.trim()}`;
			continue;
		}

		// Save previous multiline value
		if (currentKey && multilineValue) {
			(frontmatter as Record<string, string>)[currentKey] =
				multilineValue.trim();
			currentKey = null;
			multilineValue = "";
		}

		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			let value = line.slice(colonIndex + 1).trim();

			// Check for multiline indicator
			if (value === ">" || value === "|") {
				currentKey = key;
				multilineValue = "";
				continue;
			}

			// Remove quotes
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			(frontmatter as Record<string, string>)[key] = value;
		}
	}

	// Handle final multiline value
	if (currentKey && multilineValue) {
		(frontmatter as Record<string, string>)[currentKey] = multilineValue.trim();
	}

	return frontmatter;
}

function collectSkills(skillDir: string): SkillInfo[] {
	const skills: SkillInfo[] = [];

	if (!existsSync(skillDir)) return skills;

	const entries = readdirSync(skillDir, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const skillPath = join(skillDir, entry.name);
		const skillMdPath = join(skillPath, "SKILL.md");

		if (existsSync(skillMdPath)) {
			const content = readFileSync(skillMdPath, "utf-8");
			const frontmatter = parseFrontmatter(content);

			skills.push({
				name: frontmatter.name || entry.name,
				path: skillPath,
				frontmatter,
			});
		}
	}

	return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function validateSkillName(name: string): string | undefined {
	if (!name) return "Name is required";
	if (name.length < 1 || name.length > 64) {
		return "Name must be 1-64 characters";
	}
	if (!/^[a-z][a-z0-9-]*$/.test(name)) {
		return "Name must be lowercase letters, numbers, and hyphens (start with letter)";
	}
	return undefined;
}

function validateDescription(desc: string): string | undefined {
	if (!desc) return "Description is required";
	if (desc.length < 1 || desc.length > 1024) {
		return "Description must be 1-1024 characters";
	}
	return undefined;
}

function listSkills(skillDir: string) {
	const skills = collectSkills(skillDir);

	if (skills.length === 0) {
		showEmpty("skills", "ock skill create");
		return;
	}

	p.log.info(color.bold("Skills"));

	for (const skill of skills) {
		const desc = skill.frontmatter.description
			? color.dim(
					` - ${skill.frontmatter.description.slice(0, 60)}${skill.frontmatter.description.length > 60 ? "..." : ""}`,
				)
			: "";
		const version = skill.frontmatter.version
			? color.yellow(` v${skill.frontmatter.version}`)
			: "";

		console.log(`  ${color.cyan(skill.name)}${version}${desc}`);
	}

	console.log();
	p.log.info(
		color.dim(
			`Found ${skills.length} skill${skills.length === 1 ? "" : "s"} in .opencode/skill/`,
		),
	);
}

async function createSkill(skillDir: string) {
	p.intro(color.bgYellow(color.black(" Create Skill ")));

	// Ensure directory exists
	if (!existsSync(skillDir)) {
		mkdirSync(skillDir, { recursive: true });
	}

	const name = await p.text({
		message: "Skill name",
		placeholder: "my-skill",
		validate: (value) => {
			const error = validateSkillName(value);
			if (error) return error;
			if (existsSync(join(skillDir, value))) {
				return "Skill already exists";
			}
			return undefined;
		},
	});

	if (p.isCancel(name)) {
		p.cancel("Cancelled");
		return;
	}

	const description = await p.text({
		message: "Description (when should this skill be used?)",
		placeholder: "Use when implementing authentication flows...",
		validate: validateDescription,
	});

	if (p.isCancel(description)) {
		p.cancel("Cancelled");
		return;
	}

	const version = await p.text({
		message: "Version",
		placeholder: "1.0.0",
		initialValue: "1.0.0",
	});

	if (p.isCancel(version)) {
		p.cancel("Cancelled");
		return;
	}

	// Create skill directory and SKILL.md
	const skillPath = join(skillDir, String(name));
	mkdirSync(skillPath, { recursive: true });

	const template = `---
name: ${name}
description: >
  ${description}
version: "${version}"
license: MIT
---

# ${String(name)
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ")}

## Overview

${description}

## When to Use

Use this skill when:
- Condition 1
- Condition 2

## Instructions

<!-- Add your skill instructions here -->

1. Step one
2. Step two
3. Step three

## Examples

\`\`\`typescript
// Example usage
\`\`\`

## Rules

1. Rule one
2. Rule two
`;

	writeFileSync(join(skillPath, "SKILL.md"), template);

	p.outro(color.green(`Created ${name} at .opencode/skill/${name}/SKILL.md`));
}

async function viewSkill(skillDir: string, skillNameArg?: string) {
	const skills = collectSkills(skillDir);

	if (skills.length === 0) {
		showEmpty("skills", "ock skill create");
		return;
	}

	let skillName = skillNameArg;
	if (!skillName) {
		const options = skills.map((s) => ({
			value: s.name,
			label: s.name,
			hint: s.frontmatter.description?.slice(0, 50) || "",
		}));

		const selected = await p.select({
			message: "Select skill to view",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		skillName = selected as string;
	}

	const skill = skills.find(
		(s) => s.name === skillName || basename(s.path) === skillName,
	);

	if (!skill) {
		notFound("Skill", skillName);
		return;
	}

	const skillMdPath = join(skill.path, "SKILL.md");
	const content = readFileSync(skillMdPath, "utf-8");

	console.log();
	console.log(color.dim("─".repeat(60)));
	console.log(content);
	console.log(color.dim("─".repeat(60)));
}

async function removeSkill(skillDir: string, skillNameArg?: string) {
	const skills = collectSkills(skillDir);

	if (skills.length === 0) {
		showEmpty("skills", "ock skill create");
		return;
	}

	let skillName = skillNameArg;
	if (!skillName) {
		const options = skills.map((s) => ({
			value: basename(s.path),
			label: s.name,
			hint: s.frontmatter.description?.slice(0, 50) || "",
		}));

		const selected = await p.select({
			message: "Select skill to remove",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		skillName = selected as string;
	}

	const skill = skills.find(
		(s) => s.name === skillName || basename(s.path) === skillName,
	);

	if (!skill) {
		notFound("Skill", skillName);
		return;
	}

	const confirm = await p.confirm({
		message: `Remove skill "${skill.name}"? This will delete the entire folder.`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		p.cancel("Cancelled");
		return;
	}

	rmSync(skill.path, { recursive: true, force: true });
	p.log.success(`Removed skill "${skill.name}"`);
}

export const PRESERVE_FILES = [
	"opencode.json",
	".env",
] as const;

export const PRESERVE_DIRS = [
	"agent",
	"command",
	"context",
	"memory",
	"skill",
	"tool",
] as const;

export const SKIP_DIRS = ["node_modules", ".git", "dist", "coverage"] as const;

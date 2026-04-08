export const EXCLUDED_DIRS = [
	"node_modules",
	".git",
	"dist",
	".DS_Store",
	"coverage",
	".next",
	".turbo",
] as const;

export const EXCLUDED_FILES = [
	"bun.lock",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
] as const;

// Directories within .opencode/ whose existing files should be preserved during reinit.
// These contain user-specific content that should not be overwritten by template defaults.
export const PRESERVE_USER_DIRS = [
	"memory/project",
	"context",
] as const;

// Dirs that can be provided by global config (shared across projects).
// If these exist at ~/.config/opencode/, they can be skipped during local init.
export const SHARED_CONFIG_DIRS = ["agent", "command", "skill", "tool"] as const;

import pc from "picocolors";

/**
 * Simple logger with colored output and quiet/verbose modes.
 * Respects --quiet and --verbose CLI flags.
 */
export const logger = {
	log: (message: string) => {
		if (!process.argv.includes("--quiet")) {
			console.log(message);
		}
	},
	info: (message: string) => {
		if (!process.argv.includes("--quiet")) {
			console.log(pc.blue(`[i] ${message}`));
		}
	},
	success: (message: string) => {
		if (!process.argv.includes("--quiet")) {
			console.log(pc.green(`[+] ${message}`));
		}
	},
	warn: (message: string) => {
		if (!process.argv.includes("--quiet")) {
			console.warn(pc.yellow(`[!] ${message}`));
		}
	},
	error: (message: string) => {
		if (!process.argv.includes("--quiet")) {
			console.error(pc.red(`[x] ${message}`));
		}
	},
	debug: (message: string) => {
		if (
			(process.env.DEBUG || process.argv.includes("--verbose")) &&
			!process.argv.includes("--quiet")
		) {
			console.log(pc.dim(`[DEBUG] ${message}`));
		}
	},
	verbose: (message: string) => {
		if (
			process.argv.includes("--verbose") &&
			!process.argv.includes("--quiet")
		) {
			console.log(pc.dim(message));
		}
	},
};

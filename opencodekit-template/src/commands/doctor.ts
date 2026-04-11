import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
	type BeadsRuntimeCheck,
	getBeadsRuntimeHealthReport,
	getBridgeHealthReport,
} from "./bridge-diagnostics.js";
import {
	type CheckResult,
	collectDoctorSectionChecks,
	displayChecks,
} from "./doctor-checks.js";

export async function doctorCommand() {
	if (process.argv.includes("--quiet")) return;

	const cwd = process.cwd();
	const opencodeDir = join(cwd, ".opencode");
	const bridgeHealth = getBridgeHealthReport(opencodeDir);
	const beadsRuntimeHealth = getBeadsRuntimeHealthReport({
		projectDir: cwd,
		opencodeDir,
	});

	p.intro(color.bgBlue(color.white(" Doctor - Health Check ")));

	const warnings: CheckResult[] = [];
	const {
		structureChecks,
		configurationChecks,
		agentChecks,
		skillChecks,
		toolChecks,
	} = collectDoctorSectionChecks(opencodeDir, warnings);
	const checks = [
		...structureChecks,
		...configurationChecks,
		...agentChecks,
		...skillChecks,
		...toolChecks,
	];

	console.log();
	console.log(color.bold("  Structure"));
	displayChecks(structureChecks);

	console.log();
	console.log(color.bold("  Configuration"));
	displayChecks(configurationChecks);

	console.log();
	console.log(color.bold("  Agents"));
	displayChecks(agentChecks);

	console.log();
	console.log(color.bold("  Skills"));
	displayChecks(skillChecks);

	console.log();
	console.log(color.bold("  Tools"));
	displayChecks(toolChecks);

	console.log();
	console.log(color.bold("  Bridge"));
	renderBridgeSection(bridgeHealth);

	console.log();
	console.log(color.bold("  Beads Runtime"));
	renderBeadsRuntimeChecks(beadsRuntimeHealth.checks);

	const errors = checks.filter((check) => !check.ok && !check.warn);
	const warningCount =
		warnings.length +
		checks.filter((check) => !check.ok && check.warn).length +
		bridgeHealth.diagnostics.filter((diagnostic) => diagnostic.level === "WARN")
			.length +
		beadsRuntimeHealth.checks.filter((check) => check.level === "WARN").length;
	const bridgeErrorCount = bridgeHealth.diagnostics.filter(
		(diagnostic) => diagnostic.level === "ERROR",
	).length;
	const beadsRuntimeErrorCount = beadsRuntimeHealth.checks.filter(
		(check) => check.level === "ERROR",
	).length;

	if (warnings.length > 0) {
		console.log();
		console.log(color.bold("  Warnings"));
		for (const warn of warnings.slice(0, 5)) {
			console.log(`  ${color.yellow("!")} ${warn.name}`);
		}
		if (warnings.length > 5) {
			console.log(color.dim(`    ... and ${warnings.length - 5} more`));
		}
	}

	console.log();

	if (
		errors.length === 0 &&
		bridgeErrorCount === 0 &&
		beadsRuntimeErrorCount === 0 &&
		warningCount === 0
	) {
		p.outro(color.green("All checks passed!"));
		process.exitCode = 0;
		return;
	}

	if (
		errors.length === 0 &&
		bridgeErrorCount === 0 &&
		beadsRuntimeErrorCount === 0
	) {
		p.outro(
			color.yellow(
				`Passed with ${warningCount} warning${warningCount > 1 ? "s" : ""}`,
			),
		);
		process.exitCode = 2;
		return;
	}

	const totalErrors = errors.length + bridgeErrorCount + beadsRuntimeErrorCount;
	p.outro(
		color.red(
			`${totalErrors} error${totalErrors > 1 ? "s" : ""}, ${warningCount} warning${warningCount > 1 ? "s" : ""}`,
		),
	);
	process.exitCode = 1;
}

function renderBridgeSection(
	bridgeHealth: ReturnType<typeof getBridgeHealthReport>,
) {
	if (bridgeHealth.level === "OK") {
		console.log(
			`  ${color.green("✓")} BRIDGE OK: canonical OMO runtime registration detected`,
		);
		return;
	}

	for (const diagnostic of bridgeHealth.diagnostics) {
		const prefix =
			diagnostic.level === "ERROR" ? color.red("✗") : color.yellow("!");
		console.log(`  ${prefix} ${diagnostic.message}`);
		if (diagnostic.details && diagnostic.details.length > 0) {
			for (const detail of diagnostic.details.slice(0, 5)) {
				console.log(`    ${color.dim("→")} ${color.dim(detail)}`);
			}
			if (diagnostic.details.length > 5) {
				console.log(
					color.dim(`    ... and ${diagnostic.details.length - 5} more`),
				);
			}
		}
	}
}

function renderBeadsRuntimeChecks(checks: BeadsRuntimeCheck[]) {
	for (const check of checks) {
		const icon =
			check.level === "OK"
				? color.green("✓")
				: check.level === "WARN"
					? color.yellow("!")
					: color.red("✗");
		console.log(`  ${icon} ${check.name}: ${check.message}`);
		if (check.details && check.details.length > 0) {
			for (const detail of check.details.slice(0, 5)) {
				console.log(`    ${color.dim("→")} ${color.dim(detail)}`);
			}
			if (check.details.length > 5) {
				console.log(color.dim(`    ... and ${check.details.length - 5} more`));
			}
		}
	}
}

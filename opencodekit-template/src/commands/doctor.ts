import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
	type BeadsRuntimeCheck,
	getBeadsRuntimeHealthReport,
	getBridgeHealthReport,
} from "./bridge-diagnostics.js";
import {
	createMachineReadableDiagnosticsPayload,
	createUnificationDiagnosticCheck,
	DIAGNOSTIC_CODES,
	type MachineReadableDiagnosticsPayload,
	type UnificationDiagnosticCheck,
} from "./diagnostic-codes.js";
import {
	type CheckResult,
	collectDoctorSectionChecks,
	displayChecks,
} from "./doctor-checks.js";
import {
	createRuntimeStateRepairedCheck,
	repairRuntimeState,
} from "./runtime-state-repair.js";

export interface DoctorCommandOptions {
	repair?: string;
	json?: boolean;
	bead?: string;
}

export async function doctorCommand(options: DoctorCommandOptions = {}) {
	if (process.argv.includes("--quiet")) return;
	if (options.repair) {
		await runDoctorRepair(options);
		return;
	}

	const cwd = process.cwd();
	const opencodeDir = join(cwd, ".opencode");
	const bridgeHealth = getBridgeHealthReport(opencodeDir);
	const beadsRuntimeHealth = getBeadsRuntimeHealthReport({
		projectDir: cwd,
		opencodeDir,
	});
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
	const bridgeChecks = ensureHealthyBridgeChecks(bridgeHealth);
	const beadsRuntimeChecks =
		ensureHealthyBeadsRuntimeChecks(beadsRuntimeHealth);
	const doctorChecks = createDoctorContractChecks(
		opencodeDir,
		cwd,
		warnings,
		checks,
	);
	const allChecks = [...doctorChecks, ...bridgeChecks, ...beadsRuntimeChecks];
	const payload = createMachineReadableDiagnosticsPayload({
		surface: "doctor",
		mode: "health",
		checks: allChecks,
	});

	if (options.json) {
		console.log(JSON.stringify(payload, null, 2));
		process.exitCode = exitCodeForLevel(payload.level);
		return;
	}

	p.intro(color.bgBlue(color.white(" Doctor - Health Check ")));

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

async function runDoctorRepair(options: DoctorCommandOptions) {
	if (options.repair !== "runtime-state") {
		console.log(`Unknown doctor repair target: ${options.repair}`);
		process.exitCode = 1;
		return;
	}

	let result: ReturnType<typeof repairRuntimeState>;
	try {
		result = repairRuntimeState({
			projectDir: process.cwd(),
			beadId: options.bead,
		});
	} catch (error) {
		if (isRuntimeStateRepairResult(error)) {
			result = error;
		} else {
			throw error;
		}
	}

	const checks = [
		...result.diagnostics,
		...(result.level === "ERROR"
			? []
			: [createRuntimeStateRepairedCheck(result)]),
	];
	const payload = createMachineReadableDiagnosticsPayload({
		surface: "doctor",
		mode: "repair",
		checks,
		level: result.level,
	});

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					...payload,
					repair: {
						target: "runtime-state",
						beadId: result.beadId || null,
						boulderPath: result.boulderPath ?? null,
						restoredPlanPath: result.restoredPlanPath ?? null,
					},
				},
				null,
				2,
			),
		);
	} else {
		for (const diagnostic of result.diagnostics) {
			const icon =
				diagnostic.level === "ERROR" ? color.red("✗") : color.yellow("!");
			console.log(`  ${icon} ${diagnostic.code}: ${diagnostic.message}`);
			if (diagnostic.details) {
				for (const detail of diagnostic.details) {
					console.log(`    ${color.dim("→")} ${color.dim(detail)}`);
				}
			}
		}

		if (result.boulderPath) {
			console.log(
				`  ${color.green("✓")} Rebuilt runtime state: ${result.boulderPath}`,
			);
		}
		if (result.restoredPlanPath) {
			console.log(
				`  ${color.green("✓")} Restored working plan: ${result.restoredPlanPath}`,
			);
		}
	}

	process.exitCode = exitCodeForLevel(result.level);
}

function isRuntimeStateRepairResult(
	value: unknown,
): value is ReturnType<typeof repairRuntimeState> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		(candidate.level === "OK" ||
			candidate.level === "WARN" ||
			candidate.level === "ERROR") &&
		typeof candidate.beadId === "string" &&
		Array.isArray(candidate.diagnostics)
	);
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

function ensureHealthyBridgeChecks(
	bridgeHealth: ReturnType<typeof getBridgeHealthReport>,
): UnificationDiagnosticCheck[] {
	return bridgeHealth.diagnostics.length > 0
		? bridgeHealth.diagnostics
		: [
				createUnificationDiagnosticCheck({
					name: "bridge runtime registration",
					code: DIAGNOSTIC_CODES.OK,
					level: "OK",
					owner: "ock",
					canonicalStore: ".sisyphus",
					repairable: false,
					message: "BRIDGE OK: canonical OMO runtime registration detected",
				}),
			];
}

function ensureHealthyBeadsRuntimeChecks(
	beadsRuntimeHealth: ReturnType<typeof getBeadsRuntimeHealthReport>,
): BeadsRuntimeCheck[] {
	return beadsRuntimeHealth.checks;
}

function createDoctorContractChecks(
	opencodeDir: string,
	projectDir: string,
	warnings: CheckResult[],
	checks: CheckResult[],
): UnificationDiagnosticCheck[] {
	const contractChecks: UnificationDiagnosticCheck[] = [];

	for (const check of checks) {
		contractChecks.push(
			createUnificationDiagnosticCheck({
				name: check.name,
				code: check.ok ? DIAGNOSTIC_CODES.OK : DIAGNOSTIC_CODES.WRONG_SCOPE,
				level: check.ok ? "OK" : check.warn ? "WARN" : "ERROR",
				owner: "ock",
				canonicalStore: check.name.includes("Dependencies")
					? ".sisyphus"
					: "none",
				repairable: !check.ok,
				message: check.ok
					? `${check.name} OK`
					: check.fix
						? `${check.name} — ${check.fix}`
						: `${check.name} failed`,
				details: buildDoctorCheckDetails(check, opencodeDir, projectDir),
			}),
		);
	}

	for (const warning of warnings) {
		contractChecks.push(
			createUnificationDiagnosticCheck({
				name: warning.name,
				code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
				level: "WARN",
				owner: "ock",
				canonicalStore: "none",
				repairable: true,
				message: warning.name,
				details: warning.fix ? [warning.fix] : [],
			}),
		);
	}

	return contractChecks;
}

function buildDoctorCheckDetails(
	check: CheckResult,
	opencodeDir: string,
	projectDir: string,
): string[] {
	const details: string[] = [];
	if (check.fix) {
		details.push(check.fix);
	}

	if (check.name === ".opencode/ exists") {
		details.push(opencodeDir);
	}
	if (check.name === "opencode.json exists") {
		details.push(join(opencodeDir, "opencode.json"));
	}
	if (check.name === "package.json exists") {
		details.push(join(opencodeDir, "package.json"));
	}
	if (check.name === "Dependencies installed") {
		details.push(join(opencodeDir, "node_modules"));
	}
	if (check.name === "$schema reference") {
		details.push(join(opencodeDir, "opencode.json"));
	}
	if (check.name === "Model configured") {
		details.push(join(opencodeDir, "opencode.json"));
	}
	if (check.name.startsWith("Agent files")) {
		details.push(join(opencodeDir, "agent"));
	}
	if (check.name.startsWith("Skills")) {
		details.push(join(opencodeDir, "skill"));
	}
	if (check.name.startsWith("Custom tools")) {
		details.push(join(opencodeDir, "tool"));
	}
	if (check.name.startsWith("MCP servers")) {
		details.push(join(opencodeDir, "opencode.json"));
	}
	if (details.length === 0) {
		details.push(projectDir);
	}

	return details;
}

function exitCodeForLevel(level: MachineReadableDiagnosticsPayload["level"]) {
	return level === "ERROR" ? 1 : level === "WARN" ? 2 : 0;
}

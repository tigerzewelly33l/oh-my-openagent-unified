export const DIAGNOSTIC_CODES = {
	OK: "UNIFICATION_OK",
	REPAIRABLE_RUNTIME_STATE: "UNIFICATION_REPAIRABLE_RUNTIME_STATE",
	SPLIT_BRAIN: "UNIFICATION_SPLIT_BRAIN",
	SCHEMA_SKEW: "UNIFICATION_SCHEMA_SKEW",
	NAMESPACE_COLLISION: "UNIFICATION_NAMESPACE_COLLISION",
	MISSING_DURABLE_PLAN: "UNIFICATION_MISSING_DURABLE_PLAN",
	AMBIGUOUS_DURABLE_PLAN: "UNIFICATION_AMBIGUOUS_DURABLE_PLAN",
	WRONG_SCOPE: "UNIFICATION_WRONG_SCOPE",
	RUNTIME_REPAIRED: "UNIFICATION_RUNTIME_REPAIRED",
} as const;

export type UnificationDiagnosticCode =
	(typeof DIAGNOSTIC_CODES)[keyof typeof DIAGNOSTIC_CODES];

export type DiagnosticLevel = "OK" | "WARN" | "ERROR";
export type DiagnosticOwner = "ock" | "omo" | "br";
export type CanonicalStore = ".beads" | ".sisyphus" | "none";

export interface UnificationDiagnosticCheck {
	name: string;
	code: UnificationDiagnosticCode;
	level: DiagnosticLevel;
	owner: DiagnosticOwner;
	canonicalStore: CanonicalStore;
	repairable: boolean;
	message: string;
	details: string[];
}

export interface DiagnosticSummary {
	ok: number;
	warnings: number;
	errors: number;
}

export interface MachineReadableDiagnosticsPayload {
	surface: "status" | "doctor";
	mode: "health" | "repair";
	level: DiagnosticLevel;
	summary: DiagnosticSummary;
	checks: UnificationDiagnosticCheck[];
}

export function createUnificationDiagnosticCheck(
	check: Omit<UnificationDiagnosticCheck, "details"> & {
		details?: string[];
	},
): UnificationDiagnosticCheck {
	return {
		...check,
		details: check.details ?? [],
	};
}

export function summarizeDiagnosticLevels(
	checks: Pick<UnificationDiagnosticCheck, "level">[],
): DiagnosticSummary {
	return checks.reduce<DiagnosticSummary>(
		(summary, check) => {
			if (check.level === "ERROR") {
				summary.errors += 1;
			} else if (check.level === "WARN") {
				summary.warnings += 1;
			} else {
				summary.ok += 1;
			}

			return summary;
		},
		{ ok: 0, warnings: 0, errors: 0 },
	);
}

export function levelFromSummary(summary: DiagnosticSummary): DiagnosticLevel {
	if (summary.errors > 0) {
		return "ERROR";
	}

	return summary.warnings > 0 ? "WARN" : "OK";
}

export function createMachineReadableDiagnosticsPayload(
	args: Omit<MachineReadableDiagnosticsPayload, "summary" | "level"> & {
		summary?: DiagnosticSummary;
		level?: DiagnosticLevel;
	},
): MachineReadableDiagnosticsPayload {
	const summary = args.summary ?? summarizeDiagnosticLevels(args.checks);
	return {
		surface: args.surface,
		mode: args.mode,
		checks: args.checks,
		summary,
		level: args.level ?? levelFromSummary(summary),
	};
}

import type { UnificationDiagnosticCheck } from "./diagnostic-codes.js";

export type BeadsRuntimeHealthLevel = "OK" | "WARN" | "ERROR";

export interface BeadsRuntimeCheck extends UnificationDiagnosticCheck {}

export interface BeadsRuntimeHealthReport {
	level: BeadsRuntimeHealthLevel;
	checks: BeadsRuntimeCheck[];
}

export interface ManagedRuntimeConfig {
	experimental?: {
		beads_runtime?: boolean;
		task_system?: boolean;
	};
}

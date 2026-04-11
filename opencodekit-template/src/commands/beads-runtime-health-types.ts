export type BeadsRuntimeHealthLevel = "OK" | "WARN" | "ERROR";

export interface BeadsRuntimeCheck {
	name: string;
	level: BeadsRuntimeHealthLevel;
	message: string;
	details?: string[];
}

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

import { isOckBeadFirstProject } from "./ock-bead-first-project";

export interface TaskSystemConfig {
	experimental?: {
		task_system?: boolean;
	};
}

export function isTaskSystemEnabled(config: TaskSystemConfig): boolean {
	return config.experimental?.task_system ?? false;
}

export function isTaskSystemActiveForDirectory(
	config: TaskSystemConfig,
	directory?: string,
): boolean {
	if (!isTaskSystemEnabled(config)) {
		return false;
	}

	if (!directory) {
		return true;
	}

	return !isOckBeadFirstProject(directory);
}

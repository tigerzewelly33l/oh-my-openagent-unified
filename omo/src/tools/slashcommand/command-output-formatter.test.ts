import { describe, expect, it } from "bun:test";
import {
	formatCommandList,
	formatLoadedCommand,
} from "./command-output-formatter";
import type { CommandInfo } from "./types";

describe("command output formatter", () => {
	describe("#given command template includes argument placeholders", () => {
		it("#then replaces both placeholder forms", async () => {
			// given
			const command: CommandInfo = {
				name: "daplug:templated",
				metadata: {
					name: "daplug:templated",
					description: "Templated plugin command",
				},
				content: "Echo $ARGUMENTS and ${user_message}.",
				scope: "plugin",
			};

			// when
			const output = await formatLoadedCommand(command, "ship it");

			// then
			expect(output).toContain("Echo ship it and ship it.");
			expect(output).not.toContain("$ARGUMENTS");
			expect(output).not.toContain("${user_message}");
		});
	});

	describe("#given compatibility and workflow commands are listed together", () => {
		it("#then labels primary, support, and compatibility commands in the visible command list", () => {
			// given
			const items: CommandInfo[] = [
				{
					name: "create",
					metadata: {
						name: "create",
						description: "Create bead-backed work",
					},
					content: "Create work.",
					scope: "opencode-project",
				},
				{
					name: "verify",
					metadata: {
						name: "verify",
						description: "Verify bead-backed work",
					},
					content: "Verify work.",
					scope: "user",
				},
				{
					name: "lfg",
					metadata: {
						name: "lfg",
						description: "Compatibility full-cycle adapter",
					},
					content: "Run full compatibility workflow.",
					scope: "opencode-project",
				},
				{
					name: "compound",
					metadata: {
						name: "compound",
						description: "Compatibility adapter",
					},
					content: "Run compatibility flow.",
					scope: "opencode-project",
				},
			];

			// when
			const output = formatCommandList(items);

			// then
			expect(output).toContain(
				"**/create**: Create bead-backed work (opencode-project, primary workflow)",
			);
			expect(output).toContain(
				"**/verify**: Verify bead-backed work (user, workflow support)",
			);
			expect(output).toContain(
				"**/lfg**: Compatibility full-cycle adapter (opencode-project, compatibility adapter)",
			);
			expect(output).toContain(
				"**/compound**: Compatibility adapter (opencode-project, compatibility adapter)",
			);
		});

		it("#then marks loaded workflow-class commands with human-readable categories", async () => {
			// given
			const primaryCommand: CommandInfo = {
				name: "create",
				metadata: {
					name: "create",
					description: "Create bead-backed work",
				},
				content: "Create work.",
				scope: "opencode-project",
			};
			const supportCommand: CommandInfo = {
				name: "verify",
				metadata: {
					name: "verify",
					description: "Verify bead-backed work",
				},
				content: "Verify work.",
				scope: "user",
			};
			const lfgCompatibilityCommand: CommandInfo = {
				name: "lfg",
				metadata: {
					name: "lfg",
					description: "Compatibility full-cycle adapter",
				},
				content: "Run full compatibility workflow.",
				scope: "opencode-project",
			};
			const compatibilityCommand: CommandInfo = {
				name: "compound",
				metadata: {
					name: "compound",
					description: "Compatibility adapter",
				},
				content: "Run compatibility flow.",
				scope: "opencode-project",
			};

			// when
			const primaryOutput = await formatLoadedCommand(primaryCommand);
			const supportOutput = await formatLoadedCommand(supportCommand);
			const lfgCompatibilityOutput = await formatLoadedCommand(
				lfgCompatibilityCommand,
			);
			const compatibilityOutput =
				await formatLoadedCommand(compatibilityCommand);

			// then
			expect(primaryOutput).toContain("**Category**: primary workflow");
			expect(supportOutput).toContain("**Category**: workflow support");
			expect(lfgCompatibilityOutput).toContain(
				"**Category**: compatibility adapter",
			);
			expect(compatibilityOutput).toContain(
				"**Category**: compatibility adapter",
			);
		});
	});
});

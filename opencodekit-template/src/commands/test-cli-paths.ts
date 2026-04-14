import { fileURLToPath } from "node:url";

export const TSX_LOADER_PATH = fileURLToPath(
	new URL("../../node_modules/tsx/dist/loader.mjs", import.meta.url),
);

export const SOURCE_CLI_ENTRY_PATH = fileURLToPath(
	new URL("../index.ts", import.meta.url),
);

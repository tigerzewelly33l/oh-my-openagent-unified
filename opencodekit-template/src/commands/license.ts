import * as p from "@clack/prompts";
import color from "picocolors";
import {
	deactivateCurrentLicense,
	deleteStoredLicense,
	getLicenseFilePath,
	readStoredLicense,
	validateLicenseOnline,
} from "../utils/license.js";
import { captureHoneybadgerError } from "../utils/honeybadger-client.js";

export async function licenseCommand(action?: string): Promise<void> {
	const mode = (action ?? "status").trim();

	if (mode === "status") {
		await showLicenseStatus();
		return;
	}

	if (mode === "deactivate") {
		await deactivateLicense();
		return;
	}

	p.log.error(`Unknown action: ${mode}`);
	p.log.info(`Available: ${color.cyan("status")}, ${color.cyan("deactivate")}`);
}

async function showLicenseStatus(): Promise<void> {
	const stored = readStoredLicense();
	if (!stored) {
		p.log.warn("No license is currently activated");
		p.log.info(`Run ${color.cyan("ock activate <LICENSE_KEY>")}`);
		return;
	}

	p.log.info(color.bold("License Status"));
	console.log(`  key:          ${color.cyan(stored.key)}`);
	console.log(`  activation:   ${stored.activationId}`);
	console.log(`  machine:      ${stored.machineLabel}`);
	console.log(
		`  last check:   ${new Date(stored.lastValidatedAt * 1000).toISOString()}`,
	);
	console.log(
		`  next check:   ${new Date(stored.nextCheckAt * 1000).toISOString()}`,
	);
	console.log(`  file:         ${color.dim(getLicenseFilePath())}`);

	const spinner = p.spinner();
	spinner.start("Verifying with license server");

	try {
		await validateLicenseOnline(stored);
		spinner.stop("License is valid");
	} catch (error) {
		spinner.stop("Validation failed");
		await captureHoneybadgerError(error, {
			action: "license.status",
			awaitDelivery: true,
		});
		const message = error instanceof Error ? error.message : String(error);
		p.log.warn(message);
	}
}

async function deactivateLicense(): Promise<void> {
	const stored = readStoredLicense();
	if (!stored) {
		p.log.warn("No license is currently activated");
		return;
	}

	const confirm = await p.confirm({
		message: `Deactivate license ${stored.key} on this machine?`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		p.cancel("Cancelled");
		return;
	}

	const spinner = p.spinner();
	spinner.start("Deactivating license");

	try {
		await deactivateCurrentLicense(stored);
		spinner.stop("License deactivated");
		p.outro(color.green("This machine no longer uses the license"));
	} catch (error) {
		spinner.stop("Deactivation failed");
		await captureHoneybadgerError(error, {
			action: "license.deactivate",
			awaitDelivery: true,
		});
		const message = error instanceof Error ? error.message : String(error);
		p.log.warn(`Remote deactivation failed: ${message}`);

		const retry = await p.confirm({
			message: "Remove local license file anyway?",
			initialValue: false,
		});

		if (p.isCancel(retry) || !retry) {
			return;
		}

		deleteStoredLicense();
		p.log.info(`Removed local license at ${color.dim(getLicenseFilePath())}`);
	}
}

import * as p from "@clack/prompts";
import color from "picocolors";
import {
	activateLicenseKey,
	getLicenseFilePath,
	isLicenseKeyFormatValid,
} from "../utils/license.js";

export async function activateCommand(keyArg?: string): Promise<void> {
	p.intro(color.bgBlue(color.black(" License Activation ")));

	let key = keyArg?.trim();
	if (!key) {
		const answer = await p.text({
			message: "Enter your license key",
			placeholder: "OCK-XXXX-XXXX-XXXX",
			validate: (value) => {
				if (!value) return "License key is required";
				if (!isLicenseKeyFormatValid(value)) {
					return "Invalid format. Expected OCK-XXXX-XXXX-XXXX";
				}
				return undefined;
			},
		});

		if (p.isCancel(answer)) {
			p.cancel("Cancelled");
			return;
		}

		key = String(answer);
	}

	if (!isLicenseKeyFormatValid(key)) {
		p.log.error("Invalid license key format. Expected OCK-XXXX-XXXX-XXXX");
		return;
	}

	const spinner = p.spinner();
	spinner.start("Activating license");

	try {
		const stored = await activateLicenseKey(key);
		spinner.stop("License activated");
		p.log.success(`Activated ${color.cyan(stored.key)}`);
		p.log.info(`Stored at ${color.dim(getLicenseFilePath())}`);
		p.outro(color.green("Activation complete"));
	} catch (error) {
		spinner.stop("Activation failed");
		const message = error instanceof Error ? error.message : String(error);
		p.log.error(message);
	}
}

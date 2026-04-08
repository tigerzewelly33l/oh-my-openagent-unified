import { createHmac } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { hostname, platform, release } from "node:os";
import { dirname, join } from "node:path";
import envPaths from "env-paths";
import machineId from "node-machine-id";
import { z } from "zod";

const { machineIdSync } = machineId;

const LICENSE_API_BASE_URL =
	process.env.OCK_LICENSE_API_BASE_URL ??
	"https://payments-api.opencodekit.xyz";
const LICENSE_REQUEST_TIMEOUT_MS = 10_000;
// This is for local corruption detection (accidental edits / partial writes),
// not strong anti-tamper security. The client binary can always be inspected.
const LICENSE_HMAC_SECRET =
	process.env.OCK_LICENSE_HMAC_SECRET ?? "ock-license-v1-local-integrity";

const LICENSE_CHECK_INTERVAL_SECONDS = 7 * 24 * 60 * 60;
const LICENSE_OFFLINE_GRACE_SECONDS = 30 * 24 * 60 * 60;

export const LICENSE_KEY_PATTERN = /^OCK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export interface StoredLicense {
	key: string;
	activationId: string;
	machineId: string;
	machineLabel: string;
	activatedAt: number;
	lastValidatedAt: number;
	nextCheckAt: number;
	hmac: string;
}

const StoredLicenseSchema = z.object({
	key: z.string(),
	activationId: z.string(),
	machineId: z.string(),
	machineLabel: z.string(),
	activatedAt: z.number(),
	lastValidatedAt: z.number(),
	nextCheckAt: z.number(),
	hmac: z.string(),
});

interface StoredLicensePayload {
	key: string;
	activationId: string;
	machineId: string;
	machineLabel: string;
	activatedAt: number;
	lastValidatedAt: number;
	nextCheckAt: number;
}

interface ActivateResponse {
	ok: boolean;
	activation_id?: string;
	message?: string;
	error?: string;
}

interface ValidateResponse {
	ok: boolean;
	message?: string;
	error?: string;
}

interface DeactivateResponse {
	ok: boolean;
	message?: string;
	error?: string;
}

function unixNow(): number {
	return Math.floor(Date.now() / 1000);
}

function getLicensePaths() {
	const paths = envPaths("opencodekit", { suffix: "" });
	return {
		dir: join(paths.data, "license"),
		file: join(paths.data, "license", "license.json"),
	};
}

function toSign(payload: StoredLicensePayload): string {
	return [
		payload.key,
		payload.activationId,
		payload.machineId,
		payload.machineLabel,
		payload.activatedAt,
		payload.lastValidatedAt,
		payload.nextCheckAt,
	].join("|");
}

function computeHmac(payload: StoredLicensePayload): string {
	return createHmac("sha256", LICENSE_HMAC_SECRET)
		.update(toSign(payload), "utf8")
		.digest("hex");
}

export function getMachineId(): string {
	return machineIdSync(false);
}

export function getMachineLabel(): string {
	return `${hostname()} (${platform()} ${release()})`;
}

export function getLicenseFilePath(): string {
	return getLicensePaths().file;
}

export function readStoredLicense(): StoredLicense | null {
	const { file } = getLicensePaths();
	if (!existsSync(file)) return null;

	try {
		const raw = readFileSync(file, "utf8");
		const parsed = StoredLicenseSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) return null;
		return parsed.data;
	} catch {
		return null;
	}
}

export function deleteStoredLicense(): void {
	const { file } = getLicensePaths();
	if (!existsSync(file)) return;
	rmSync(file, { force: true });
}

export function isLicenseBypassEnabled(): boolean {
	return process.env.OCK_LICENSE_BYPASS === "1";
}

export function isLicenseKeyFormatValid(key: string): boolean {
	return LICENSE_KEY_PATTERN.test(key.trim().toUpperCase());
}

export function isStoredLicenseIntegrityValid(stored: StoredLicense): boolean {
	const payload: StoredLicensePayload = {
		key: stored.key,
		activationId: stored.activationId,
		machineId: stored.machineId,
		machineLabel: stored.machineLabel,
		activatedAt: stored.activatedAt,
		lastValidatedAt: stored.lastValidatedAt,
		nextCheckAt: stored.nextCheckAt,
	};

	return computeHmac(payload) === stored.hmac;
}

function writeStoredLicense(payload: StoredLicensePayload): StoredLicense {
	const { dir, file } = getLicensePaths();
	mkdirSync(dir, { recursive: true });

	const stored: StoredLicense = {
		...payload,
		hmac: computeHmac(payload),
	};

	writeFileSync(file, `${JSON.stringify(stored, null, 2)}\n`, "utf8");
	return stored;
}

async function postJson<T>(
	path: string,
	body: Record<string, unknown>,
): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${LICENSE_API_BASE_URL}${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(LICENSE_REQUEST_TIMEOUT_MS),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`License server request failed: ${message}`);
	}

	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new Error(
			`License server returned invalid JSON (${response.status})`,
		);
	}

	if (!response.ok) {
		const maybe = data as { message?: string };
		throw new Error(
			maybe?.message ||
				`License server request failed with status ${response.status}`,
		);
	}

	return data as T;
}

export async function activateLicenseKey(key: string): Promise<StoredLicense> {
	const normalizedKey = key.trim().toUpperCase();
	const machineId = getMachineId();
	const machineLabel = getMachineLabel();
	const now = unixNow();

	const data = await postJson<ActivateResponse>("/v1/activate", {
		key: normalizedKey,
		machine_id: machineId,
		machine_label: machineLabel,
	});

	if (!data.ok || !data.activation_id) {
		throw new Error(data.message || data.error || "License activation failed");
	}

	return writeStoredLicense({
		key: normalizedKey,
		activationId: data.activation_id,
		machineId,
		machineLabel,
		activatedAt: now,
		lastValidatedAt: now,
		nextCheckAt: now + LICENSE_CHECK_INTERVAL_SECONDS,
	});
}

export async function validateLicenseOnline(
	stored: StoredLicense,
): Promise<void> {
	const machineId = getMachineId();

	if (machineId !== stored.machineId) {
		throw new Error("License key is activated on a different machine");
	}

	const data = await postJson<ValidateResponse>("/v1/validate", {
		key: stored.key,
		activation_id: stored.activationId,
		machine_id: stored.machineId,
	});

	if (!data.ok) {
		throw new Error(data.message || data.error || "License validation failed");
	}

	const now = unixNow();
	writeStoredLicense({
		key: stored.key,
		activationId: stored.activationId,
		machineId: stored.machineId,
		machineLabel: stored.machineLabel,
		activatedAt: stored.activatedAt,
		lastValidatedAt: now,
		nextCheckAt: now + LICENSE_CHECK_INTERVAL_SECONDS,
	});
}

export async function deactivateCurrentLicense(
	stored: StoredLicense,
): Promise<void> {
	const data = await postJson<DeactivateResponse>("/v1/deactivate", {
		key: stored.key,
		activation_id: stored.activationId,
		machine_id: stored.machineId,
	});

	if (!data.ok) {
		throw new Error(
			data.message || data.error || "License deactivation failed",
		);
	}

	deleteStoredLicense();
}

export async function requireValidLicense(): Promise<{
	mode: "active" | "offline-grace" | "bypass";
	stored: StoredLicense | null;
}> {
	if (isLicenseBypassEnabled()) {
		return { mode: "bypass", stored: null };
	}

	const stored = readStoredLicense();
	if (!stored) {
		throw new Error("License not activated. Run: ock activate <LICENSE_KEY>");
	}

	if (!isStoredLicenseIntegrityValid(stored)) {
		throw new Error(
			`License file integrity check failed (${dirname(getLicenseFilePath())}). Re-activate with: ock activate <LICENSE_KEY>`,
		);
	}

	if (stored.machineId !== getMachineId()) {
		throw new Error(
			"License is tied to a different machine. Run: ock activate <LICENSE_KEY>",
		);
	}

	const now = unixNow();
	if (stored.nextCheckAt > now) {
		return { mode: "active", stored };
	}

	try {
		await validateLicenseOnline(stored);
		return { mode: "active", stored: readStoredLicense() };
	} catch (error) {
		const age = now - stored.lastValidatedAt;
		if (age <= LICENSE_OFFLINE_GRACE_SECONDS) {
			return { mode: "offline-grace", stored };
		}

		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`License validation failed: ${message}`);
	}
}

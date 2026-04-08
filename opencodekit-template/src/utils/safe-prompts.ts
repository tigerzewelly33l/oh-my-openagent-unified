import { createInterface } from "node:readline";
import picocolors from "picocolors";

/**
 * Simple readline-based prompts without unicode rendering issues
 */

export function intro(message: string): void {
  console.log();
  console.log(picocolors.cyan(`> ${message}`));
  console.log();
}

export function outro(message: string): void {
  console.log();
  console.log(picocolors.green(`[OK] ${message}`));
  console.log();
}

export function note(message: string, title?: string): void {
  console.log();
  if (title) {
    console.log(picocolors.cyan(`${title}:`));
    console.log();
  }
  const lines = message.split("\n");
  for (const line of lines) {
    console.log(`  ${line}`);
  }
  console.log();
}

export async function text(options: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
}): Promise<string | symbol> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = options.placeholder || options.defaultValue || "";
    const message = `${options.message}${prompt ? ` [${prompt}]` : ""}: `;

    rl.question(message, (answer) => {
      rl.close();
      const result = answer.trim() || options.defaultValue || "";
      resolve(result);
    });
  });
}

export async function confirm(options: { message: string }): Promise<boolean | symbol> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${options.message} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

export async function select(options: {
  message: string;
  options: Array<{ value: string; label: string }>;
}): Promise<string | symbol> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log();
    console.log(options.message);
    options.options.forEach((opt, idx) => {
      console.log(`  ${idx + 1}. ${opt.label}`);
    });

    rl.question("\nEnter number: ", (answer) => {
      rl.close();
      const idx = Number.parseInt(answer, 10) - 1;
      if (idx >= 0 && idx < options.options.length) {
        resolve(options.options[idx].value);
      } else {
        resolve(options.options[0].value);
      }
    });
  });
}

export function isCancel(): boolean {
  return false;
}

import * as readline from "node:readline";

export type KeyHandler = (key: string, ctrl: boolean) => void;

export interface KeyboardController {
  start: (handler: KeyHandler) => void;
  stop: () => void;
}

/**
 * Creates a keyboard controller for handling arrow keys and other inputs.
 * Uses readline in raw mode to capture individual keypresses.
 */
export function createKeyboardController(): KeyboardController {
  let rl: readline.Interface | null = null;
  let handler: KeyHandler | null = null;

  const keyListener = (_: string, key: readline.Key) => {
    if (!handler) return;

    const ctrl = key.ctrl ?? false;

    // Handle special keys
    if (key.name === "up") handler("up", ctrl);
    else if (key.name === "down") handler("down", ctrl);
    else if (key.name === "left") handler("left", ctrl);
    else if (key.name === "right") handler("right", ctrl);
    else if (key.name === "return") handler("enter", ctrl);
    else if (key.name === "escape") handler("escape", ctrl);
    else if (key.name === "backspace") handler("backspace", ctrl);
    else if (key.name === "tab") handler("tab", ctrl);
    else if (key.name === "c" && ctrl) handler("quit", ctrl);
    else if (key.sequence) handler(key.sequence, ctrl);
  };

  return {
    start(h: KeyHandler) {
      handler = h;

      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      readline.emitKeypressEvents(process.stdin);
      process.stdin.on("keypress", keyListener);
    },

    stop() {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener("keypress", keyListener);
      if (rl) {
        rl.close();
        rl = null;
      }
      handler = null;
    },
  };
}

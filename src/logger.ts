const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
} as const;

const useColor = process.stderr.isTTY && process.env["NO_COLOR"] === undefined;

function paint(color: keyof typeof ANSI, s: string): string {
  return useColor ? `${ANSI[color]}${s}${ANSI.reset}` : s;
}

function write(line: string): void {
  process.stderr.write(`${line}\n`);
}

export const log = {
  info: (msg: string): void => {
    write(`  ${paint("cyan", "i")}  ${msg}`);
  },
  success: (msg: string): void => {
    write(`  ${paint("green", "+")}  ${msg}`);
  },
  warn: (msg: string): void => {
    write(`  ${paint("yellow", "!")}  ${msg}`);
  },
  error: (msg: string): void => {
    write(`  ${paint("red", "x")}  ${msg}`);
  },
  raw: (msg: string): void => {
    write(msg);
  },
  header: (title: string): void => {
    const bar = "+======================================+";
    write("");
    write(`  ${paint("bold", paint("cyan", bar))}`);
    write(`  ${paint("bold", paint("cyan", `|  ${title.padEnd(36)}|`))}`);
    write(`  ${paint("bold", paint("cyan", bar))}`);
    write("");
  },
};

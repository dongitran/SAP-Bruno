/* eslint-disable no-console */
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
} as const;

export const log = {
  info: (msg: string): void => {
    console.log(`  ${ANSI.cyan}i${ANSI.reset}  ${msg}`);
  },
  success: (msg: string): void => {
    console.log(`  ${ANSI.green}+${ANSI.reset}  ${msg}`);
  },
  warn: (msg: string): void => {
    console.warn(`  ${ANSI.yellow}!${ANSI.reset}  ${msg}`);
  },
  error: (msg: string): void => {
    console.error(`  ${ANSI.red}x${ANSI.reset}  ${msg}`);
  },
  raw: (msg: string): void => {
    console.log(msg);
  },
  header: (title: string): void => {
    const bar = "+======================================+";
    console.log(`\n  ${ANSI.bold}${ANSI.cyan}${bar}${ANSI.reset}`);
    console.log(`  ${ANSI.bold}${ANSI.cyan}|  ${title.padEnd(36)}|${ANSI.reset}`);
    console.log(`  ${ANSI.bold}${ANSI.cyan}${bar}${ANSI.reset}\n`);
  },
};

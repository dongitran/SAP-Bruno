import { spawn } from "node:child_process";
import { readFile, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { log } from "./logger.js";

interface RunOptions {
  collectionsDir: string;
  target: string;
  envName?: string;
  reportPath?: string;
}

export interface RunResult {
  exitCode: number;
  reportPath?: string;
}

export async function runBru(opts: RunOptions): Promise<RunResult> {
  const target = opts.target;
  const fullPath = join(opts.collectionsDir, target);
  const isDir = await isDirectory(fullPath);
  const reportPath =
    opts.reportPath ?? join(tmpdir(), `sapbruno-report-${process.pid.toString()}.json`);

  if (!(await hasBruCli())) {
    log.error(
      "bru CLI not found. Install it in this project: pnpm add -D @usebruno/cli (or: npm i -D @usebruno/cli).",
    );
    return { exitCode: 127 };
  }

  const args: string[] = ["run", target];
  if (isDir) args.push("-r");
  if (opts.envName) args.push("--env-file", `environments/${opts.envName}.bru`);
  args.push("--reporter-json", reportPath);

  log.info(`bru ${args.join(" ")}`);
  log.raw("");

  const exitCode = await new Promise<number>((resolveExit) => {
    const child = spawn("bru", args, {
      cwd: opts.collectionsDir,
      stdio: "inherit",
    });
    child.on("close", (code) => {
      resolveExit(code ?? 1);
    });
    child.on("error", (err) => {
      log.error(`Failed to spawn 'bru': ${err.message}`);
      resolveExit(127);
    });
  });

  await printReport(reportPath);
  return { exitCode, reportPath };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function hasBruCli(): Promise<boolean> {
  return new Promise((resolveCheck) => {
    const probe = spawn("bru", ["--version"], { stdio: "ignore" });
    probe.on("error", () => {
      resolveCheck(false);
    });
    probe.on("close", (code) => {
      resolveCheck(code === 0);
    });
  });
}

interface BruReport {
  results?: BruResult[];
}
interface BruResult {
  test?: { filename?: string };
  response?: { status?: number; statusText?: string; data?: unknown };
}

async function printReport(reportPath: string): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(reportPath, "utf8");
  } catch {
    return;
  }
  log.raw("");
  log.raw("------------------------------------------");
  let parsed: BruReport[] | BruReport;
  try {
    parsed = JSON.parse(raw) as BruReport[] | BruReport;
  } catch {
    log.warn("Could not parse JSON report");
    return;
  }
  const reports = Array.isArray(parsed) ? parsed : [parsed];
  for (const r of reports) {
    for (const result of r.results ?? []) {
      const filename = result.test?.filename ?? "?";
      const status = result.response?.status ?? "?";
      const statusText = result.response?.statusText ?? "";
      log.raw(`  ${filename}  [${status.toString()} ${statusText}]`);
    }
  }
  await unlink(reportPath).catch(() => undefined);
}

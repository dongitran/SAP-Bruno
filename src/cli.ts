#!/usr/bin/env node
import { Command } from "commander";

import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { runTui } from "./tui/index.js";

const program = new Command();

program
  .name("sapbruno")
  .description("Interactive TUI runner for Bruno collections with OAuth2 auto-fetch.")
  .version("0.1.0");

program
  .command("run", { isDefault: true })
  .description("Launch interactive TUI runner")
  .action(async () => {
    try {
      const loaded = await loadConfig();
      await runTui(loaded);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("token")
  .description("Fetch OAuth token for a prefix without running tests")
  .requiredOption("--env <env>", "Environment name")
  .requiredOption("--prefix <prefix>", "Service prefix (e.g. com_app_demo)")
  .action(() => {
    log.warn("token subcommand: not yet implemented in v0.1");
  });

void program.parseAsync(process.argv);

function handleError(err: unknown): never {
  if (err instanceof Error) {
    log.error(err.message);
  } else {
    log.error(String(err));
  }
  process.exit(1);
}

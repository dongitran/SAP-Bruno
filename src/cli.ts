#!/usr/bin/env node
import { join } from "node:path";

import { Command } from "commander";

import { upsertEnvVars } from "./bru.js";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { bearerHeader, fetchClientCredentialsToken } from "./oauth.js";
import { buildProvider } from "./providers/index.js";
import { runTui } from "./tui/index.js";

const program = new Command();

program
  .name("sapbruno")
  .description("Interactive TUI runner for Bruno collections with OAuth2 auto-fetch.")
  .version("0.1.1");

program
  .command("run", { isDefault: true })
  .description("Launch interactive TUI runner")
  .option("--no-loop", "Exit after a single run (no 'Run another?' prompt)")
  .action(async (opts: { loop?: boolean }) => {
    try {
      const loaded = await loadConfig();
      const exit = await runTui(loaded, { loop: opts.loop ?? true });
      process.exit(exit);
    } catch (err) {
      handleError(err);
    }
  });

program
  .command("token")
  .description("Fetch OAuth token for a prefix and inject it into the env file")
  .requiredOption("--env <env>", "Environment name")
  .requiredOption("--prefix <prefix>", "Service prefix (e.g. com_app_demo)")
  .option("--print", "Print token to stdout instead of writing to env file")
  .action(async (opts: { env: string; prefix: string; print?: boolean }) => {
    try {
      const loaded = await loadConfig();
      const envCfg = loaded.config.environments[opts.env];
      if (!envCfg) {
        throw new Error(`Environment '${opts.env}' not configured in sapbruno.config.json`);
      }
      if (envCfg.auth.type !== "oauth2-client-credentials") {
        throw new Error(
          `Environment '${opts.env}' uses auth type '${envCfg.auth.type}', not 'oauth2-client-credentials'.`,
        );
      }
      const provider = await buildProvider(envCfg.credentialProvider, loaded.rootDir);
      if (!provider) {
        throw new Error(`No credentialProvider configured for env '${opts.env}'.`);
      }
      log.info(`Fetching access token (${opts.prefix})...`);
      const creds = await provider.fetch(opts.prefix, {
        rootDir: loaded.rootDir,
        envName: opts.env,
      });
      const token = await fetchClientCredentialsToken(creds);
      if (opts.print) {
        process.stdout.write(`${token.access_token}\n`);
        return;
      }
      const envFile = join(loaded.config.collections, "environments", `${opts.env}.bru`);
      await upsertEnvVars(envFile, {
        [`${opts.prefix}_oauth_token_url`]: creds.tokenUrl,
        [`${opts.prefix}_oauth_client_id`]: creds.clientId,
        [`${opts.prefix}_oauth_client_secret`]: creds.clientSecret,
        [`${opts.prefix}_auth_header`]: bearerHeader(token.access_token),
      });
      log.success(`Token written -> ${opts.prefix}_auth_header in ${envFile}`);
    } catch (err) {
      handleError(err);
    }
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

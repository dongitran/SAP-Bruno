import { basename, join, relative } from "node:path";

import { confirm, select } from "@inquirer/prompts";

import { loadLocalUsers } from "../basic-auth.js";
import { upsertEnvVars } from "../bru.js";
import { calcPrefix, findServices, listBruFiles, listGroups, listSuites } from "../collections.js";
import { type LoadedConfig } from "../config.js";
import { log } from "../logger.js";
import { basicHeader, bearerHeader, fetchClientCredentialsToken } from "../oauth.js";
import { buildProvider } from "../providers/index.js";
import { runBru } from "../runner.js";

export interface RunTuiOptions {
  loop?: boolean;
}

export async function runTui(loaded: LoadedConfig, opts: RunTuiOptions = {}): Promise<number> {
  const { config, rootDir } = loaded;
  log.header("SAPBruno API Runner");

  let lastExit = 0;

  // Environment is selected once — most users stay in one env for a full session.
  const envName = await selectEnvironment(loaded);
  if (envName === undefined) return 0;
  const envCfg = config.environments[envName];
  if (!envCfg) {
    log.error(`Environment '${envName}' not configured in sapbruno.config.json`);
    return 1;
  }

  const doLoop = opts.loop ?? true;
  for (;;) {
    try {
      lastExit = await runOnce({ loaded, envName, envCfg, rootDir });
    } catch (err) {
      if (isPromptCancellation(err)) {
        log.warn("Cancelled.");
        return lastExit;
      }
      throw err;
    }
    if (!doLoop) break;
    let again: boolean;
    try {
      again = await confirm({ message: "Run another test?", default: true });
    } catch (err) {
      if (isPromptCancellation(err)) return lastExit;
      throw err;
    }
    if (!again) break;
  }

  return lastExit;
}

interface RunOnceArgs {
  loaded: LoadedConfig;
  envName: string;
  envCfg: LoadedConfig["config"]["environments"][string];
  rootDir: string;
}

async function runOnce(args: RunOnceArgs): Promise<number> {
  const { loaded, envName, envCfg, rootDir } = args;
  const { config } = loaded;

  let basicAuth: { user: string; pass: string } | undefined;
  if (envCfg.auth.type === "basic") {
    const usersFile = resolveRel(rootDir, envCfg.auth.usersFile);
    const users = await loadLocalUsers(usersFile);
    if (users.length === 0) {
      log.warn(`No users found in ${usersFile}`);
      return 1;
    }
    const userLabel = await select({
      message: "Mock user:",
      choices: users.map((u) => ({ name: u.label, value: u.label })),
    });
    const u = users.find((x) => x.label === userLabel);
    if (!u) return 1;
    basicAuth = { user: u.email, pass: u.password };
    await upsertEnvVars(envFilePath(config.collections, envName), {
      basic_auth_username: u.email,
      basic_auth_password: u.password,
    });
  }

  const groups = await listGroups(config.collections, config.ignore);
  if (groups.length === 0) {
    log.error(`No groups found in ${config.collections}`);
    return 1;
  }
  const group = await select({
    message: "Group:",
    choices: groups.map((g) => ({ name: g, value: g })),
  });

  const groupDir = join(config.collections, group);
  const services = await findServices(groupDir);
  if (services.length === 0) {
    log.warn(`No services in ${group}`);
    return 1;
  }

  const serviceRel = await select({
    message: "Service:",
    choices: services.map((s) => ({
      name: `${s.module} / ${basename(s.serviceRel)}`,
      value: s.serviceRel,
    })),
  });

  const serviceDir = join(groupDir, serviceRel);
  const serviceFolder = basename(serviceRel);
  const prefix = calcPrefix(group, serviceFolder, config.prefixStrip);

  const suites = await listSuites(serviceDir);
  const suiteChoices = [
    { name: "> Run entire service", value: "__all__" },
    ...suites.map((s) => ({ name: s, value: s })),
  ];
  const suiteSel = await select({ message: "Test suite:", choices: suiteChoices });

  let target: string;
  if (suiteSel === "__all__") {
    target = `${group}/${serviceRel}`;
  } else {
    const suiteDir = join(serviceDir, suiteSel);
    const files = await listBruFiles(suiteDir);
    const fileChoices = [
      { name: "> Run entire suite", value: "__all__" },
      ...files.map((f) => ({ name: basename(f).replace(/\.bru$/, ""), value: f })),
    ];
    const fileSel = await select({
      message: `Test file (${suiteSel}):`,
      choices: fileChoices,
    });
    target =
      fileSel === "__all__"
        ? `${group}/${serviceRel}/${suiteSel}`
        : `${group}/${relative(config.collections, fileSel)}`;
  }

  await injectAuth({ envName, envCfg, prefix, basicAuth, loaded });

  const result = await runBru({
    collectionsDir: config.collections,
    target,
    envName,
  });

  if (result.exitCode === 0) {
    log.success(`Done (exit ${result.exitCode.toString()})`);
  } else {
    log.warn(`bru exited with ${result.exitCode.toString()}`);
  }
  return result.exitCode;
}

interface InjectAuthArgs {
  envName: string;
  envCfg: LoadedConfig["config"]["environments"][string];
  prefix: string;
  basicAuth: { user: string; pass: string } | undefined;
  loaded: LoadedConfig;
}

async function injectAuth(args: InjectAuthArgs): Promise<void> {
  const envFile = envFilePath(args.loaded.config.collections, args.envName);

  if (args.envCfg.auth.type === "basic" && args.basicAuth) {
    await upsertEnvVars(envFile, {
      [`${args.prefix}_auth_header`]: basicHeader(args.basicAuth.user, args.basicAuth.pass),
    });
    return;
  }

  if (args.envCfg.auth.type === "oauth2-client-credentials") {
    const provider = await buildProvider(args.envCfg.credentialProvider, args.loaded.rootDir);
    if (!provider) {
      log.warn(`No credentialProvider configured for env '${args.envName}'`);
      return;
    }
    log.info(`Fetching access token (${args.prefix})...`);
    const creds = await provider.fetch(args.prefix, {
      rootDir: args.loaded.rootDir,
      envName: args.envName,
    });
    const token = await fetchClientCredentialsToken(creds);
    await upsertEnvVars(envFile, {
      [`${args.prefix}_oauth_token_url`]: creds.tokenUrl,
      [`${args.prefix}_oauth_client_id`]: creds.clientId,
      [`${args.prefix}_oauth_client_secret`]: creds.clientSecret,
      [`${args.prefix}_auth_header`]: bearerHeader(token.access_token),
    });
    log.success(`Token stored -> ${args.prefix}_auth_header`);
  }
}

async function selectEnvironment(loaded: LoadedConfig): Promise<string | undefined> {
  const envs = Object.keys(loaded.config.environments);
  if (envs.length === 0) {
    log.error("No environments configured. Add an 'environments' block to sapbruno.config.json.");
    return undefined;
  }
  if (envs.length === 1) return envs[0];
  return select({
    message: "Environment:",
    choices: envs.map((e) => ({ name: e, value: e })),
  });
}

function envFilePath(collectionsDir: string, envName: string): string {
  return join(collectionsDir, "environments", `${envName}.bru`);
}

function resolveRel(rootDir: string, p: string): string {
  return p.startsWith("/") ? p : join(rootDir, p);
}

function isPromptCancellation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // @inquirer/prompts throws ExitPromptError on Ctrl+C.
  return err.name === "ExitPromptError" || err.message.includes("force closed");
}

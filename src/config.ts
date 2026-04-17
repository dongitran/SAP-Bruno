import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import { z } from "zod";

const oauthClientCredentialsSchema = z.object({
  type: z.literal("oauth2-client-credentials"),
});

const basicAuthSchema = z.object({
  type: z.literal("basic"),
  usersFile: z.string(),
});

const noAuthSchema = z.object({
  type: z.literal("none"),
});

const authSchema = z.discriminatedUnion("type", [
  oauthClientCredentialsSchema,
  basicAuthSchema,
  noAuthSchema,
]);

const envProviderSchema = z.object({
  type: z.literal("env"),
  tokenUrl: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  baseUrl: z.string().optional(),
});

const fileProviderSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
});

const manualProviderSchema = z.object({
  type: z.literal("manual"),
});

const customProviderSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

const providerSchema = z.union([
  envProviderSchema,
  fileProviderSchema,
  manualProviderSchema,
  customProviderSchema,
]);

const environmentSchema = z.object({
  auth: authSchema,
  credentialProvider: providerSchema.optional(),
});

export const configSchema = z.object({
  collections: z.string().default("./collections"),
  ignore: z.array(z.string()).default([]),
  environments: z.record(z.string(), environmentSchema).default({}),
  prefixStrip: z.string().optional(),
});

export type SapBrunoConfig = z.infer<typeof configSchema>;
export type EnvironmentConfig = z.infer<typeof environmentSchema>;
export type AuthConfig = z.infer<typeof authSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;

export interface LoadedConfig {
  config: SapBrunoConfig;
  configPath: string;
  rootDir: string;
}

const CONFIG_FILENAME = "sapbruno.config.json";

export async function loadConfig(cwd: string = process.cwd()): Promise<LoadedConfig> {
  const configPath = resolve(cwd, CONFIG_FILENAME);
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`${CONFIG_FILENAME} not found at ${configPath}`, { cause: err });
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${CONFIG_FILENAME}: ${(err as Error).message}`, {
      cause: err,
    });
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid ${CONFIG_FILENAME}:\n${result.error.message}`);
  }

  const rootDir = dirname(configPath);
  const config: SapBrunoConfig = {
    ...result.data,
    collections: resolveRelative(rootDir, result.data.collections),
  };
  return { config, configPath, rootDir };
}

export function resolveRelative(rootDir: string, path: string): string {
  return isAbsolute(path) ? path : resolve(rootDir, path);
}

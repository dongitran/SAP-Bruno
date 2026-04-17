import { pathToFileURL } from "node:url";

import { z } from "zod";

import { resolveRelative } from "../config.js";

import { envProvider } from "./env.js";
import { fileProvider } from "./file.js";
import { manualProvider } from "./manual.js";

import type { ProviderConfig } from "../config.js";
import type { CredentialProvider } from "./index.js";

const envProviderConfigSchema = z.object({
  type: z.literal("env"),
  tokenUrl: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
});

const fileProviderConfigSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
});

const customProviderConfigSchema = z
  .object({
    type: z.string(),
    module: z.string().optional(),
    factory: z.string().optional(),
  })
  .passthrough();

export async function buildProvider(
  cfg: ProviderConfig | undefined,
  rootDir: string,
): Promise<CredentialProvider | undefined> {
  if (!cfg) return undefined;

  switch (cfg.type) {
    case "env":
      return envProvider(envProviderConfigSchema.parse(cfg));
    case "file":
      return fileProvider(fileProviderConfigSchema.parse(cfg));
    case "manual":
      return manualProvider();
    default:
      return loadCustomProvider(customProviderConfigSchema.parse(cfg), rootDir);
  }
}

type ProviderFactory = (config: unknown) => unknown;

async function loadCustomProvider(
  cfg: z.infer<typeof customProviderConfigSchema>,
  rootDir: string,
): Promise<CredentialProvider> {
  const moduleSpec = cfg.module ?? cfg.type;
  const factoryName = cfg.factory ?? defaultFactoryName(cfg.type);

  const spec =
    moduleSpec.startsWith(".") || moduleSpec.startsWith("/")
      ? pathToFileURL(resolveRelative(rootDir, moduleSpec)).href
      : moduleSpec;

  let mod: Record<string, unknown>;
  try {
    mod = (await import(spec)) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Failed to load credential provider module '${moduleSpec}': ${(err as Error).message}`,
      { cause: err },
    );
  }

  const factory = mod[factoryName] ?? mod["default"];
  if (typeof factory !== "function") {
    throw new Error(
      `Credential provider module '${moduleSpec}' does not export '${factoryName}' as a function.`,
    );
  }

  const provider = await (factory as ProviderFactory)(cfg);
  if (!isCredentialProvider(provider)) {
    throw new Error(
      `Credential provider factory '${factoryName}' in '${moduleSpec}' did not return a valid CredentialProvider.`,
    );
  }
  return provider;
}

function isCredentialProvider(value: unknown): value is CredentialProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { fetch?: unknown }).fetch === "function"
  );
}

function defaultFactoryName(type: string): string {
  const camel = type.replace(/[-_/@]+(\w)/g, (_, ch: string) => ch.toUpperCase());
  return `${camel}Provider`;
}

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import bruLang from "@usebruno/lang";

interface BruEnvVar {
  name: string;
  value: string;
  enabled?: boolean;
  secret?: boolean;
}

interface BruEnvJson {
  variables?: BruEnvVar[];
  secretVariables?: BruEnvVar[];
}

interface BruLang {
  bruToJsonV2?: (text: string) => unknown;
  jsonToBruV2?: (json: unknown) => string;
  envToJsonV2?: (text: string) => unknown;
  jsonToEnvV2?: (json: unknown) => string;
  bruToEnvJsonV2?: (text: string) => unknown;
  envJsonToBruV2?: (json: unknown) => string;
}

const lang = bruLang as BruLang;

function pickFn<T extends keyof BruLang>(...names: T[]): BruLang[T] {
  for (const n of names) {
    const fn = lang[n];
    if (typeof fn === "function") return fn;
  }
  throw new Error(
    `@usebruno/lang missing expected function. Tried: ${names.join(", ")}. Installed version may be incompatible.`,
  );
}

const parseEnv = pickFn("bruToEnvJsonV2", "envToJsonV2") as (t: string) => BruEnvJson;
const serializeEnv = pickFn("envJsonToBruV2", "jsonToEnvV2") as (j: BruEnvJson) => string;

export async function readEnvFile(path: string): Promise<BruEnvJson> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { variables: [] };
    }
    throw err;
  }
  if (text.trim() === "") return { variables: [] };
  return parseEnv(text);
}

export async function writeEnvFile(path: string, data: BruEnvJson): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const text = serializeEnv(data);
  await writeFile(path, text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

export async function upsertEnvVars(path: string, updates: Record<string, string>): Promise<void> {
  const json = await readEnvFile(path);
  const variables = json.variables ?? [];
  for (const [name, value] of Object.entries(updates)) {
    const existing = variables.find((v) => v.name === name);
    if (existing) {
      existing.value = value;
      existing.enabled = true;
    } else {
      variables.push({ name, value, enabled: true, secret: false });
    }
  }
  await writeEnvFile(path, { ...json, variables });
}

export async function readEnvVar(path: string, name: string): Promise<string | undefined> {
  const json = await readEnvFile(path);
  return json.variables?.find((v) => v.name === name)?.value;
}

export async function listConfiguredPrefixes(path: string, suffix: string): Promise<string[]> {
  const json = await readEnvFile(path);
  const names = (json.variables ?? []).map((v) => v.name);
  const prefixes = new Set<string>();
  for (const name of names) {
    if (name.endsWith(suffix)) prefixes.add(name.slice(0, -suffix.length));
  }
  return [...prefixes].sort();
}

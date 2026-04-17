import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildProvider } from "../src/providers/build.js";

describe("buildProvider", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sapbruno-build-provider-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns undefined when no config provided", async () => {
    const result = await buildProvider(undefined, dir);
    expect(result).toBeUndefined();
  });

  it("builds env provider from parsed config", async () => {
    const p = await buildProvider(
      {
        type: "env",
        tokenUrl: "T",
        clientId: "C",
        clientSecret: "S",
      },
      dir,
    );
    expect(p?.type).toBe("env");
  });

  it("builds file provider from parsed config", async () => {
    const p = await buildProvider({ type: "file", path: "creds.json" }, dir);
    expect(p?.type).toBe("file");
  });

  it("builds manual provider", async () => {
    const p = await buildProvider({ type: "manual" }, dir);
    expect(p?.type).toBe("manual");
  });

  it("loads a custom provider from a relative module path", async () => {
    const mod = join(dir, "my-provider.mjs");
    await writeFile(
      mod,
      `export function myCustomProvider(cfg) {
         return {
           type: cfg.type,
           async fetch() {
             return { tokenUrl: cfg.tokenUrl, clientId: cfg.clientId, clientSecret: cfg.clientSecret };
           },
         };
       }`,
    );
    const provider = await buildProvider(
      {
        type: "my-custom",
        module: "./my-provider.mjs",
        tokenUrl: "T",
        clientId: "C",
        clientSecret: "S",
      },
      dir,
    );
    expect(provider?.type).toBe("my-custom");
    const creds = await provider?.fetch("whatever", { rootDir: dir, envName: "dev" });
    expect(creds).toEqual({ tokenUrl: "T", clientId: "C", clientSecret: "S" });
  });

  it("falls back to default export when factory function not found", async () => {
    const mod = join(dir, "default-provider.mjs");
    await writeFile(
      mod,
      `export default function (cfg) {
         return { type: cfg.type, async fetch() { return { tokenUrl: "u", clientId: "c", clientSecret: "s" }; } };
       }`,
    );
    const provider = await buildProvider({ type: "x", module: "./default-provider.mjs" }, dir);
    expect(provider?.type).toBe("x");
  });

  it("throws a helpful error when module cannot be loaded", async () => {
    await expect(
      buildProvider({ type: "missing", module: "./does-not-exist.mjs" }, dir),
    ).rejects.toThrow(/Failed to load credential provider module/);
  });

  it("throws when factory returns a non-provider", async () => {
    const mod = join(dir, "bad-provider.mjs");
    await writeFile(mod, `export function badProvider() { return { nothing: true }; }`);
    await expect(buildProvider({ type: "bad", module: "./bad-provider.mjs" }, dir)).rejects.toThrow(
      /did not return a valid CredentialProvider/,
    );
  });
});

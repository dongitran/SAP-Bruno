import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readEnvFile, readEnvVar, upsertEnvVars, writeEnvFile } from "../src/bru.js";

describe("bru env file", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sapbruno-"));
    file = join(dir, "test.bru");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns empty when file missing", async () => {
    const data = await readEnvFile(file);
    expect(data.variables ?? []).toEqual([]);
  });

  it("upserts new vars then updates existing", async () => {
    await upsertEnvVars(file, { foo: "1", bar: "2" });
    expect(await readEnvVar(file, "foo")).toBe("1");
    expect(await readEnvVar(file, "bar")).toBe("2");

    await upsertEnvVars(file, { foo: "updated" });
    expect(await readEnvVar(file, "foo")).toBe("updated");
    expect(await readEnvVar(file, "bar")).toBe("2");
  });

  it("preserves vars when round-tripping", async () => {
    const initial = `vars {
  base_url: https://api.example.com
  retries: 3
}
`;
    await writeFile(file, initial, "utf8");
    await upsertEnvVars(file, { token: "abc" });
    const text = await readFile(file, "utf8");
    expect(text).toContain("base_url");
    expect(text).toContain("retries");
    expect(text).toContain("token");
  });

  it("writeEnvFile creates a file then read returns same vars", async () => {
    await writeEnvFile(file, {
      variables: [{ name: "k", value: "v", enabled: true, secret: false }],
    });
    expect(await readEnvVar(file, "k")).toBe("v");
  });
});

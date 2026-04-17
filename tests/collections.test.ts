import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { calcPrefix, findServices, listGroups, listSuites } from "../src/collections.js";

describe("calcPrefix", () => {
  it("converts dashes and concatenates", () => {
    expect(calcPrefix("com-app", "com_demo_proc")).toBe("com_app_com_demo_proc");
  });

  it("strips a configured shared prefix", () => {
    expect(calcPrefix("com-app", "com_demo_proc", "com_")).toBe("com_app_demo_proc");
  });
});

describe("collection scanning", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sapbruno-col-"));
    await mkdir(join(dir, "group-a", "module-x", "service-1", "10-smoke"), { recursive: true });
    await mkdir(join(dir, "group-a", "module-x", "service-1", "20-flow"), { recursive: true });
    await writeFile(join(dir, "group-a", "module-x", "service-1", "10-smoke", "ping.bru"), "");
    await mkdir(join(dir, "group-b"), { recursive: true });
    await mkdir(join(dir, "environments"), { recursive: true });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("listGroups returns directories excluding environments and ignored", async () => {
    const groups = await listGroups(dir, ["group-b"]);
    expect(groups).toEqual(["group-a"]);
  });

  it("findServices detects folders that contain numbered subdirs", async () => {
    const services = await findServices(join(dir, "group-a"));
    expect(services).toHaveLength(1);
    expect(services[0]?.serviceRel).toBe("module-x/service-1");
  });

  it("listSuites returns numbered subdirs sorted", async () => {
    const suites = await listSuites(join(dir, "group-a", "module-x", "service-1"));
    expect(suites).toEqual(["10-smoke", "20-flow"]);
  });
});

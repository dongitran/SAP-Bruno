import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export interface ServiceEntry {
  module: string;
  serviceRel: string;
  serviceAbs: string;
}

export async function listGroups(collectionsDir: string, ignore: string[]): Promise<string[]> {
  const entries = await readdirSafe(collectionsDir);
  const groups: string[] = [];
  for (const entry of entries) {
    if (entry === "environments") continue;
    if (ignore.includes(entry)) continue;
    const full = join(collectionsDir, entry);
    const s = await stat(full);
    if (s.isDirectory()) groups.push(entry);
  }
  return groups.sort();
}

export async function findServices(groupDir: string): Promise<ServiceEntry[]> {
  const results: ServiceEntry[] = [];
  await walk(groupDir, async (dir) => {
    const isService = await hasNumberedSubdir(dir);
    if (!isService) return;
    const rel = relative(groupDir, dir);
    if (rel.split("/").length < 2) return;
    const parent = rel.split("/").slice(-2)[0] ?? "";
    results.push({ module: parent, serviceRel: rel, serviceAbs: dir });
  });
  return results.sort((a, b) => a.serviceRel.localeCompare(b.serviceRel));
}

export async function listSuites(serviceDir: string): Promise<string[]> {
  const entries = await readdirSafe(serviceDir);
  const suites: string[] = [];
  for (const e of entries) {
    if (!/^\d{2}-/.test(e)) continue;
    const full = join(serviceDir, e);
    const s = await stat(full);
    if (s.isDirectory()) suites.push(e);
  }
  return suites.sort();
}

export async function listBruFiles(suiteDir: string): Promise<string[]> {
  const entries = await readdirSafe(suiteDir);
  return entries
    .filter((e) => e.endsWith(".bru") && e !== "folder.bru")
    .map((e) => join(suiteDir, e))
    .sort();
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

async function hasNumberedSubdir(dir: string): Promise<boolean> {
  const entries = await readdirSafe(dir);
  for (const e of entries) {
    if (!/^\d{2}-/.test(e)) continue;
    const s = await stat(join(dir, e));
    if (s.isDirectory()) return true;
  }
  return false;
}

async function walk(dir: string, visit: (path: string) => Promise<void>): Promise<void> {
  const entries = await readdirSafe(dir);
  for (const e of entries) {
    const full = join(dir, e);
    let s;
    try {
      s = await stat(full);
    } catch {
      continue;
    }
    if (!s.isDirectory()) continue;
    await visit(full);
    await walk(full, visit);
  }
}

export function calcPrefix(group: string, serviceFolder: string, strip?: string): string {
  const g = group.replaceAll("-", "_");
  let s = serviceFolder.replaceAll("-", "_");
  if (strip && s.startsWith(strip)) s = s.slice(strip.length);
  return `${g}${s.startsWith("_") ? "" : "_"}${s}`.toLowerCase();
}

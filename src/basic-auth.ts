import { readFile } from "node:fs/promises";

import { z } from "zod";

const userSchema = z.object({
  label: z.string(),
  email: z.string(),
  password: z.string(),
});

const usersFileSchema = z.object({
  users: z.array(userSchema),
});

export type LocalUser = z.infer<typeof userSchema>;

export async function loadLocalUsers(path: string): Promise<LocalUser[]> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Local users file not found: ${path}`, { cause: err });
    }
    throw err;
  }
  const parsed = usersFileSchema.parse(JSON.parse(raw));
  return parsed.users;
}

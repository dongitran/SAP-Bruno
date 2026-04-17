import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { z } from "zod";

import type { OAuthCredentials } from "../oauth.js";
import type { CredentialProvider, ProviderContext } from "./index.js";

const fileSchema = z.record(
  z.string(),
  z.object({
    tokenUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
  }),
);

interface FileProviderConfig {
  path: string;
}

export function fileProvider(config: FileProviderConfig): CredentialProvider {
  return {
    type: "file",
    fetch: async (prefix, ctx: ProviderContext): Promise<OAuthCredentials> => {
      const abs = isAbsolute(config.path) ? config.path : resolve(ctx.rootDir, config.path);
      const raw = await readFile(abs, "utf8");
      const data = fileSchema.parse(JSON.parse(raw));
      const entry = data[prefix];
      if (!entry) {
        throw new Error(
          `file provider: no credentials for prefix '${prefix}' in ${abs}. Available: ${Object.keys(data).join(", ")}`,
        );
      }
      return entry;
    },
  };
}

import { input, password } from "@inquirer/prompts";

import type { OAuthCredentials } from "../oauth.js";
import type { CredentialProvider } from "./index.js";

export function manualProvider(): CredentialProvider {
  return {
    type: "manual",
    fetch: async (prefix): Promise<OAuthCredentials> => {
      const tokenUrl = await input({ message: `[${prefix}] Token URL:` });
      const clientId = await input({ message: `[${prefix}] Client ID:` });
      const clientSecret = await password({ message: `[${prefix}] Client Secret:` });
      return { tokenUrl, clientId, clientSecret };
    },
  };
}

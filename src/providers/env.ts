import type { OAuthCredentials } from "../oauth.js";
import type { CredentialProvider } from "./index.js";

interface EnvProviderConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
}

export function envProvider(config: EnvProviderConfig): CredentialProvider {
  return {
    type: "env",
    fetch: (_prefix): Promise<OAuthCredentials> => {
      const tokenUrl = process.env[config.tokenUrl] ?? "";
      const clientId = process.env[config.clientId] ?? "";
      const clientSecret = process.env[config.clientSecret] ?? "";
      const missing: string[] = [];
      if (!tokenUrl) missing.push(config.tokenUrl);
      if (!clientId) missing.push(config.clientId);
      if (!clientSecret) missing.push(config.clientSecret);
      if (missing.length > 0) {
        return Promise.reject(new Error(`env provider: missing env vars: ${missing.join(", ")}`));
      }
      return Promise.resolve({ tokenUrl, clientId, clientSecret });
    },
  };
}

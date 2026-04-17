import type { OAuthCredentials } from "../oauth.js";

export interface CredentialProvider {
  readonly type: string;
  fetch(prefix: string, context: ProviderContext): Promise<OAuthCredentials>;
}

export interface ProviderContext {
  rootDir: string;
  envName: string;
}

export { envProvider } from "./env.js";
export { manualProvider } from "./manual.js";
export { fileProvider } from "./file.js";

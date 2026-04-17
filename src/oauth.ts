export interface OAuthCredentials {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export async function fetchClientCredentialsToken(creds: OAuthCredentials): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", creds.clientId);
  body.set("client_secret", creds.clientSecret);
  if (creds.scope) body.set("scope", creds.scope);

  const res = await fetch(creds.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `OAuth token request failed: HTTP ${res.status} ${res.statusText}\n${text.slice(0, 500)}`,
    );
  }

  const json = (await res.json()) as Partial<TokenResponse>;
  if (!json.access_token) {
    throw new Error("OAuth response missing access_token");
  }
  return {
    access_token: json.access_token,
    ...(json.token_type !== undefined && { token_type: json.token_type }),
    ...(json.expires_in !== undefined && { expires_in: json.expires_in }),
  };
}

export function bearerHeader(token: string): string {
  return `Bearer ${token}`;
}

export function basicHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

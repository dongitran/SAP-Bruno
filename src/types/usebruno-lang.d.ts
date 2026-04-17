declare module "@usebruno/lang" {
  type AnyJson = unknown;
  export function bruToJsonV2(text: string): AnyJson;
  export function jsonToBruV2(json: AnyJson): string;
  export function envToJsonV2(text: string): AnyJson;
  export function jsonToEnvV2(json: AnyJson): string;
  export function bruToEnvJsonV2(text: string): AnyJson;
  export function envJsonToBruV2(json: AnyJson): string;
  const _default: {
    bruToJsonV2?: (text: string) => AnyJson;
    jsonToBruV2?: (json: AnyJson) => string;
    envToJsonV2?: (text: string) => AnyJson;
    jsonToEnvV2?: (json: AnyJson) => string;
    bruToEnvJsonV2?: (text: string) => AnyJson;
    envJsonToBruV2?: (json: AnyJson) => string;
  };
  export default _default;
}

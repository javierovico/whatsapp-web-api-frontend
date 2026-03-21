export interface GetIntegrationTokenResponseHttpDto {
  clientKey: string;
  exists: boolean;
  tokenType: string;
  token: string | null;
}

export interface UpdateWaClientHttpDto {
  webhookUrl?: string;
  webhookSecret?: string;
  name?: string;
  isActive?: boolean;
  isIntegrationTestOnly?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateWaClientHttpDto {
  webhookUrl?: string;
  webhookSecret?: string;
  name?: string;
  isActive?: boolean;
  metadata?: Record<string, unknown>;
}

import { WaClientSyncStatus } from "@/api-backend/wa-clients/dto/wa-client-sync-status.type";

export interface WaClientListItemResponseHttpDto {
  clientKey: string;
  name: string | null;
  isActive: boolean;
  isIntegrationTestOnly: boolean;
  whitelistCount: number;
  syncStatus: WaClientSyncStatus;
  hasIntegrationToken: boolean;
  updatedAt: string;
}

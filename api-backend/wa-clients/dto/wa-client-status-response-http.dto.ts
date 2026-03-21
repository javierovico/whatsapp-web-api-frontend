import { WaClientSyncStatus } from "@/api-backend/wa-clients/dto/wa-client-sync-status.type";

export interface WaClientStatusResponseHttpDto {
  clientKey: string;
  isActive: boolean;
  syncStatus: WaClientSyncStatus;
  lastQrAt: string | null;
  readyAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
}

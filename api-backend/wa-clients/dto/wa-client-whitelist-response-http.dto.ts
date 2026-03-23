import { WaClientWhitelistNumberItemHttpDto } from "@/api-backend/wa-clients/dto/wa-client-whitelist-number-item-http.dto";

export interface WaClientWhitelistResponseHttpDto {
  clientKey: string;
  data: WaClientWhitelistNumberItemHttpDto[];
}


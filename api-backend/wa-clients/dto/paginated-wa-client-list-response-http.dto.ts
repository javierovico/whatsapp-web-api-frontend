import { WaClientListItemResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-list-item-response-http.dto";

export interface PaginatedWaClientListResponseHttpDto {
  data: WaClientListItemResponseHttpDto[];
  total: number;
  lastPage: number;
  perPage: number;
  currentPage: number;
}

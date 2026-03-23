import apiFront from "@/api-backend/api-backend-front";
import { AddWaClientWhitelistNumberHttpDto } from "@/api-backend/wa-clients/dto/add-wa-client-whitelist-number-http.dto";
import { ClientKeyResponseHttpDto } from "@/api-backend/wa-clients/dto/client-key-response-http.dto";
import { CreateWaClientHttpDto } from "@/api-backend/wa-clients/dto/create-wa-client-http.dto";
import { GetIntegrationTokenResponseHttpDto } from "@/api-backend/wa-clients/dto/get-integration-token-response-http.dto";
import { IssueIntegrationTokenResponseHttpDto } from "@/api-backend/wa-clients/dto/issue-integration-token-response-http.dto";
import { PaginatedWaClientListResponseHttpDto } from "@/api-backend/wa-clients/dto/paginated-wa-client-list-response-http.dto";
import { SendMessageAcceptedResponseHttpDto } from "@/api-backend/wa-clients/dto/send-message-accepted-response-http.dto";
import { SendMessageHttpDto } from "@/api-backend/wa-clients/dto/send-message-http.dto";
import { SetWaClientIntegrationModeHttpDto } from "@/api-backend/wa-clients/dto/set-wa-client-integration-mode-http.dto";
import { StatusOkResponseHttpDto } from "@/api-backend/wa-clients/dto/status-ok-response-http.dto";
import { UpdateWaClientHttpDto } from "@/api-backend/wa-clients/dto/update-wa-client-http.dto";
import { WaClientQrResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-qr-response-http.dto";
import { WaClientStatusResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-status-response-http.dto";
import { WaClientWhitelistResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-whitelist-response-http.dto";

export function listWaClients(page = 1, perPage = 10) {
  return apiFront
    .get<PaginatedWaClientListResponseHttpDto>("/api/wa-clients", {
      params: { page, perPage },
    })
    .then((response) => response.data);
}

export function createWaClient(dto: CreateWaClientHttpDto) {
  return apiFront.post<ClientKeyResponseHttpDto>("/api/wa-clients", dto).then((response) => response.data);
}

export function updateWaClient(clientKey: string, dto: UpdateWaClientHttpDto) {
  return apiFront
    .patch<ClientKeyResponseHttpDto>(`/api/wa-clients/${clientKey}`, dto)
    .then((response) => response.data);
}

export function activateWaClient(clientKey: string) {
  return apiFront
    .post<StatusOkResponseHttpDto>(`/api/wa-clients/${clientKey}/activate`)
    .then((response) => response.data);
}

export function deactivateWaClient(clientKey: string) {
  return apiFront
    .post<StatusOkResponseHttpDto>(`/api/wa-clients/${clientKey}/deactivate`)
    .then((response) => response.data);
}

export function reconnectWaClient(clientKey: string) {
  return apiFront
    .post<StatusOkResponseHttpDto>(`/api/wa-clients/${clientKey}/reconnect`)
    .then((response) => response.data);
}

export function getWaClientStatus(clientKey: string) {
  return apiFront
    .get<WaClientStatusResponseHttpDto>(`/api/wa-clients/${clientKey}/status`)
    .then((response) => response.data);
}

export function getWaClientQr(clientKey: string) {
  return apiFront
    .get<WaClientQrResponseHttpDto>(`/api/wa-clients/${clientKey}/qr`)
    .then((response) => response.data);
}

export function sendWaClientMessage(clientKey: string, dto: SendMessageHttpDto) {
  return apiFront
    .post<SendMessageAcceptedResponseHttpDto>(`/api/wa-clients/${clientKey}/messages`, dto)
    .then((response) => response.data);
}

export function rotateWaClientIntegrationToken(clientKey: string) {
  return apiFront
    .post<IssueIntegrationTokenResponseHttpDto>(`/api/wa-clients/${clientKey}/integration-token`)
    .then((response) => response.data);
}

export function getWaClientIntegrationToken(clientKey: string) {
  return apiFront
    .get<GetIntegrationTokenResponseHttpDto>(`/api/wa-clients/${clientKey}/integration-token`)
    .then((response) => response.data);
}

export function setWaClientIntegrationMode(clientKey: string, dto: SetWaClientIntegrationModeHttpDto) {
  return apiFront
    .patch<ClientKeyResponseHttpDto>(`/api/wa-clients/${clientKey}/integration-mode`, dto)
    .then((response) => response.data);
}

export function listWaClientWhitelistNumbers(clientKey: string) {
  return apiFront
    .get<WaClientWhitelistResponseHttpDto>(`/api/wa-clients/${clientKey}/whitelist-numbers`)
    .then((response) => response.data);
}

export function addWaClientWhitelistNumber(clientKey: string, dto: AddWaClientWhitelistNumberHttpDto) {
  return apiFront
    .post<StatusOkResponseHttpDto>(`/api/wa-clients/${clientKey}/whitelist-numbers`, dto)
    .then((response) => response.data);
}

export function removeWaClientWhitelistNumber(clientKey: string, waChatId: string) {
  return apiFront
    .delete<StatusOkResponseHttpDto>(`/api/wa-clients/${clientKey}/whitelist-numbers/${encodeURIComponent(waChatId)}`)
    .then((response) => response.data);
}

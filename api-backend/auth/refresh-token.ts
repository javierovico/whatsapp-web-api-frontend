import apiSinAutenticacion from "@/api-backend/api-backend";
import { RefreshTokenHttpDto } from "@/api-backend/auth/dto/refresh-token-http.dto";
import { RefreshTokenResponseHttpDto } from "@/api-backend/auth/dto/refresh-token-response-http.dto";

export function refreshToken(dto: RefreshTokenHttpDto) {
  return apiSinAutenticacion
    .post<RefreshTokenResponseHttpDto>("/api/auth/refresh", dto)
    .then((response) => response.data);
}

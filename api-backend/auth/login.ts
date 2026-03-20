import apiSinAutenticacion from "@/api-backend/api-backend";
import { LoginHttpDto } from "@/api-backend/auth/dto/login-http.dto";
import { LoginResponseHttpDto } from "@/api-backend/auth/dto/login-response-http.dto";

export function login(dto: LoginHttpDto) {
  return apiSinAutenticacion
    .post<LoginResponseHttpDto>("/api/auth/login", dto)
    .then((response) => response.data);
}


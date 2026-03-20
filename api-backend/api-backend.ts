import axios, { AxiosError, AxiosResponse } from "axios";
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { API_URL_PRIVADA } from "@/config/environments";

export async function getApiConAutenticacion(req: NextRequest) {
  const token = await getToken({ req });
  return axios.create({
    baseURL: API_URL_PRIVADA,
    headers: {
      ...(token?.backendToken && {
        Authorization: `Bearer ${token.backendToken}`,
      }),
    },
  });
}

const apiSinAutenticacion = axios.create({
  baseURL: API_URL_PRIVADA,
});

export const handleApiResponse = async <T>(promise: Promise<AxiosResponse<T>>) => {
  try {
    const response = await promise;
    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    let status = 500;
    let data: object;
    if (error instanceof AxiosError) {
      status = error.response?.status || 500;
      data = error.response?.data || { message: "Error inesperado" };
    } else if (error instanceof Error) {
      data = { message: error.message };
    } else {
      data = { message: "Error inesperado" };
    }
    return NextResponse.json(data, { status });
  }
};

export default apiSinAutenticacion;


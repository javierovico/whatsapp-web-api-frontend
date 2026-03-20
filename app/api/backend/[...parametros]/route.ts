import { NextRequest } from "next/server";
import { getApiConAutenticacion, handleApiResponse } from "@/api-backend/api-backend";

interface Props {
  params: Promise<{ parametros: string[] }>;
}

const getSearchParams = (req: NextRequest) => Object.fromEntries(req.nextUrl.searchParams.entries());

const getBody = async (req: NextRequest) => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

export async function GET(req: NextRequest, { params }: Props) {
  const { parametros } = await params;
  const axios = await getApiConAutenticacion(req);
  return handleApiResponse(axios.get(`/${parametros.join("/")}`, { params: getSearchParams(req) }));
}

export async function POST(req: NextRequest, { params }: Props) {
  const { parametros } = await params;
  const axios = await getApiConAutenticacion(req);
  return handleApiResponse(
    axios.post(`/${parametros.join("/")}`, await getBody(req), { params: getSearchParams(req) }),
  );
}

export async function PUT(req: NextRequest, { params }: Props) {
  const { parametros } = await params;
  const axios = await getApiConAutenticacion(req);
  return handleApiResponse(
    axios.put(`/${parametros.join("/")}`, await getBody(req), { params: getSearchParams(req) }),
  );
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { parametros } = await params;
  const axios = await getApiConAutenticacion(req);
  return handleApiResponse(
    axios.patch(`/${parametros.join("/")}`, await getBody(req), { params: getSearchParams(req) }),
  );
}

export async function DELETE(req: NextRequest, { params }: Props) {
  const { parametros } = await params;
  const axios = await getApiConAutenticacion(req);
  return handleApiResponse(
    axios.delete(`/${parametros.join("/")}`, { data: await getBody(req), params: getSearchParams(req) }),
  );
}


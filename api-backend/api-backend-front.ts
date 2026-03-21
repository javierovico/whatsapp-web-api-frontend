import axios from "axios";
import { getSession, signOut } from "next-auth/react";
import { NEXT_PUBLIC_BASE_PATH } from "@/config/environments";

const apiFront = axios.create({
  baseURL: NEXT_PUBLIC_BASE_PATH,
});

let logoutInProgress = false;

interface RetriableConfig {
  _retryAfterSessionRefresh?: boolean;
}

function isAuthStatus(status?: number) {
  return status === 401 || status === 403;
}

function getCurrentCallbackUrl() {
  if (typeof window === "undefined") {
    return "/login";
  }
  const currentUrl = `${window.location.pathname}${window.location.search}`;
  return `/login?callbackUrl=${encodeURIComponent(currentUrl)}`;
}

async function logoutToLogin() {
  if (logoutInProgress) {
    return;
  }
  logoutInProgress = true;
  await signOut({ callbackUrl: getCurrentCallbackUrl() });
}

apiFront.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const config = error.config as (typeof error.config & RetriableConfig) | undefined;
    if (!config || !isAuthStatus(status)) {
      return Promise.reject(error);
    }

    if (!config._retryAfterSessionRefresh) {
      config._retryAfterSessionRefresh = true;
      try {
        const session = await getSession();
        if (session?.authError === "AUTH_INVALID") {
          await logoutToLogin();
          return Promise.reject(error);
        }
        return await apiFront.request(config);
      } catch {
        await logoutToLogin();
        return Promise.reject(error);
      }
    }

    await logoutToLogin();
    return Promise.reject(error);
  },
);

export default apiFront;

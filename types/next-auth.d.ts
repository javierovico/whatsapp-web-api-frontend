import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

export type AuthErrorCode = "AUTH_INVALID" | "REFRESH_FAILED_NON_AUTH";

declare module "next-auth" {
  interface Session extends DefaultSession {
    backendToken?: string;
    tokenType?: string;
    authError?: AuthErrorCode;
    backendTokenExpiresAt?: number;
  }

  interface User {
    backendToken?: string;
    refreshToken?: string;
    tokenType?: string;
    backendTokenExpiresAt?: number;
    refreshTokenExpiresAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    backendToken?: string;
    refreshToken?: string;
    tokenType?: string;
    backendTokenExpiresAt?: number;
    refreshTokenExpiresAt?: number;
    authError?: AuthErrorCode;
  }
}

export {};

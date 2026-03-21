import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { AxiosError } from "axios";
import { login } from "@/api-backend/auth/login";
import { refreshToken } from "@/api-backend/auth/refresh-token";

const TOKEN_REFRESH_WINDOW_MS = 60_000;

function toExpiryTimestamp(expiresInSeconds: number) {
  return Date.now() + Math.max(0, expiresInSeconds) * 1000;
}

function shouldRefreshToken(accessTokenExpiresAt?: number) {
  if (!accessTokenExpiresAt) {
    return true;
  }
  return accessTokenExpiresAt - TOKEN_REFRESH_WINDOW_MS <= Date.now();
}

const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        try {
          const resultado = await login({
            username: credentials.username,
            password: credentials.password,
          });

          return {
            id: resultado.userId,
            name: resultado.userId,
            email: resultado.username ?? undefined,
            backendToken: resultado.accessToken,
            refreshToken: resultado.refreshToken,
            tokenType: resultado.tokenType,
            backendTokenExpiresAt: toExpiryTimestamp(resultado.expiresIn),
            refreshTokenExpiresAt: toExpiryTimestamp(resultado.refreshExpiresIn),
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.backendToken = user.backendToken;
        token.refreshToken = user.refreshToken;
        token.tokenType = user.tokenType;
        token.backendTokenExpiresAt = user.backendTokenExpiresAt;
        token.refreshTokenExpiresAt = user.refreshTokenExpiresAt;
        delete token.authError;
        return token;
      }

      if (!shouldRefreshToken(token.backendTokenExpiresAt)) {
        return token;
      }

      if (!token.refreshToken) {
        token.authError = "AUTH_INVALID";
        return token;
      }

      try {
        const resultado = await refreshToken({ refreshToken: token.refreshToken });
        token.backendToken = resultado.accessToken;
        token.refreshToken = resultado.refreshToken;
        token.tokenType = resultado.tokenType;
        token.backendTokenExpiresAt = toExpiryTimestamp(resultado.expiresIn);
        token.refreshTokenExpiresAt = toExpiryTimestamp(resultado.refreshExpiresIn);
        delete token.authError;
      } catch (error) {
        const status = error instanceof AxiosError ? error.response?.status : undefined;

        if (status === 401 || status === 403) {
          token.authError = "AUTH_INVALID";
          delete token.backendToken;
          delete token.refreshToken;
          delete token.tokenType;
          delete token.backendTokenExpiresAt;
          delete token.refreshTokenExpiresAt;
        } else {
          token.authError = "REFRESH_FAILED_NON_AUTH";
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.backendToken = token.backendToken as string;
      session.tokenType = token.tokenType as string;
      session.backendTokenExpiresAt = token.backendTokenExpiresAt as number;
      session.authError = token.authError;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

export default authOptions;

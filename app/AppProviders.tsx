"use client";

import { ReactNode, useEffect } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { SessionProvider, signOut, useSession } from "next-auth/react";
import theme from "@/theme";

function SessionAuthWatcher() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || session?.authError !== "AUTH_INVALID" || typeof window === "undefined") {
      return;
    }

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const callbackUrl = `/login?callbackUrl=${encodeURIComponent(currentUrl)}`;
    void signOut({ callbackUrl });
  }, [session?.authError, status]);

  return null;
}

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SessionProvider refetchInterval={30} refetchOnWindowFocus>
          <SessionAuthWatcher />
          {children}
        </SessionProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}

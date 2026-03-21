import type { Metadata } from "next";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import "./globals.css";
import AppProviders from "@/app/AppProviders";

export const metadata: Metadata = {
  title: "Whatsapp Web API Front",
  description: "Frontend para administración de Whatsapp Web API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="class" />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

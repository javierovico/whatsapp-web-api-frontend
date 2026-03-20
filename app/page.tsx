"use client";

import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { signOut, useSession } from "next-auth/react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 560 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Sesion iniciada</Typography>
            <Typography color="text.secondary">
              Usuario: {session?.user?.name || "sin datos"}
            </Typography>
            <Button variant="contained" color="primary" onClick={() => signOut({ callbackUrl: "/login" })}>
              Cerrar sesion
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}


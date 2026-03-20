"use client";

import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();

  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") || "/", [searchParams]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username || !password) {
      setError("Completá usuario y contraseña.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username,
        password,
      });

      if (result?.error) {
        setError("Credenciales inválidas.");
        return;
      }

      router.replace(callbackUrl);
    } catch {
      setError("No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        background:
          "radial-gradient(circle at 50% 10%, rgba(25,118,210,0.15), rgba(25,118,210,0) 55%), #f4f6f8",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 430 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            <Typography variant="h4" component="h1">
              Iniciar sesión
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Accedé con tus credenciales del backend.
            </Typography>

            {error && <Alert severity="error">{error}</Alert>}

            <FormControl>
              <FormLabel htmlFor="username">Usuario</FormLabel>
              <TextField
                id="username"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                fullWidth
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="password">Contraseña</FormLabel>
              <TextField
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                fullWidth
              />
            </FormControl>

            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Box sx={{ minHeight: "100dvh", backgroundColor: "#f4f6f8" }} />}>
      <LoginContent />
    </Suspense>
  );
}

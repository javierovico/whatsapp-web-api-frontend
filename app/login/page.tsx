"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import Joi from "joi";
import { useFormik } from "formik";
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
import { useTheme } from "@mui/material/styles";
import { joiStringRequired, validateWithJoi } from "@/lib/formik-joi";

interface LoginFormValues {
  username: string;
  password: string;
}

const loginSchema = Joi.object<LoginFormValues>({
  username: joiStringRequired("Usuario"),
  password: joiStringRequired("Contraseña"),
});

function LoginContent() {
  const theme = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();

  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") || "/", [searchParams]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  const formik = useFormik<LoginFormValues>({
    initialValues: {
      username: "",
      password: "",
    },
    validate: (values) => validateWithJoi(loginSchema, values),
    onSubmit: async (values, { setSubmitting }) => {
      setError(null);

      try {
        const result = await signIn("credentials", {
          redirect: false,
          username: values.username.trim(),
          password: values.password,
        });

        if (result?.error) {
          setError("Credenciales inválidas.");
          return;
        }

        router.replace(callbackUrl);
      } catch {
        setError("No se pudo iniciar sesión.");
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
        background: `radial-gradient(circle at 50% 10%, ${
          theme.palette.mode === "dark" ? "rgba(144,202,249,0.18)" : "rgba(25,118,210,0.15)"
        }, rgba(25,118,210,0) 55%), ${theme.palette.background.default}`,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 430 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2.5} component="form" onSubmit={formik.handleSubmit}>
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
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="admin"
                autoComplete="username"
                required
                error={formik.touched.username && Boolean(formik.errors.username)}
                helperText={formik.touched.username ? formik.errors.username : " "}
                fullWidth
              />
            </FormControl>

            <FormControl>
              <FormLabel htmlFor="password">Contraseña</FormLabel>
              <TextField
                id="password"
                name="password"
                type="password"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="current-password"
                required
                error={formik.touched.password && Boolean(formik.errors.password)}
                helperText={formik.touched.password ? formik.errors.password : " "}
                fullWidth
              />
            </FormControl>

            <Button type="submit" variant="contained" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Box sx={{ minHeight: "100dvh", backgroundColor: "background.default" }} />}>
      <LoginContent />
    </Suspense>
  );
}

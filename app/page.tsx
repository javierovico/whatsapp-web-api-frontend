"use client";

import { type MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import Joi from "joi";
import { useFormik } from "formik";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { useTheme } from "@mui/material/styles";
import { QRCodeSVG } from "qrcode.react";
import {
  activateWaClient,
  addWaClientWhitelistNumber,
  createWaClient,
  deactivateWaClient,
  getWaClientIntegrationToken,
  getWaClientQr,
  getWaClientStatus,
  listWaClients,
  listWaClientWhitelistNumbers,
  reconnectWaClient,
  removeWaClientWhitelistNumber,
  rotateWaClientIntegrationToken,
  sendWaClientMessage,
  setWaClientIntegrationMode,
  updateWaClient,
} from "@/api-backend/wa-clients/wa-clients.service";
import { CreateWaClientHttpDto } from "@/api-backend/wa-clients/dto/create-wa-client-http.dto";
import { SendMessageHttpDto } from "@/api-backend/wa-clients/dto/send-message-http.dto";
import { UpdateWaClientHttpDto } from "@/api-backend/wa-clients/dto/update-wa-client-http.dto";
import { WaClientListItemResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-list-item-response-http.dto";
import { WaClientQrResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-qr-response-http.dto";
import { WaClientStatusResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-status-response-http.dto";
import { WaClientWhitelistResponseHttpDto } from "@/api-backend/wa-clients/dto/wa-client-whitelist-response-http.dto";
import ModeSwitch from "@/app/components/ModeSwitch";
import WaEventsDialog from "@/app/components/WaEventsDialog";
import { NEXT_PUBLIC_WS_BASE_URL } from "@/config/environments";
import { getErrorMessage } from "@/lib/http-error";
import { joiStringRequired, validateWithJoi } from "@/lib/formik-joi";

interface WaClientCreateFormValues {
  clientKey: string;
  name: string;
  webhookUrl: string;
  webhookSecret: string;
  isActive: boolean;
  isIntegrationTestOnly: boolean;
  metadataText: string;
}

interface WaClientUpdateFormValues {
  name: string;
  webhookUrl: string;
  webhookSecret: string;
  isActive: boolean;
  metadataText: string;
}

interface SendMessageFormValues {
  to: string;
  body: string;
}

interface WhitelistNumberFormValues {
  waChatId: string;
}

const metadataSchema = Joi.string()
  .allow("")
  .custom((value, helpers) => {
    if (!value.trim()) {
      return value;
    }

    try {
      JSON.parse(value);
      return value;
    } catch {
      return helpers.error("any.invalid");
    }
  })
  .messages({
    "any.invalid": "Metadata debe ser JSON válido.",
  });

const createWaClientSchema = Joi.object<WaClientCreateFormValues>({
  clientKey: joiStringRequired("Client key"),
  name: Joi.string().allow("").max(120),
  webhookUrl: joiStringRequired("Webhook URL").uri({ scheme: ["http", "https"] }).messages({
    "string.uri": "Webhook URL debe ser una URL válida.",
  }),
  webhookSecret: joiStringRequired("Webhook secret"),
  isActive: Joi.boolean().required(),
  isIntegrationTestOnly: Joi.boolean().required(),
  metadataText: metadataSchema,
});

const updateWaClientSchema = Joi.object<WaClientUpdateFormValues>({
  name: Joi.string().allow("").max(120),
  webhookUrl: Joi.string().allow("").uri({ scheme: ["http", "https"] }).messages({
    "string.uri": "Webhook URL debe ser una URL válida.",
  }),
  webhookSecret: Joi.string().allow(""),
  isActive: Joi.boolean().required(),
  metadataText: metadataSchema,
});

const sendMessageSchema = Joi.object<SendMessageFormValues>({
  to: joiStringRequired("Destino").messages({
    "string.base": "Destino debe ser texto.",
  }),
  body: joiStringRequired("Mensaje"),
});

const whitelistNumberSchema = Joi.object<WhitelistNumberFormValues>({
  waChatId: joiStringRequired("Número de prueba")
    .pattern(/^\d{8,15}@c\.us$/)
    .messages({ "string.pattern.base": "Debe tener formato 595981000000@c.us" }),
});

function parseMetadata(metadataText: string) {
  if (!metadataText.trim()) {
    return undefined;
  }

  return JSON.parse(metadataText) as Record<string, unknown>;
}

function formatDate(isoDate: string | null | undefined) {
  if (!isoDate) {
    return "-";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getStatusColor(status: string) {
  switch (status) {
    case "READY":
      return "success" as const;
    case "AUTH_FAILED":
    case "DISCONNECTED":
      return "error" as const;
    case "QR_PENDING":
    case "INITIALIZING":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

function getQrExpiryState(lastQrAt: string | null) {
  if (!lastQrAt) {
    return {
      isExpired: true,
      ageMs: null as number | null,
      reason: "No hay fecha de generación para validar vigencia.",
    };
  }

  const generatedAt = new Date(lastQrAt);
  if (Number.isNaN(generatedAt.getTime())) {
    return {
      isExpired: true,
      ageMs: null as number | null,
      reason: "La fecha de generación del QR es inválida.",
    };
  }

  const ageMs = Date.now() - generatedAt.getTime();
  if (ageMs > 60_000) {
    return {
      isExpired: true,
      ageMs,
      reason: "El QR está vencido (más de 1 minuto desde su generación).",
    };
  }

  return {
    isExpired: false,
    ageMs,
    reason: "",
  };
}

export default function Home() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const router = useRouter();
  const { data: session, status } = useSession();

  const [clients, setClients] = useState<WaClientListItemResponseHttpDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loadingList, setLoadingList] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<WaClientListItemResponseHttpDto | null>(null);
  const [messageClient, setMessageClient] = useState<WaClientListItemResponseHttpDto | null>(null);
  const [integrationTokenClient, setIntegrationTokenClient] = useState<WaClientListItemResponseHttpDto | null>(null);
  const [rotatedIntegrationToken, setRotatedIntegrationToken] = useState<string | null>(null);
  const [statusClientKey, setStatusClientKey] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<WaClientStatusResponseHttpDto | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [qrClientKey, setQrClientKey] = useState<string | null>(null);
  const [qrData, setQrData] = useState<WaClientQrResponseHttpDto | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrAutoRefreshState, setQrAutoRefreshState] = useState<"idle" | "running" | "time_limit" | "expired">("idle");
  const [qrRefreshSession, setQrRefreshSession] = useState(0);
  const [eventsClientKey, setEventsClientKey] = useState<string | null>(null);
  const [actionsMenuAnchorEl, setActionsMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [actionsMenuClient, setActionsMenuClient] = useState<WaClientListItemResponseHttpDto | null>(null);
  const [whitelistClient, setWhitelistClient] = useState<WaClientListItemResponseHttpDto | null>(null);
  const [whitelistData, setWhitelistData] = useState<WaClientWhitelistResponseHttpDto | null>(null);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [whitelistActionLoading, setWhitelistActionLoading] = useState(false);

  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });

  const showSuccess = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: "success" });
  }, []);

  const showError = useCallback((message: string) => {
    setSnackbar({ open: true, message, severity: "error" });
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [router, status]);

  const fetchClients = useCallback(async () => {
    if (status !== "authenticated") {
      return;
    }

    setLoadingList(true);
    setPageError(null);

    try {
      const data = await listWaClients(page + 1, rowsPerPage);
      setClients(data.data);
      setTotal(data.total);
    } catch (error) {
      const message = getErrorMessage(error, "No se pudieron cargar los clientes.");
      setPageError(message);
    } finally {
      setLoadingList(false);
    }
  }, [page, rowsPerPage, status]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    if (!statusClientKey) {
      return;
    }

    const run = async () => {
      setStatusLoading(true);
      setStatusData(null);

      try {
        const data = await getWaClientStatus(statusClientKey);
        setStatusData(data);
      } catch (error) {
        showError(getErrorMessage(error, "No se pudo obtener el estado del cliente."));
      } finally {
        setStatusLoading(false);
      }
    };

    void run();
  }, [showError, statusClientKey]);

  useEffect(() => {
    if (!qrClientKey) {
      setQrAutoRefreshState("idle");
      return;
    }

    let cancelled = false;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const stopRefresh = (state: "idle" | "time_limit" | "expired") => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }

      if (!cancelled) {
        setQrAutoRefreshState(state);
      }
    };

    const fetchQr = async () => {
      try {
        const data = await getWaClientQr(qrClientKey);
        if (!cancelled) {
          setQrData(data);
        }
        return data;
      } catch (error) {
        if (!cancelled) {
          showError(getErrorMessage(error, "No se pudo obtener el QR del cliente."));
        }
        return null;
      }
    };

    const run = async () => {
      setQrLoading(true);
      setQrData(null);
      setQrAutoRefreshState("idle");

      try {
        const initialData = await fetchQr();
        if (!initialData || cancelled) {
          return;
        }

        if (!initialData.qr || getQrExpiryState(initialData.lastQrAt ?? null).isExpired) {
          setQrAutoRefreshState("expired");
          return;
        }

        setQrAutoRefreshState("running");

        refreshInterval = setInterval(() => {
          void (async () => {
            const refreshedData = await fetchQr();
            if (!refreshedData || cancelled) {
              return;
            }

            if (!refreshedData.qr || getQrExpiryState(refreshedData.lastQrAt ?? null).isExpired) {
              stopRefresh("expired");
            }
          })();
        }, 3_000);

        refreshTimeout = setTimeout(() => {
          stopRefresh("time_limit");
        }, 60_000);
      } finally {
        if (!cancelled) {
          setQrLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
    };
  }, [qrClientKey, qrRefreshSession, showError]);

  const restartQrAutoRefresh = useCallback(() => {
    setQrRefreshSession((current) => current + 1);
  }, []);

  const loadWhitelistNumbers = useCallback(
    async (clientKey: string) => {
      setWhitelistLoading(true);
      try {
        const data = await listWaClientWhitelistNumbers(clientKey);
        setWhitelistData(data);
      } catch (error) {
        showError(getErrorMessage(error, "No se pudieron cargar los números de prueba."));
      } finally {
        setWhitelistLoading(false);
      }
    },
    [showError],
  );

  useEffect(() => {
    if (!whitelistClient) {
      setWhitelistData(null);
      setWhitelistLoading(false);
      return;
    }

    void loadWhitelistNumbers(whitelistClient.clientKey);
  }, [loadWhitelistNumbers, whitelistClient]);

  const openActionsMenu = useCallback((event: MouseEvent<HTMLElement>, client: WaClientListItemResponseHttpDto) => {
    setActionsMenuAnchorEl(event.currentTarget);
    setActionsMenuClient(client);
  }, []);

  const closeActionsMenu = useCallback(() => {
    setActionsMenuAnchorEl(null);
    setActionsMenuClient(null);
  }, []);

  const runRotateIntegrationToken = useCallback(async () => {
    if (!integrationTokenClient) {
      return;
    }

    const clientKey = integrationTokenClient.clientKey;
    setActionLoadingKey(`rotate-token:${clientKey}`);

    try {
      const data = await rotateWaClientIntegrationToken(clientKey);
      setIntegrationTokenClient(null);
      setRotatedIntegrationToken(data.token);
      await fetchClients();
    } catch (error) {
      showError(getErrorMessage(error, "No se pudo rotar el token de integración."));
    } finally {
      setActionLoadingKey(null);
    }
  }, [fetchClients, integrationTokenClient, showError]);

  const runGetIntegrationToken = useCallback(
    async (clientKey: string) => {
      setActionLoadingKey(`get-token:${clientKey}`);

      try {
        const data = await getWaClientIntegrationToken(clientKey);
        if (!data.exists || !data.token) {
          showError("El cliente no tiene token de integración generado.");
          return;
        }
        setRotatedIntegrationToken(data.token);
      } catch (error) {
        showError(getErrorMessage(error, "No se pudo obtener el token de integración."));
      } finally {
        setActionLoadingKey(null);
      }
    },
    [showError],
  );

  const copyRotatedIntegrationToken = useCallback(async () => {
    if (!rotatedIntegrationToken) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API no disponible.");
      }
      await navigator.clipboard.writeText(rotatedIntegrationToken);
      showSuccess("Token copiado al portapapeles.");
    } catch (error) {
      showError(getErrorMessage(error, "No se pudo copiar el token."));
    }
  }, [rotatedIntegrationToken, showError, showSuccess]);

  const isActionLoading = useCallback(
    (action: string, clientKey: string) => actionLoadingKey === `${action}:${clientKey}`,
    [actionLoadingKey],
  );

  const runAction = useCallback(
    async (action: string, clientKey: string, handler: () => Promise<unknown>, successMessage: string) => {
      setActionLoadingKey(`${action}:${clientKey}`);
      try {
        await handler();
        showSuccess(successMessage);
        await fetchClients();
      } catch (error) {
        showError(getErrorMessage(error));
      } finally {
        setActionLoadingKey(null);
      }
    },
    [fetchClients, showError, showSuccess],
  );

  const runSetIntegrationMode = useCallback(
    async (client: WaClientListItemResponseHttpDto) => {
      void runAction(
        "integration-mode",
        client.clientKey,
        () =>
          setWaClientIntegrationMode(client.clientKey, {
            isIntegrationTestOnly: !client.isIntegrationTestOnly,
          }),
        !client.isIntegrationTestOnly ? "Modo prueba activado." : "Modo prueba desactivado.",
      );
    },
    [runAction],
  );

  const runAddWhitelistNumber = useCallback(
    async (waChatId: string) => {
      if (!whitelistClient) {
        return;
      }
      setWhitelistActionLoading(true);
      try {
        await addWaClientWhitelistNumber(whitelistClient.clientKey, { waChatId });
        showSuccess("Número agregado a la whitelist.");
        await loadWhitelistNumbers(whitelistClient.clientKey);
        await fetchClients();
      } catch (error) {
        showError(getErrorMessage(error, "No se pudo agregar el número."));
      } finally {
        setWhitelistActionLoading(false);
      }
    },
    [fetchClients, loadWhitelistNumbers, showError, showSuccess, whitelistClient],
  );

  const runRemoveWhitelistNumber = useCallback(
    async (waChatId: string) => {
      if (!whitelistClient) {
        return;
      }
      setWhitelistActionLoading(true);
      try {
        await removeWaClientWhitelistNumber(whitelistClient.clientKey, waChatId);
        showSuccess("Número eliminado de la whitelist.");
        await loadWhitelistNumbers(whitelistClient.clientKey);
        await fetchClients();
      } catch (error) {
        showError(getErrorMessage(error, "No se pudo eliminar el número."));
      } finally {
        setWhitelistActionLoading(false);
      }
    },
    [fetchClients, loadWhitelistNumbers, showError, showSuccess, whitelistClient],
  );

  const activeClients = useMemo(() => clients.filter((client) => client.isActive).length, [clients]);
  const qrExpiry = useMemo(() => getQrExpiryState(qrData?.lastQrAt ?? null), [qrData?.lastQrAt]);

  if (status === "loading") {
    return (
      <Box sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <Box sx={{ minHeight: "100dvh", py: { xs: 2, md: 4 }, backgroundColor: "background.default" }}>
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", md: "center" }}
                spacing={2}
              >
                <Box>
                  <Typography variant="h4">WhatsApp Clients</Typography>
                  <Typography color="text.secondary">Administración de clientes y pruebas de mensajería.</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Usuario: {session?.user?.name ?? "sin datos"}
                  </Typography>
                </Box>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <ModeSwitch />
                  <Button variant="contained" onClick={() => setCreateOpen(true)}>
                    Nuevo cliente
                  </Button>
                  <Button variant="outlined" onClick={() => signOut({ callbackUrl: "/login" })}>
                    Cerrar sesión
                  </Button>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Total clientes
                  </Typography>
                  <Typography variant="h4">{total}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Activos en página actual
                  </Typography>
                  <Typography variant="h4">{activeClients}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {pageError && <Alert severity="error">{pageError}</Alert>}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Listado de clientes</Typography>
                  <Button variant="text" onClick={() => void fetchClients()} disabled={loadingList}>
                    Recargar
                  </Button>
                </Stack>

                {loadingList ? (
                  <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
                    <CircularProgress />
                  </Box>
                ) : clients.length === 0 ? (
                  <Alert severity="info">No hay clientes para mostrar.</Alert>
                ) : isMobile ? (
                  <Stack spacing={1.5}>
                    {clients.map((client) => (
                      <Card key={client.clientKey} variant="outlined">
                        <CardContent>
                          <Stack spacing={1}>
                            <Typography variant="h6">{client.clientKey}</Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Chip label={client.isActive ? "Activo" : "Inactivo"} color={client.isActive ? "success" : "default"} size="small" />
                              <Chip label={client.syncStatus} color={getStatusColor(client.syncStatus)} size="small" />
                              <Chip label={client.hasIntegrationToken ? "Token: Sí" : "Token: No"} color={client.hasIntegrationToken ? "success" : "default"} size="small" />
                              <Chip
                                label={`Modo prueba: ${client.isIntegrationTestOnly ? "Sí" : "No"}`}
                                color={client.isIntegrationTestOnly ? "warning" : "default"}
                                size="small"
                              />
                              <Chip
                                label={`Whitelist: ${client.isIntegrationTestOnly ? client.whitelistCount : "-"}`}
                                color={client.isIntegrationTestOnly ? "warning" : "default"}
                                size="small"
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              Nombre: {client.name || "-"}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Actualizado: {formatDate(client.updatedAt)}
                            </Typography>
                          </Stack>
                        </CardContent>
                        <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2 }}>
                          <IconButton aria-label={`Acciones ${client.clientKey}`} onClick={(event) => openActionsMenu(event, client)}>
                            <MoreVertIcon />
                          </IconButton>
                        </CardActions>
                      </Card>
                    ))}
                  </Stack>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Client key</TableCell>
                          <TableCell>Nombre</TableCell>
                          <TableCell>Activo</TableCell>
                          <TableCell>Sync status</TableCell>
                          <TableCell>Token</TableCell>
                          <TableCell>Modo prueba</TableCell>
                          <TableCell>Nros. prueba</TableCell>
                          <TableCell>Actualizado</TableCell>
                          <TableCell align="right">Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {clients.map((client) => (
                          <TableRow key={client.clientKey} hover>
                            <TableCell>{client.clientKey}</TableCell>
                            <TableCell>{client.name || "-"}</TableCell>
                            <TableCell>{client.isActive ? "Sí" : "No"}</TableCell>
                            <TableCell>
                              <Chip label={client.syncStatus} color={getStatusColor(client.syncStatus)} size="small" />
                            </TableCell>
                            <TableCell>{client.hasIntegrationToken ? "Sí" : "No"}</TableCell>
                            <TableCell>{client.isIntegrationTestOnly ? "Sí" : "No"}</TableCell>
                            <TableCell>{client.isIntegrationTestOnly ? client.whitelistCount : "-"}</TableCell>
                            <TableCell>{formatDate(client.updatedAt)}</TableCell>
                            <TableCell align="right">
                              <IconButton aria-label={`Acciones ${client.clientKey}`} onClick={(event) => openActionsMenu(event, client)}>
                                <MoreVertIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <TablePagination
                  component="div"
                  count={total}
                  page={page}
                  onPageChange={(_event, newPage) => setPage(newPage)}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25]}
                  labelRowsPerPage="Filas por página"
                />
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>

      <Menu
        anchorEl={actionsMenuAnchorEl}
        open={Boolean(actionsMenuAnchorEl && actionsMenuClient)}
        onClose={closeActionsMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setEditingClient(actionsMenuClient);
            closeActionsMenu();
          }}
        >
          Editar
        </MenuItem>
        <MenuItem
          disabled={!actionsMenuClient || isActionLoading("toggle", actionsMenuClient.clientKey)}
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            void runAction(
              "toggle",
              actionsMenuClient.clientKey,
              () =>
                actionsMenuClient.isActive
                  ? deactivateWaClient(actionsMenuClient.clientKey)
                  : activateWaClient(actionsMenuClient.clientKey),
              actionsMenuClient.isActive ? "Cliente desactivado." : "Cliente activado.",
            );
            closeActionsMenu();
          }}
        >
          {actionsMenuClient?.isActive ? "Desactivar" : "Activar"}
        </MenuItem>
        <MenuItem
          disabled={!actionsMenuClient || isActionLoading("reconnect", actionsMenuClient.clientKey)}
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            void runAction(
              "reconnect",
              actionsMenuClient.clientKey,
              () => reconnectWaClient(actionsMenuClient.clientKey),
              "Cliente reconectado.",
            );
            closeActionsMenu();
          }}
        >
          Reconnect
        </MenuItem>
        <MenuItem
          disabled={!actionsMenuClient || isActionLoading("integration-mode", actionsMenuClient.clientKey)}
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            void runSetIntegrationMode(actionsMenuClient);
            closeActionsMenu();
          }}
        >
          {actionsMenuClient?.isIntegrationTestOnly ? "Desactivar modo prueba" : "Activar modo prueba"}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setWhitelistClient(actionsMenuClient);
            closeActionsMenu();
          }}
        >
          Números de prueba
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setStatusClientKey(actionsMenuClient.clientKey);
            closeActionsMenu();
          }}
        >
          Estado
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setQrClientKey(actionsMenuClient.clientKey);
            closeActionsMenu();
          }}
        >
          QR
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setMessageClient(actionsMenuClient);
            closeActionsMenu();
          }}
        >
          Enviar prueba
        </MenuItem>
        <MenuItem
          disabled={!actionsMenuClient || !actionsMenuClient.hasIntegrationToken || isActionLoading("get-token", actionsMenuClient.clientKey)}
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            void runGetIntegrationToken(actionsMenuClient.clientKey);
            closeActionsMenu();
          }}
        >
          Ver token
        </MenuItem>
        <MenuItem
          disabled={!actionsMenuClient || isActionLoading("rotate-token", actionsMenuClient.clientKey)}
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setIntegrationTokenClient(actionsMenuClient);
            closeActionsMenu();
          }}
        >
          Rotar token
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (!actionsMenuClient) {
              return;
            }
            setEventsClientKey(actionsMenuClient.clientKey);
            closeActionsMenu();
          }}
        >
          Eventos
        </MenuItem>
      </Menu>

      <WaClientCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={async (dto) => {
          await createWaClient(dto);
          showSuccess("Cliente creado.");
          setCreateOpen(false);
          await fetchClients();
        }}
        onError={showError}
      />

      <WaClientUpdateDialog
        client={editingClient}
        onClose={() => setEditingClient(null)}
        onSubmit={async (dto) => {
          if (!editingClient) {
            return;
          }
          await updateWaClient(editingClient.clientKey, dto);
          showSuccess("Cliente actualizado.");
          setEditingClient(null);
          await fetchClients();
        }}
        onError={showError}
      />

      <SendMessageDialog
        client={messageClient}
        onClose={() => setMessageClient(null)}
        onSubmit={async (dto) => {
          if (!messageClient) {
            return;
          }
          const response = await sendWaClientMessage(messageClient.clientKey, dto);
          showSuccess(`Mensaje encolado (${response.status}).`);
          setMessageClient(null);
        }}
        onError={showError}
      />

      <WhitelistNumbersDialog
        client={whitelistClient}
        data={whitelistData}
        loading={whitelistLoading}
        actionLoading={whitelistActionLoading}
        onClose={() => setWhitelistClient(null)}
        onRefresh={() => {
          if (!whitelistClient) {
            return Promise.resolve();
          }
          return loadWhitelistNumbers(whitelistClient.clientKey);
        }}
        onAdd={runAddWhitelistNumber}
        onRemove={runRemoveWhitelistNumber}
      />

      <WaEventsDialog
        open={Boolean(eventsClientKey)}
        clientKey={eventsClientKey}
        backendToken={session?.backendToken}
        wsBaseUrl={NEXT_PUBLIC_WS_BASE_URL}
        onClose={() => setEventsClientKey(null)}
      />

      <Dialog open={Boolean(statusClientKey)} onClose={() => setStatusClientKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>Estado del cliente</DialogTitle>
        <DialogContent dividers>
          {statusLoading ? (
            <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : statusData ? (
            <Stack spacing={1.2}>
              <Typography>
                <strong>Client key:</strong> {statusData.clientKey}
              </Typography>
              <Typography>
                <strong>Activo:</strong> {statusData.isActive ? "Sí" : "No"}
              </Typography>
              <Typography>
                <strong>Status:</strong> {statusData.syncStatus}
              </Typography>
              <Typography>
                <strong>lastQrAt:</strong> {formatDate(statusData.lastQrAt)}
              </Typography>
              <Typography>
                <strong>readyAt:</strong> {formatDate(statusData.readyAt)}
              </Typography>
              <Typography>
                <strong>disconnectedAt:</strong> {formatDate(statusData.disconnectedAt)}
              </Typography>
              <Typography>
                <strong>lastError:</strong> {statusData.lastError || "-"}
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">Sin datos.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusClientKey(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(qrClientKey)} onClose={() => setQrClientKey(null)} fullWidth maxWidth="sm">
        <DialogTitle>QR del cliente</DialogTitle>
        <DialogContent dividers>
          {qrLoading ? (
            <Box sx={{ py: 5, display: "grid", placeItems: "center" }}>
              <CircularProgress />
            </Box>
          ) : qrData ? (
            <Stack spacing={1.2}>
              <Typography>
                <strong>Client key:</strong> {qrData.clientKey}
              </Typography>
              <Typography>
                <strong>lastQrAt:</strong> {formatDate(qrData.lastQrAt)}
              </Typography>
              {!qrData.qr ? (
                <Alert severity="error">No hay contenido QR disponible para este cliente.</Alert>
              ) : qrExpiry.isExpired ? (
                <Alert severity="error">
                  {qrExpiry.reason}
                  {qrExpiry.ageMs !== null ? ` Edad aproximada: ${Math.floor(qrExpiry.ageMs / 1000)}s.` : ""}
                </Alert>
              ) : (
                <Stack spacing={1.5} alignItems="center" sx={{ py: 1 }}>
                  <Alert severity="success" sx={{ width: "100%" }}>
                    QR vigente. Expira a los 60 segundos desde su generación.
                  </Alert>
                  {qrAutoRefreshState === "running" ? (
                    <Alert severity="success" sx={{ width: "100%" }}>
                      Actualizando QR cada 3 segundos (máximo 1 minuto).
                    </Alert>
                  ) : null}
                  <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                    <QRCodeSVG value={qrData.qr} size={240} includeMargin />
                  </Box>
                </Stack>
              )}
              {qrAutoRefreshState === "time_limit" ? (
                <Alert
                  severity="success"
                  action={
                    <Button color="inherit" size="small" onClick={restartQrAutoRefresh}>
                      Reiniciar
                    </Button>
                  }
                >
                  Ya no se está actualizando automáticamente. Puedes reiniciar la actualización.
                </Alert>
              ) : null}
            </Stack>
          ) : (
            <Typography color="text.secondary">Sin datos.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQrClientKey(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(integrationTokenClient)}
        onClose={() => {
          if (actionLoadingKey?.startsWith("rotate-token:")) {
            return;
          }
          setIntegrationTokenClient(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Rotar token de integración</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Alert severity="warning">
              Esto va a reemplazar cualquier token anterior generado para este cliente.
            </Alert>
            <Typography>
              <strong>Client key:</strong> {integrationTokenClient?.clientKey}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setIntegrationTokenClient(null)}
            disabled={Boolean(actionLoadingKey?.startsWith("rotate-token:"))}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={() => void runRotateIntegrationToken()}
            disabled={Boolean(actionLoadingKey?.startsWith("rotate-token:"))}
          >
            {actionLoadingKey?.startsWith("rotate-token:") ? "Rotando..." : "Rotar token"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(rotatedIntegrationToken)}
        onClose={() => setRotatedIntegrationToken(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Token de integración</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <TextField
              value={rotatedIntegrationToken ?? ""}
              label="Token"
              fullWidth
              multiline
              minRows={3}
              slotProps={{
                input: {
                  readOnly: true,
                },
              }}
            />
            <IconButton aria-label="Copiar token" onClick={() => void copyRotatedIntegrationToken()} sx={{ mt: 0.5 }}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRotatedIntegrationToken(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          action={
            <IconButton color="inherit" size="small" onClick={() => setSnackbar((prev) => ({ ...prev, open: false }))}>
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function WaClientCreateDialog({
  open,
  onClose,
  onSubmit,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateWaClientHttpDto) => Promise<void>;
  onError: (message: string) => void;
}) {
  const formik = useFormik<WaClientCreateFormValues>({
    initialValues: {
      clientKey: "",
      name: "",
      webhookUrl: "",
      webhookSecret: "",
      isActive: true,
      isIntegrationTestOnly: true,
      metadataText: "",
    },
    enableReinitialize: true,
    validate: (values) => validateWithJoi(createWaClientSchema, values),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const dto: CreateWaClientHttpDto = {
          clientKey: values.clientKey.trim(),
          webhookUrl: values.webhookUrl.trim(),
          webhookSecret: values.webhookSecret.trim(),
          isActive: values.isActive,
          isIntegrationTestOnly: values.isIntegrationTestOnly,
          ...(values.name.trim() && { name: values.name.trim() }),
          ...(values.metadataText.trim() && { metadata: parseMetadata(values.metadataText) }),
        };

        await onSubmit(dto);
        resetForm();
      } catch (error) {
        onError(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Crear cliente</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField
            label="Client key"
            name="clientKey"
            value={formik.values.clientKey}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.clientKey && Boolean(formik.errors.clientKey)}
            helperText={formik.touched.clientKey ? formik.errors.clientKey : " "}
            fullWidth
          />
          <TextField
            label="Nombre"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && Boolean(formik.errors.name)}
            helperText={formik.touched.name ? formik.errors.name : " "}
            fullWidth
          />
          <TextField
            label="Webhook URL"
            name="webhookUrl"
            value={formik.values.webhookUrl}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.webhookUrl && Boolean(formik.errors.webhookUrl)}
            helperText={formik.touched.webhookUrl ? formik.errors.webhookUrl : " "}
            fullWidth
          />
          <TextField
            label="Webhook secret"
            name="webhookSecret"
            value={formik.values.webhookSecret}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.webhookSecret && Boolean(formik.errors.webhookSecret)}
            helperText={formik.touched.webhookSecret ? formik.errors.webhookSecret : " "}
            fullWidth
          />
          <FormControl error={formik.touched.metadataText && Boolean(formik.errors.metadataText)}>
            <TextField
              label="Metadata JSON"
              name="metadataText"
              value={formik.values.metadataText}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              multiline
              minRows={4}
              placeholder='{"plan":"premium"}'
              fullWidth
            />
            <FormHelperText>{formik.touched.metadataText ? formik.errors.metadataText : " "}</FormHelperText>
          </FormControl>
          <FormControlLabel
            control={<Switch name="isActive" checked={formik.values.isActive} onChange={formik.handleChange} />}
            label="Crear como activo"
          />
          <FormControlLabel
            control={
              <Switch
                name="isIntegrationTestOnly"
                checked={formik.values.isIntegrationTestOnly}
                onChange={formik.handleChange}
              />
            }
            label="Modo prueba de integración"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void formik.submitForm()} variant="contained" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Guardando..." : "Crear"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function WaClientUpdateDialog({
  client,
  onClose,
  onSubmit,
  onError,
}: {
  client: WaClientListItemResponseHttpDto | null;
  onClose: () => void;
  onSubmit: (dto: UpdateWaClientHttpDto) => Promise<void>;
  onError: (message: string) => void;
}) {
  const formik = useFormik<WaClientUpdateFormValues>({
    initialValues: {
      name: client?.name || "",
      webhookUrl: "",
      webhookSecret: "",
      isActive: client?.isActive ?? true,
      metadataText: "",
    },
    enableReinitialize: true,
    validate: (values) => validateWithJoi(updateWaClientSchema, values),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const dto: UpdateWaClientHttpDto = {
          isActive: values.isActive,
          ...(values.name.trim() && { name: values.name.trim() }),
          ...(values.webhookUrl.trim() && { webhookUrl: values.webhookUrl.trim() }),
          ...(values.webhookSecret.trim() && { webhookSecret: values.webhookSecret.trim() }),
          ...(values.metadataText.trim() && { metadata: parseMetadata(values.metadataText) }),
        };

        await onSubmit(dto);
        resetForm();
      } catch (error) {
        onError(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={Boolean(client)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar cliente {client?.clientKey}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="info">Completá solo los campos que querés actualizar.</Alert>
          <TextField
            label="Nombre"
            name="name"
            value={formik.values.name}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.name && Boolean(formik.errors.name)}
            helperText={formik.touched.name ? formik.errors.name : " "}
            fullWidth
          />
          <TextField
            label="Webhook URL"
            name="webhookUrl"
            value={formik.values.webhookUrl}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.webhookUrl && Boolean(formik.errors.webhookUrl)}
            helperText={formik.touched.webhookUrl ? formik.errors.webhookUrl : " "}
            fullWidth
          />
          <TextField
            label="Webhook secret"
            name="webhookSecret"
            value={formik.values.webhookSecret}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.webhookSecret && Boolean(formik.errors.webhookSecret)}
            helperText={formik.touched.webhookSecret ? formik.errors.webhookSecret : " "}
            fullWidth
          />
          <FormControl error={formik.touched.metadataText && Boolean(formik.errors.metadataText)}>
            <TextField
              label="Metadata JSON"
              name="metadataText"
              value={formik.values.metadataText}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              multiline
              minRows={4}
              placeholder='{"featureFlag":true}'
              fullWidth
            />
            <FormHelperText>{formik.touched.metadataText ? formik.errors.metadataText : " "}</FormHelperText>
          </FormControl>
          <FormControlLabel
            control={<Switch name="isActive" checked={formik.values.isActive} onChange={formik.handleChange} />}
            label="Cliente activo"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void formik.submitForm()} variant="contained" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Guardando..." : "Actualizar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SendMessageDialog({
  client,
  onClose,
  onSubmit,
  onError,
}: {
  client: WaClientListItemResponseHttpDto | null;
  onClose: () => void;
  onSubmit: (dto: SendMessageHttpDto) => Promise<void>;
  onError: (message: string) => void;
}) {
  const formik = useFormik<SendMessageFormValues>({
    initialValues: {
      to: "",
      body: "",
    },
    enableReinitialize: true,
    validate: (values) => validateWithJoi(sendMessageSchema, values),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const dto: SendMessageHttpDto = {
          to: values.to.trim(),
          body: values.body.trim(),
        };
        await onSubmit(dto);
        resetForm();
      } catch (error) {
        onError(getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={Boolean(client)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Enviar mensaje de prueba</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Alert severity="warning">Este formulario es solo para pruebas de envío del cliente {client?.clientKey}.</Alert>
          <TextField
            label="Destino"
            name="to"
            value={formik.values.to}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.to && Boolean(formik.errors.to)}
            helperText={formik.touched.to ? formik.errors.to : "Ej: 595981000000@c.us"}
            fullWidth
          />
          <TextField
            label="Mensaje"
            name="body"
            value={formik.values.body}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            error={formik.touched.body && Boolean(formik.errors.body)}
            helperText={formik.touched.body ? formik.errors.body : " "}
            multiline
            minRows={4}
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void formik.submitForm()} variant="contained" disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Enviando..." : "Enviar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function WhitelistNumbersDialog({
  client,
  data,
  loading,
  actionLoading,
  onClose,
  onRefresh,
  onAdd,
  onRemove,
}: {
  client: WaClientListItemResponseHttpDto | null;
  data: WaClientWhitelistResponseHttpDto | null;
  loading: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onAdd: (waChatId: string) => Promise<void>;
  onRemove: (waChatId: string) => Promise<void>;
}) {
  const formik = useFormik<WhitelistNumberFormValues>({
    initialValues: {
      waChatId: "",
    },
    enableReinitialize: true,
    validate: (values) => validateWithJoi(whitelistNumberSchema, values),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        await onAdd(values.waChatId.trim());
        resetForm();
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Dialog open={Boolean(client)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Números de prueba</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography>
            <strong>Client key:</strong> {client?.clientKey}
          </Typography>
          <Typography>
            <strong>Modo prueba:</strong> {client?.isIntegrationTestOnly ? "Sí" : "No"}
          </Typography>
          {!client?.isIntegrationTestOnly ? (
            <Alert severity="warning">
              El cliente no está en modo prueba. Puedes gestionar la whitelist igual, pero no se aplicará hasta
              activar modo prueba.
            </Alert>
          ) : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems={{ xs: "stretch", sm: "flex-start" }}>
            <TextField
              fullWidth
              label="Número (waChatId)"
              name="waChatId"
              value={formik.values.waChatId}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              placeholder="595981000000@c.us"
              error={formik.touched.waChatId && Boolean(formik.errors.waChatId)}
              helperText={formik.touched.waChatId ? formik.errors.waChatId : "Formato requerido: 595981000000@c.us"}
            />
            <Button
              variant="contained"
              onClick={() => void formik.submitForm()}
              disabled={loading || actionLoading || formik.isSubmitting}
            >
              Agregar
            </Button>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">Números habilitados</Typography>
            <Button
              variant="text"
              onClick={() => void onRefresh()}
              disabled={loading || actionLoading || formik.isSubmitting}
            >
              Recargar
            </Button>
          </Stack>

          {loading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress size={28} />
            </Box>
          ) : !data || data.data.length === 0 ? (
            <Alert severity="info">No hay números de prueba para este cliente.</Alert>
          ) : (
            <Stack spacing={1}>
              {data.data.map((item) => (
                <Card key={item.waChatId} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Typography sx={{ wordBreak: "break-all" }}>{item.waChatId}</Typography>
                      <IconButton
                        aria-label={`Eliminar ${item.waChatId}`}
                        onClick={() => void onRemove(item.waChatId)}
                        disabled={actionLoading || formik.isSubmitting}
                        color="error"
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

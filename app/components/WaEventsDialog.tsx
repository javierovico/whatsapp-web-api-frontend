"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import {
  WA_STREAMS,
  WaRealtimeEnvelope,
  WaStream,
  WaSubscribeAck,
} from "@/api-backend/wa-events/realtime-contract";
import {
  WA_BUFFER_MAX,
  WA_DEDUP_WINDOW_MS,
  createWaEventsSocket,
  emitSubscribe,
  emitUnsubscribe,
  normalizeSocketError,
  registerWaEventHandlers,
} from "@/lib/realtime/wa-events-socket";

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface Props {
  open: boolean;
  clientKey: string | null;
  backendToken?: string;
  wsBaseUrl?: string;
  onClose: () => void;
}

function formatDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("es-PY", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function stringifyPayload(payload: unknown) {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return "<payload no serializable>";
  }
}

function getConnectionColor(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "success" as const;
    case "reconnecting":
    case "connecting":
      return "warning" as const;
    case "error":
      return "error" as const;
    default:
      return "default" as const;
  }
}

function getEventKey(item: WaRealtimeEnvelope) {
  return `${item.eventId}|${item.status}|${item.timestamp}`;
}

export default function WaEventsDialog({ open, clientKey, backendToken, wsBaseUrl, onClose }: Props) {
  const [stream, setStream] = useState<WaStream>("all");
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [events, setEvents] = useState<WaRealtimeEnvelope[]>([]);
  const [ackInfo, setAckInfo] = useState<WaSubscribeAck | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);
  const [replayCompleted, setReplayCompleted] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const subscribedStreamRef = useRef<WaStream | null>(null);
  const dedupeRef = useRef<Map<string, number>>(new Map());
  const preconditionError = useMemo(() => {
    if (!clientKey) {
      return "No se recibió clientKey para el visor de eventos.";
    }
    if (!backendToken) {
      return "La sesión no tiene backendToken para autenticación WebSocket.";
    }
    if (!wsBaseUrl) {
      return "Falta configurar NEXT_PUBLIC_WS_BASE_URL.";
    }
    return null;
  }, [backendToken, clientKey, wsBaseUrl]);

  const pushEvent = useCallback((event: WaRealtimeEnvelope) => {
    const dedupeKey = getEventKey(event);
    const now = Date.now();

    dedupeRef.current.forEach((ts, key) => {
      if (now - ts > WA_DEDUP_WINDOW_MS) {
        dedupeRef.current.delete(key);
      }
    });

    if (dedupeRef.current.has(dedupeKey)) {
      return;
    }

    dedupeRef.current.set(dedupeKey, now);

    if (event.__meta?.eventName === "queue.replay.completed") {
      setReplayCompleted(true);
    }

    setEvents((prev) => {
      const next = [event, ...prev];
      if (next.length > WA_BUFFER_MAX) {
        next.length = WA_BUFFER_MAX;
      }
      return next;
    });
  }, []);

  const closeSocket = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    if (clientKey && subscribedStreamRef.current && socket.connected) {
      await emitUnsubscribe(socket, clientKey, subscribedStreamRef.current);
    }

    socket.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
    subscribedStreamRef.current = null;
    setStatus("disconnected");
  }, [clientKey]);

  const subscribeCurrent = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket || !socket.connected || !clientKey) {
      return;
    }

    try {
      if (subscribedStreamRef.current && subscribedStreamRef.current !== stream) {
        await emitUnsubscribe(socket, clientKey, subscribedStreamRef.current);
      }

      const ack = await emitSubscribe(socket, clientKey, stream);
      setAckInfo(ack);

      if (!ack.ok) {
        setErrorText(`${ack.code}: ${ack.message || "Error en subscribe"}`);
        if (ack.code === "RATE_LIMIT" && ack.retryable) {
          setStatus("reconnecting");
        } else {
          setStatus("error");
        }
        return;
      }

      subscribedStreamRef.current = stream;
      setErrorText(null);
      setStatus("connected");
    } catch (error) {
      const normalized = normalizeSocketError(error);
      setErrorText(`${normalized.code}: ${normalized.message}`);
      setStatus("error");
    }
  }, [clientKey, stream]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (preconditionError) {
      return;
    }

    const socket = createWaEventsSocket(wsBaseUrl as string, backendToken as string);
    socketRef.current = socket;

    const unregisterEventHandlers = registerWaEventHandlers(socket, pushEvent);

    const handleConnect = () => {
      setStatus("connected");
      setErrorText(null);
      void subscribeCurrent();
    };

    const handleDisconnect = () => {
      setStatus("reconnecting");
    };

    const handleConnectError = (error: unknown) => {
      const normalized = normalizeSocketError(error);
      setErrorText(`${normalized.code}: ${normalized.message}`);
      setStatus("error");
    };

    const handleSocketError = (payload: unknown) => {
      const normalized = normalizeSocketError(payload);
      setErrorText(`${normalized.code}: ${normalized.message}`);
      setStatus("error");
    };

    const handleReconnectAttempt = () => {
      setStatus("reconnecting");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("socket.error", handleSocketError);
    socket.io.on("reconnect_attempt", handleReconnectAttempt);

    return () => {
      unregisterEventHandlers();
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("socket.error", handleSocketError);
      socket.io.off("reconnect_attempt", handleReconnectAttempt);
      void closeSocket();
    };
  }, [backendToken, clientKey, closeSocket, open, preconditionError, pushEvent, subscribeCurrent, wsBaseUrl]);

  useEffect(() => {
    if (!open || !socketRef.current?.connected || !clientKey) {
      return;
    }

    void subscribeCurrent();
  }, [clientKey, open, stream, subscribeCurrent]);

  const streamOptions = useMemo(() => WA_STREAMS, []);
  const effectiveStatus: ConnectionStatus = preconditionError ? "error" : status;

  const handleReconnect = async () => {
    if (!socketRef.current) {
      return;
    }

    setStatus("connecting");
    socketRef.current.connect();
  };

  const handleDisconnect = async () => {
    await closeSocket();
  };

  const handleClearEvents = () => {
    setEvents([]);
    setReplayCompleted(false);
    dedupeRef.current.clear();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Eventos Realtime {clientKey ? `- ${clientKey}` : ""}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            <Chip label={`Conexión: ${effectiveStatus}`} color={getConnectionColor(effectiveStatus)} />
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="wa-stream-label">Stream</InputLabel>
              <Select
                labelId="wa-stream-label"
                value={stream}
                label="Stream"
                onChange={(event) => setStream(event.target.value as WaStream)}
              >
                {streamOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={() => void handleReconnect()}>
              Reconectar
            </Button>
            <Button variant="outlined" color="warning" onClick={() => void handleDisconnect()}>
              Desconectar
            </Button>
            <Button variant="text" onClick={handleClearEvents}>
              Limpiar eventos
            </Button>
          </Stack>

          {(preconditionError || errorText) && <Alert severity="error">{preconditionError || errorText}</Alert>}

          {ackInfo && (
            <Alert severity={ackInfo.ok ? "success" : "error"}>
              ACK: {ackInfo.code}
              {ackInfo.message ? ` - ${ackInfo.message}` : ""}
            </Alert>
          )}

          {replayCompleted && <Alert severity="info">Replay inicial completado.</Alert>}

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">Eventos en buffer:</Typography>
            <Chip label={events.length} size="small" />
            <Typography variant="body2" color="text.secondary">
              (máximo {WA_BUFFER_MAX})
            </Typography>
          </Stack>

          <Divider />

          {events.length === 0 ? (
            <Alert severity="info">Sin eventos todavía para esta suscripción.</Alert>
          ) : (
            <Stack spacing={1}>
              {events.map((item) => {
                const itemKey = getEventKey(item);
                const isExpanded = expandedEventKey === itemKey;

                return (
                  <Box key={itemKey} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between">
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label={item.__meta?.eventName || "event"} size="small" />
                        <Chip label={item.status} size="small" color={item.status === "ERROR" || item.status === "FAILED" ? "error" : "default"} />
                        <Chip label={item.source} size="small" variant="outlined" />
                        <Chip label={item.type} size="small" variant="outlined" />
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(item.timestamp)}
                        </Typography>
                        <Button size="small" onClick={() => setExpandedEventKey(isExpanded ? null : itemKey)}>
                          {isExpanded ? "Ocultar" : "Detalle"}
                        </Button>
                      </Stack>
                    </Stack>

                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      eventId: {item.eventId}
                    </Typography>

                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                      <Box
                        component="pre"
                        sx={{
                          mt: 1,
                          p: 1,
                          bgcolor: "background.default",
                          borderRadius: 1,
                          overflowX: "auto",
                          fontSize: 12,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      >
                        {stringifyPayload(item.payload)}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        schemaVersion: {item.schemaVersion}
                        {item.__meta?.payloadBytes ? ` | payloadBytes: ${item.__meta.payloadBytes}` : ""}
                        {item.__meta?.payloadTruncated ? " | payload truncado" : ""}
                      </Typography>
                    </Collapse>
                  </Box>
                );
              })}
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

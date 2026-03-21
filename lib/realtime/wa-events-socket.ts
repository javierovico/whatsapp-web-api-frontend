import { io, Socket } from "socket.io-client";
import {
  WA_REALTIME_SCHEMA_VERSION,
  WA_STREAMS,
  WaSubscribeAck,
  WaRealtimeEnvelope,
  WaServerEventName,
  WaSocketErrorPayload,
  WaStream,
  WA_SERVER_EVENT_NAMES,
} from "@/api-backend/wa-events/realtime-contract";

export const WA_DEDUP_WINDOW_MS = 5 * 60_000;
export const WA_BUFFER_MAX = 500;
export const WA_PAYLOAD_RENDER_MAX_BYTES = 64 * 1024;

export function isWaStream(value: string): value is WaStream {
  return WA_STREAMS.includes(value as WaStream);
}

export function createWaEventsSocket(wsBaseUrl: string, token: string) {
  const baseUrl = wsBaseUrl.replace(/\/$/, "");

  return io(`${baseUrl}/wa-events`, {
    transports: ["websocket"],
    auth: {
      token: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });
}

export function emitSubscribe(socket: Socket, clientKey: string, stream: WaStream) {
  return new Promise<WaSubscribeAck>((resolve) => {
    socket.emit("subscribe", { clientKey, streams: [stream] }, (ack: WaSubscribeAck) => {
      resolve(ack);
    });
  });
}

export function emitUnsubscribe(socket: Socket, clientKey: string, stream: WaStream) {
  return new Promise<WaSubscribeAck>((resolve) => {
    socket.emit("unsubscribe", { clientKey, streams: [stream] }, (ack: WaSubscribeAck) => {
      resolve(ack);
    });
  });
}

export function normalizeSocketError(error: unknown) {
  const payload = (error ?? {}) as WaSocketErrorPayload;
  return {
    code: payload.code || "WS_ERROR",
    message: payload.message || "Error de WebSocket.",
  };
}

function normalizeTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

export function sanitizeEnvelope(eventName: WaServerEventName, raw: unknown): WaRealtimeEnvelope | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Partial<WaRealtimeEnvelope>;
  if (!item.eventId || !item.clientKey || !item.timestamp || !item.status || !item.source || !item.type) {
    return null;
  }

  if (!item.schemaVersion || !item.schemaVersion.startsWith("1.")) {
    return null;
  }

  let payload: unknown = item.payload ?? {};
  let payloadBytes = 0;
  let payloadTruncated = false;

  try {
    const payloadString = JSON.stringify(payload);
    payloadBytes = payloadString ? new Blob([payloadString]).size : 0;

    if (payloadBytes > WA_PAYLOAD_RENDER_MAX_BYTES) {
      payloadTruncated = true;
      payload = {
        __truncated: true,
        message: "Payload truncado para proteger rendimiento de UI.",
        payloadBytes,
      };
    }
  } catch {
    payload = {
      __invalidPayload: true,
      message: "No se pudo serializar el payload.",
    };
  }

  return {
    schemaVersion: item.schemaVersion || WA_REALTIME_SCHEMA_VERSION,
    eventId: item.eventId,
    clientKey: item.clientKey,
    source: item.source,
    type: item.type,
    status: item.status,
    timestamp: normalizeTimestamp(item.timestamp),
    payload,
    traceId: item.traceId,
    __meta: {
      payloadBytes,
      payloadTruncated,
      eventName,
    },
  };
}

export function registerWaEventHandlers(socket: Socket, handler: (event: WaRealtimeEnvelope) => void) {
  WA_SERVER_EVENT_NAMES.forEach((eventName) => {
    socket.on(eventName, (raw) => {
      const normalized = sanitizeEnvelope(eventName, raw);
      if (normalized) {
        handler(normalized);
      }
    });
  });

  return () => {
    WA_SERVER_EVENT_NAMES.forEach((eventName) => {
      socket.off(eventName);
    });
  };
}

export const WA_REALTIME_SCHEMA_VERSION = "1.0.0";

export const WA_STREAMS = ["all", "wa-events", "webhook-delivery", "errors", "outbound"] as const;
export type WaStream = (typeof WA_STREAMS)[number];

export type WaSubscribeAckCode =
  | "SUBSCRIBED"
  | "UNSUBSCRIBED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface WaSubscribeRequest {
  clientKey: string;
  streams: WaStream[];
}

export interface WaSubscribeAck {
  ok: boolean;
  code: WaSubscribeAckCode;
  message?: string;
  retryable?: boolean;
  rooms?: string[];
  schemaVersion: string;
}

export type WaEventType =
  | "QR"
  | "READY"
  | "AUTHENTICATED"
  | "AUTH_FAILURE"
  | "DISCONNECTED"
  | "MESSAGE"
  | "MESSAGE_CREATE"
  | "MESSAGE_ACK"
  | "MESSAGE_SEND"
  | "REPLAY";

export type WaEventSource = "whatsapp" | "queue" | "webhook";

export interface WaRealtimeEnvelope {
  schemaVersion: string;
  eventId: string;
  clientKey: string;
  source: WaEventSource;
  type: WaEventType | string;
  status: string;
  timestamp: string;
  payload: unknown;
  traceId?: string;
  __meta?: {
    payloadBytes?: number;
    payloadTruncated?: boolean;
    eventName?: WaServerEventName;
  };
}

export type WaServerEventName =
  | "queue.event.received"
  | "queue.event.error"
  | "webhook.delivery.updated"
  | "outbound.message.updated"
  | "queue.replay.completed";

export const WA_SERVER_EVENT_NAMES: WaServerEventName[] = [
  "queue.event.received",
  "queue.event.error",
  "webhook.delivery.updated",
  "outbound.message.updated",
  "queue.replay.completed",
];

export interface WaSocketErrorPayload {
  code?: string;
  message?: string;
}

# WebSocket Realtime Contract: Cola WhatsApp

## 1) Endpoint de conexión

- Protocolo: Socket.IO v4 sobre WebSocket.
- URL backend (base HTTP): `http://<host>:<port>`.
- Namespace: `/wa-events`.
- Endpoint final cliente: `http://<host>:<port>/wa-events`.
- Path Engine.IO: `/socket.io` (default Socket.IO).
- Transportes permitidos: `websocket` (recomendado), `polling` (fallback de Socket.IO si el cliente lo habilita).

Ejemplo:

```ts
io('http://localhost:3004/wa-events', {
  transports: ['websocket'],
  auth: { token: `Bearer ${jwt}` },
});
```

## 2) Seguridad y autenticación

- Control global por `.env`:
  - `WS_ENABLED`
  - `WS_JWT_REQUIRED`
  - `WS_CORS_ORIGINS`
- Token JWT aceptado en handshake por este orden:
  - `auth.token`
  - header `authorization: Bearer <token>`
  - query `token`
- Si falla autenticación en conexión, el servidor emite `socket.error` y cierra:

```json
{
  "code": "WS_UNAUTHORIZED",
  "message": "..."
}
```

- Autorización por tenant al suscribir:
  - permiso requerido: `WA_EVENTS_STREAM_READ`
  - global: acceso a cualquier `clientKey`
  - contextual: solo `clientKey` asignados al usuario

## 3) Contrato de subscribe/unsubscribe (ACK y error)

Evento cliente->servidor: `subscribe`

```json
{
  "clientKey": "acme-main",
  "streams": ["all", "wa-events", "webhook-delivery", "errors", "outbound"]
}
```

Evento cliente->servidor: `unsubscribe`

```json
{
  "clientKey": "acme-main",
  "streams": ["all"]
}
```

ACK exitoso (`subscribe` o `unsubscribe`):

```json
{
  "ok": true,
  "code": "SUBSCRIBED",
  "rooms": ["tenant:acme-main:stream:all"],
  "schemaVersion": "1.0.0"
}
```

```json
{
  "ok": true,
  "code": "UNSUBSCRIBED",
  "rooms": ["tenant:acme-main:stream:all"],
  "schemaVersion": "1.0.0"
}
```

ACK con error de negocio/autorización:

```json
{
  "ok": false,
  "code": "FORBIDDEN",
  "message": "Missing permission WA_EVENTS_STREAM_READ for clientKey acme-main",
  "retryable": false,
  "schemaVersion": "1.0.0"
}
```

Códigos de error ACK soportados:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `BAD_REQUEST`
- `RATE_LIMIT`
- `VALIDATION_ERROR`
- `INTERNAL_ERROR`

Errores de conexión (antes de subscribe) van por `socket.error`.

### Ejemplos ACK de error (completos)

`UNAUTHENTICATED`

```json
{
  "ok": false,
  "code": "UNAUTHENTICATED",
  "message": "Socket session is not authenticated",
  "retryable": false,
  "schemaVersion": "1.0.0"
}
```

`FORBIDDEN`

```json
{
  "ok": false,
  "code": "FORBIDDEN",
  "message": "Missing permission WA_EVENTS_STREAM_READ for clientKey acme-main",
  "retryable": false,
  "schemaVersion": "1.0.0"
}
```

`BAD_REQUEST`

```json
{
  "ok": false,
  "code": "BAD_REQUEST",
  "message": "Missing clientKey in request body",
  "retryable": false,
  "schemaVersion": "1.0.0"
}
```

`RATE_LIMIT`

```json
{
  "ok": false,
  "code": "RATE_LIMIT",
  "message": "Rate limit exceeded: max 60 subscribe operations/min",
  "retryable": true,
  "schemaVersion": "1.0.0"
}
```

`VALIDATION_ERROR`

```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "streams must be an array",
  "retryable": false,
  "schemaVersion": "1.0.0"
}
```

`INTERNAL_ERROR`

```json
{
  "ok": false,
  "code": "INTERNAL_ERROR",
  "message": "Unexpected subscription error",
  "retryable": true,
  "schemaVersion": "1.0.0"
}
```

## 4) Semántica de streams

Rooms: `tenant:{clientKey}:stream:{stream}`

- `all`: replica todos los eventos funcionales (`wa-events`, `webhook-delivery`, `errors`, `outbound`).
- `wa-events`: eventos entrantes/persistidos de WhatsApp (`queue.event.received`).
- `webhook-delivery`: estado de entrega de webhook (`webhook.delivery.updated`).
- `errors`: errores de proceso/evento (`queue.event.error`, fallos de webhook, fallos de outbound).
- `outbound`: estado de cola de mensajes salientes (`outbound.message.updated`).

## 5) Schemas por evento (server->client)

Todos los eventos usan envelope común:

```json
{
  "schemaVersion": "1.0.0",
  "eventId": "evt_123",
  "clientKey": "acme-main",
  "source": "whatsapp",
  "type": "MESSAGE",
  "status": "RECEIVED",
  "timestamp": "2026-03-20T03:12:00.000Z",
  "payload": {},
  "traceId": "optional"
}
```

### `queue.event.received`

- `source`: `whatsapp`
- `status`: `RECEIVED`
- `type`: `WaEventType` (`QR`, `READY`, `AUTHENTICATED`, `AUTH_FAILURE`, `DISCONNECTED`, `MESSAGE`, ...)
- `payload`: payload original del evento WA persistido

### `queue.event.error`

- `source`: `queue`
- `status`: `ERROR`
- `type`: tipo WA asociado
- `payload`: incluye `error` string y contexto del evento

### `webhook.delivery.updated`

- `source`: `webhook`
- `status`: `SUCCESS` | `FAILED`
- `payload`:

```json
{
  "attempt": 1,
  "responseStatus": 200,
  "responseBody": "...",
  "errorMessage": "...",
  "nextRetryAt": "2026-03-20T03:15:00.000Z",
  "deliveredAt": "2026-03-20T03:14:58.000Z"
}
```

### `outbound.message.updated`

- `source`: `queue`
- `status`: `SENT` | `FAILED`
- `type`: `MESSAGE_SEND`
- `payload`:

```json
{
  "to": "5959...",
  "providerMessageId": "wamid...",
  "errorMessage": "..."
}
```

### `queue.replay.completed`

- evento técnico de fin de replay inicial
- `source`: `queue`
- `status`: `COMPLETED`
- `type`: `REPLAY`
- `payload`:

```json
{
  "streams": ["all"],
  "replayLimit": 50
}
```

### Catálogo cerrado `WaEventType` (estable v1)

Lista completa soportada:

- `QR`
- `READY`
- `AUTHENTICATED`
- `AUTH_FAILURE`
- `DISCONNECTED`
- `MESSAGE`
- `MESSAGE_CREATE`
- `MESSAGE_ACK`

Regla de estabilidad:

- No renombrar valores existentes en `1.x.x`.
- Nuevas variantes son aditivas (minor).
- Eliminar o renombrar implica breaking change (major).

## 6) Replay al conectar

- Controlado por:
  - `WS_REPLAY_ON_CONNECT`
  - `WS_REPLAY_LIMIT`
- Se ejecuta al `subscribe` exitoso.
- Orden de envío en replay: cronológico ascendente dentro de cada fuente (se consulta en desc y luego se invierte).
- Fuentes replayadas:
  - `WaEvent`
  - `WaWebhookDelivery`
  - `WaOutboundMessage`
- Marca explícita de fin: `queue.replay.completed`.

## 7) Garantías de entrega

- Modelo de entrega: **at-least-once** (puede haber duplicados).
- No hay garantía de exactly-once.
- Orden:
  - se mantiene por stream/room según orden de emisión del proceso local,
  - no se garantiza orden global entre streams distintos.
- Recomendación frontend:
  - deduplicar por `eventId` + `status` + `timestamp`.
  - mantener una ventana temporal de deduplicación (ej. 2-5 minutos) en memoria.
  - limitar buffer en memoria por `clientKey+stream`.

### Límites recomendados de payload/buffer (frontend)

- Buffer por stream: `500` eventos (ring buffer).
- Si hay replay habilitado, usar `bufferMax = max(500, WS_REPLAY_LIMIT * 2)`.
- Límite sugerido por payload individual: `<= 64 KB`.
- Si llega payload mayor, truncar el render en UI y conservar metadata (`eventId`, `status`, `timestamp`).
- No persistir `responseBody` completo indefinidamente en memoria del navegador.
- Si entran > `100` eventos/segundo, agrupar render por lotes para evitar bloqueo de UI.

## 8) Reconnect y expiración de token

- Si el token es inválido/expiró al conectar:
  - evento `socket.error` con `WS_UNAUTHORIZED`,
  - desconexión inmediata.
- Flujo recomendado frontend:
  1. detectar disconnect/auth error.
  2. refrescar JWT.
  3. reconectar.
  4. reemitir `subscribe` para cada `clientKey/stream`.
- Si hay rate limit en subscribe: recibirás ACK `RATE_LIMIT` con `retryable=true`.

## 9) Versionado de contrato

- Campo obligatorio: `schemaVersion` en todos los eventos y ACK.
- Versión actual: `1.0.0`.
- Regla de compatibilidad:
  - cambios breaking -> bump mayor (`2.x.x`),
  - cambios aditivos -> bump menor (`1.1.x`).

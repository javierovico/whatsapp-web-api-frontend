export interface WaClientQrResponseHttpDto {
  clientKey: string;
  qr: string | null;
  lastQrAt: string | null;
}

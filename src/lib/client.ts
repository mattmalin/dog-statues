export async function send<T>(url: string, method: string, data: unknown): Promise<T> {
  const result = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await result.json().catch(() => null);
  if (!result.ok)
    throw new RequestError(result.status, payload?.message || 'Try again in a moment.');
  return payload as T;
}

export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function message(cause: unknown) {
  return cause instanceof RequestError ? cause.message : 'Connection interrupted. Try again.';
}

export function uploadId() {
  // getRandomValues is available during HTTP development on an Android device over LAN.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

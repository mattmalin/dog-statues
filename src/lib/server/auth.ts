import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config';

export const cookieName = 'atlas_local_admin';
const lifetime = 60 * 60 * 24 * 14;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

function equal(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

function sign(expiry: string) {
  return createHmac('sha256', config.localPassword)
    .update('atlas-local:' + expiry)
    .digest('hex');
}

export function localSession(password: string) {
  if (
    !config.localAuth ||
    config.localPassword.length < 24 ||
    !equal(password, config.localPassword)
  ) {
    return null;
  }
  const expiry = String(Math.floor(Date.now() / 1000) + lifetime);
  return { token: expiry + '.' + sign(expiry), lifetime };
}

export function isAdmin(headers: Headers, cookie?: string) {
  if (config.localAuth && config.localPassword.length >= 24 && cookie) {
    const parts = /^(\d{10})\.([a-f0-9]{64})$/.exec(cookie);
    if (parts && Number(parts[1]) > Date.now() / 1000 && equal(parts[2], sign(parts[1])))
      return true;
  }

  if (!config.entraAuth || !uuid.test(config.tenant) || !uuid.test(config.owner)) return false;

  // Only enable this mode behind the Azure auth sidecar, which owns these headers.
  const encoded = headers.get('x-ms-client-principal');
  if (!encoded || encoded.length > 24000 || headers.get('x-ms-client-principal-idp') !== 'aad') {
    return false;
  }
  try {
    const principal = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    if (principal.auth_typ !== 'aad' || !Array.isArray(principal.claims)) return false;
    const matches = (short: string, long: string, expected: string) => {
      const claims = principal.claims.filter(
        (claim: { typ: string }) =>
          claim.typ === short ||
          claim.typ === 'http://schemas.microsoft.com/identity/claims/' + long,
      );
      return (
        claims.length > 0 &&
        claims.every(
          (claim: { val: string }) =>
            typeof claim.val === 'string' && claim.val.toLowerCase() === expected.toLowerCase(),
        )
      );
    };
    return (
      matches('oid', 'objectidentifier', config.owner) && matches('tid', 'tenantid', config.tenant)
    );
  } catch {
    return false;
  }
}

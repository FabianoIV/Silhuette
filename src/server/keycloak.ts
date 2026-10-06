import {
  createHash,
  createHmac,
  createPublicKey,
  createVerify,
  randomBytes,
  timingSafeEqual,
  type KeyObject,
} from 'node:crypto';
import type { SessionUser } from '../app/auth/session-user';
import { loadEnvFile } from './env-file';

loadEnvFile();

const SECRET = process.env['SILHOUETTE_SESSION_SECRET'] ?? 'silhouette-dev-session-secret';
const TRANSACTION_TTL_MS = 10 * 60 * 1000;
const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export interface KeycloakSettings {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
  issuer: string;
  redirectUri?: string;
}

interface LoginTransaction {
  state: string;
  nonce: string;
  verifier: string;
  exp: number;
}

interface JsonWebKeyWithKid {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

const jwksCache = new Map<string, { keys: Map<string, KeyObject>; fetchedAt: number }>();

export function readKeycloakSettings(): KeycloakSettings | null {
  const baseUrl = normalizeBaseUrl(process.env['KEYCLOAK_URL']);
  const realm = process.env['KEYCLOAK_REALM']?.trim();
  const clientId = process.env['KEYCLOAK_CLIENT_ID']?.trim();
  if (!baseUrl || !realm || !clientId) {
    return null;
  }

  const clientSecret = process.env['KEYCLOAK_CLIENT_SECRET']?.trim();
  const issuer = process.env['KEYCLOAK_ISSUER']?.trim() || `${baseUrl}/realms/${realm}`;
  const redirectUri = process.env['KEYCLOAK_REDIRECT_URI']?.trim();

  return {
    baseUrl,
    realm,
    clientId,
    clientSecret: clientSecret || undefined,
    issuer,
    redirectUri: redirectUri || undefined,
  };
}

export function createLoginTransaction(): LoginTransaction & { challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return {
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
    exp: Date.now() + TRANSACTION_TTL_MS,
  };
}

export function sealLoginTransaction(transaction: LoginTransaction): string {
  const encoded = Buffer.from(
    JSON.stringify({
      state: transaction.state,
      nonce: transaction.nonce,
      verifier: transaction.verifier,
      exp: transaction.exp,
    }),
    'utf8',
  ).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function openLoginTransaction(token: string): LoginTransaction | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) {
    return null;
  }

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = createHmac('sha256', SECRET).update(encoded).digest('base64url');
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<LoginTransaction>;
    if (
      typeof payload.state !== 'string' ||
      typeof payload.nonce !== 'string' ||
      typeof payload.verifier !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp < Date.now()
    ) {
      return null;
    }

    return {
      state: payload.state,
      nonce: payload.nonce,
      verifier: payload.verifier,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function authorizationRedirect(
  settings: KeycloakSettings,
  input: { redirectUri: string; state: string; nonce: string; challenge: string },
): string {
  const url = new URL(endpoint(settings, 'auth'));
  url.searchParams.set('client_id', settings.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', input.state);
  url.searchParams.set('nonce', input.nonce);
  url.searchParams.set('code_challenge', input.challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function endSessionRedirect(settings: KeycloakSettings, postLogoutRedirectUri: string): string {
  const url = new URL(endpoint(settings, 'logout'));
  url.searchParams.set('client_id', settings.clientId);
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
  return url.toString();
}

export function callbackUri(origin: string, settings: KeycloakSettings): string {
  return settings.redirectUri || `${origin}/api/callback`;
}

export async function userFromAuthorizationCode(input: {
  settings: KeycloakSettings;
  code: string;
  redirectUri: string;
  verifier: string;
  nonce: string;
  fetchImpl?: typeof fetch;
}): Promise<SessionUser> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.settings.clientId,
    code_verifier: input.verifier,
  });
  if (input.settings.clientSecret) {
    body.set('client_secret', input.settings.clientSecret);
  }

  const tokenResponse = await fetchImpl(endpoint(input.settings, 'token'), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Token endpoint returned ${tokenResponse.status}.`);
  }

  const tokenBody = (await tokenResponse.json()) as { id_token?: unknown };
  if (typeof tokenBody.id_token !== 'string' || !tokenBody.id_token) {
    throw new Error('Token response has no id_token.');
  }

  const claims = await verifiedIdTokenClaims(input.settings, tokenBody.id_token, fetchImpl);
  if (claims.iss !== input.settings.issuer) {
    throw new Error('ID token issuer does not match the realm.');
  }
  if (!audienceIncludes(claims.aud, input.settings.clientId)) {
    throw new Error('ID token audience does not include the client.');
  }
  if (claims.nonce !== input.nonce) {
    throw new Error('ID token nonce does not match the login transaction.');
  }

  const now = Date.now();
  if (typeof claims.exp !== 'number' || claims.exp * 1000 + CLOCK_SKEW_MS < now) {
    throw new Error('ID token is expired.');
  }
  if (typeof claims.nbf === 'number' && claims.nbf * 1000 - CLOCK_SKEW_MS > now) {
    throw new Error('ID token is not valid yet.');
  }

  return userFromClaims(claims);
}

function userFromClaims(claims: IdTokenClaims): SessionUser {
  const email = firstText(claims.email, claims.preferred_username);
  const name = firstText(
    claims.name,
    joinName(claims.given_name, claims.family_name),
    claims.preferred_username,
    email,
  );
  if (!email || !name) {
    throw new Error('ID token has no name or email.');
  }

  return { name, email };
}

async function verifiedIdTokenClaims(
  settings: KeycloakSettings,
  idToken: string,
  fetchImpl: typeof fetch,
): Promise<IdTokenClaims> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('ID token is malformed.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
    alg?: unknown;
    kid?: unknown;
  };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('ID token must be signed with RS256.');
  }

  const key = await signingKey(settings, header.kid, fetchImpl);
  const signature = Buffer.from(encodedSignature, 'base64url');
  const valid = createVerify('RSA-SHA256')
    .update(`${encodedHeader}.${encodedPayload}`)
    .verify(key, signature);
  if (!valid) {
    throw new Error('ID token signature is invalid.');
  }

  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as IdTokenClaims;
}

async function signingKey(
  settings: KeycloakSettings,
  kid: string,
  fetchImpl: typeof fetch,
): Promise<KeyObject> {
  const cached = jwksCache.get(settings.issuer);
  const fresh = cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS ? cached.keys.get(kid) : undefined;
  if (fresh) {
    return fresh;
  }

  const keys = await fetchJwks(settings, fetchImpl);
  const key = keys.get(kid);
  if (!key) {
    throw new Error('ID token key is not published by the realm.');
  }
  return key;
}

async function fetchJwks(settings: KeycloakSettings, fetchImpl: typeof fetch): Promise<Map<string, KeyObject>> {
  const response = await fetchImpl(endpoint(settings, 'certs'), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`JWKS endpoint returned ${response.status}.`);
  }

  const body = (await response.json()) as { keys?: JsonWebKeyWithKid[] };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kty !== 'RSA' || jwk.use === 'enc' || !jwk.kid || !jwk.n || !jwk.e) {
      continue;
    }
    keys.set(
      jwk.kid,
      createPublicKey({
        key: jwk as unknown as import('node:crypto').JsonWebKey,
        format: 'jwk',
      }),
    );
  }

  jwksCache.set(settings.issuer, { keys, fetchedAt: Date.now() });
  return keys;
}

function endpoint(settings: KeycloakSettings, name: 'auth' | 'token' | 'logout' | 'certs'): string {
  const realm = encodeURIComponent(settings.realm);
  return `${settings.baseUrl}/realms/${realm}/protocol/openid-connect/${name}`;
}

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function audienceIncludes(audience: unknown, clientId: string): boolean {
  if (typeof audience === 'string') {
    return audience === clientId;
  }
  return Array.isArray(audience) && audience.some((entry) => entry === clientId);
}

function firstText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

function joinName(given: unknown, family: unknown): string | undefined {
  const parts = [given, family].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
  return parts.length ? parts.map((part) => part.trim()).join(' ') : undefined;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  nonce?: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
}

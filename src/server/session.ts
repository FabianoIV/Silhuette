import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { SessionUser } from '../app/auth/session-user';
import { loadEnvFile } from './env-file';

loadEnvFile();

export const SESSION_COOKIE = 'silhouette_session';

const SECRET = process.env['SILHOUETTE_SESSION_SECRET'] ?? 'silhouette-dev-session-secret';
const MAX_AGE_MS = 1000 * 60 * 60 * 12;

interface SessionPayload extends SessionUser {
  exp: number;
}

export function readSessionUser(req: Request): SessionUser | null {
  const token = readNamedCookie(req, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  return verifyToken(token);
}

export function issueSession(res: Response, user: SessionUser): void {
  res.cookie(SESSION_COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_MS,
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

function signToken(user: SessionUser): string {
  const payload: SessionPayload = {
    name: user.name,
    email: user.email,
    exp: Date.now() + MAX_AGE_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): SessionUser | null {
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
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (typeof payload.name !== 'string' || typeof payload.email !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    if (payload.exp < Date.now()) {
      return null;
    }
    return { name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

export function readNamedCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }

  const cookies = Array.isArray(header) ? header.join(';') : header;
  for (const part of cookies.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}

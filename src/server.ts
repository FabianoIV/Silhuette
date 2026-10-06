import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type NextFunction, type Request, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import type { RequestAuthContext } from './app/auth/session-user';
import { loginDocument, missingAuthorizationDocument } from './server/login-document';
import {
  authorizationRedirect,
  callbackUri,
  createLoginTransaction,
  endSessionRedirect,
  openLoginTransaction,
  readKeycloakSettings,
  sealLoginTransaction,
  userFromAuthorizationCode,
} from './server/keycloak';
import { clearSession, issueSession, readNamedCookie, readSessionUser } from './server/session';

const browserDistFolder = join(import.meta.dirname, '../browser');
const LOGIN_PATH = '/login';
const LOGIN_TRANSACTION_COOKIE = 'silhouette_login';
const PUBLIC_ASSETS = new Set(['/brand/logo.png', '/favicon.ico']);
const LOGIN_ERRORS: Record<string, string> = {
  konfiguracja: 'Serwer autoryzacji nie jest skonfigurowany.',
  odrzucono: 'Logowanie przerwane. Spróbuj ponownie.',
  nieudane: 'Serwer autoryzacji nie potwierdził sesji.',
};

const app = express();
const angularApp = new AngularNodeAppEngine();
const serveBrowser = express.static(browserDistFolder, {
  index: false,
  redirect: false,
  setHeaders(res, filePath) {
    const normalized = filePath.replaceAll('\\', '/');
    if (normalized.endsWith('/brand/logo.png') || normalized.endsWith('/favicon.ico')) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return;
    }

    res.setHeader('Cache-Control', 'private, no-store');
  },
});

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.get('/api/login', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const settings = readKeycloakSettings();
  if (!settings) {
    res.status(503).type('html').send(missingAuthorizationDocument());
    return;
  }

  if (readSessionUser(req)) {
    sendRedirect(res, '/');
    return;
  }

  const transaction = createLoginTransaction();
  const origin = externalOrigin(req);
  res.cookie(LOGIN_TRANSACTION_COOKIE, sealLoginTransaction(transaction), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60 * 1000,
    secure: origin.startsWith('https:'),
  });
  res.redirect(
    302,
    authorizationRedirect(settings, {
      redirectUri: callbackUri(origin, settings),
      state: transaction.state,
      nonce: transaction.nonce,
      challenge: transaction.challenge,
    }),
  );
});

app.get('/api/callback', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  const settings = readKeycloakSettings();
  const sealed = readNamedCookie(req, LOGIN_TRANSACTION_COOKIE);
  const transaction = sealed ? openLoginTransaction(sealed) : null;
  clearLoginTransaction(res);

  if (!settings) {
    sendRedirect(res, '/login?blad=konfiguracja');
    return;
  }

  const code = queryValue(req, 'code');
  const state = queryValue(req, 'state');
  if (
    !transaction ||
    !code ||
    !sameValue(state, transaction.state) ||
    queryValue(req, 'error')
  ) {
    sendRedirect(res, '/login?blad=odrzucono');
    return;
  }

  const origin = externalOrigin(req);
  userFromAuthorizationCode({
    settings,
    code,
    redirectUri: callbackUri(origin, settings),
    verifier: transaction.verifier,
    nonce: transaction.nonce,
  })
    .then((user) => {
      issueSession(res, user);
      sendRedirect(res, '/');
    })
    .catch((error: unknown) => {
      console.error('Keycloak login failed.', error instanceof Error ? error.message : error);
      sendRedirect(res, '/login?blad=nieudane');
    });
});

app.get('/api/logout', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  clearSession(res);
  clearLoginTransaction(res);
  const settings = readKeycloakSettings();
  if (!settings) {
    sendRedirect(res, LOGIN_PATH);
    return;
  }

  res.redirect(302, endSessionRedirect(settings, `${externalOrigin(req)}/login`));
});

app.get('/api/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const user = readSessionUser(req);
  if (!user) {
    res.status(401).json({ user: null });
    return;
  }
  res.json({ user });
});

/**
 * Anonymous requests never reach the Angular application.
 * `/login` is a standalone document. Every other document redirects there.
 * Application files are sent only with a valid session cookie.
 */
app.use((req, res, next) => {
  if (!isDocumentRequest(req)) {
    if (!isPublicAsset(req.path) && !readSessionUser(req)) {
      refuse(res);
      return;
    }

    serveBrowser(req, res, () => {
      angularApp
        .handle(req)
        .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
        .catch(next);
    });
    return;
  }

  const user = readSessionUser(req);
  const path = normalizePath(req.path);

  if (!user && path !== LOGIN_PATH) {
    sendRedirect(res, LOGIN_PATH);
    return;
  }

  if (!user) {
    res.set('Cache-Control', 'private, no-store');
    res.set('Vary', 'Cookie');
    res.type('html').send(loginDocument(loginError(req)));
    return;
  }

  if (path === LOGIN_PATH) {
    sendRedirect(res, '/');
    return;
  }

  const context: RequestAuthContext = { user };
  angularApp
    .handle(req, context)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : 500;

  if (status === 400) {
    res.status(400).json({ message: 'Niepoprawne żądanie.' });
    return;
  }

  console.error(error);
  if (!res.headersSent) {
    res.status(500).send('Internal Server Error');
  }
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);

function externalOrigin(req: Request): string {
  const forwardedProto = headerValue(req.headers['x-forwarded-proto']);
  const forwardedHost = headerValue(req.headers['x-forwarded-host']);
  const proto = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host') || 'localhost';
  return `${proto}://${host}`;
}

function headerValue(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0]?.trim() ?? '';
}

function sameValue(left: string, right: string): boolean {
  const actual = Buffer.from(left);
  const expected = Buffer.from(right);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function queryValue(req: Request, name: string): string {
  const value = req.query[name];
  return typeof value === 'string' ? value : '';
}

function loginError(req: Request): string | undefined {
  return LOGIN_ERRORS[queryValue(req, 'blad')];
}

function clearLoginTransaction(res: Response): void {
  res.clearCookie(LOGIN_TRANSACTION_COOKIE, { path: '/' });
}

function isPublicAsset(path: string): boolean {
  return PUBLIC_ASSETS.has(path);
}

function refuse(res: Response): void {
  res.set('Cache-Control', 'private, no-store');
  res.set('Vary', 'Cookie');
  res.status(404).end();
}

function sendRedirect(res: Response, location: string): void {
  res.set('Cache-Control', 'private, no-store');
  res.set('Vary', 'Cookie');
  res.redirect(302, location);
}

function isDocumentRequest(req: Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  const path = req.path;
  if (
    path.startsWith('/api/') ||
    path.startsWith('/@') ||
    path.startsWith('/__') ||
    path.startsWith('/.')
  ) {
    return false;
  }

  const segment = path.split('/').pop() ?? '';
  return !segment.includes('.');
}

function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith('/')) {
    return path.slice(0, -1);
  }
  return path || '/';
}

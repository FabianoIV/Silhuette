import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express, { type NextFunction, type Request, type Response } from 'express';
import { join } from 'node:path';
import type { RequestAuthContext } from './app/auth/session-user';
import { DEMO_ACCOUNT, clearSession, issueSession, readSessionUser } from './server/session';

const browserDistFolder = join(import.meta.dirname, '../browser');
const LOGIN_PATH = '/login';

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

app.post('/api/login', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const body = req.body as { email?: unknown; password?: unknown } | undefined;
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    res.status(400).json({ message: 'Podaj e-mail i hasło.' });
    return;
  }

  const email = body.email.trim().toLowerCase();
  if (email !== DEMO_ACCOUNT.email || body.password !== DEMO_ACCOUNT.password) {
    res.status(401).json({ message: 'Nieprawidłowy e-mail lub hasło.' });
    return;
  }

  const user = { name: DEMO_ACCOUNT.name, email: DEMO_ACCOUNT.email };
  issueSession(res, user);
  res.json(user);
});

app.post('/api/logout', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  clearSession(res);
  res.status(204).end();
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

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Anonymous document requests never reach the protected application.
 * Angular renders `/login` only. A signed session cookie unlocks a full SSR pass
 * of the requested route. Lazy route bundles stay out of the login document.
 */
app.use((req, res, next) => {
  if (!isDocumentRequest(req)) {
    angularApp
      .handle(req)
      .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
      .catch(next);
    return;
  }

  const user = readSessionUser(req);
  const path = normalizePath(req.path);

  if (!user && path !== LOGIN_PATH) {
    res.redirect(302, LOGIN_PATH);
    return;
  }

  if (user && path === LOGIN_PATH) {
    res.redirect(302, '/');
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

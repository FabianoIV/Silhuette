import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';
import { once } from 'node:events';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: 'jwk' });
publicJwk.kid = 'test-key';
publicJwk.use = 'sig';
publicJwk.alg = 'RS256';

const pendingByState = new Map();
const pendingByCode = new Map();
const CLIENT_SECRET = 'secret-value';

const keycloak = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const path = url.pathname;

  if (req.method === 'GET' && path === '/realms/silhouette/protocol/openid-connect/certs') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ keys: [publicJwk] }));
    return;
  }

  if (req.method === 'GET' && path === '/realms/silhouette/protocol/openid-connect/auth') {
    const state = url.searchParams.get('state') ?? '';
    const code = `code-${state.slice(0, 12)}`;
    pendingByState.set(state, {
      nonce: url.searchParams.get('nonce'),
      challenge: url.searchParams.get('code_challenge'),
      redirectUri: url.searchParams.get('redirect_uri'),
      clientId: url.searchParams.get('client_id'),
      code,
    });
    pendingByCode.set(code, state);
    const redirect = new URL(url.searchParams.get('redirect_uri') ?? '');
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', state);
    res.writeHead(302, { location: redirect.toString() });
    res.end();
    return;
  }

  if (req.method === 'POST' && path === '/realms/silhouette/protocol/openid-connect/token') {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      const state = pendingByCode.get(body.get('code') ?? '');
      const pending = state ? pendingByState.get(state) : undefined;
      const verifier = body.get('code_verifier') ?? '';
      const challenge = createHash('sha256').update(verifier).digest('base64url');
      const accepted =
        pending &&
        body.get('grant_type') === 'authorization_code' &&
        body.get('client_id') === pending.clientId &&
        body.get('client_secret') === CLIENT_SECRET &&
        body.get('redirect_uri') === pending.redirectUri &&
        challenge === pending.challenge;

      if (!accepted) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant' }));
        return;
      }

      const idToken = signIdToken({
        iss: `http://127.0.0.1:${keycloak.address().port}/realms/silhouette`,
        aud: 'silhouette',
        exp: Math.floor(Date.now() / 1000) + 300,
        nonce: pending.nonce,
        name: 'Ada Nowak',
        email: 'ada@keycloak.test',
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id_token: idToken, token_type: 'Bearer' }));
    });
    return;
  }

  if (req.method === 'GET' && path === '/realms/silhouette/protocol/openid-connect/logout') {
    res.writeHead(302, { location: url.searchParams.get('post_logout_redirect_uri') ?? '/' });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end();
});

function signIdToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createSign('RSA-SHA256').update(`${header}.${body}`).sign(privateKey).toString('base64url');
  return `${header}.${body}.${signature}`;
}

keycloak.listen(0, '127.0.0.1');
await once(keycloak, 'listening');
const keycloakPort = keycloak.address().port;
const appPort = 4399;

const child = spawn(process.execPath, ['dist/Silhouette/server/server.mjs'], {
  env: {
    ...process.env,
    PORT: String(appPort),
    KEYCLOAK_URL: `http://127.0.0.1:${keycloakPort}`,
    KEYCLOAK_REALM: 'silhouette',
    KEYCLOAK_CLIENT_ID: 'silhouette',
    KEYCLOAK_CLIENT_SECRET: CLIENT_SECRET,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let appLog = '';
child.stdout.on('data', (chunk) => {
  appLog += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  appLog += chunk.toString();
});

try {
  await waitFor(`http://127.0.0.1:${appPort}/login`);
  await checkAnonymousGate(appPort);
  await checkLogin(appPort, keycloakPort);
  console.log('Keycloak flow verified.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error(appLog);
  process.exitCode = 1;
} finally {
  child.kill();
  keycloak.close();
}

async function checkAnonymousGate(port) {
  const login = await fetch(`http://127.0.0.1:${port}/login`);
  const html = await login.text();
  assert(login.status === 200, `login status ${login.status}`);
  assert(!html.includes('pracownia'), 'login document mentions an internal route');
  assert(!html.includes('type="password"'), 'login document still asks for a password');
  assert(html.includes('href="/api/login"'), 'login document has no authorization link');

  const asset = await fetch(`http://127.0.0.1:${port}/main.js`);
  assert(asset.status === 404, `anonymous asset status ${asset.status}`);
}

async function checkLogin(port, realmPort) {
  const start = await fetch(`http://127.0.0.1:${port}/api/login`, { redirect: 'manual' });
  const location = start.headers.get('location') ?? '';
  assert(start.status === 302, `login redirect status ${start.status}`);
  assert(
    location.startsWith(`http://127.0.0.1:${realmPort}/realms/silhouette/protocol/openid-connect/auth?`),
    `unexpected authorization url ${location}`,
  );
  assert(location.includes('code_challenge_method=S256'), 'PKCE challenge is missing');

  const transaction = cookiePair(start, 'silhouette_login');
  const realm = await fetch(location, { redirect: 'manual' });
  const callbackUrl = realm.headers.get('location') ?? '';
  assert(realm.status === 302, `realm redirect status ${realm.status}`);

  const callback = await fetch(callbackUrl, {
    redirect: 'manual',
    headers: { cookie: transaction },
  });
  assert(callback.status === 302 && callback.headers.get('location') === '/', `callback location ${callback.headers.get('location')}`);
  const session = cookiePair(callback, 'silhouette_session');

  const home = await fetch(`http://127.0.0.1:${port}/`, { headers: { cookie: session } });
  const homeHtml = await home.text();
  assert(home.status === 200, `home status ${home.status}`);
  assert(homeHtml.includes('Witaj, Ada Nowak'), 'signed-in document has no name from the ID token');
  assert(homeHtml.includes('ada@keycloak.test'), 'signed-in document has no email from the ID token');

  const logout = await fetch(`http://127.0.0.1:${port}/api/logout`, {
    redirect: 'manual',
    headers: { cookie: session },
  });
  const logoutLocation = logout.headers.get('location') ?? '';
  assert(
    logoutLocation.startsWith(`http://127.0.0.1:${realmPort}/realms/silhouette/protocol/openid-connect/logout?`),
    `unexpected logout url ${logoutLocation}`,
  );
}

function cookiePair(response, name) {
  const header = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  if (!header) {
    throw new Error(`Missing ${name} cookie.`);
  }
  return header.split(';')[0];
}

async function waitFor(url) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not start.\n${appLog}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export interface SessionUser {
  name: string;
  email: string;
}

/** Passed from the Express SSR gate into Angular through `REQUEST_CONTEXT`. */
export interface RequestAuthContext {
  user: SessionUser | null;
}

export function readAuthContext(context: unknown): SessionUser | null {
  if (!context || typeof context !== 'object' || !('user' in context)) {
    return null;
  }

  const user = (context as { user: unknown }).user;
  if (!user || typeof user !== 'object') {
    return null;
  }

  const candidate = user as { name?: unknown; email?: unknown };
  if (typeof candidate.name !== 'string' || typeof candidate.email !== 'string') {
    return null;
  }

  const name = candidate.name.trim();
  const email = candidate.email.trim();
  if (!name || !email) {
    return null;
  }

  return { name, email };
}

/**
 * The login screen is a standalone document.
 * It must not boot the Angular app, because that bundle contains the signed-in routes.
 */
export const LOGIN_DOCUMENT = `<!doctype html>
<html lang="pl">
  <head>
    <meta charset="utf-8" />
    <title>Zaloguj się · Silhouette</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Zaloguj się do Silhouette." />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg: #f3f6fb;
        --ink: #1b2430;
        --muted: #5d6b7c;
        --blue-950: #0a3d91;
        --blue-700: #1557c0;
        --card: rgba(255, 255, 255, 0.94);
        --line: rgba(16, 42, 87, 0.1);
        --shadow: 0 24px 60px rgba(22, 54, 110, 0.08);
        --radius: 22px;
        --font: 'Outfit', 'Segoe UI', sans-serif;
        color: var(--ink);
        background:
          radial-gradient(ellipse 70% 45% at 50% -10%, rgba(90, 150, 255, 0.2), transparent 62%),
          var(--bg);
        font-family: var(--font);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        min-height: 100%;
      }

      body {
        font: 16px/1.5 var(--font);
      }

      h1,
      p {
        margin: 0;
      }

      h1 {
        font-size: clamp(2rem, 4vw, 2.75rem);
        letter-spacing: -0.04em;
        line-height: 1.1;
      }

      button,
      input {
        font: inherit;
      }

      .login {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 20px 56px;
      }

      .login__logo {
        width: min(340px, 86vw);
        height: auto;
        display: block;
      }

      .panel {
        width: min(440px, 100%);
        margin-top: 4px;
        padding: 28px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
      }

      .lead,
      .hint {
        color: var(--muted);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .field span {
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--blue-950);
      }

      .field input {
        padding: 0.85rem 0.95rem;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: #f8fbff;
        color: var(--ink);
      }

      .button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 0.85rem 1.2rem;
        background: linear-gradient(180deg, #2a6fe8, #0c4cb5);
        color: white;
        font-weight: 650;
        cursor: pointer;
      }

      .button:disabled {
        opacity: 0.65;
        cursor: progress;
      }

      .form-error {
        margin: 0;
        color: #9b2c2c;
        font-weight: 600;
      }

      .hint {
        margin: 0;
        font-size: 0.92rem;
      }

      :focus-visible {
        outline: 2px solid var(--blue-700);
        outline-offset: 3px;
      }
    </style>
  </head>
  <body>
    <main class="login">
      <img class="login__logo" src="/brand/logo.png" width="403" height="333" alt="Silhouette" />

      <form class="panel">
        <h1>Zaloguj się</h1>
        <p class="lead">
          Bez sesji serwer oddaje tylko ten ekran. Reszta aplikacji jest renderowana dopiero dla
          zalogowanego użytkownika.
        </p>

        <label class="field">
          <span>E-mail</span>
          <input type="email" name="email" value="ada@silhouette.dev" autocomplete="username" required />
        </label>

        <label class="field">
          <span>Hasło</span>
          <input
            type="password"
            name="password"
            value="silhouette"
            autocomplete="current-password"
            required
          />
        </label>

        <p class="form-error" role="alert" hidden></p>

        <button class="button" type="submit">Wejdź</button>

        <p class="hint">Konto demonstracyjne: ada@silhouette.dev / silhouette</p>
      </form>
    </main>
    <script>
      const form = document.querySelector('form');
      const error = document.querySelector('.form-error');
      const button = document.querySelector('button');

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const email = String(data.get('email') ?? '').trim();
        const password = String(data.get('password') ?? '');
        error.hidden = true;
        button.disabled = true;
        button.textContent = 'Logowanie…';

        try {
          const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const body = await response.json().catch(() => null);
            const message =
              body && typeof body.message === 'string' && body.message.trim()
                ? body.message
                : 'Nie udało się zalogować.';
            error.textContent = message;
            error.hidden = false;
            button.disabled = false;
            button.textContent = 'Wejdź';
            return;
          }

          location.assign('/');
        } catch {
          error.textContent = 'Nie udało się zalogować.';
          error.hidden = false;
          button.disabled = false;
          button.textContent = 'Wejdź';
        }
      });
    </script>
  </body>
</html>
`;

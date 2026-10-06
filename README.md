# Silhouette

Prototyp Angular 22 z SSR. Przed wyrenderowaniem dokumentu serwer sprawdza podpisane ciasteczko sesji.

- Brak sesji: odpowiedź to wyłącznie dokument logowania, bez Angulara i bez plików aplikacji. Inne adresy dostają przekierowanie na `/login`.
- Sesja: żądany widok jest składany na serwerze. Paczki aplikacji są oddawane tylko razem z ciasteczkiem.

## Uruchomienie

```bash
npm start
```

Aplikacja działa pod adresem http://localhost:4200.

Konta użytkowników są w Keycloaku. Aplikacja nie trzyma hasła. Skopiuj `.env.example` do `.env` i uzupełnij:

- `KEYCLOAK_URL` — adres serwera autoryzacji, na przykład `https://auth.firma.pl`
- `KEYCLOAK_REALM` — realm
- `KEYCLOAK_CLIENT_ID` — klient
- `KEYCLOAK_CLIENT_SECRET` — tylko dla klienta poufnego

Z tych wartości serwer składa adres logowania `{KEYCLOAK_URL}/realms/{realm}/protocol/openid-connect/auth`. W kliencie Keycloaka włącz standard flow i wpisz adresy przekierowań `{origin}/api/callback` oraz `{origin}/login` jako post logout. Dla lokalnego `npm start` origin to `http://localhost:4200`.

Bez tych zmiennych przycisk „Wejdź” pokazuje, czego brakuje. Po udanym logowaniu Express stawia dotychczasowe ciasteczko `silhouette_session`, a Angular dostaje tylko imię i e-mail.

Produkcyjny serwer SSR:

```bash
npm run build
npm run serve:ssr:Silhouette
```

Domyślnie dozwolone hosty to `localhost` i `127.0.0.1`. Inny host dopisz w `angular.json` pod `security.allowedHosts` albo ustaw zmienną `NG_ALLOWED_HOSTS`.

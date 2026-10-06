# Silhouette

Prototyp Angular 22 z SSR. Przed wyrenderowaniem dokumentu serwer sprawdza podpisane ciasteczko sesji.

- Brak sesji: odpowiedź to wyłącznie ekran logowania. Inne adresy dostają przekierowanie na `/login`, a chronione widoki nie są renderowane.
- Sesja: żądany widok aplikacji jest składany na serwerze w całości. Pulpit, pracownia i ustawienia są leniwymi paczkami i nie wchodzą do dokumentu logowania.

## Uruchomienie

```bash
npm start
```

Aplikacja działa pod adresem http://localhost:4200.

Konto demonstracyjne: `ada@silhouette.dev` / `silhouette`

Produkcyjny serwer SSR:

```bash
npm run build
npm run serve:ssr:Silhouette
```

Domyślnie dozwolone hosty to `localhost` i `127.0.0.1`. Inny host dopisz w `angular.json` pod `security.allowedHosts` albo ustaw zmienną `NG_ALLOWED_HOSTS`.

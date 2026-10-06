# Silhouette

Prototyp Angular 22 z SSR. Przed wyrenderowaniem dokumentu serwer sprawdza podpisane ciasteczko sesji.

- Brak sesji: odpowiedź to wyłącznie dokument logowania, bez Angulara i bez plików aplikacji. Inne adresy dostają przekierowanie na `/login`.
- Sesja: żądany widok jest składany na serwerze. Paczki aplikacji są oddawane tylko razem z ciasteczkiem.

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

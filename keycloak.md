# Podłączenie Keycloaka

Branch `keycloak`. Konta użytkowników są w Keycloaku. Silhouette nie trzyma hasła. Express przekierowuje przeglądarkę na serwer autoryzacji, odbiera kod i stawia ciasteczko `silhouette_session`. Angular dostaje tylko imię i e-mail.

## 1. Klient w Keycloaku

W realm, którego będziesz używać, utwórz klienta OpenID Connect.

- Client ID — ta sama wartość, którą wpiszesz jako `KEYCLOAK_CLIENT_ID`.
- Standard flow — włączone. To authorization code.
- Client authentication — włączone tylko dla klienta poufnego. Wtedy skopiuj sekret do `KEYCLOAK_CLIENT_SECRET`. Dla klienta publicznego zostaw sekret pusty. PKCE i tak jest wysyłane.
- Valid redirect URIs — `http://localhost:4200/api/callback`
- Valid post logout redirect URIs — `http://localhost:4200/login`

Dla zbudowanego serwera na porcie 4000 zamień origin na `http://localhost:4000`. Adres musi być identyczny z tym, którego używa przeglądarka, łącznie z hostem i portem. `localhost` i `127.0.0.1` to dwa różne adresy.

Użytkownik w realm powinien mieć e-mail oraz imię i nazwisko. Z tokenu brane są claimy `email`, `name`, ewentualnie `given_name` i `family_name` albo `preferred_username`.

## 2. Plik `.env`

W katalogu projektu:

```bash
copy .env.example .env
```

Uzupełnij trzy wartości. Reszta ma sensowne domyślne.

| Zmienna | Znaczenie |
| --- | --- |
| `KEYCLOAK_URL` | Adres serwera autoryzacji, bez ukośnika na końcu. Przykład: `https://auth.firma.pl` |
| `KEYCLOAK_REALM` | Nazwa realm |
| `KEYCLOAK_CLIENT_ID` | Identyfikator klienta |
| `KEYCLOAK_CLIENT_SECRET` | Sekret klienta poufnego. Dla klienta publicznego zostaw zakomentowane |
| `KEYCLOAK_ISSUER` | Opcjonalnie. Domyślnie `{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}`. Ustaw, gdy pole `iss` w tokenie ma inny adres |
| `KEYCLOAK_REDIRECT_URI` | Opcjonalnie. Domyślnie `{origin żądania}/api/callback`. Ustaw, gdy Keycloak ma przyjąć jeden sztywny adres |

Z `KEYCLOAK_URL` i `KEYCLOAK_REALM` serwer składa adres logowania:

```text
{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth
```

Token, klucze podpisu i wylogowanie biorą się z tego samego adresu i realm:

```text
{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token
{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs
{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/logout
```

Plik `.env` jest lokalny i nie wchodzi do gita. Zmienna już ustawiona w systemie wygrywa z wpisem w pliku. Po zmianie `.env` uruchom serwer ponownie.

## 3. Uruchomienie

```bash
npm start
```

Aplikacja jest na http://localhost:4200. Wejście na dowolną stronę bez sesji wraca na `/login`. Przycisk „Wejdź” otwiera `/api/login`, a stamtąd Keycloak.

Produkcja:

```bash
npm run build
npm run serve:ssr:Silhouette
```

Domyślny port to 4000. Hosty dozwolone w `angular.json` to `localhost` i `127.0.0.1`.

## 4. Co widać, gdy konfiguracji brakuje

Bez `KEYCLOAK_URL`, `KEYCLOAK_REALM` i `KEYCLOAK_CLIENT_ID` przycisk „Wejdź” pokazuje stronę z nazwami brakujących zmiennych. Aplikacja się wtedy nie renderuje.

## 5. Przebieg logowania

1. `GET /api/login` zapisuje na krótko ciasteczko `silhouette_login` ze `state`, `nonce` i sekretem PKCE.
2. Przeglądarka idzie na adres logowania Keycloaka. W zapytaniu są `code_challenge` i `code_challenge_method=S256`.
3. Keycloak wraca na `/api/callback?code=...&state=...`.
4. Express wymienia kod na token, sprawdza podpis RS256, issuer, odbiorcę, czas i `nonce`.
5. Z tokenu zostają imię i e-mail. Token nie trafia do przeglądarki.
6. Express stawia `silhouette_session` i przekierowuje na `/`. Dopiero ten dokument ładuje Angulara.

Wylogowanie to `GET /api/logout`: kasowane jest ciasteczko aplikacji, a przeglądarka idzie na zakończenie sesji w Keycloaku i wraca na `/login`.

## 6. Sprawdzenie bez prawdziwego Keycloaka

Po zbudowaniu aplikacji:

```bash
npm run build
npm run verify:keycloak
```

Skrypt stawia zastępczy serwer autoryzacji, przechodzi logowanie i sprawdza, że pulpit zawiera imię i e-mail z tokenu.

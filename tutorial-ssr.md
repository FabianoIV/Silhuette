# Silhouette: jak działa Angular SSR

SSR oznacza Server-Side Rendering: serwer składa gotowy HTML, zanim przeglądarka uruchomi Angulara. To nie jest SSL ani certyfikat HTTPS.

Aplikacja jest prototypem na Angularze 22. Jedna reguła decyduje o odpowiedzi:

- brak sesji: serwer oddaje wyłącznie ekran logowania;
- sesja: serwer składa żądany widok aplikacji.

Konto do pokazu: `ada@silhouette.dev` / `silhouette`.

## Na początek

Zwykła aplikacja Angularowa wysyła prawie pusty HTML. Napis „Witaj, Ada” powstaje dopiero w przeglądarce, po pobraniu JavaScriptu.

Silhouette robi inaczej. Node z Expressem dostaje żądanie, sprawdza ciasteczko i prosi Angulara, żeby na serwerze wyrenderował właściwy komponent. W odpowiedzi jest już tytuł strony, formularz albo powitanie. Przeglądarka potem ten HTML przejmuje. To przejęcie nazywa się hydracją.

Po co bramka przed renderem: chronione strony nie mają być w ogóle składane dla anonima. Redirect jest tańszy i pewniejszy niż wyrenderowanie pulpitu i ukrycie go.

## Dwa światy, jeden kod

Ten sam komponent działa na serwerze i w przeglądarce. Różni się tylko to, skąd bierze użytkownika.

| | Serwer | Przeglądarka |
| --- | --- | --- |
| Start | `src/main.server.ts` | `src/main.ts` |
| Konfiguracja | `src/app/app.config.server.ts` | `src/app/app.config.ts` |
| Skąd sesja | kontekst żądania, wstrzyknięty przez Express | `TransferState` zapisany w HTML |
| Kiedy | każde żądanie dokumentu | po załadowaniu JS, a potem przy klikaniu linków |

`app.config.ts` włącza router, hydrację (`provideClientHydration`) i HTTP. `app.config.server.ts` dokłada `provideServerRendering` i mówi, że każda trasa ma tryb `RenderMode.Server`. Nic nie jest generowane raz na buildzie. Każdy dokument powstaje w chwili żądania, bo treść zależy od ciasteczka.

## Mapa plików, o których warto mówić

| Plik | Rola w jednym zdaniu |
| --- | --- |
| `src/server.ts` | Express: API logowania, dokument `/login` i bramka przed Angularen |
| `src/server/login-document.ts` | Sam ekran logowania. HTML, CSS i krótki skrypt. Zero Angulara |
| `src/server/session.ts` | Podpis ciasteczka i jego weryfikacja. Ten plik nie wchodzi do przeglądarki |
| `src/app/app.routes.ts` | Trasy zalogowanej aplikacji. Ekranu logowania tu nie ma |
| `src/app/app.routes.server.ts` | Każda trasa renderowana na serwerze, bez cache |
| `src/app/auth/guards.ts` | Druga linia: Angular też nie wpuszcza anonima na pulpit |
| `src/app/auth/auth.ts` | Sygnał `user` i przeniesienie sesji z serwera do przeglądarki |
| `src/app/shell/shell.ts` | Nawigacja zalogowanej aplikacji |

## Wejście anonima, krok po kroku

Użytkownik wpisuje `http://localhost:4200/pracownia`.

1. Express w `src/server.ts` widzi GET bez rozszerzenia pliku. To dokument, nie obrazek ani plik `.js`.
2. `readSessionUser` szuka ciasteczka `silhouette_session`. Nie ma go, więc użytkownik jest `null`.
3. Ścieżka to nie `/login`, więc serwer odpowiada `302` na `/login`. Angular w ogóle nie startuje. Ciało ma około 28 bajtów: `Found. Redirecting to /login`.
4. Przeglądarka prosi o `/login`. Sesji nadal nie ma, więc Express odsyła dokument z `src/server/login-document.ts`. Angular w ogóle nie startuje.
5. W tym HTML jest formularz, jego własny CSS i krótki skrypt. Skrypt umie tylko wysłać `POST /api/login`. Nie ma w nim tras aplikacji, nazw paczek ani linków do pulpitu, pracowni i ustawień.
6. Przeglądarka pobiera logo. Plików `.js` i `.css` aplikacji przy tym wejściu nie ma.

To samo dzieje się dla `/` i `/ustawienia`. Każdy dokument poza `/login` wraca przekierowaniem.

## Logowanie

Formularz nie wysyła hasła jako zwykłego przejścia na inną stronę. Woła `POST /api/login`.

Express porównuje dane z kontem demonstracyjnym. Przy błędzie zwraca 401 i komunikat. Przy sukcesie woła `issueSession`:

- ciasteczko `silhouette_session` jest `httpOnly`, więc JavaScript w przeglądarce nie może go odczytać;
- `SameSite=Lax`, więc przeglądarka wyśle je przy następnym wejściu na stronę;
- wartość to podpisany HMAC-em ładunek: imię, e-mail i czas wygaśnięcia (12 godzin);
- sekret bierze się ze zmiennej `SILHOUETTE_SESSION_SECRET`, a w prototypie ma wartość deweloperską.

Potem skrypt robi `location.assign('/')`. To świadome pełne przeładowanie. Następny dokument składa już serwer, z ciasteczkiem, i dopiero ten dokument ładuje Angulara.

## Wejście z sesją

1. GET `/` niesie ciasteczko.
2. `verifyToken` sprawdza podpis przez `timingSafeEqual`, datę wygaśnięcia i kształt danych. Zły podpis, przedawnienie albo uszkodzony JSON dają `null`, czyli z powrotem ekran logowania.
3. Użytkownik istnieje, a ścieżka to nie `/login`, więc Express nie robi redirectu. Przekazuje `{ user: { name: 'Ada Nowak', email: 'ada@silhouette.dev' } }` do Angulara.
4. `authGuard` widzi użytkownika i puszcza trasę. Ładuje się powłoka i pulpit. W HTML jest już „Witaj, Ada Nowak” oraz linki Pulpit, Pracownia, Ustawienia.
5. `TransferState` przenosi tego użytkownika do przeglądarki. Hydracja nie zgaduje sesji na nowo i nie miga pustym ekranem.
6. Dalsze kliknięcia, na przykład w Pracownię, zostają w przeglądarce. Serwer złoży `/pracownia` dopiero przy odświeżeniu albo przy wklejeniu adresu.

Gdy zalogowana osoba wejdzie na `/login`, serwer odwraca kierunek: `302` na `/`.

Wylogowanie to `POST /api/logout`, skasowanie ciasteczka i pełne przejście na `/login`.

## Po co są guardy, skoro Express już przekierowuje

Bramka Expressa jest pierwsza i dotyczy dokumentu. Guardy są drugą linią, już wewnątrz Angulara.

- `authGuard` trzyma pulpit, pracownię i ustawienia. Brak użytkownika w przeglądarce kończy się pełnym przejściem na `/login`, bo ekran logowania nie jest trasą Angulara.

Jest wyjątek `allowDuringBuildExtraction`. Build produkcyjny uruchamia aplikację serwerową bez prawdziwego żądania HTTP, żeby poznać drzewo tras. Wtedy token `REQUEST` nie istnieje. Guardy w tej fazie nie zamieniają całego drzewa w redirect, bo build musi zobaczyć wszystkie trasy. W przeglądarce `REQUEST` też nie istnieje, ale platforma nie jest serwerem, więc wyjątek się nie włącza.

## Dlaczego ciasteczko, a nie localStorage

Serwer przy pierwszym żądaniu nie wykonuje kodu przeglądarki. Nie widzi `localStorage`. Widzi nagłówki HTTP. Ciasteczko jest w nagłówku `Cookie`, więc da się podjąć decyzję zanim powstanie HTML.

`httpOnly` jest tu ważne w opowieści dla zespołu: przeglądarka ciasteczko przechowuje i odsyła, ale aplikacja Angularowa go nie czyta. Imię na pulpicie pochodzi z kontekstu przekazanego przy renderze i z `TransferState`, nie z odczytu ciasteczka w JS.

## Co dokładnie jest „zaserwowane” przed logowaniem

To rozróżnienie warto powiedzieć wprost, bo audyt je zmierzył.

Dokument `/login` zawiera tylko ekran logowania. Nie ładuje Angulara. Nie ma w nim linków nawigacji, tytułów innych stron ani nazw ich plików.

Konfiguracja routera, czyli ścieżki `pracownia` i `ustawienia`, tytuły i leniwe importy, siedzi w paczce aplikacji. Ta paczka przychodzi dopiero z dokumentem osoby zalogowanej. Bez ciasteczka serwer na taki plik odpowiada `404` i nie wysyła treści. To samo dotyczy wspólnego CSS aplikacji i chunków powłoki, pulpitu, pracowni oraz ustawień.

Publicznie zostają tylko logo i favicon, bo ekran logowania ich potrzebuje.

Hasło demonstracyjne jest wpisane w formularz. To dane ekranu logowania, specjalnie, żeby dało się kliknąć „Wejdź”.

`ng build` nadal spisuje drzewo tras, ale robi to u siebie, bez użytkownika i bez ciasteczka. Wynik tego spisu ląduje w paczkach. Paczki przeglądarki wychodzą z serwera dopiero przy sesji.

## Jak to zobaczyć samemu

Dev, z tym samym `server.ts`:

```bash
npm start
```

Aplikacja jest na http://localhost:4200.

Produkcja, czyli to, co mierzył audyt:

```bash
npm run build
npm run serve:ssr:Silhouette
```

Domyślny port to 4000. Hosty dozwolone w `angular.json` to `localhost` i `127.0.0.1`.

Trzy rzeczy do obejrzenia w narzędziach przeglądarki:

1. Wejście na `/pracownia` w oknie prywatnym. Zakładka sieci pokazuje 302, potem dokument `/login`. W „view source” nie ma słowa Pracownia.
2. Po zalogowaniu źródło `/` zawiera „Witaj, Ada Nowak” jeszcze przed wykonaniem aplikacji. Szukaj `ng-server-context="ssr"`.
3. W `ng-state` po logowaniu jest imię i e-mail. W źródle `/login` tego skryptu nie ma, bo Angular jeszcze nie działa.

Z terminala, bez ciasteczka:

```bash
curl -s -o NUL -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:4000/pracownia
curl -s http://127.0.0.1:4000/login
```

Pierwsze polecenie ma pokazać `302` i adres `/login`. Drugie ma pokazać formularz, bez linków pulpitu.

## Scenariusz pięciominutowego pokazu

1. Okno prywatne, adres `/ustawienia`. Zespół widzi logowanie, nie ustawienia.
2. Pokaż źródło: jest formularz, nie ma nawigacji i nie ma znaczników `<script src=` z paczkami aplikacji.
3. Zaloguj się. Po przeładowaniu adres to `/`, a w źródle jest powitanie.
4. Kliknij Pracownię. Adres się zmienia bez nowego dokumentu z serwera. Odśwież: serwer składa pracownię od zera, bo ciasteczko jedzie z żądaniem.
5. Wyloguj. `/` znowu wraca na `/login`.
6. Pokaż w sieci, że `/login` pobiera logo, a nie pliki `.js` aplikacji. Wejście na znany adres chunka bez ciasteczka kończy się `404`.

## Częste pytania

**Czy to zabezpieczenie?**
Bramka obejmuje dokument i pliki aplikacji. Bez ciasteczka serwer nie składa wewnętrznych stron i nie oddaje ich JavaScriptu ani CSS. Imię Ady powstaje dopiero przy renderze z ważnego ciasteczka. `npm start` to serwer deweloperski Vite: moduł źródłowy potrafi zostać skompilowany, zanim żądanie dojdzie do Expressa. Do pokazu tej bramki użyj zbudowanego serwera.

**Czemu nie wystarczą guardy Angulara?**
Guard działa w trakcie renderu. Express odcina żądanie wcześniej, więc serwer nie składa chronionego komponentu. Guard zostaje na wypadek nawigacji już w przeglądarce i jako druga linia.

**Czemu pełne przeładowanie po loginie?**
Żeby pierwszy widok aplikacji był HTML-em z serwera, a nie widokiem dorysowanym dopiero w przeglądarce.

**Co się stanie po odświeżeniu pulpitu?**
Ciasteczko wraca z żądaniem, podpis się zgadza, serwer składa pulpit jeszcze raz.

**Czy da się to cache'ować?**
Świadomie nie. Trasy serwerowe ustawiają `Cache-Control: private, no-store` i `Vary: Cookie`. Odpowiedź zależy od sesji, więc wspólny cache pomieszałby ekran logowania z pulpitem.

**Gdzie jest hasło?**
Tylko w `src/server/session.ts`, po stronie Node. Porównanie jest na serwerze. W prototypie to stałe konto demonstracyjne, nie baza użytkowników.

## Czego ten prototyp nie robi

Nie ma prawdziwego dostawcy tożsamości, ról ani wygasania sesji po stronie serwera poza datą w ciasteczku. Sekret podpisu w kodzie jest deweloperski. Na środowisku współdzielonym trzeba podstawić `SILHOUETTE_SESSION_SECRET`.

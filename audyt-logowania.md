# Audyt strony logowania

Anonimowe wejście na http://127.0.0.1:4321/login, produkcyjny serwer SSR, 6 października 2026. Sprawdzone: dokument HTML, linki w DOM, pliki pobrane przez przeglądarkę i bezpośrednie pobranie paczek pozostałych stron bez ciasteczka.

Dokument logowania nie zawiera linków ani treści pulpitu, pracowni ani ustawień. Przeglądarka ich nie pobiera. Paczka startowa, którą logowanie musi ściągnąć, zawiera jednak tablicę tras i nazwy plików tych stron, a serwer oddaje te pliki każdemu, kto zna adres.

| Miara | Wynik |
| --- | --- |
| Linki do innych stron w DOM | 0 |
| Trafienia treści innych stron w HTML | 0 |
| Paczki innych stron dostępne bez sesji | 4 |

## Odpowiedzi dokumentu bez ciasteczka

Źródło: curl bez ciasteczka, 6 października 2026. Przekierowania nie były śledzone.

| Adres | Status | Treść odpowiedzi |
| --- | ---: | --- |
| `/login` | 200 | Tylko ekran logowania, 7624 B |
| `/` | 302 | Found. Redirecting to /login, 28 B |
| `/pracownia` | 302 | Found. Redirecting to /login, 28 B |
| `/ustawienia` | 302 | Found. Redirecting to /login, 28 B |

## Zawartość HTML strony /login

Wyrenderowany korzeń to wyłącznie komponent logowania. Nie ma powłoki, pulpitu, pracowni ani ustawień. W DOM nie ma żadnego linku. Stan przeniesiony do przeglądarki ma sesję `null`.

| Szukane dane innych stron | Wynik w HTML logowania |
| --- | --- |
| Linki Pulpit, Pracownia, Ustawienia, Wyloguj | Brak |
| Treść: Witaj, Studia znaku, Sesja aktywna | Brak |
| Imię użytkownika Ada Nowak | Brak |
| Nazwa ciasteczka `silhouette_session` | Brak |
| Komponenty innych stron | Brak |
| Hasło demonstracyjne w polu formularza | Jest. To dane samego logowania |

## Pliki pobrane przy otwarciu logowania

Źródło: przeglądarka po wylogowaniu, `performance.getEntriesByType`, 6 października 2026. Paczki pulpitu, pracowni i ustawień nie wystąpiły.

| Plik | Rola | Treść innych stron |
| --- | --- | --- |
| `chunk-BhzhboPu.js` | Framework Angular, 173,8 kB | Brak |
| `chunk-DCFIIctd.js` | Komponent logowania, 41,7 kB | Brak |
| `main-GXFYCQ7T.js` | Start aplikacji, 122,7 kB | Tablica tras i nazwy paczek |
| `styles-2TSWIJNJ.css` | Wspólny arkusz, 3,9 kB | Klasy topbar, nav i stage, bez tekstu stron |
| `brand/logo.png` | Znak logowania, 149 kB | Brak |

## Tablica tras w paczce startowej

`main-GXFYCQ7T.js` jest konieczny do uruchomienia logowania. Nie ma w nim treści widoków ani danych użytkownika. Są ścieżki, tytuły i adresy leniwych plików. Wystąpienia `routerLink` to kod dyrektywy Angulara, nie linki aplikacji.

| Rodzaj | Wartości w paczce |
| --- | --- |
| Ścieżki | `login`, pusta ścieżka, `pracownia`, `ustawienia`, przekierowanie na `/` |
| Tytuły | Zaloguj się · Silhouette, Pulpit · Silhouette, Pracownia · Silhouette, Ustawienia · Silhouette |
| Pliki `import()` | `chunk-DCFIIctd.js` (login), `chunk-DfEu89a8.js` (powłoka), `chunk-Cj7HoHCu.js` (pulpit), `chunk-8lbwzJVB.js` (pracownia), `chunk-Ce2Jn7lK.js` (ustawienia) |

## Paczki innych stron pobrane bez sesji

Logowanie ich nie podlinkowuje, ale serwer plików statycznych oddaje je przy bezpośrednim GET, bez ciasteczka. Odpowiedź to kod komponentu, w tym napisy nawigacji i treść strony.

Źródło: GET bez ciasteczka, 6 października 2026.

| Plik | Status | Rozmiar | Tekst z tej strony |
| --- | ---: | ---: | --- |
| `chunk-DfEu89a8.js` | 200 | 2,9 kB | Pulpit, Pracownia, Ustawienia, Wyloguj |
| `chunk-Cj7HoHCu.js` | 200 | 1,4 kB | Pulpit, Witaj, Sesja aktywna |
| `chunk-8lbwzJVB.js` | 200 | 1,2 kB | Pracownia, Studia znaku |
| `chunk-Ce2Jn7lK.js` | 200 | 1,3 kB | Ustawienia, Wyloguj, nazwa ciasteczka |

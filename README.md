# Sprawunki

Sprawunki to prosta aplikacja webowa (PWA) do prowadzenia listy zakupów: w ciągu dnia dopisujesz produkty, w sklepie odhaczasz kupione, a po zakupach czyścisz listę. Ma być szybsza i prostsza w użyciu niż kartka papieru.

**Aplikacja: https://dawidgorecki.github.io/sprawunki/**

## Funkcje

- Dodawanie produktów z pola na dole ekranu, w zasięgu kciuka. Ilość wpisujesz w nazwę, np. „mleko 2 l”.
- Wykrywanie duplikatów: ponowne wpisanie produktu, który już jest na liście, nie dodaje go drugi raz. Jeśli był kupiony, wraca do „Do kupienia”.
- Dwie sekcje, „Do kupienia” i „Kupione”, oraz licznik postępu, np. „3 z 8 kupione”.
- Edycja nazwy po tapnięciu, usuwanie jednym przyciskiem i „Wyczyść kupione”.
- „Cofnij” po usunięciu produktu lub wyczyszczeniu kupionych.
- Działanie offline po pierwszym uruchomieniu.
- Tryb jasny i ciemny zgodnie z ustawieniami telefonu.

## Instalacja na telefonie

- **Android (Chrome):** otwórz link powyżej, a potem ⋮ → „Zainstaluj aplikację”.
- **iOS (Safari 16.4+):** otwórz link, potem „Udostępnij” → „Dodaj do ekranu początkowego”.

Aktualizacje instalują się same: nowa wersja pobiera się w tle i działa od kolejnego uruchomienia.

## Prywatność

Aplikacja nie ma serwera ani kont. Lista jest zapisana tylko w pamięci przeglądarki na Twoim urządzeniu (localStorage) i nigdzie nie jest wysyłana. Aplikacja nie korzysta z żadnych zewnętrznych usług ani analityki.

Wyczyszczenie danych przeglądarki lub odinstalowanie aplikacji usuwa listę.

## Dla programistów

Czysty JavaScript (moduły ES), bez frameworków. Do budowania służy [Vite](https://vite.dev/), do testów logiki [Vitest](https://vitest.dev/), a manifest i service worker generuje [vite-plugin-pwa](https://vite-pwa-org.netlify.app/).

Wymagany Node.js 20.19+ lub 22.12+.

```bash
npm install        # instalacja zależności
npm run dev        # serwer deweloperski: http://localhost:5173/sprawunki/
npm test           # testy
npm run build      # build do dist/
npm run preview    # podgląd builda (tu działa service worker i tryb offline)
```

Każdy push na gałąź `main` uruchamia GitHub Actions (`.github/workflows/deploy.yml`). Workflow uruchamia testy, buduje aplikację i publikuje ją na GitHub Pages.

### Struktura

```
index.html         # struktura strony
src/
  main.js          # start aplikacji: wczytanie danych, połączenie logiki z interfejsem
  store.js         # logika listy: czyste funkcje, bez DOM i localStorage
  storage.js       # zapis i odczyt localStorage, migracje, kopia uszkodzonych danych
  ui.js            # renderowanie i obsługa zdarzeń
  styles.css
public/            # favicon i ikony aplikacji
tests/             # testy store.js i storage.js
```

Pełna specyfikacja: [SPEC.md](SPEC.md).

## Licencja

[Apache License 2.0](LICENSE)

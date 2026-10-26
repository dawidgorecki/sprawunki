# CLAUDE.md

Instrukcje dla Claude Code w tym projekcie.

## Projekt

**Sprawunki** — aplikacja PWA do listy zakupów: jedna lista, dodawanie, odhaczanie, edycja, usuwanie produktów; w wersji 1.1 także parsowanie ilości, zmiana kolejności przeciąganiem i blokada wygaszania ekranu; w wersji 2.0 kategorie (działy sklepu); w wersji 2.1 wiele list; w wersji 2.2 ustawienia (motyw, numer wersji, ekran powitalny); dane w localStorage; pełne działanie offline. **Pełna specyfikacja: `SPEC.md`, kolejność prac i kryteria ukończenia: `PLAN.md`. Przed każdym zadaniem sprawdź, czego dotyczy w specyfikacji.**

Autor programuje zawodowo w PHP i zna podstawy JavaScriptu. Projekt służy też nauce, więc kod ma być czytelny i zrozumiały bez znajomości frameworków.

## Stos

- Vite (serwer deweloperski i build)
- Czysty JavaScript, moduły ES. **Bez frameworków** (React, Vue, Alpine itd.) i bez TypeScriptu
- vite-plugin-pwa (manifest i service worker)
- Vitest (testy logiki)
- Playwright Test (testy interfejsu w Chromium: komputer i emulowany telefon z dotykiem; tylko lokalnie, nie w CI)
- Hosting: GitHub Pages przez GitHub Actions

Zależności tylko jako `devDependencies`. Nie dodawaj nowych bibliotek bez pytania.

## Polecenia

```bash
npm install        # instalacja
npm run dev        # serwer deweloperski
npm test           # testy logiki (Vitest, jednorazowo)
npm run test:e2e   # testy interfejsu (Playwright; sam uruchamia serwer deweloperski)
npm run test:e2e:ui  # to samo z oknem pokazującym każdy krok
npm run build      # build do dist/
npm run preview    # podgląd builda (tu działa service worker)
npm run icons      # ikony PNG w public/ z design/icon.svg
```

## Struktura

```
index.html
src/
  main.js        # start aplikacji: wczytanie danych, podpięcie UI
  store.js       # logika listy — czyste funkcje, bez DOM i localStorage
  storage.js     # odczyt/zapis localStorage, migracje, obsługa błędów
  ui.js          # renderowanie i obsługa zdarzeń DOM
  manage-dialog.js      # okna zarządzania kategoriami (2.0) i listami (2.1)
  list-picker.js        # przycisk z nazwą listy i okno wyboru listy (wersja 2.1)
  list-controls.js      # wspólne dla list: edycja nazwy w miejscu, uchwyt, strzałki
  drag.js        # zmiana kolejności przeciąganiem (wersja 1.1)
  wake-lock.js   # blokada wygaszania ekranu (wersja 1.1)
  product-dictionary.js  # słownik produkt → kategoria domyślna (wersja 2.0, same dane)
  settings-dialog.js    # okno „Ustawienia”: motyw, o aplikacji (wersja 2.2)
  theme.js       # stosowanie motywu: atrybut na <html>, theme-color (wersja 2.2)
  styles.css
public/
  icons/         # ikony PWA (generowane z design/icon.svg, nie edytować ręcznie)
design/
  icon.svg       # źródło ikony
scripts/
  generate-icons.js  # npm run icons: PNG z SVG przez Chromium z Playwrighta
tests/
  store.test.js
  storage.test.js
e2e/             # testy interfejsu (Playwright), *.spec.js
  helpers.js
playwright.config.js
.github/workflows/deploy.yml
```

## Zasady kodu

- **Rozdzielenie warstw:** `store.js` zawiera tylko czyste funkcje, które przyjmują stan i zwracają nowy stan (bez mutacji). Żadnego DOM ani localStorage w `store.js`. Dzięki temu logika jest testowalna.
- **Renderowanie:** po każdej zmianie stanu zapisz go i wyrenderuj listę od nowa. Prosto, bez optymalizacji na zapas.
- **Bezpieczeństwo:** tekst od użytkownika tylko przez `textContent`. Nigdy `innerHTML` z danymi użytkownika.
- **Nazewnictwo:** kod, nazwy zmiennych i komentarze po angielsku; teksty w interfejsie po polsku.
- **Model danych** zgodny z `SPEC.md` (punkt 4, od wersji 2.0 punkt 10.6). Zachowaj strukturę przewidującą wiele list i kategorie, nawet jeśli w wersji 1 są nieużywane.
- Proste, krótkie funkcje. Komentarz tam, gdzie decyzja nie jest oczywista.
- CSS: zmienne dla kolorów, tryb ciemny przez `prefers-color-scheme`, układ mobile first.
- Repozytorium nazywa się `sprawunki`; GitHub Pages serwuje aplikację spod `/sprawunki/`, więc w `vite.config.js` ustaw `base: '/sprawunki/'` i używaj ścieżek zgodnych z tym ustawieniem (także w manifeście PWA).
- Nazwa w interfejsie: „Sprawunki”. Klucz localStorage: `sprawunki`.

## Sposób pracy

- Pracuj małymi krokami według kolejności implementacji w `PLAN.md` (obecnie wersja 2.2). Jeden krok = jedna logiczna zmiana.
- Do każdej zmiany w `store.js` lub `storage.js` dodaj albo zaktualizuj testy. Po zmianie uruchom `npm test`.
- Do każdej zmiany w interfejsie dodaj albo zaktualizuj testy w `e2e/` i uruchom `npm run test:e2e`. Elementy wyszukuj po roli i etykiecie (`getByRole`), jak użytkownik i czytnik ekranu. Testy przeglądarkowe nie zastępują ręcznego testu autora.
- Nie dodawaj funkcji spoza zakresu wersji 1, 1.1, 2.0, 2.1 i 2.2 (punkty 3, 9, 10, 11 i 12 w `SPEC.md`; to, co poza zakresem, opisuje punkt 6). Jeśli coś wydaje się potrzebne, zapytaj.
- Gdy specyfikacja jest niejasna, zapytaj zamiast zgadywać.
- Po zakończeniu kroku krótko wyjaśnij, co zmieniłeś i dlaczego (autor się uczy), oraz zaproponuj komunikat commita.

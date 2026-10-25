# Sprawunki

<img src="public/icons/icon-192.png" alt="Ikona aplikacji Sprawunki: biała torba na zakupy w ruchu na niebieskim tle" width="96" height="96">

Sprawunki to prosta aplikacja webowa (PWA) do prowadzenia listy zakupów: w ciągu dnia dopisujesz produkty, w sklepie odhaczasz kupione, a po zakupach czyścisz listę. Ma być szybsza i prostsza w użyciu niż kartka papieru.

**Aplikacja: https://dawidgorecki.github.io/sprawunki/**

## Funkcje

- Dodawanie produktów z pola na dole ekranu, w zasięgu kciuka. Ilość wpisujesz w nazwę, np. „mleko 2 l”, „6 jajek” albo „chleb x2”, a aplikacja pokazuje ją jako osobną etykietę.
- Wykrywanie duplikatów bez względu na ilość: ponowne wpisanie produktu, który już jest na liście, nie dodaje go drugi raz. Wpis z nową ilością („mleko 3 l”) ją zmienia, a kupiony produkt wraca do „Do kupienia”.
- Zmiana kolejności produktów do kupienia: przeciągnij za uchwyt ≡ albo użyj strzałek na klawiaturze.
- Przełącznik w nagłówku, który nie pozwala ekranowi zgasnąć w trakcie zakupów (tam, gdzie przeglądarka to obsługuje).
- Dwie sekcje, „Do kupienia” i „Kupione”, oraz licznik postępu, np. „3 z 8 kupione”.
- Edycja nazwy po tapnięciu, usuwanie jednym przyciskiem i „Wyczyść kupione”.
- „Cofnij” po usunięciu produktu lub wyczyszczeniu kupionych.
- Działanie offline po pierwszym uruchomieniu.
- Tryb jasny i ciemny zgodnie z ustawieniami telefonu, w stonowanej niebieskiej kolorystyce.

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
npm test           # testy logiki (Vitest)
npm run test:e2e   # testy interfejsu w przeglądarce (Playwright)
npm run test:e2e:ui  # to samo z podglądem każdego kroku
npm run build      # build do dist/
npm run preview    # podgląd builda (tu działa service worker i tryb offline)
```

Testy interfejsu klikają w prawdziwą aplikację w Chromium, na komputerze i na emulowanym telefonie z ekranem dotykowym. Przed pierwszym uruchomieniem pobierz przeglądarkę: `npx playwright install chromium`. W WSL lub na świeżym Linuksie potrzebne są też biblioteki systemowe: `sudo env "PATH=$PATH" npx playwright install-deps chromium`. Testy interfejsu działają tylko lokalnie, nie w GitHub Actions.

Każdy push na gałąź `main` uruchamia GitHub Actions (`.github/workflows/deploy.yml`). Workflow uruchamia testy, buduje aplikację i publikuje ją na GitHub Pages.

### Struktura

```
index.html         # struktura strony
src/
  main.js          # start aplikacji: wczytanie danych, połączenie logiki z interfejsem
  store.js         # logika listy: czyste funkcje, bez DOM i localStorage
  storage.js       # zapis i odczyt localStorage, migracje, kopia uszkodzonych danych
  ui.js            # renderowanie i obsługa zdarzeń
  drag.js          # zmiana kolejności przeciąganiem (Pointer Events)
  wake-lock.js     # blokada wygaszania ekranu (Screen Wake Lock API)
  styles.css
public/            # favicon i ikony aplikacji
tests/             # testy logiki: store.js i storage.js (Vitest)
e2e/               # testy interfejsu (Playwright)
```

### Kolory i ikona

Kolory są zdefiniowane jako zmienne CSS na początku `src/styles.css`, osobno dla trybu jasnego i ciemnego. Kolor akcentu (przyciski, zaznaczenia) to `#2f6f9e` w trybie jasnym i `#73b1d8` w ciemnym.

Ikona to biała torba na zakupy w ruchu z małym ptaszkiem, na niebieskim tle w tej samej barwie co akcent. Projekt nie zawiera jej źródła wektorowego, tylko gotowe pliki PNG: `public/favicon.png` (64×64, zaokrąglone rogi) oraz `public/icons/icon-192.png`, `icon-512.png` i `apple-touch-icon.png` (180×180). Ikony 192 i 512 są też wariantem `maskable`, więc rysunek mieści się w środkowym kole, które Android zostawia po przycięciu.

Pełna specyfikacja: [SPEC.md](SPEC.md).

## Licencja

[Apache License 2.0](LICENSE)

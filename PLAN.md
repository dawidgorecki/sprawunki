# Sprawunki — plan prac

Kolejność implementacji i kryteria ukończenia kolejnych wersji. Co i jak ma działać, opisuje [SPEC.md](SPEC.md); numery punktów w tym pliku (np. „3.1”, „10.5”) odnoszą się do specyfikacji.

## Wersje

| Wersja | Zakres | Specyfikacja | Stan |
| --- | --- | --- | --- |
| 1.0 | Jedna lista: dodawanie, odhaczanie, edycja, usuwanie, PWA | 3, 4 | ukończona |
| 1.1 | Parsowanie ilości, zmiana kolejności, blokada wygaszania ekranu | 9 | ukończona |
| 2.0 | Kategorie | 10 | opublikowana, test w sklepie |
| 2.1 | Wiele list | 11 | **w trakcie** |
| 2.2 | Eksport/import kopii zapasowej | — | planowana |

Pomysły na później i rzeczy poza zakresem: punkt 6 specyfikacji.

## Wersja 1

### Kolejność implementacji

1. Szkielet projektu: Vite, czysty JS, Vitest, pusta strona działająca lokalnie.
2. Logika listy (`store.js`) z testami: dodawanie, duplikaty, odhaczanie, edycja, usuwanie, czyszczenie, sortowanie.
3. Zapis i odczyt (`storage.js`) z obsługą błędów i testami.
4. Interfejs: lista, sekcje, licznik, pusty stan, dodawanie.
5. Interfejs: edycja w miejscu, usuwanie, czyszczenie kupionych.
6. Wygląd: style mobilne, tryb ciemny.
7. PWA: manifest, ikony, service worker.
8. Publikacja na GitHub Pages przez GitHub Actions (repozytorium `sprawunki`, adres `https://<login>.github.io/sprawunki/`); test instalacji na telefonie.
9. Opcjonalnie: „Cofnij”.
10. Test w prawdziwym sklepie i poprawki.

### Kryteria ukończenia

- Wszystkie funkcje z punktów 3.1–3.7 i 3.9 działają na telefonie z Androidem.
- Aplikacja zainstalowana na ekranie głównym działa w trybie samolotowym.
- Dane przetrwają zamknięcie aplikacji i restart telefonu.
- Testy logiki przechodzą (`npm test`).
- Aplikacja jest opublikowana pod adresem GitHub Pages.

## Wersja 1.1

### Kolejność implementacji

1. Parsowanie ilości w `store.js` (`parseQuantity`) i nowe porównywanie duplikatów, z testami.
2. Interfejs: etykieta ilości.
3. Ręczna kolejność w `store.js` (`getSections` według tablicy, `moveItem`), z testami.
4. Interfejs: uchwyt i przesuwanie klawiaturą.
5. Interfejs: przeciąganie palcem i myszą.
6. Blokada wygaszania ekranu.
7. Test na telefonie, aktualizacja README, publikacja.

### Kryteria ukończenia

- Funkcje 9.1–9.3 działają w Chrome na Androidzie; na iOS aplikacja działa bez błędów (Wake Lock może być niedostępny).
- Dane z wersji 1 wczytują się bez zmian i w dotychczasowej kolejności.
- Testy przechodzą (`npm test`).

## Wersja 2.0 — kategorie

### Kolejność implementacji

1. Kategorie domyślne, słownik i dobieranie kategorii (czyste funkcje), z testami.
2. Model danych 2 i migracja w `storage.js`, z testami.
3. `store.js`: kategoria przy dodawaniu, zmiana kategorii z pamięcią, grupy w `getSections`, z testami.
4. `moveItem` w obrębie grupy (z testami) i interfejs: grupy z podtytułami, przeciąganie i strzałki w grupie. Razem, bo pozycja w grupie ma sens dopiero wtedy, gdy interfejs pokazuje grupy.
5. Interfejs: przycisk kategorii przy produkcie.
6. `store.js`: dodawanie, zmiana nazwy, usuwanie i zmiana kolejności kategorii, z testami.
7. Interfejs: okno zarządzania kategoriami.
8. Test w sklepie, README, wersja 2.0.0, publikacja.

### Kryteria ukończenia

- Funkcje 10.1–10.5 działają w Chrome na Androidzie.
- Dane z wersji 1.1 wczytują się po migracji bez utraty produktów, z zachowaniem kolejności i z kategoriami ze słownika.
- Testy przechodzą (`npm test`).

## Wersja 2.1 — wiele list

### Kolejność implementacji

1. `store.js`: dodawanie, zmiana nazwy, usuwanie i zmiana kolejności list, przełączanie aktywnej listy, liczniki list, z testami. Test w `storage.test.js`: dane z kilkoma listami wczytują się z zachowaniem aktywnej listy.
2. Interfejs: przycisk „Listy” w nagłówku i okno zarządzania listami. Wspólne części z oknem kategorii przenieść do wspólnego kodu, zamiast je kopiować.
3. Interfejs: przycisk z nazwą listy i okno wyboru listy.
4. Test na telefonie, README, wersja 2.1.0, publikacja.

### Kryteria ukończenia

- Funkcje 11.1–11.3 działają w Chrome na Androidzie.
- Dane z wersji 2.0 wczytują się bez zmian.
- Testy przechodzą (`npm test`, `npm run test:e2e`).

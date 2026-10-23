# Sprawunki — specyfikacja wersji 1

## 1. Cel

**Sprawunki** to prosta aplikacja webowa (PWA) do prowadzenia listy zakupów: dopisuję produkty w ciągu dnia, w sklepie odhaczam kupione, po zakupach czyszczę listę.

- **Użytkownicy:** autor i kilku znajomych. Każdy korzysta niezależnie na swoim telefonie, z własną listą zapisaną lokalnie.
- **Problem:** zapominanie, co kupić; gubienie się w trakcie zakupów; niewygoda kartek i ogólnych notatników.
- **Zasada nadrzędna:** aplikacja ma być szybsza i prostsza w użyciu niż kartka papieru.

## 2. Ograniczenia

- Brak backendu. Wszystkie dane tylko w przeglądarce (localStorage).
- Brak logowania, kont, płatności.
- Brak zewnętrznych usług i zasobów w czasie działania: żadnych API, CDN, fontów z sieci, analityki.
- Pełne działanie offline po pierwszym uruchomieniu.
- Platformy: **priorytet Chrome na Androidzie**; Safari na iOS 16.4+ ma działać bez dodatkowych funkcji.
- Interfejs w języku polskim.

## 3. Zakres wersji 1

### 3.1 Dodawanie produktu

- Pole tekstowe i przycisk „Dodaj” umieszczone na dole ekranu (w zasięgu kciuka).
- Dodanie: Enter lub przycisk „Dodaj”.
- Po dodaniu pole jest czyszczone, a fokus zostaje w polu, żeby można było dodać kilka produktów pod rząd.
- Ilość wpisuje się w nazwę (np. „mleko 2 l”). Nazwa jest przechowywana i wyświetlana dokładnie tak, jak ją wpisano (po przycięciu spacji z początku i końca). Aplikacja nie parsuje ilości.
- Pusta nazwa (lub same spacje) nie dodaje produktu.
- Maksymalna długość nazwy: 100 znaków.

### 3.2 Duplikaty

- Dwa produkty są duplikatami, gdy ich **znormalizowane nazwy** są równe. Normalizacja: przycięcie spacji, zamiana wielokrotnych spacji na jedną, małe litery (`toLocaleLowerCase('pl')`).
- Próba dodania duplikatu:
  - produkt **nie jest dodawany** ponownie,
  - jeśli istniejący produkt był odhaczony, zostaje odznaczony (wraca do sekcji „do kupienia”),
  - istniejący produkt jest krótko podświetlony i przewinięty do widoku,
  - pole tekstowe jest czyszczone.
- Uwaga: „mleko” i „mleko 2 l” to różne produkty (świadome uproszczenie wersji 1).

### 3.3 Lista i kolejność

- Dwie sekcje: **„Do kupienia”** (u góry) i **„Kupione”** (pod spodem, wyszarzone, nazwa przekreślona).
- „Do kupienia”: w kolejności dodania, najnowsze na dole.
- „Kupione”: ostatnio odhaczony na górze sekcji.
- Licznik postępu, np. „3 z 8 kupione”.
- Pusty stan: gdy lista jest pusta, krótki komunikat zachęcający do dodania pierwszego produktu.

### 3.4 Odhaczanie

- Tapnięcie w pole wyboru (checkbox) przy produkcie przełącza stan kupione/niekupione.
- Odznaczony produkt wraca do sekcji „Do kupienia” na swoje miejsce według kolejności dodania.

### 3.5 Edycja

- Tapnięcie w nazwę produktu włącza edycję w miejscu.
- Enter lub utrata fokusu zapisuje zmianę; Escape anuluje.
- Pusta nazwa po edycji: zmiana jest odrzucana, przywracana jest poprzednia nazwa.
- Nazwa będąca duplikatem innego produktu: zmiana jest odrzucana z krótkim komunikatem.

### 3.6 Usuwanie

- Przycisk usuwania (ikona) przy każdym produkcie. Usuwa od razu, bez potwierdzenia.

### 3.7 Czyszczenie kupionych

- Przycisk „Wyczyść kupione” widoczny tylko wtedy, gdy są kupione produkty.
- Wymaga potwierdzenia (natywne `confirm()`), chyba że zrealizowano funkcję „Cofnij” (3.8).

### 3.8 Cofnij (opcjonalne, jeśli zostanie czas)

- Po usunięciu produktu lub wyczyszczeniu kupionych pojawia się na ok. 5 s komunikat z przyciskiem „Cofnij”, który przywraca poprzedni stan.
- Po wdrożeniu tej funkcji „Wyczyść kupione” nie wymaga już potwierdzenia.

### 3.9 PWA

- Instalowalna na Androidzie (Chrome) i iOS (Safari, „Dodaj do ekranu początkowego”).
- Manifest: `name` „Sprawunki — lista zakupów”, `short_name` „Sprawunki”, `display: standalone`, `lang: pl`, kolor motywu, ikony 192×192 i 512×512 (także wariant `maskable`) oraz `apple-touch-icon`.
- Tytuł strony (`<title>`) i nagłówek aplikacji: „Sprawunki”.
- Service worker zapisuje w pamięci podręcznej wszystkie pliki aplikacji; pełne działanie offline.
- Aktualizacje instalują się automatycznie przy kolejnym uruchomieniu.

## 4. Dane

### 4.1 Model

Zapisywany pod jednym kluczem localStorage `sprawunki`, jako JSON:

```json
{
  "version": 1,
  "activeListId": "l_1",
  "lists": [
    {
      "id": "l_1",
      "name": "Zakupy",
      "items": [
        {
          "id": "i_abc123",
          "name": "mleko 2 l",
          "checked": false,
          "createdAt": 1761230000000,
          "checkedAt": null,
          "categoryId": null
        }
      ]
    }
  ]
}
```

- Struktura od razu przewiduje **wiele list** i **kategorie** (wersja 2). W wersji 1 istnieje dokładnie jedna lista, a `categoryId` jest zawsze `null`.
- Identyfikatory: `crypto.randomUUID()` z prefiksem (`l_`, `i_`).
- Czasy: milisekundy (`Date.now()`).

### 4.2 Zapis i odczyt

- Zapis po każdej zmianie.
- Przy starcie: brak danych → utworzenie pustej listy domyślnej.
- Uszkodzony JSON lub nieznana wersja: **nie nadpisywać** danych. Kopia surowej wartości trafia pod klucz `sprawunki-backup-<timestamp>`, aplikacja startuje z pustą listą i pokazuje komunikat.
- Pole `version` służy do migracji danych w przyszłych wersjach (funkcja `migrate(data)`).

## 5. Wymagania niefunkcjonalne

- Projekt pod telefon (mobile first); na komputerze lista wyśrodkowana, maks. ok. 600 px szerokości.
- Elementy dotykowe min. 44×44 px.
- Fonty systemowe, brak zasobów z zewnątrz.
- Tryb jasny i ciemny według ustawień systemu (`prefers-color-scheme`).
- Dostępność: etykiety dla przycisków z ikonami (`aria-label`), prawdziwe elementy `<input type="checkbox">` i `<button>`, obsługa klawiatury.
- Bezpieczeństwo: nazwy produktów wstawiane wyłącznie przez `textContent`, nigdy przez `innerHTML`.
- Szybkość: start i reakcje natychmiastowe; brak zbędnych zależności.

## 6. Poza zakresem wersji 1

- **Wersja 2:** kategorie (działy sklepu, własna kolejność, zapamiętywanie kategorii produktu), wiele list.
- **Później:** podpowiedzi z historii, udostępnianie listy linkiem, eksport/import kopii zapasowej, blokada wygaszania ekranu (Wake Lock), zmiana kolejności przeciąganiem, parsowanie ilości.
- **Nigdy (w obecnych założeniach):** synchronizacja między osobami lub urządzeniami, konta, ceny i budżet, powiadomienia, reklamy i analityka.

## 7. Kolejność implementacji

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

## 8. Kryteria ukończenia wersji 1

- Wszystkie funkcje z punktów 3.1–3.7 i 3.9 działają na telefonie z Androidem.
- Aplikacja zainstalowana na ekranie głównym działa w trybie samolotowym.
- Dane przetrwają zamknięcie aplikacji i restart telefonu.
- Testy logiki przechodzą (`npm test`).
- Aplikacja jest opublikowana pod adresem GitHub Pages.

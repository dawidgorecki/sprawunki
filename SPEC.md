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
- Ilość wpisuje się w nazwę (np. „mleko 2 l”). Nazwa jest przechowywana i wyświetlana dokładnie tak, jak ją wpisano (po przycięciu spacji z początku i końca). Aplikacja nie parsuje ilości. *(Zmienione w wersji 1.1, zob. 9.1.)*
- Pusta nazwa (lub same spacje) nie dodaje produktu.
- Maksymalna długość nazwy: 100 znaków.

### 3.2 Duplikaty

- Dwa produkty są duplikatami, gdy ich **znormalizowane nazwy** są równe. Normalizacja: przycięcie spacji, zamiana wielokrotnych spacji na jedną, małe litery (`toLocaleLowerCase('pl')`).
- Próba dodania duplikatu:
  - produkt **nie jest dodawany** ponownie,
  - jeśli istniejący produkt był odhaczony, zostaje odznaczony (wraca do sekcji „do kupienia”),
  - istniejący produkt jest krótko podświetlony i przewinięty do widoku,
  - pole tekstowe jest czyszczone.
- Uwaga: „mleko” i „mleko 2 l” to różne produkty (świadome uproszczenie wersji 1). *(Zmienione w wersji 1.1, zob. 9.1.)*

### 3.3 Lista i kolejność

- Dwie sekcje: **„Do kupienia”** (u góry) i **„Kupione”** (pod spodem, wyszarzone, nazwa przekreślona).
- „Do kupienia”: w kolejności dodania, najnowsze na dole. *(W wersji 1.1 kolejność można zmieniać ręcznie, zob. 9.2.)*
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

- Struktura od razu przewiduje **wiele list** i **kategorie** (wersja 2). W wersji 1 istnieje dokładnie jedna lista, a `categoryId` jest zawsze `null`. *(Kategorie: wersja 2.0, model danych 2, zob. 10.6.)*
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

- **Wersja 2:** podzielona na **2.0 — kategorie** (działy sklepu, własna kolejność, zapamiętywanie kategorii produktu; punkt 10) i **2.1 — wiele list** (specyfikacja później).
- **Później:** podpowiedzi z historii, udostępnianie listy linkiem, eksport/import kopii zapasowej, ~~blokada wygaszania ekranu, zmiana kolejności przeciąganiem, parsowanie ilości~~ (przeniesione do wersji 1.1, punkt 9).
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

## 9. Wersja 1.1

Trzy usprawnienia do używania w sklepie. Wersja 2 (kategorie, wiele list) pozostaje bez zmian.

### 9.1 Parsowanie ilości

- Nazwa produktu nadal jest **zapisywana dokładnie tak, jak ją wpisano**. Ilość jest z niej odczytywana przy wyświetlaniu i porównywaniu, więc nie ma nowego pola w danych.
- **Ilość** to:
  - liczba z opcjonalną jednostką: `2`, `0,5`, `1.5`, `2 l`, `2l`, `500 g`, `10 szt.`;
    jednostki (wielkość liter bez znaczenia, opcjonalna kropka na końcu): `g`, `dag`, `dkg`, `kg`, `ml`, `l`, `szt`, `op`, `opak`;
  - albo mnożnik: `x2`, `2x`, `×2`, `2×` (bez spacji w środku).
- Ilość jest rozpoznawana **na końcu** nazwy (po spacji) albo **na początku** (przed spacją):
  - „mleko 2 l” → nazwa „mleko”, ilość „2 l”
  - „chleb x2” → „chleb”, „x2”
  - „6 jajek” → „jajek”, „6”
  - „2 l mleka” → „mleka”, „2 l”
- Wyjątki:
  - Sama liczba bez jednostki **na końcu** nie jest ilością („mąka typ 450”, „WD 40”). Na początku jest („6 jajek”).
  - Jeśli po odjęciu ilości nazwa byłaby pusta (np. „2 l”), całość jest nazwą.
  - Rozpoznawana jest najwyżej jedna ilość; najpierw sprawdzany jest koniec nazwy.
- **Wyświetlanie:** nazwa bez ilości, a ilość w osobnej etykiecie obok, w zapisie użytkownika (np. „2l” zostaje „2l”).
- **Edycja w miejscu** pokazuje pełny tekst, np. „mleko 2 l”.
- **Duplikaty** (zmienia 3.2): porównywane są znormalizowane nazwy **bez ilości**, więc „mleko”, „mleko 2 l” i „Mleko 3 l” to ten sam produkt. Przy próbie dodania duplikatu:
  - jeśli wpis ma ilość, nazwa istniejącego produktu zostaje zastąpiona wpisanym tekstem (z „mleko 2 l” robi się „Mleko 3 l”),
  - jeśli wpis nie ma ilości, nazwa istniejącego produktu się nie zmienia,
  - poza tym jak w 3.2: odznaczenie, podświetlenie, wyczyszczenie pola.
- Edycja (3.5): nazwa jest duplikatem, gdy jej nazwa bez ilości równa się nazwie bez ilości innego produktu.
- Świadome uproszczenie: odmiana nie jest rozpoznawana, więc „mleko 2 l” i „2 l mleka” to różne produkty.

### 9.2 Zmiana kolejności

- Dotyczy tylko sekcji „Do kupienia”. „Kupione” zostają posortowane jak dotąd (ostatnio odhaczony na górze).
- Każdy produkt do kupienia ma po lewej uchwyt (≡). To prawdziwy `<button>` z `aria-label` „Zmień kolejność: <nazwa>”, min. 44×44 px.
- **Przeciąganie** działa tylko za uchwyt, a reszta listy przewija się normalnie palcem. Implementacja na Pointer Events, bez bibliotek. W trakcie przeciągania produkt podąża za palcem, pozostałe robią mu miejsce, a po puszczeniu nowa kolejność jest zapisywana. Gdy palec zbliży się do górnej lub dolnej krawędzi ekranu, lista przewija się sama. Przerwane przeciąganie (`pointercancel`) przywraca poprzednią kolejność.
- **Klawiatura:** na uchwycie strzałka w górę lub w dół przesuwa produkt o jedno miejsce; fokus zostaje na uchwycie.
- Nowe produkty trafiają na koniec „Do kupienia”.
- Odznaczony produkt wraca na swoje miejsce w ręcznej kolejności (zmienia 3.4).
- Zmiana kolejności nie pokazuje „Cofnij”, bo łatwo ją odwrócić ręcznie.
- **Dane:** kolejność to kolejność elementów w tablicy `items`, więc nie ma nowego pola. W wersji 1 produkty były dopisywane na koniec tablicy, więc dotychczasowa kolejność tablicy jest już kolejnością dodania. Dlatego migracja nie jest potrzebna i `version` zostaje równe 1. Przesunięcie zmienia pozycje tylko produktów do kupienia; kupione zostają na swoich miejscach w tablicy.

### 9.3 Blokada wygaszania ekranu

- Przycisk-przełącznik w nagłówku z ikoną, `aria-label` „Nie wygaszaj ekranu” i `aria-pressed`. Wyraźnie widać, czy jest włączony.
- Domyślnie wyłączony. Stan **nie jest zapamiętywany**: po ponownym otwarciu aplikacji przełącznik jest wyłączony.
- Włączenie wywołuje `navigator.wakeLock.request('screen')`. Przeglądarka sama zwalnia blokadę, gdy aplikacja schodzi w tło. Po powrocie (`visibilitychange`), jeśli przełącznik jest włączony, blokada jest zakładana ponownie.
- Gdy przeglądarka odmówi (np. tryb oszczędzania baterii), przełącznik wraca do stanu wyłączonego i pojawia się komunikat „Nie udało się wyłączyć wygaszania ekranu.”.
- Brak API (`'wakeLock' in navigator` jest fałszywe): przycisk jest ukryty.
- Kod w osobnym module `src/wake-lock.js`, bo nie jest to ani logika listy, ani zapis danych.

### 9.4 Kolejność implementacji

1. Parsowanie ilości w `store.js` (`parseQuantity`) i nowe porównywanie duplikatów, z testami.
2. Interfejs: etykieta ilości.
3. Ręczna kolejność w `store.js` (`getSections` według tablicy, `moveItem`), z testami.
4. Interfejs: uchwyt i przesuwanie klawiaturą.
5. Interfejs: przeciąganie palcem i myszą.
6. Blokada wygaszania ekranu.
7. Test na telefonie, aktualizacja README, publikacja.

### 9.5 Kryteria ukończenia

- Funkcje 9.1–9.3 działają w Chrome na Androidzie; na iOS aplikacja działa bez błędów (Wake Lock może być niedostępny).
- Dane z wersji 1 wczytują się bez zmian i w dotychczasowej kolejności.
- Testy przechodzą (`npm test`).

## 10. Wersja 2.0 — kategorie

Produkty do kupienia są pogrupowane według działów sklepu, w kolejności, w jakiej chodzi się po sklepie. Wiele list to osobna wersja 2.1 (specyfikacja później).

### 10.1 Kategorie

- Na start aplikacja ma zestaw **kategorii domyślnych**, w tej kolejności:
  Warzywa i owoce, Pieczywo, Nabiał, Mięso i ryby, Wędliny, Mrożonki, Spiżarnia (mąka, makarony, konserwy, przyprawy), Słodycze i przekąski, Napoje, Chemia i kosmetyki.
- Kategorie można dodawać, zmieniać im nazwy, usuwać i ustawiać ich kolejność (10.5). Kategorie domyślne nie różnią się od dodanych, więc też można je usunąć.
- Nazwa kategorii: niepusta, maks. 40 znaków, bez duplikatów (porównanie jak w 3.2, bez parsowania ilości).
- **„Bez kategorii”** to nie jest kategoria, tylko brak kategorii (`categoryId: null`). Zawsze stoi na końcu, nie da się jej usunąć ani zmienić jej nazwy.
- Kategorie są wspólne dla całej aplikacji, nie dla jednej listy (przyda się w 2.1).

### 10.2 Przypisywanie kategorii

- Dodawanie produktu się nie zmienia: wpisujesz nazwę i zatwierdzasz. Kategoria jest dobierana automatycznie, według **nazwy bez ilości, znormalizowanej** (9.1, 3.2), w tej kolejności:
  1. **pamięć użytkownika**: kategoria, którą użytkownik wcześniej wybrał dla tej nazwy (także wybór „Bez kategorii”, który wyłącza słownik dla tej nazwy);
  2. **słownik**: wbudowana lista ok. 150 popularnych produktów, w popularnych formach („jajka”, „jajek”, „jaja”), dokładne dopasowanie;
  3. **słownik po pierwszym słowie**: „mleko owsiane” → „mleko” → Nabiał;
  4. w przeciwnym razie „Bez kategorii”.
- Wpisy słownika wskazujące usuniętą kategorię są pomijane.
- **Zmiana kategorii:** przy każdym produkcie do kupienia jest przycisk kategorii (ikona etykiety), `aria-label` „Kategoria: <nazwa>”. Otwiera systemową listę wyboru (`<select>`) z kategoriami w ich kolejności i „Bez kategorii” na końcu.
  - Po wyborze produkt trafia **na koniec** wybranej grupy.
  - Wybór jest zapisywany w pamięci użytkownika dla nazwy produktu bez ilości, więc następne „mleko” trafi tam samo.
- Kupione produkty nie mają przycisku kategorii.
- Duplikat (3.2, 9.1) nie zmienia kategorii istniejącego produktu.
- Edycja nazwy (3.5) nie zmienia kategorii.
- Usunięcie produktu nie usuwa wpisu z pamięci, bo pamięć ma przetrwać do następnych zakupów.

### 10.3 Lista

- „Do kupienia” jest podzielona na **grupy** według kategorii, w kolejności kategorii, a „Bez kategorii” na końcu. Każda grupa ma podtytuł z nazwą kategorii. Puste grupy nie są pokazywane.
- Jeśli wszystkie produkty są w „Bez kategorii”, podtytuł nie jest pokazywany i lista wygląda jak w wersji 1.1.
- W grupie obowiązuje ręczna kolejność z 9.2. Przeciąganie i strzałki działają tylko wewnątrz grupy; produkt nie wyjedzie poza swoją grupę. Kategorię zmienia się przyciskiem kategorii (10.2).
- Nowy produkt trafia na koniec swojej grupy.
- Odznaczony produkt wraca do swojej grupy, na swoje miejsce w ręcznej kolejności.
- „Kupione” zostają jedną listą bez grup, posortowaną jak dotąd (3.3).
- Licznik postępu liczy wszystkie produkty, jak dotąd.

### 10.4 Pamięć kategorii

- Pamięć to słownik „nazwa bez ilości, znormalizowana → id kategorii albo `null`”.
- Wpis powstaje lub zmienia się tylko przy ręcznej zmianie kategorii produktu (10.2).
- Usunięcie kategorii usuwa wpisy pamięci, które na nią wskazują.
- Pamięć nie ma limitu wielkości: rośnie tylko przy ręcznych wyborach, więc zostaje mała.

### 10.5 Zarządzanie kategoriami

- Przycisk w nagłówku (ikona, `aria-label` „Kategorie”) otwiera okno (`<dialog>`, modalne; Escape i przycisk „Gotowe” zamykają).
- W oknie jest lista kategorii, a przy każdej:
  - uchwyt ≡: przeciąganie i strzałki jak w 9.2;
  - nazwa: tapnięcie włącza edycję w miejscu (jak 3.5; pusta nazwa przywraca poprzednią, duplikat jest odrzucany z komunikatem);
  - przycisk usuwania ×.
- Pod listą jest pole i przycisk „Dodaj kategorię”, przyklejone do dołu okna (jak pole dodawania produktu na ekranie głównym), więc są widoczne bez przewijania. Nowa kategoria trafia na koniec i okno przewija się tak, żeby była widoczna.
- **Usuwanie:**
  - nieużywana kategoria jest usuwana od razu;
  - jeśli należą do niej jakieś produkty, aplikacja pyta o potwierdzenie (`confirm()`: „Produkty z tej kategorii trafią do „Bez kategorii”. Usunąć?”). Po usunięciu produkty mają `categoryId: null`.
  - Bez „Cofnij”, bo pasek komunikatów jest zasłonięty przez okno.
- „Bez kategorii” nie występuje na liście w oknie.

### 10.6 Dane

Wersja danych **2** (`version: 2`). Nowe pola na najwyższym poziomie:

```json
{
  "version": 2,
  "activeListId": "l_1",
  "categories": [
    { "id": "c_produce", "name": "Warzywa i owoce" },
    { "id": "c_bakery", "name": "Pieczywo" }
  ],
  "categoryMemory": {
    "mleko owsiane": "c_dairy",
    "baterie": null
  },
  "lists": [ "…bez zmian, items[].categoryId wskazuje kategorię albo null" ]
}
```

- Kolejność kategorii to kolejność tablicy `categories` (tak jak w 9.2 dla produktów).
- Kategorie domyślne mają **stałe** id (`c_produce`, `c_bakery`, `c_dairy`, `c_meat`, `c_deli`, `c_frozen`, `c_pantry`, `c_snacks`, `c_drinks`, `c_household`), bo słownik się do nich odwołuje. Nowe kategorie dostają `c_` + `crypto.randomUUID()`.
- `categoryId` produktu wskazujący nieistniejącą kategorię jest traktowany jak `null`.
- **Migracja 1 → 2** (`migrate`):
  - dodaje kategorie domyślne i pustą pamięć,
  - przypisuje istniejącym produktom kategorie ze słownika (10.2, kroki 2–4), dzięki czemu lista po aktualizacji od razu jest pogrupowana,
  - nie zmienia nazw, stanów ani kolejności produktów.
- Odczyt sprawdza też poprawność `categories` i `categoryMemory`; w razie błędu działa 4.2 (kopia zapasowa i pusta lista).
- Starsza wersja aplikacji nie zna wersji danych 2. Nie jest to problem, bo aktualizacja instaluje się automatycznie (3.9), a stara wersja nie nadpisze danych (4.2).
- Słownik jest w osobnym pliku `src/product-dictionary.js` (dane, bez logiki).

### 10.7 Kolejność implementacji

1. Kategorie domyślne, słownik i dobieranie kategorii (czyste funkcje), z testami.
2. Model danych 2 i migracja w `storage.js`, z testami.
3. `store.js`: kategoria przy dodawaniu, zmiana kategorii z pamięcią, grupy w `getSections`, z testami.
4. `moveItem` w obrębie grupy (z testami) i interfejs: grupy z podtytułami, przeciąganie i strzałki w grupie. Razem, bo pozycja w grupie ma sens dopiero wtedy, gdy interfejs pokazuje grupy.
5. Interfejs: przycisk kategorii przy produkcie.
6. `store.js`: dodawanie, zmiana nazwy, usuwanie i zmiana kolejności kategorii, z testami.
7. Interfejs: okno zarządzania kategoriami.
8. Test w sklepie, README, wersja 2.0.0, publikacja.

### 10.8 Kryteria ukończenia

- Funkcje 10.1–10.5 działają w Chrome na Androidzie.
- Dane z wersji 1.1 wczytują się po migracji bez utraty produktów, z zachowaniem kolejności i z kategoriami ze słownika.
- Testy przechodzą (`npm test`).

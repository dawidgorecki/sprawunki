// Built-in product → category dictionary (spec 10.2). Data only, no logic.
//
// Grouped by default category id, so it is easy to read and extend. Each name is
// written the way findCategoryId() compares names: lowercase, no quantity, single
// spaces. Several word forms are listed where people use them ("jajka", "jajek")
// because the app does not understand Polish grammar.
//
// Multi-word names are rarely needed: a name not found as a whole is looked up
// by its first word too ("mleko owsiane" → "mleko"). A name may appear only once
// in the whole dictionary; tests/store.test.js checks these rules.

export const PRODUCT_DICTIONARY = {
  c_produce: [
    'ziemniaki', 'ziemniak', 'marchew', 'marchewka', 'cebula', 'czosnek', 'pomidory',
    'pomidor', 'ogórki', 'ogórek', 'papryka', 'sałata', 'kapusta', 'brokuł', 'brokuły',
    'kalafior', 'cukinia', 'pieczarki', 'por', 'seler', 'pietruszka', 'natka', 'koperek',
    'szczypiorek', 'rzodkiewka', 'rzodkiewki', 'buraki', 'burak', 'szpinak', 'rukola',
    'imbir', 'awokado', 'jabłka', 'jabłko', 'banany', 'banan', 'gruszki', 'gruszka',
    'pomarańcze', 'pomarańcza', 'mandarynki', 'cytryna', 'cytryny', 'limonka', 'winogrona',
    'truskawki', 'borówki', 'maliny', 'kiwi', 'arbuz', 'śliwki', 'brzoskwinie',
  ],
  c_bakery: [
    'chleb', 'pieczywo', 'bułki', 'bułka', 'bułeczki', 'kajzerki', 'kajzerka', 'grahamki',
    'grahamka', 'rogal', 'rogale', 'bagietka', 'bagietki', 'chałka', 'drożdżówka',
    'drożdżówki', 'tortilla', 'tortille',
  ],
  c_dairy: [
    'mleko', 'jogurt', 'jogurty', 'kefir', 'maślanka', 'śmietana', 'śmietanka', 'masło',
    'margaryna', 'ser', 'serek', 'serki', 'twaróg', 'mozzarella', 'feta', 'parmezan',
    'jajka', 'jajek', 'jaja', 'jajko',
  ],
  c_meat: [
    'mięso', 'mielone', 'kurczak', 'pierś', 'piersi', 'udka', 'filet', 'filety', 'schab',
    'karkówka', 'żeberka', 'wątróbka', 'wołowina', 'wieprzowina', 'indyk', 'ryba', 'ryby',
    'łosoś', 'dorsz', 'karp', 'krewetki',
  ],
  c_deli: [
    'szynka', 'kiełbasa', 'kiełbaski', 'parówki', 'salami', 'kabanosy', 'polędwica',
    'pasztet', 'baleron', 'mortadela', 'boczek', 'kaszanka',
  ],
  c_frozen: ['mrożonki', 'mrożone', 'lody', 'frytki', 'pierogi', 'pizza', 'lód'],
  c_pantry: [
    'mąka', 'cukier', 'sól', 'pieprz', 'przyprawy', 'przyprawa', 'ryż', 'makaron', 'kasza',
    'płatki', 'owsianka', 'olej', 'oliwa', 'ocet', 'ketchup', 'majonez', 'musztarda',
    'koncentrat', 'passata', 'przecier', 'sos', 'bulion', 'konserwa', 'tuńczyk', 'fasola',
    'groszek', 'kukurydza', 'ciecierzyca', 'soczewica', 'drożdże', 'miód', 'dżem', 'kawa',
    'herbata', 'kakao', 'budyń', 'galaretka',
  ],
  c_snacks: [
    'czekolada', 'czekolady', 'chipsy', 'ciastka', 'ciasteczka', 'herbatniki', 'wafelki',
    'cukierki', 'żelki', 'baton', 'batony', 'paluszki', 'krakersy', 'chrupki', 'popcorn',
    'orzeszki', 'orzechy',
  ],
  c_drinks: [
    'woda', 'sok', 'soki', 'napój', 'napoje', 'cola', 'lemoniada', 'oranżada', 'tonik',
    'energetyk', 'piwo', 'wino', 'wódka',
  ],
  c_household: [
    'papier', 'ręczniki', 'chusteczki', 'mydło', 'szampon', 'odżywka', 'żel', 'dezodorant',
    'pasta', 'szczoteczka', 'płyn', 'proszek', 'kapsułki', 'tabletki', 'gąbki', 'zmywaki',
    'ściereczki', 'worki', 'folia', 'pieluchy', 'podpaski', 'wkładki',
  ],
};

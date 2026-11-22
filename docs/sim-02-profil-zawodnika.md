# SIM-02 — Model umiejętności, atrybutów i profilu zawodnika

Rozszerza dane biograficzne zawodnika o profil symulacyjny, czyli parametry, z których będzie korzystał silnik meczu. Ratingi nie wpływają jeszcze na przebieg akcji: podłączy je resolver wymiany z SIM-19. SIM-02 gwarantuje, że każdy zawodnik dopuszczony do meczu ma kompletny i poprawny profil.

Kod:

- [`src/pages/match-simulation/model/profile.ts`](../src/pages/match-simulation/model/profile.ts): model, walidacja i rozwiązywanie braków. To czysta domena, pod tymi samymi regułami ESLint co silnik.
- [`src/shared/player-data/`](../src/shared/player-data/): schemat pliku z bazą zawodników, migracje i wspólny loader dla wszystkich ekranów.

## Profil symulacyjny

Wszystkie wartości to **liczby całkowite 0–100**. 50 oznacza poziom przeciętnego zawodnika ligowego w danej umiejętności, 80 i więcej to czołówka ligi, a 20 i mniej to umiejętność praktycznie nieużywana na tej pozycji.

| Grupa | Pole | Znaczenie |
|---|---|---|
| Umiejętności (`skills`) | `servePower` | siła zagrywki (asy, presja na przyjęcie) |
| | `serveAccuracy` | precyzja zagrywki (mniej błędów) |
| | `reception` | przyjęcie zagrywki |
| | `setting` | rozegranie |
| | `attack` | atak |
| | `block` | blok |
| | `defense` | obrona w polu |
| Atrybuty (`attributes`) | `jumping` | skoczność i zasięg |
| | `stamina` | kondycja (spadek formy w długich meczach) |
| | `consistency` | regularność (rozrzut wyników akcji) |
| | `experience` | doświadczenie (gra pod presją, końcówki setów) |
| Pozycje (`positions`) | `primary` | pozycja podstawowa (= `position` z bazy) |
| | `secondary` | pozycje awaryjne; libero nie gra w polu i odwrotnie |

Profil zawiera też `sources`, czyli pochodzenie każdej wartości: `data`, `bio` albo `role_default`. Dzięki temu UI i raporty mogą pokazać, które liczby są prawdziwe, a które przyjęte.

## Strategia brakujących danych

Kolejność jest jawna i deterministyczna. Nic nie jest losowane, ani przy wczytaniu, ani przy meczu:

1. **Dane** (`simulation` w rekordzie zawodnika) mają zawsze pierwszeństwo.
2. **Dane biograficzne** wyliczają dwa atrybuty:
   - `jumping` z zasięgu w ataku (320 cm → 40, 365 cm → 90), a gdy go brak, z zasięgu w bloku (300 cm → 40, 345 cm → 90);
   - `experience` z wieku w sezonie (18 lat → 20, +5 za każdy rok). Wiek liczony jest względem roku sezonu z metadanych, a nie dzisiejszej daty.
3. **Profil bazowy pozycji** (`roleBaselines`) uzupełnia resztę.

Błędne wartości **nie są przycinane ani zastępowane**. Rating 101, tekst `"70"`, literówka `atack` albo nieznana pozycja dają listę problemów (`ProfileIssue`), a zawodnik nie dostaje profilu i nie może zagrać w meczu. Ekran symulacji pokazuje wtedy powód: „niepoprawny profil symulacyjny: Nazwisko”.

**Stan danych na dziś:** 38 z 39 zawodników w bazie nie ma danych biograficznych ani symulacyjnych, więc ich profile to profile bazowe pozycji. Wszyscy rozgrywający mają te same ratingi, wszyscy libero też. Różnicowanie zawodników wymaga uzupełnienia pola `simulation` w danych. To osobna praca nad danymi, nie nad modelem.

## Specjalizacje pozycji

`roleBaselines` to średni zawodnik każdej pozycji, a `roleWeights` określa, co liczy się na danej pozycji. Na tej podstawie `overallRating(profile, role)` wylicza ocenę ogólną.

| Pozycja | Kluczowe umiejętności (waga) |
|---|---|
| S | rozegranie 0,5 · obrona 0,15 · precyzja zagrywki, blok, regularność 0,1 |
| OPP | atak 0,5 · siła zagrywki 0,2 · blok 0,15 · skoczność 0,1 |
| OH | atak 0,3 · przyjęcie 0,3 · obrona 0,15 · siła zagrywki, regularność 0,1 |
| MB | blok 0,45 · atak 0,3 · skoczność 0,15 · precyzja zagrywki 0,1 |
| L | przyjęcie 0,45 · obrona 0,45 · regularność 0,1 |

Testy pilnują, że profil bazowy każdej pozycji ma najwyższą ocenę ogólną właśnie na niej, np. rozgrywający przestawiony na środek wypada gorzej.

## Format danych i wersjonowanie

Plik `public/data/plusliga-*.json`:

| Wersja | Format |
|---|---|
| v1 | `{ metadata, players }` bez `schemaVersion` (obecny plik i wynik importera) |
| v2 | `{ schemaVersion: 2, metadata, players }`; zawodnik może mieć opcjonalne pole `simulation` |

Przykład rekordu v2 z danymi symulacyjnymi (wszystkie pola `simulation` są opcjonalne):

```json
{
  "id": "pl-wilfredo-leon",
  "position": "OH",
  "...": "pozostałe pola biograficzne bez zmian",
  "simulation": {
    "schemaVersion": 1,
    "skills": { "attack": 92, "servePower": 95, "reception": 70 },
    "attributes": { "stamina": 80 },
    "secondaryPositions": ["OPP"]
  }
}
```

`parsePlayerDataset` wczytuje każdą obsługiwaną wersję i migruje ją do bieżącej. Migracja v1→v2 jest addytywna: dodaje numer wersji i nie zmienia żadnego pola, więc plik w repo i plik z importera działają bez przepisywania. Test migracji porównuje wynik z prawdziwym plikiem pole po polu.

Uszkodzone rekordy (brak `id`, nieznana pozycja, zły typ pola, zduplikowane `id`) są pomijane z ostrzeżeniem w konsoli, a reszta bazy działa normalnie. Plik, którego nie da się użyć (zła wersja, brak listy zawodników lub metadanych), kończy się błędem `DatasetError`.

Kolejną zmianę formatu dodaje się jako `migrateV2toV3` w `migrations` oraz podbicie `DATASET_SCHEMA_VERSION`. Zmianę profilu dodaje się przez podbicie `PROFILE_SCHEMA_VERSION`, z obsługą starej wersji w `resolvePlayerProfile`.

## Kontrakt z silnikiem meczu

`MatchPlayer.profile: PlayerProfile` jest wymagane. `validateMatchInput` zwraca `invalid_profile`, gdy profil zawodnika z wyjściowej szóstki lub libero jest niekompletny, ma wartości spoza zakresu albo jego pozycja podstawowa nie zgadza się z `role`. Przykład wejścia meczu w [`docs/examples/match-example.input.json`](examples/match-example.input.json) zawiera pełne profile.

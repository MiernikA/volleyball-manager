# SIM-01 — Domena meczu i deterministyczność symulacji

Ten dokument opisuje wspólny język, kontrakty i uproszczenia dla symulacji jednego meczu dwóch gotowych drużyn. Kod znajduje się w [`src/pages/match-simulation/model/`](../src/pages/match-simulation/model/), a punktem wejścia jest `index.ts`.

## Zasady architektury

- **Czysta domena.** Moduł `model/` nie importuje Reacta, Zustand, `lucide-react` ani niczego z `@/app` / `@/pages`. Nie używa `Math.random`, `Date`, `performance.now`, timerów ani `window`. Pilnuje tego blok reguł w [`eslint.config.js`](../eslint.config.js) oraz test „nie korzysta z Math.random ani zegara”.
- **Losowość tylko przez wstrzyknięcie.** Silnik dostaje `RandomSource` (`next(): number` z przedziału [0, 1)). Implementacja `createSeededRng(seed)` to Mulberry32 z hashem FNV-1a dla seedów tekstowych.
- **Brak czasu rzeczywistego.** Jedyną osią czasu domeny jest numer porządkowy zdarzenia `seq`. Tempo odtwarzania meczu (animacje, „na żywo”) to sprawa warstwy UI, która odtwarza gotową listę zdarzeń albo wywołuje `playRally` krok po kroku.
- **Niemutowalność.** Funkcje silnika zwracają nowy stan i nie modyfikują wejścia. Działa to także na obiektach zamrożonych przez `Object.freeze`.

## Słownik

| Pojęcie | Typ | Znaczenie |
|---|---|---|
| Strona | `TeamSide` (`'A' \| 'B'`) | Drużyna w meczu (ekran „Przygotowanie meczu”). |
| Strefa | `RotationSlot` (1–6) | Pozycja na boisku; strefa 1 zagrywa. Pierwsza linia: 2, 3, 4. |
| Rotacja | `Rotation` | Przypisanie sześciu `PlayerId` do stref. |
| Przejście | `rotate()` | Rotacja zgodnie z ruchem wskazówek zegara: 2→1, 1→6, 6→5, 5→4, 4→3, 3→2. |
| Wymiana (akcja) | `RallyOutcome` | Jedna akcja od zagrywki do punktu. |
| Przyczyna zakończenia akcji | `RallyEndReason` | `ace`, `service_error`, `attack_kill`, `block_point`, `attack_error`, `unforced_error`. |
| Posiadanie zagrywki | `MatchState.serving` | Drużyna, której zawodnik ze strefy 1 zagrywa w następnej wymianie. |
| Stan seta | `SetState` | Numer, punkty, kto zaczynał zagrywką. |
| Stan meczu | `MatchState` | Faza, wygrane sety, set w toku, zagrywka, rotacje, liczniki. |
| Zdarzenie | `MatchEvent` | `match_started`, `set_started`, `rally_ended`, `rotated`, `set_ended`, `match_ended`. |
| Wynik meczu | `MatchResult` | Zwycięzca, sety, liczba wymian, pełna lista zdarzeń. |

## API

```ts
import { createSeededRng, simulateMatch, startMatch, playRally } from '@/pages/match-simulation/model';

const result = simulateMatch(input, createSeededRng('seed'));          // cały mecz naraz
const { state, events } = startMatch(input, rng);                      // albo krok po kroku…
const next = playRally(state, input, rng);                             // …po jednej wymianie
simulateMatch(input, rng, myRallyResolver);                            // własna logika akcji (SIM-19)
```

`RallyResolver` to jedyne miejsce, w którym zapada decyzja o przebiegu wymiany. Silnik odpowiada za przepisy (punktacja, zagrywka, przejścia, sety), a resolver za to, *kto i jak* wygrał akcję. Obecny `baselineRallyResolver` używa stałych proporcji (ok. 62% wygranych akcji przez drużynę odbierającą, 6% asów, 15% błędów zagrywki) i nie korzysta ze statystyk zawodników. Model statystyk dostarczy SIM-19, który podepnie się jako nowy resolver bez zmian w silniku.

Nieprawidłowe wejście kończy się wyjątkiem `MatchInputError` z listą `issues` o kodach `incomplete_rotation`, `duplicate_player`, `unknown_player`, `libero_in_rotation`, `invalid_libero` i `invalid_rules`. Skład pozycji (1 S, 1 OPP, 2 OH, 2 MB) sprawdza ekran budowania drużyny. Silnik go nie wymaga, żeby dało się testować nietypowe ustawienia.

## Gwarancja determinizmu

Dla tego samego `MatchInput`, seedu i resolvera wynik (`toEqual`) oraz kolejność zdarzeń są identyczne. Wynika to z tego, że:

1. RNG to czysta arytmetyka 32-bitowa (`Math.imul`, `>>>`), więc daje ten sam wynik w każdej przeglądarce i w Node.
2. Kolejność losowań jest stała: rzut monetą przed meczem, potem w każdej wymianie zagrywka, wynik, przyczyna i zawodnik, a rzut monetą przed tie-breakiem.
3. Iteracja odbywa się wyłącznie po tablicach i obiektach o stałej kolejności kluczy.

Zmiana kolejności losowań lub algorytmu RNG zmienia przebieg meczu dla istniejących seedów. Wykryją to testy regresji (snapshot sekwencji RNG i przykład w `docs/examples`). Taką zmianę trzeba zrobić świadomie i zaktualizować snapshoty poleceniem `npx vitest run -u`.

## Uproszczenia względem przepisów

| Oficjalne przepisy | SIM-01 |
|---|---|
| Kto zaczyna zagrywką, decyduje losowanie z wyborem zagrywki lub strony. | Rzut monetą RNG wskazuje drużynę zagrywającą; strony boiska nie są modelowane. |
| Sety 2–4 rozpoczyna drużyna, która nie zaczynała poprzedniego; tie-break ma nowe losowanie. | Tak samo. |
| Do 25 pkt (tie-break do 15), przewaga 2 pkt, bez limitu. | Tak samo; dodatkowo bezpiecznik 500 wymian na set (błąd resolvera). |
| Ustawienie można zmieniać przed każdym setem. | Każdy set zaczyna się od ustawienia z wejścia. |
| Libero wchodzi za zawodnika drugiej linii (zwykle środkowego). | Libero jest częścią wejścia i jest walidowany, ale nie wchodzi na boisko i nie dostaje akcji. Rotacje i zdarzenia dotyczą szóstki. |
| Zmiany, czasy, karty, challenge, zmiana stron. | Nie modelowane. |
| Wymiana składa się z faz: zagrywka, przyjęcie, rozegranie, atak, blok, obrona. | Wymiana jest atomowa: liczy się wynik, przyczyna i zawodnik, któremu przypisano akcję. |
| Atak tylko z pierwszej linii lub zza linii 3 m. | Bazowy resolver przypisuje atak i błąd dowolnemu zawodnikowi szóstki, a blok tylko pierwszej linii. |
| Przejście drużyny, która odzyskała zagrywkę. | Tak samo. Przy punkcie kończącym seta przejście nie jest emitowane, bo następny set i tak zaczyna się od ustawienia startowego. |

## Przykład

- Wejście: [`docs/examples/match-example.input.json`](examples/match-example.input.json) (seed + `MatchInput`).
- Wynik: [`docs/examples/match-example.result.json`](examples/match-example.result.json) (`MatchResult`, jedno zdarzenie na linię).

Oba pliki są snapshotami testu `engine.test.ts`, więc zawsze odpowiadają aktualnemu kodowi. Fragment wyniku:

```json
{"type":"match_started","firstServer":"B","seq":1}
{"type":"set_started","set":1,"server":"B","seq":2}
{"type":"rally_ended","set":1,"rally":1,"serving":"B","serverId":"b-setter","winner":"B","reason":"ace","playerId":"b-setter","score":{"A":0,"B":1},"seq":3}
{"type":"rally_ended","set":1,"rally":2,"serving":"B","serverId":"b-setter","winner":"B","reason":"attack_kill","playerId":"b-oh-1","score":{"A":0,"B":2},"seq":4}
```

## Poza zakresem SIM-01

- Statystyki zawodników i ich wpływ na akcje (SIM-19).
- Podłączenie silnika do ekranu „Symulacja meczu” (odtwarzanie zdarzeń, tablica wyników, komentarz).
- Adapter z `TeamConfiguration` + `Player[]` (Dream Team) do `MatchInput`.

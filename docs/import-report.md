# Raport importu PlusLiga — 2026/2027

Data weryfikacji: **2026-10-14**.

Oficjalna witryna PlusLiga była niedostępna dla bezpośredniego klienta w środowisku wykonawczym, a publiczny indeks wyszukiwarki nie udostępnia kompletnej listy sezonu 2026/2027. Nie obchodzono zabezpieczeń antybotowych. Z tego powodu dane są jawnie oznaczone jako **niekompletne**.

Lokalny snapshot zawiera 20 prawdziwych zawodników widocznych na oficjalnej liście sezonu 2025/2026. Oficjalne materiały dotyczące sezonu 2026/2027 udało się odnaleźć dla Wilfredo Leona i Patrika Indry. Snapshot służy do uruchomienia i przetestowania interfejsu; nie stanowi kompletnej kadry 2026/2027.

| Pozycja | Liczba |
|---|---:|
| S | 4 |
| OPP | 4 |
| OH | 4 |
| MB | 4 |
| L | 4 |

Największy brak jakościowy dotyczy dat urodzenia, wzrostu, wagi i zasięgów. Niezweryfikowane pola pozostają `null`. Siedem lokalnych portretów pochodzi z Wikimedia Commons i ma odnośniki z atrybucją bezpośrednio w profilach: Wilfredo Leon, Benjamin Toniutti, Artur Szalpuk, Erik Shoji, Bartosz Kwolek, Mateusz Bieniek i Paweł Zatorski. Jakub Popiwczak oraz Marcin Komenda otrzymali wyraźnie oznaczone, ilustracyjne portrety wygenerowane przez AI na podstawie oficjalnych fotografii referencyjnych. Pozostali zawodnicy używają awatarów z inicjałami.

Importer `scripts/import_plusliga.py` najpierw sprawdza `robots.txt`, używa jawnego User-Agent i kończy pracę bez danych, jeśli witryna odmawia dostępu lub zmieniła strukturę. Nie próbuje obchodzić zabezpieczeń.

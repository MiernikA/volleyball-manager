# PlusLiga Dream Team Builder — Omega Beta v0.0.2

Przeglądarkowy kreator dwóch niezależnych składów siatkarskich. Działa całkowicie lokalnie: React, TypeScript, Vite, Tailwind CSS i Zustand.

## Uruchomienie

```bash
npm install
npm run dev
```

Weryfikacja: `npm test`, `npm run typecheck`, `npm run build`, `npm run lint`.

Aktualizacja danych: `python scripts/import_plusliga.py`. Importer respektuje robots.txt i zatrzymuje się, jeśli nie może bezpiecznie zweryfikować źródła. Aktualny stan pokrycia opisuje [docs/import-report.md](docs/import-report.md).

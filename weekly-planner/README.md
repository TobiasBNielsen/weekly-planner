# Weekly Planner

En statisk ugeplan, der serviceres fra `docs/` (til GitHub Pages) og kan redigeres via den lokale Node/Express backend. Planen gemmes i filen `docs/schedule.json`, så når du har gemt og committet, vil den samme version blive vist på den offentlig hostede side.

## Login og rettigheder
- Offentlige besøgende kan kun se skemaet (read-only).
- Redigering kræver at du kører backend lokalt (`npm start`) og logger ind.
- Backend læser legitimationsoplysninger fra miljøvariablerne `ADMIN_USERNAME` og `ADMIN_PASSWORD` (brug eventuelt en `.env`-fil). Der er standardværdier, men ændr dem helst.

## Kom godt i gang lokalt
1. Sørg for at have [Node.js](https://nodejs.org) installeret (v18+ anbefales).
2. Installer afhængigheder:
   ```bash
   npm install
   ```
3. Opret en `.env` i projektroden og angiv loginoplysninger:
   ```env
   ADMIN_USERNAME=mitbrugernavn
   ADMIN_PASSWORD=hemmeligkode
   ```
4. Start serveren:
   ```bash
   npm start
   ```
5. Åbn http://localhost:4173 i din browser. Log ind via knappen i topbaren og opdater skemaet. Alle ændringer skrives til `docs/schedule.json`.
6. Commit og push ændringerne (inklusive `docs/schedule.json`), så GitHub Pages viser den opdaterede plan.

## GitHub Pages hosting
1. Læg hele projektet på GitHub.
2. Gå til `Settings → Pages` for repoet.
3. Vælg `Deploy from a branch`, sæt Branch til `main` og mappe til `/docs`.
4. Tryk `Save`. Når du senere har ændret skemaet lokalt og pushet, vil GitHub Pages automatisk servere den opdaterede `schedule.json`.

## Scripts
- `npm start` – kører Express-serveren og API'et, så du kan logge ind og gemme i `schedule.json`.
- `npm run dev` – samme som ovenfor, men med Nodemon hot reload.

## Struktur
```
weekly-planner/
├─ server.js          # Express + API til login og skrivning til docs/schedule.json
├─ package.json
├─ docs/
│  ├─ index.html      # Frontend (kan hostes direkte på GitHub Pages)
│  ├─ style.css
│  ├─ script.js       # Henter schedule.json + kalder backend-API ved redigering
│  └─ schedule.json   # Kildedata for skemaet (commit denne fil)
├─ README.md
└─ ...
```

## Funktioner
- Alle besøgende får vist seneste skema direkte fra `schedule.json`.
- Administrator kan logge ind lokalt for at redigere/ryde enkelte felter og gemme dem til fil.
- Ændringer skrives til fil og kan versionstyres, så GitHub Pages altid viser seneste commit.
- Loginoplysninger ligger i miljøvariabler og er derfor ikke eksponeret i de statiske filer.
- Responsivt design og redigeringspanel som før.

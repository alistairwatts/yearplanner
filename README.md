# Year Planner

A browser-based planner for creating and printing a compact calendar spanning
1 to 18 months. Add notes and color highlights to individual dates, load public
holidays for a country or region, adjust the calendar and page format, and
print the result on one page.

## Features

- Choose the starting month and year, duration, and first day of the week.
- Display months in a continuous calendar grid with globally empty weekday
	columns trimmed.
- Load public holidays from Nager.Date, with optional region filtering.
- Optionally move weekend holidays forward to the next available weekday. This
    is enabled by default for the United Kingdom.
- Add a note and a custom highlight color to a date; remove a displayed
	holiday or clear that date.
- Configure paper size, orientation, planner colors, and day-number size.
- Save planner settings and notes in browser local storage; import or export a
	JSON backup.
- Print or save as PDF with print-specific page sizing and calendar layout.

Holiday loading requires an internet connection. Planner settings and notes
are stored in the current browser; loaded holiday records are fetched again
when needed and are not part of the backup.

## Run Locally

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Use the local URL printed by Vite. To check a production build:

```sh
npm run build
npm run preview
```

## Deploy

The app can be hosted by any web server that serves static files; no Node.js
server is needed in production. From the project directory, create the
production build:

```sh
npm ci
npm run build
```

Upload the **contents** of the generated `dist/` directory to the web server's
document root. The default Vite configuration serves the app from the domain
root (for example, `https://example.com/`). If deploying under a
subdirectory (for example, `https://example.com/planner/`), set Vite's `base`
option to that path in `vite.config.ts` before building.

The browser needs internet access to load public holidays from Nager.Date.
Planner settings and notes are stored in each user's browser.

## Technology

React 19, TypeScript, and Vite 6. The app is a client-side single-page
application; it has no application server or database. Holiday data comes
from the Nager.Date v4 API:

- Countries: `https://nagerholidays.com/api/v4/Countries/Available`
- Holidays by country and year:
	`https://nagerholidays.com/api/v4/Holidays/{countryCode}/{year}`

## Project Specification

See [SPECIFICATION.md](SPECIFICATION.md) for the rebuild specification,
behavioral requirements, print constraints, and acceptance checks.

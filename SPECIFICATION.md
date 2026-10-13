# Year Planner Specification

## 1. Purpose

Build a responsive, client-side calendar planner that lets a person see a configurable run of consecutive months, add personal notes and highlights, optionally display public holidays, and produce a clean one-page printout. The app should feel useful immediately, keep the calendar as its primary workspace, and require no account or application server.

This is an as-built product specification. It records user-visible requirements, implementation constraints, edge cases, and verification criteria so the project can be recreated or changed without repeating known failures.

## 2. Scope and Principles

- The planner is a single-page React application, not a marketing or landing page.
- A calendar month is one row; all months share one weekday-column grid.
- Calendar calculations use UTC date construction and ISO date keys to avoid local-time boundary shifts.
- Configuration and personal notes persist in the browser. Remote holiday records are runtime data and must be reloadable.
- Printing is a first-class output. Screen layout and print layout must both be checked; browser screen appearance alone is not proof that print output is correct.
- Keep the implementation small and dependency-light. Use React, TypeScript, and CSS; do not introduce a backend or calendar service dependency beyond Nager.Date without a product decision.

## 3. Users and Core Stories

### Story A: Make a calendar

As a planner, I can select a start month and year, duration, and week-start day so the calendar shows the period I need.

Acceptance criteria:
- Duration is selectable from 1 through 18 months.
- The range rolls across year boundaries correctly.
- The grid contains each day once, in the correct weekday column, and shows no days outside the selected months.
- Every month shares the same weekday columns. Columns that contain no date anywhere in the selected range are removed.

### Story B: Add and manage personal plans

As a planner, I can attach a short note and a chosen highlight color to a date, edit it later, or clear the date.

Acceptance criteria:
- Clicking a date opens an accessible editor for that date.
- Note text is trimmed when saved and limited to 160 characters.
- A note and its color appear in the corresponding calendar cell; text is legible and clipped or truncated rather than overflowing into another cell.
- Saving an empty note with the default color removes the note.
- Clearing a date removes its note and any date-specific holiday removal override.
- Date notes and colors survive reloads.

### Story C: Show public holidays

As a planner, I can load public holidays for a country and optionally filter by region.

Acceptance criteria:
- Retrieve available countries from `https://nagerholidays.com/api/v4/Countries/Available`.
- Retrieve each needed year from `https://nagerholidays.com/api/v4/Holidays/{countryCode}/{year}` and display records whose `holidayTypes` include `Public`.
- A selected region includes holidays whose subdivision list is null (national) or includes that region.
- Region choices are derived from the loaded data.
- Loading state, success, invalid country code, network failure, and HTTP errors are communicated without making the rest of the planner unusable.
- If the range begins in January, fetch the preceding year as well so weekend holidays nominally dated in December can be shifted into the selected range.
- Changing country clears the selected region, loaded holidays, and date-based removal overrides. The weekend-movement default is enabled for `GB` and disabled for other countries.
- The app remains usable if the country list or holiday API cannot be reached.

### Story D: Handle weekend substitutes predictably

As a planner, I can choose whether weekend-dated holidays are displayed on the next available weekday.

Acceptance criteria:
- Substitute movement is a user-controlled checkbox and defaults on for the United Kingdom.
- When on, a Saturday or Sunday holiday moves forward to the next weekday that is not a weekend, another actual holiday, or a date already assigned to a substitute.
- Multiple holidays with the same original date share the same substitute date.
- When off, holidays remain on their source dates.
- A removed-holiday override suppresses the displayed holiday for that calendar date and persists across reloads. Country changes clear these date-based overrides to avoid suppressing unrelated new-country holidays.
- Removing a holiday does not remove a note on the same date.

### Story E: Print the planner

As a planner, I can choose a standard or custom paper size and orientation and print the calendar as a single page.

Acceptance criteria:
- Support A3, A4, A5, Letter, Legal, Ledger, and custom dimensions from 80 through 1200 mm; support portrait and landscape.
- Generate matching `@page` dimensions with 5 mm margins.
- Print the planner, not the application controls, legend, or browser-only controls.
- The calendar grid uses the available height in its print area without leaving an unexplained gap beneath it.
- Date content is aligned to the top of each cell, and every date cell retains enough height for its day number to remain visible in print.
- Day numbers remain visible and sit at the top-right of their own cells in print. The last month, including its day numbers, must not be clipped at the page edge.
- Preserve selected colors and readable day numbers and note text in print, subject to browser print-color settings.
- Verify with print-media rendering and, when possible, a real browser print/PDF preview. Inspect the final row and the wrapper border, not only the screen view.

Print regression notes:
- Ensure date controls do not collapse when the calendar is laid out for print; day numbers must remain visible in every cell.
- Use the available print area without leaving a visible gap beneath the calendar grid.
- Keep date content at the top of its cell. These outcomes are required even if a browser's print renderer needs a different layout technique.
- Browser print engines may differ. Diagnose using the user's actual print/PDF result when it disagrees with emulated print media.

### Story F: Back up and reset

As a planner, I can transfer my settings and notes, and reset the planner when needed.

Acceptance criteria:
- Export the planner configuration and notes to a JSON file.
- Import valid planner JSON, merge missing settings with defaults, normalize legacy highlight colors, and show an error for malformed or incompatible data without replacing the current planner.
- Import clears loaded holiday records; the user can load them again.
- A confirmed “Clear all” resets configuration and notes, holiday overrides, loaded holidays, transient errors, and date editing state. Canceling the confirmation changes nothing.

## 4. Configuration and Persistence

- Persist planner configuration under local-storage key `year-planner:v1`.
- Configuration includes start month/year, duration, week start, country/region, weekend movement, removed holiday dates, paper/orientation/custom dimensions, colors, day-number size, and date-keyed notes.
- Defaults: current month and year, 14 months, Sunday week start, browser-locale country when available (otherwise `GB`), A4 landscape, and the current palette and typography specified by the UI.
- Treat local storage as optional: malformed or unavailable storage must not prevent the app from starting. Show a useful status when changes cannot be saved.
- Migrate older saved or imported named highlight colors (`leaf`, `coral`, `sky`, `gold`) to their corresponding hex colors. Preserve valid six-digit hex; normalize invalid colors to `#fffefa`.
- Do not persist fetched holiday records as part of the planner backup.

## 5. Visual and Interaction Requirements

- Keep the calendar preview central and allow horizontal scrolling on narrow screens rather than shrinking the cells until they are unusable.
- Use explicit, stable table geometry; date buttons fill cells and do not cause row or column shifts.
- Distinguish weekends, public holidays, and notes while preserving contrast. Holiday fill takes precedence over weekend fill. Do not specially format the current date.
- Do not rely on color alone to communicate an interaction; date buttons have accessible names, and the note editor has dialog semantics and a clear label.
- The print view hides controls and the legend, uses the configured paper orientation/size, retains day numbers, and does not clip the final month.
- External web fonts may enhance the visual design, but fallbacks must remain readable if font loading fails.

## 6. Technical Requirements

- React 19, TypeScript in strict mode, Vite 6, and the existing npm scripts.
- Use the Nager.Date v4 endpoints listed above; validate country codes as two ASCII letters before requesting holiday data.
- Use UTC-based date arithmetic for month boundaries, weekday placement, and day counts.
- Bound custom paper dimensions and numeric inputs to the ranges exposed in the UI.
- Clean up dynamically injected page-size styles when settings change or the component unmounts.
- Avoid adding persistent state libraries, backend services, or calendar engines for this straightforward grid unless requirements expand.

## 7. Quality Gates and Rebuild Checklist

Before calling a rebuild complete:

1. `npm install` succeeds from the lockfile.
2. `npm run build` passes TypeScript and Vite production compilation.
3. Exercise calendar ranges crossing December/January, each week-start option, and duration limits.
4. Exercise note create/edit/delete, legacy color migration, reload persistence, JSON export/import, and malformed import.
5. Exercise holiday loading success/failure, regional filtering, a January range requiring the preceding year, and country-switch reset behavior.
6. Verify weekend substitute collisions: a weekend holiday skips weekends, actual holidays, and prior substitute allocations; same-source-date holidays share a substitute.
7. Under print media, verify that day numbers remain visible at the top-right of each cell, date content is top-aligned, every date cell has enough room to show its number, the last month is not clipped, and the grid fills its available area without a visible gap.
8. If actual user print output differs from automated print emulation, reproduce using the target browser and paper/orientation settings before changing layout rules.

## 8. Out of Scope

- Accounts, cloud sync, collaboration, and server-side storage.
- Offline caching of holiday data.
- Legal verification or localization of official holiday observance; Nager.Date data is presented as supplied, with the app's optional generic weekend-shift rule.
- Multi-page printing or a separate mobile calendar representation.

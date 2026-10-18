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
- Clicking anywhere in a date cell, not just on its number, opens the note editor.
- Note text is trimmed when saved and limited to 160 characters.
- A note and its color appear in the corresponding calendar cell. Note text wraps within the cell and is clipped rather than overflowing into another cell.
- Note text uses a black or white foreground, whichever has the higher WCAG contrast ratio against its current background.
- The Page tab includes a global millimetre-based day-note font-size slider alongside the other typography sliders. It updates all planner notes immediately and persists across reloads and backups.
- The right side of the Day Note dialog shows an enlarged version of the selected planner cell. Its width-to-height ratio and content sizing accurately scale from that date cell, including the date number, note wrapping and size, highlight, weekend, and holiday appearance.
- The enlarged cell stays synchronized with the planner whenever the draft note text or highlight changes, the note font size changes, or planner settings alter the selected cell's dimensions, typography, or background. It reflects unsaved note edits immediately.
- Saving an empty note with the default color removes the note.
- Clearing a date removes its note and any date-specific holiday removal override.
- Date notes and colors survive reloads.

### Story C: Show public holidays

As a planner, I can add public holidays from multiple countries and regions.

Acceptance criteria:
- Retrieve available countries from `https://nagerholidays.com/api/v4/Countries/Available`.
- Retrieve each needed year from `https://nagerholidays.com/api/v4/Holidays/{countryCode}/{year}` and display records whose `holidayTypes` include `Public`.
- Fetch holiday data as soon as a country is selected; keep the Region control disabled until the request succeeds.
- A selected region includes holidays whose subdivision list is null (national) or includes that region. Region choices are derived from the fetched data, alongside “All regions”.
- “Add Holidays” adds the selected country/region and weekend movement setting to a persistent, ordered source list. Do not add duplicate country/region entries; allow distinct regions from one country.
- Source order determines holiday color priority: the first source uses the primary holiday color, and all later sources use the secondary color. If a date has a holiday from the first source, use the primary color.
- Sources can be moved up or down and removed. Removing a source also clears its holiday-removal overrides.
- Refresh every added source when the planner’s required year span changes. Include the preceding year when the range begins in January.
- Loading state, success, invalid country code, network failure, and HTTP errors are communicated without making the rest of the planner unusable.
- The weekend-movement checkbox defaults on for `GB` and off for other countries; its value is captured when that source is added.
- The app remains usable if the country list or holiday API cannot be reached.

### Story D: Handle weekend substitutes predictably

As a planner, I can choose whether weekend-dated holidays are displayed on the next available weekday.

Acceptance criteria:
- Substitute movement is a user-controlled checkbox captured per source and defaults on for the United Kingdom.
- When on, a Saturday or Sunday holiday moves forward to the next weekday that is not a weekend, another actual holiday from that source, or a date already assigned to a substitute from that source. Different sources may land on the same date.
- Multiple holidays with the same original date share the same substitute date.
- When off, holidays remain on their source dates.
- Removing a named holiday suppresses that source’s matching observance and persists across reloads. Other sources and other named holidays on that date remain visible.
- Removing and re-adding a source starts with its holidays restored.
- Removing a holiday does not remove a note on the same date.

### Story E: Print the planner

As a planner, I can choose a standard or custom paper size and orientation and print the calendar as a single page.

Acceptance criteria:
- Support A3, A4, A5, Letter, Legal, Ledger, and custom dimensions from 80 through 1200 mm; support portrait and landscape.
- Generate matching `@page` dimensions with 5 mm margins.
- Print the planner, not the application controls or browser-only controls.
- The calendar grid uses the available height in its print area without leaving an unexplained gap beneath it.
- Date content is aligned to the top of each cell, and every date cell retains enough height for its day number to remain visible in print.
- Day numbers remain visible and sit at the top-right of their own cells in print. The last month, including its day numbers, must not be clipped at the page edge.
- Calendar typography scales with the physical date-cell width and month-row height, preserving the A4 landscape sizing as its baseline; weekday labels follow column width, and month labels follow row height. Keep day numbers large enough to remain visible and clip or truncate note text within each cell on extreme custom paper proportions.
- The Page tab provides millimetre-based font-size sliders for the title, weekday labels, month labels, month-cell year, day numbers, and day notes. Their values apply to the same screen and print sheet.
- Standard paper sizes use recommended font sizes scaled from the A4 values by the square root of the paper-area ratio; landscape and portrait use the same recommendations.
- An “Override font sizes” checkbox defaults off for standard papers. When off, show the paper-specific recommendations and disable all typography sliders, including day notes. When enabled, enable the sliders and initialize their values to the current recommendations. Turning it off restores the recommendations.
- Custom paper always forces the override checkbox on and keeps it checked and disabled. All custom font-size slider maxima scale by the square root of the custom paper-area ratio relative to A4, rounded to 0.1 mm; values are clamped when a dimension change lowers a maximum.
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

### Story G: Title the planner

As a planner, I can replace the default title with my own.

Acceptance criteria:
- The sheet shows a title above the table. By default it is the date range, e.g. "March 2026 — April 2027".
- A "Use a custom title" checkbox (default off) reveals a text input (maximum 80 characters; the placeholder shows the default title). When checked and the text is non-blank it replaces the default title; when unchecked or blank the default is shown.
- The checkbox state and text persist and are included in backups.

### Story H: Colour themes

As a planner, I can choose or build a colour scheme, including the table heading colour.

Acceptance criteria:
- A theme is six colours: accent (month labels, title, buttons), table heading background, empty cells, weekend cells, primary holiday cells, and secondary holiday cells.
- Built-in themes: Monochrome (black, white, greys; the default), Ocean (blues with grey), and Sunset (plum, apricot, coral).
- Selecting a theme copies its colours into the planner. Each colour has a colour input; changing any colour switches the theme to "Custom".
- Text on the table heading and on accent-coloured surfaces is black or white, whichever has the higher WCAG contrast ratio against the background (white when relative luminance is below 0.179).
- When "Custom" is selected the user can name and save the current colours. Saving an existing name overwrites it. Saved themes appear under "Saved" in the theme list, can be deleted, and persist in local-storage key `year-planner:themes:v1`. They are not part of backups. Malformed stored themes are ignored.
- A planner referring to a saved theme that no longer exists is treated as "Custom".

## 4. Configuration and Persistence

- Persist planner configuration under local-storage key `year-planner:v1`.
- Configuration includes start month/year, duration, week start, the country/region composer and weekend setting, the ordered holiday-source list and per-source weekend settings, removed holiday identities, paper/orientation/custom dimensions, font-size override state, the six theme colours, theme name, custom title settings, title/day-name/month-name/year-number/day-number/day-note font sizes in millimetres, and date-keyed notes.
- Font-size defaults preserve the existing A4 landscape appearance: title 5.3 mm, day names 1.9 mm, month names 4.9 mm, year number 3.5 mm, day number 2.6 mm, and day notes 1.8 mm. Slider ranges are respectively 2–12 mm, 0.8–5 mm, 1.5–7 mm, 1–5 mm, 1–5 mm, and 0.5–4 mm.
- Base slider maxima are 12 mm for title, 5 mm for day names, 7 mm for month names, and 5 mm each for year and day numbers, and 4 mm for day notes; each maximum is multiplied by the square root of paper area divided by A4 area. Minimums remain 2 mm, 0.8 mm, 1.5 mm, 1 mm, 1 mm, and 0.5 mm respectively.
- The day-note font-size slider uses the same paper-scaled recommendations and override behavior as the other typography sliders. Its A4 default is 1.8 mm and its A4 range is 0.5–4 mm in 0.1 mm increments. Older saved planners and backups missing this setting use the paper-scaled recommendation.
- Saved or imported planners with only the legacy pixel-based day-number size convert that value to millimetres; missing new font-size settings use the paper-scaled recommendations.
- Saved custom themes persist separately under `year-planner:themes:v1`; legacy saved themes without a secondary holiday color derive one from the primary color.
- Defaults: current month and year, 14 months, Sunday week start, browser-locale country when available (otherwise `GB`), A4 landscape, the Monochrome theme, default title, recommended A4 font sizes, and font-size overrides off.
- Backups lacking theme fields import as the Monochrome defaults; backups with colours but no theme name import as "Custom" with the legacy heading colour `#f0f1ef`.
- Treat local storage as optional: malformed or unavailable storage must not prevent the app from starting. Show a useful status when changes cannot be saved.
- Migrate older saved or imported named highlight colors (`leaf`, `coral`, `sky`, `gold`) to their corresponding hex colors. Preserve valid six-digit hex; normalize invalid colors to `#fffefa`.
- Do not persist fetched holiday records as part of the planner backup.

## 5. Visual and Interaction Requirements

- The configuration sidebar is split into four tabs (Calendar: title and date range; Holidays; Page: paper, layout, and typography sizes in millimetres, including day notes; Style: theme and colours). It fills the viewport height beside the calendar, scrolls internally, and keeps the status message and save indicator pinned at its bottom. On narrow screens it stacks above the calendar.
- The on-screen planner is a sheet with the exact aspect ratio of the selected paper and orientation. It is laid out at true paper size (including the 5 mm margin) and scaled to fit the available width (scale limited to 0.5–2; below that the preview scrolls horizontally). It uses the same styles as print, so it shows what will be printed. Date cells remain clickable.
- Keep the calendar preview central.
- Use explicit, stable table geometry; date buttons fill cells and do not cause row or column shifts.
- Distinguish weekends, public holidays, and notes while preserving contrast. Holiday fill takes precedence over weekend fill. Do not specially format the current date.
- Day-note text wraps within its date cell, is clipped at the cell boundary, and uses whichever of black or white has the higher WCAG contrast ratio against its rendered background.
- The Day Note dialog places an enlarged selected-date cell beside the editor. Scale its full width and height, content, and typography proportionally from the current planner cell; keep it live with unsaved text, highlight and font-size edits, and every planner change affecting that cell.
- Do not rely on color alone to communicate an interaction; date buttons have accessible names, and the note editor has dialog semantics and a clear label.
- The print view hides controls, uses the configured paper orientation/size, retains day numbers, and does not clip the final month.
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
4. Exercise note create/edit/delete, wrapping and cell clipping, contrast selection on light and dark highlights, slider persistence, live preview updates, legacy color migration, reload persistence, JSON export/import, and malformed import.
5. Exercise holiday loading success/failure, regional filtering, a January range requiring the preceding year, and country-switch reset behavior.
6. Verify weekend substitute collisions: a weekend holiday skips weekends, actual holidays, and prior substitute allocations; same-source-date holidays share a substitute.
7. Verify standard paper recommendations for all six typography sliders, including day notes; override enable/disable behavior; and custom paper's forced override state and paper-scaled slider maxima.
8. Under print media, verify that day numbers remain visible at the top-right of each cell, date content is top-aligned, every date cell has enough room to show its number, the last month is not clipped, and the grid fills its available area without a visible gap.
9. If actual user print output differs from automated print emulation, reproduce using the target browser and paper/orientation settings before changing layout rules.
10. Verify each theme and a custom colour: heading and month-label text switch between black and white for light and dark backgrounds. Verify primary/secondary holiday colors, then save, reload, select, and delete a named theme.
11. Verify the sheet's aspect ratio matches the paper for each size and orientation and that print output matches the on-screen sheet.

## 8. Out of Scope

- Accounts, cloud sync, collaboration, and server-side storage.
- Offline caching of holiday data.
- Legal verification or localization of official holiday observance; Nager.Date data is presented as supplied, with the app's optional generic weekend-shift rule.
- Multi-page printing or a separate mobile calendar representation.

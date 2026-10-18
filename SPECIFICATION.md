# Year Planner Specification

## 1. Purpose

Build a responsive, client-side calendar planner that lets a person:
- See a configurable run of consecutive months.
- Add personal notes and highlights.
- Optionally display public holidays.
- Produce a clean one-page printout.

The app should feel useful immediately, keep the calendar as its primary workspace, and require no account or application server.

This is an as-built product specification. It records the information needed to recreate or change the project without repeating known failures:
- User-visible requirements.
- Implementation constraints.
- Edge cases.
- Verification criteria.

## 2. Scope and Principles

- The planner is a single-page React application, not a marketing or landing page.
- A calendar month is one row; all months share one weekday-column grid.
- Calendar calculations use UTC date construction and ISO date keys to avoid local-time boundary shifts.
- Configuration and personal notes persist in the browser. Remote holiday records are runtime data and must be reloadable.
- Printing is a first-class output. Screen layout and print layout must both be checked; browser screen appearance alone is not proof that print output is correct.
- Keep the implementation small and dependency-light. Use:
	- React.
	- TypeScript.
	- CSS.
	Do not introduce a backend or calendar service dependency beyond Nager.Date without a product decision.

## 3. Users and Core Stories

### Story A: Make a calendar

As a planner, I can configure the calendar period by setting:
- A start month and year.
- A duration.
- A week-start day.

The calendar shows the period I need.

Acceptance criteria:
- Duration is selectable from 1 through 18 months.
- The range rolls across year boundaries correctly.
- The grid must:
	- Contain each day exactly once.
	- Place each day in the correct weekday column.
	- Show no days outside the selected months.
- Every month shares the same weekday columns. Columns that contain no date anywhere in the selected range are removed.

### Story B: Add and manage personal plans

As a planner, I can manage a date's note and highlight:
- Add or edit a short note.
- Choose a highlight color.
- Clear the date.

Acceptance criteria:
- Clicking a date opens an accessible editor for that date.
- Clicking anywhere in a date cell, not just on its number, opens the note editor.
- Note text is trimmed when saved and limited to 160 characters.
- A note and its color appear in the corresponding calendar cell. Note text wraps within the cell and is clipped rather than overflowing into another cell.
- Choose note text foreground by comparing:
	- Black.
	- White.
	Use whichever has the higher WCAG contrast ratio against the current background.
- The Page tab includes a global millimetre-based day-note font-size slider alongside the other typography sliders. It updates all planner notes immediately and persists across reloads and backups.
- The right side of the Day Note dialog shows an enlarged version of the selected planner cell. Its width-to-height ratio and content sizing accurately scale from that date cell, including:
	- The date number.
	- Note wrapping and size.
	- Highlight appearance.
	- Weekend appearance.
	- Holiday appearance.
- The enlarged cell stays synchronized with the planner whenever any of these change:
	- The draft note text or highlight.
	- The note font size.
	- Planner settings that alter the selected cell's:
		- Dimensions.
		- Typography.
		- Background.
	It reflects unsaved note edits immediately.
- Saving an empty note with the default color removes the note.
- Clearing a date removes its note and any date-specific holiday removal override.
- Date notes and colors survive reloads.

### Story C: Show public holidays

As a planner, I can add public holidays from:
- Multiple countries.
- Specific regions.

Acceptance criteria:
- Retrieve available countries from `https://nagerholidays.com/api/v4/Countries/Available`.
- Retrieve each needed year from `https://nagerholidays.com/api/v4/Holidays/{countryCode}/{year}` and display records whose `holidayTypes` include `Public`.
- Fetch holiday data as soon as a country is selected; keep the Region control disabled until the request succeeds.
- A selected region includes:
	- Holidays whose subdivision list is null (national).
	- Holidays whose subdivision list includes that region.
	Region choices are derived from fetched data and include “All regions”.
- “Add Holidays” adds these settings to a persistent, ordered source list:
	- Country.
	- Region.
	- Weekend movement setting.
	Do not add duplicate country/region entries; allow distinct regions from one country.
- Source order determines holiday color priority:
	- The first source uses the primary holiday color.
	- All later sources use the secondary color.
	- If a date has a holiday from the first source, use the primary color.
- Sources can be:
	- Moved up or down.
	- Removed.
	Removing a source also clears its holiday-removal overrides.
- Refresh every added source when the planner’s required year span changes. Include the preceding year when the range begins in January.
- Communicate each of these states without making the rest of the planner unusable:
	- Loading.
	- Success.
	- Invalid country code.
	- Network failure.
	- HTTP errors.
- The weekend-movement checkbox defaults on for `GB` and off for other countries; its value is captured when that source is added.
- The app remains usable if the country list or holiday API cannot be reached.

### Story D: Handle weekend substitutes predictably

As a planner, I can choose whether weekend-dated holidays are displayed on the next available weekday.

Acceptance criteria:
- Substitute movement is a user-controlled checkbox captured per source and defaults on for the United Kingdom.
- When on, a Saturday or Sunday holiday moves forward to the next weekday that is not:
	- A weekend.
	- Another actual holiday from that source.
	- A date already assigned to a substitute from that source.
	Different sources may land on the same date.
- Multiple holidays with the same original date share the same substitute date.
- When off, holidays remain on their source dates.
- Removing a named holiday suppresses that source’s matching observance and persists across reloads. Other sources and other named holidays on that date remain visible.
- Removing and re-adding a source starts with its holidays restored.
- Removing a holiday does not remove a note on the same date.

### Story E: Print the planner

As a planner, I can choose a standard or custom paper size and orientation and print the calendar as a single page.

Acceptance criteria:
- Support these standard paper sizes:
	- A3.
	- A4.
	- A5.
	- Letter.
	- Legal.
	- Ledger.
- Support custom dimensions from 80 through 1200 mm.
- Support portrait and landscape orientations.
- Generate matching `@page` dimensions with 5 mm margins.
- Print the planner and exclude:
	- Application controls.
	- Browser-only controls.
- The calendar grid uses the available height in its print area without leaving an unexplained gap beneath it.
- Align date content to the top of each cell.
- Give every date cell enough height for its day number to remain visible in print.
- Day numbers remain visible and sit at the top-right of their own cells in print. The last month, including its day numbers, must not be clipped at the page edge.
- Calendar typography scales with the physical date-cell width and month-row height, preserving the A4 landscape sizing as its baseline:
	- Weekday labels follow column width.
	- Month labels follow row height.
	- Day numbers remain large enough to be visible.
	- Note text is clipped or truncated within each cell on extreme custom paper proportions.
- The Page tab provides millimetre-based font-size sliders for:
	- The title.
	- Weekday labels.
	- Month labels.
	- Month-cell year.
	- Day numbers.
	- Day notes.
	Their values apply to the same screen and print sheet.
- Standard paper sizes use recommended font sizes scaled from the A4 values by the square root of the paper-area ratio. Use the same recommendations for:
	- Landscape orientation.
	- Portrait orientation.
- For standard papers, the “Override font sizes” checkbox defaults off:
	- When off:
		- Show the paper-specific recommendations.
		- Disable all typography sliders, including day notes.
	- When enabled:
		- Enable the sliders.
		- Initialize their values to the current recommendations.
	- Turning it off restores the recommendations.
- Custom paper always forces the override checkbox on and keeps it checked and disabled.
- All custom font-size slider maxima scale by the square root of the custom paper-area ratio relative to A4 and are rounded to 0.1 mm.
- Clamp values when a dimension change lowers a maximum.
- Preserve these in print, subject to browser print-color settings:
	- Selected colors.
	- Readable day numbers.
	- Readable note text.
- Verify print output using:
	- Print-media rendering.
	- A real browser print/PDF preview when possible.
	Inspect:
	- The final row.
	- The wrapper border.
	Do not inspect only the screen view.

Print regression notes:
- Ensure date controls do not collapse when the calendar is laid out for print.
- Keep day numbers visible in every cell.
- Use the available print area without leaving a visible gap beneath the calendar grid.
- Keep date content at the top of its cell. These outcomes are required even if a browser's print renderer needs a different layout technique.
- Browser print engines may differ. Diagnose using the user's actual print/PDF result when it disagrees with emulated print media.

### Story F: Back up and reset

As a planner, I can manage planner data:
- Transfer my:
	- Settings.
	- Notes.
- Reset the planner when needed.

Acceptance criteria:
- Export the planner configuration and notes to a JSON file.
- When importing planner JSON:
	- Merge missing settings with defaults.
	- Normalize legacy highlight colors.
	- Show an error for malformed or incompatible data without replacing the current planner.
- Import clears loaded holiday records; the user can load them again.
- A confirmed “Clear all” resets:
	- Configuration and notes.
	- Holiday overrides and loaded holiday data.
	- Transient errors.
	- Date editing state.
	Canceling the confirmation changes nothing.

### Story G: Title the planner

As a planner, I can replace the default title with my own.

Acceptance criteria:
- Show a title above the table. By default, use the date range, such as "March 2026 — April 2027".
- Provide a "Use a custom title" checkbox that defaults off:
	- When checked, reveal a text input with a maximum of 80 characters.
	- Show the default title as the input placeholder.
	- When checked with non-blank text, use that text as the title.
	- When unchecked or blank, show the default title.
- The checkbox state and text persist and are included in backups.

### Story H: Colour themes

As a planner, I can choose or build a colour scheme, including the table heading colour.

Acceptance criteria:
- A theme has six colours:
	- Accent, used for:
		- Month labels.
		- The title.
		- Buttons.
	- Table heading background.
	- Empty cells.
	- Weekend cells.
	- Primary holiday cells.
	- Secondary holiday cells.
- Built-in themes:
	- Monochrome, using:
		- Black.
		- White.
		- Greys.
		It is the default theme.
	- Ocean, using blues with grey.
	- Sunset, using:
		- Plum.
		- Apricot.
		- Coral.
- Selecting a theme copies its colours into the planner.
- Provide a colour input for each theme colour.
- Changing any colour switches the theme to "Custom".
- Choose text on table headings and accent-coloured surfaces by comparing:
	- Black.
	- White.
	Use whichever has the higher WCAG contrast ratio against the background. Choose white when relative luminance is below 0.179.
- When "Custom" is selected, allow the user to name and save the current colours.
- Saving an existing name overwrites that saved theme.
- Saved themes:
	- Appear under "Saved" in the theme list.
	- Can be deleted.
	- Persist in local-storage key `year-planner:themes:v1`.
	- Are not included in backups.
- Ignore malformed stored themes.
- A planner referring to a saved theme that no longer exists is treated as "Custom".

## 4. Configuration and Persistence

- Persist planner configuration under local-storage key `year-planner:v1`.
- Configuration includes:
	- Calendar range:
		- Start month and year.
		- Duration.
		- Week start.
	- Holiday settings:
		- Country/region composer.
		- Weekend setting.
		- Ordered holiday-source list.
		- Per-source weekend settings.
		- Removed holiday identities.
	- Page settings:
		- Paper.
		- Orientation.
		- Custom dimensions.
		- Font-size override state.
	- Theme settings:
		- Six theme colours.
		- Theme name.
	- Title settings:
		- Custom-title state.
		- Custom title text.
	- Typography settings in millimetres:
		- Title.
		- Day names.
		- Month names.
		- Year number.
		- Day number.
		- Day notes.
	- Date-keyed notes.
- Font-size defaults preserve the existing A4 landscape appearance:
	- Title: 5.3 mm; slider range: 2–12 mm.
	- Day names: 1.9 mm; slider range: 0.8–5 mm.
	- Month names: 4.9 mm; slider range: 1.5–7 mm.
	- Year number: 3.5 mm; slider range: 1–5 mm.
	- Day number: 2.6 mm; slider range: 1–5 mm.
	- Day notes: 1.8 mm; slider range: 0.5–4 mm.
- Base slider maxima, before paper scaling, are:
	- Title: 12 mm.
	- Day names: 5 mm.
	- Month names: 7 mm.
	- Year number: 5 mm.
	- Day number: 5 mm.
	- Day notes: 4 mm.
	Each maximum is multiplied by the square root of paper area divided by A4 area. Minimums remain:
	- Title: 2 mm.
	- Day names: 0.8 mm.
	- Month names: 1.5 mm.
	- Year number: 1 mm.
	- Day number: 1 mm.
	- Day notes: 0.5 mm.
- The day-note font-size slider uses the same paper-scaled recommendations and override behavior as the other typography sliders. Its A4 default is 1.8 mm and its A4 range is 0.5–4 mm in 0.1 mm increments. Older saved planners and backups missing this setting use the paper-scaled recommendation.
- For saved or imported planners:
	- Convert a legacy pixel-based day-number size to millimetres when it is the only saved size.
	- Use paper-scaled recommendations for missing new font-size settings.
- Saved custom themes persist separately under `year-planner:themes:v1`.
- Legacy saved themes without a secondary holiday color derive one from the primary color.
- Defaults:
	- Current month and year.
	- 14 months.
	- Sunday week start.
	- Browser-locale country when available; otherwise `GB`.
	- A4 landscape.
	- Monochrome theme.
	- Default title.
	- Recommended A4 font sizes.
	- Font-size overrides off.
- Backups lacking theme fields import as the Monochrome defaults.
- Backups with colours but no theme name import as "Custom" with the legacy heading colour `#f0f1ef`.
- Treat local storage as optional:
	- Malformed storage must not prevent the app from starting.
	- Unavailable storage must not prevent the app from starting.
	- Show a useful status when changes cannot be saved.
- Migrate older saved or imported named highlight colors to their corresponding hex colors:
	- `leaf`.
	- `coral`.
	- `sky`.
	- `gold`.
	Preserve valid six-digit hex; normalize invalid colors to `#fffefa`.
- Do not persist fetched holiday records as part of the planner backup.

## 5. Visual and Interaction Requirements

- The configuration sidebar is split into four tabs:
	- Calendar: title and date range.
	- Holidays.
	- Page:
		- Paper.
		- Layout.
		- Typography sizes in millimetres, including day notes.
	- Style: theme and colours.
	The sidebar:
	- Fills the viewport height beside the calendar.
	- Scrolls internally.
	- Keeps the status message and save indicator pinned at its bottom.
	- Stacks above the calendar on narrow screens.
- The on-screen planner:
	- Uses the exact aspect ratio of the selected paper and orientation.
	- Is laid out at true paper size, including the 5 mm margin.
	- Is scaled to fit the available width, with a scale limited to 0.5–2. Below that scale, the preview scrolls horizontally.
	- Uses the same styles as print, so it shows what will be printed.
	- Keeps date cells clickable.
- Keep the calendar preview central.
- Use explicit, stable table geometry.
- Date buttons fill cells and do not cause shifts to rows or columns.
- Distinguish these date types while preserving contrast:
	- Weekends.
	- Public holidays.
	- Notes.
	Holiday fill takes precedence over weekend fill. Do not specially format the current date.
- Day-note text:
	- Wraps within its date cell.
	- Is clipped at the cell boundary.
	- Uses whichever of black or white has the higher WCAG contrast ratio against its rendered background.
- The Day Note dialog places an enlarged selected-date cell beside the editor. Scale these proportionally from the current planner cell:
	- Width.
	- Height.
	- Content.
	- Typography.
	Keep the preview live with:
	- Unsaved text.
	- Highlight and font-size edits.
	- Every planner change affecting that cell.
- Do not rely on color alone to communicate an interaction:
	- Date buttons have accessible names.
	- The note editor has dialog semantics and a clear label.
- The print view must:
	- Hide controls.
	- Use the configured paper orientation and size.
	- Retain day numbers.
	- Avoid clipping the final month.
- External web fonts may enhance the visual design, but fallbacks must remain readable if font loading fails.

## 6. Technical Requirements

- Use:
	- React 19.
	- TypeScript in strict mode.
	- Vite 6.
	- The existing npm scripts.
- Use the Nager.Date v4 endpoints listed above.
- Validate country codes as two ASCII letters before requesting holiday data.
- Use UTC-based date arithmetic for:
	- Month boundaries.
	- Weekday placement.
	- Day counts.
- Bound these inputs to the ranges exposed in the UI:
	- Custom paper dimensions.
	- Numeric settings.
- Clean up dynamically injected page-size styles:
	- When settings change.
	- When the component unmounts.
- Avoid adding these for this straightforward grid unless requirements expand:
	- Persistent state libraries.
	- Backend services.
	- Calendar engines.

## 7. Quality Gates and Rebuild Checklist

Before calling a rebuild complete:

1. `npm install` succeeds from the lockfile.
2. `npm run build` passes:
	- TypeScript.
	- Vite production compilation.
3. Exercise calendar ranges with:
	- A December/January boundary.
	- Each week-start option.
	- Minimum and maximum durations.
4. Exercise note behavior:
	- Create notes.
	- Edit notes.
	- Delete notes.
	- Wrap and clip text within cells.
	- Select contrasting text on light and dark highlights.
	- Persist the slider value and preview updates.
	- Migrate legacy colors.
	- Persist notes across reloads.
	- Export and import JSON.
	- Reject malformed imports.
5. Exercise holiday behavior:
	- Loading success and failure.
	- Regional filtering.
	- A January range that requires the preceding year.
	- Country-switch reset behavior.
6. Verify weekend substitute collisions:
	- A weekend holiday skips weekends.
	- A weekend holiday skips actual holidays.
	- A weekend holiday skips prior substitute allocations.
	- Holidays with the same source date share a substitute.
7. Verify typography behavior:
	- Standard-paper recommendations for all six sliders, including day notes.
	- Override enable and disable behavior.
	- Custom paper's forced override state.
	- Paper-scaled slider maxima.
8. Under print media, verify:
	- Day numbers remain visible at the top-right of each cell.
	- Date content is top-aligned.
	- Every date cell has enough room to show its number.
	- The last month is not clipped.
	- The grid fills its available area without a visible gap.
9. If actual user print output differs from automated print emulation:
	- Reproduce the output using the target browser.
	- Match the target paper and orientation settings.
	- Then change layout rules if needed.
10. Verify theme behavior:
	- Test each built-in theme and a custom colour.
	- Confirm heading and month-label text switches between black and white for light and dark backgrounds.
	- Verify primary and secondary holiday colours.
	- Save a named theme.
	- Reload and select the named theme.
	- Delete the named theme.
11. Verify paper output:
	- Check the sheet aspect ratio for each paper size and orientation.
	- Confirm print output matches the on-screen sheet.

## 8. Out of Scope

- Out of scope:
	- Accounts.
	- Cloud sync.
	- Collaboration.
	- Server-side storage.
- Offline caching of holiday data.
- Official holiday observance:
	- Legal verification is out of scope.
	- Localization is out of scope.
- Present Nager.Date data as supplied.
- The app may apply its optional generic weekend-shift rule.
- Multi-page printing or a separate mobile calendar representation.

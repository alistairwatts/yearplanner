import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

type Note = { text: string; color: string }
type Holiday = {
  date: string
  name: string
  subdivisionCodes: string[] | null
  holidayTypes: string[]
}
type DisplayHoliday = Holiday & { actualDate: string; isSubstitute: boolean }
type CountryOption = { countryCode: string; name: string }
type Planner = {
  startMonth: number
  startYear: number
  duration: number
  weekStartsOn: number
  countryCode: string
  regionCode: string
  moveWeekendHolidays: boolean
  removedHolidayDates: string[]
  paper: string
  orientation: 'landscape' | 'portrait'
  customWidth: number
  customHeight: number
  accentColor: string
  emptyCellColor: string
  weekendColor: string
  holidayColor: string
  dayNumberSize: number
  notes: Record<string, Note>
}

const STORAGE_KEY = 'year-planner:v1'
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayAbbreviations = weekdayNames.map((day) => day.slice(0, 3))
const legacyHighlightColors: Record<string, string> = {
  leaf: '#82a486', coral: '#df987f', sky: '#8aabb7', gold: '#d5bd70',
}
const todayKey = new Date().toISOString().slice(0, 10)

function detectBrowserCountry() {
  if (typeof navigator === 'undefined') return 'GB'
  const languages = navigator.languages.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    try {
      const region = new Intl.Locale(language).region
      if (region && /^[A-Z]{2}$/.test(region)) return region
    } catch {
      continue
    }
  }
  return 'GB'
}

function defaultPlanner(): Planner {
  const today = new Date()
  const countryCode = detectBrowserCountry()
  return {
    startMonth: today.getMonth(),
    startYear: today.getFullYear(),
    duration: 14,
    weekStartsOn: 0,
    countryCode,
    regionCode: '',
    moveWeekendHolidays: countryCode === 'GB',
    removedHolidayDates: [],
    paper: 'A4',
    orientation: 'landscape',
    customWidth: 420,
    customHeight: 297,
    accentColor: '#45484c',
    emptyCellColor: '#f2f3f0',
    weekendColor: '#eceeec',
    holidayColor: '#f4d8c9',
    dayNumberSize: 10,
    notes: {},
  }
}

function readSavedPlanner(): Planner {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Planner>
      const planner = { ...defaultPlanner(), ...saved }
      if (typeof saved.moveWeekendHolidays !== 'boolean') planner.moveWeekendHolidays = planner.countryCode === 'GB'
      if (!Array.isArray(saved.removedHolidayDates)) planner.removedHolidayDates = []
      planner.notes = Object.fromEntries(Object.entries(planner.notes).map(([date, note]) => [date, {
        ...note,
        color: legacyHighlightColors[note.color] ?? (/^#[\da-f]{6}$/i.test(note.color) ? note.color : '#fffefa'),
      }]))
      return planner
    }
  } catch {
    // Keep the app usable when storage is disabled or its data is malformed.
  }
  return defaultPlanner()
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function App() {
  const [planner, setPlanner] = useState<Planner>(readSavedPlanner)
  const [countries, setCountries] = useState<CountryOption[]>([])
  const [allHolidays, setAllHolidays] = useState<Holiday[]>([])
  const [holidayStatus, setHolidayStatus] = useState('')
  const [loadingHolidays, setLoadingHolidays] = useState(false)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [draft, setDraft] = useState<Note>({ text: '', color: '#fffefa' })
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(planner))
    } catch {
      setHolidayStatus('Browser storage is unavailable. Export a backup to keep your changes.')
    }
  }, [planner])

  useEffect(() => {
    let active = true
    fetch('https://nagerholidays.com/api/v4/Countries/Available')
      .then((response) => {
        if (!response.ok) throw new Error(`Country service returned ${response.status}.`)
        return response.json() as Promise<CountryOption[]>
      })
      .then((data) => {
        if (active) setCountries(data.sort((first, second) => first.name.localeCompare(second.name)))
      })
      .catch((error: unknown) => {
        if (active) setHolidayStatus(error instanceof Error ? error.message : 'Could not load countries.')
      })
    return () => { active = false }
  }, [])

  const months = useMemo(() => Array.from({ length: planner.duration }, (_, index) => {
    const date = new Date(Date.UTC(planner.startYear, planner.startMonth + index, 1))
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() }
  }), [planner.startMonth, planner.startYear, planner.duration])

  const calendarSpan = useMemo(() => {
    const rows = months.map(({ year, month }) => {
      const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay()
      const offset = (firstWeekday - planner.weekStartsOn + 7) % 7
      const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
      return { offset, daysInMonth }
    })
    const firstColumn = Math.min(...rows.map(({ offset }) => offset))
    const lastColumn = Math.max(...rows.map(({ offset, daysInMonth }) => offset + daysInMonth))
    return {
      firstColumn,
      columnCount: lastColumn - firstColumn,
      rows: rows.map(({ offset, daysInMonth }) => ({ offset: offset - firstColumn, daysInMonth })),
    }
  }, [months, planner.weekStartsOn])

  const regions = useMemo(() => [...new Set(allHolidays.flatMap((holiday) => holiday.subdivisionCodes ?? []))].sort(), [allHolidays])
  const holidays = useMemo(() => {
    const region = planner.regionCode
    const selected = allHolidays
      .filter((holiday) => !region || holiday.subdivisionCodes === null || holiday.subdivisionCodes.includes(region))
      .sort((first, second) => first.date.localeCompare(second.date))
    const actualDates = new Set(selected.map((holiday) => holiday.date))
    const movedDates = new Set<string>()
    const movedByOriginalDate = new Map<string, string>()
    const displayed: DisplayHoliday[] = []

    for (const holiday of selected) {
      const weekday = new Date(`${holiday.date}T00:00:00Z`).getUTCDay()
      if (!planner.moveWeekendHolidays || (weekday !== 0 && weekday !== 6)) {
        displayed.push({ ...holiday, actualDate: holiday.date, isSubstitute: false })
        continue
      }

      let substituteDate = movedByOriginalDate.get(holiday.date)
      if (!substituteDate) {
        const candidate = new Date(`${holiday.date}T00:00:00Z`)
        do {
          candidate.setUTCDate(candidate.getUTCDate() + 1)
          substituteDate = candidate.toISOString().slice(0, 10)
        } while ([0, 6].includes(candidate.getUTCDay()) || actualDates.has(substituteDate) || movedDates.has(substituteDate))
        movedByOriginalDate.set(holiday.date, substituteDate)
        movedDates.add(substituteDate)
      }
      displayed.push({ ...holiday, date: substituteDate, actualDate: holiday.date, isSubstitute: true })
    }

    return displayed.filter((holiday) => !planner.removedHolidayDates.includes(holiday.date))
  }, [allHolidays, planner.moveWeekendHolidays, planner.regionCode, planner.removedHolidayDates])

  const paperDimensions: Record<string, [number, number]> = {
    A3: [297, 420], A4: [210, 297], A5: [148, 210],
    Letter: [216, 279], Legal: [216, 356], Ledger: [279, 432],
  }
  const [shortEdge, longEdge] = planner.paper === 'Custom'
    ? [Math.max(80, Math.min(planner.customHeight, 1200)), Math.max(80, Math.min(planner.customWidth, 1200))]
    : paperDimensions[planner.paper]
  const pageWidth = planner.orientation === 'landscape' ? longEdge : shortEdge
  const pageHeight = planner.orientation === 'landscape' ? shortEdge : longEdge
  const monthRowHeight = Math.max(2, (pageHeight - 36) / planner.duration)

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.pageFormat = 'true'
    style.textContent = `@page { size: ${pageWidth}mm ${pageHeight}mm; margin: 5mm; } @media print { .workspace { height: ${pageHeight - 10}mm; } .month-row { height: ${monthRowHeight}mm; } }`
    document.head.append(style)
    return () => style.remove()
  }, [pageHeight, pageWidth, monthRowHeight])

  function update<K extends keyof Planner>(key: K, value: Planner[K]) {
    setPlanner((current) => ({ ...current, [key]: value }))
  }

  function editDate(key: string) {
    setEditingDate(key)
    setDraft(planner.notes[key] ?? { text: '', color: '#fffefa' })
  }

  function saveNote() {
    if (!editingDate) return
    setPlanner((current) => {
      const notes = { ...current.notes }
      if (draft.text.trim() || draft.color.toLowerCase() !== '#fffefa') notes[editingDate] = { text: draft.text.trim(), color: draft.color }
      else delete notes[editingDate]
      return { ...current, notes }
    })
    setEditingDate(null)
  }

  async function loadHolidays() {
    const country = planner.countryCode.trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(country)) {
      setHolidayStatus('Enter a two-letter ISO country code.')
      return
    }
    const years = new Set(months.map(({ year }) => year))
    if (planner.startMonth === 0) years.add(months[0].year - 1)
    setLoadingHolidays(true)
    setHolidayStatus('')
    try {
      const results = await Promise.all([...years].map(async (year) => {
        const response = await fetch(`https://nagerholidays.com/api/v4/Holidays/${country}/${year}`)
        if (!response.ok) throw new Error(`Holiday service returned ${response.status} for ${year}.`)
        return await response.json() as Holiday[]
      }))
      const all = results.flat().filter((holiday) => holiday.holidayTypes?.includes('Public'))
      setAllHolidays(all)
      setHolidayStatus(`Loaded public holidays for ${country}. Choose a region to filter them.`)
      update('countryCode', country)
    } catch (error) {
      setHolidayStatus(error instanceof Error ? error.message : 'Could not load public holidays.')
    } finally {
      setLoadingHolidays(false)
    }
  }

  function exportPlanner() {
    const blob = new Blob([JSON.stringify(planner, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `year-planner-${planner.startYear}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importPlanner(file?: File) {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as Partial<Planner>
      if (!Number.isInteger(data.startMonth) || !Number.isInteger(data.startYear) || !Number.isInteger(data.duration) || !data.notes || typeof data.notes !== 'object') {
        throw new Error('This file does not look like a planner backup.')
      }
      setPlanner({
        ...defaultPlanner(),
        ...data,
        notes: Object.fromEntries(Object.entries(data.notes as Record<string, Note>).map(([date, note]) => [date, {
          ...note,
          color: legacyHighlightColors[note.color] ?? (/^#[\da-f]{6}$/i.test(note.color) ? note.color : '#fffefa'),
        }])),
      } as Planner)
      setAllHolidays([])
      setHolidayStatus('Planner backup restored.')
    } catch (error) {
      setHolidayStatus(error instanceof Error ? error.message : 'Could not read this planner backup.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  function removeHoliday(date: string) {
    setPlanner((current) => ({ ...current, removedHolidayDates: [...new Set([...current.removedHolidayDates, date])] }))
  }

  function clearDay(date: string) {
    setPlanner((current) => {
      const notes = { ...current.notes }
      delete notes[date]
      return { ...current, notes, removedHolidayDates: current.removedHolidayDates.filter((removedDate) => removedDate !== date) }
    })
    setDraft({ text: '', color: '#fffefa' })
    setEditingDate(null)
  }

  function clearAll() {
    if (!window.confirm('Clear all planner settings, notes, holiday overrides, and loaded holiday data?')) return
    setPlanner(defaultPlanner())
    setAllHolidays([])
    setHolidayStatus('')
    setEditingDate(null)
  }

  function renderMonth(year: number, month: number, monthIndex: number) {
    const { offset, daysInMonth } = calendarSpan.rows[monthIndex]
    const title = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month, 1)))
    return (
      <tr className="month-row" key={`${year}-${month}`}>
        <th className="month-label" scope="row">
          <span className="month-name"><strong>{title.slice(0, 3).toUpperCase()}</strong>{(monthIndex === 0 || month === 0) && <small>{year}</small>}</span>
        </th>
        {Array.from({ length: calendarSpan.columnCount }, (_, column) => {
          const day = column - offset + 1
          if (day < 1 || day > daysInMonth) return <td className="empty-date" key={column} />
          const key = dateKey(year, month, day)
          const note = planner.notes[key]
          const dayHolidays = holidays.filter((entry) => entry.date === key)
          const holiday = dayHolidays[0]
          const weekday = new Date(Date.UTC(year, month, day)).getUTCDay()
          return (
              <td className={`date-cell ${weekday === 0 || weekday === 6 ? 'is-weekend' : ''} ${holiday ? 'has-holiday' : ''}`} key={column}>
              <button
                className={`date-mark ${holiday ? 'is-holiday' : ''} ${note ? 'marked' : ''} ${key === todayKey ? 'today' : ''}`}
                style={note ? { '--highlight-color': note.color } as CSSProperties : undefined}
                type="button"
                title={[note?.text, ...dayHolidays.map((entry) => entry.name)].filter(Boolean).join(' | ') || `Add a note for ${key}`}
                aria-label={`${key}${note ? `, note: ${note.text}` : ''}${holiday ? `, ${dayHolidays.map((entry) => entry.name).join(', ')}` : ''}`}
                onClick={() => editDate(key)}
              >
                <span className="day-number">{day}</span>
                {note?.text && <span className="day-note-text">{note.text}</span>}
              </button>
            </td>
          )
        })}
      </tr>
    )
  }

  const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1))))

  return (
    <main className="app-shell" style={{
      '--accent': planner.accentColor,
      '--empty-cell-color': planner.emptyCellColor,
      '--weekend-color': planner.weekendColor,
      '--holiday-color': planner.holidayColor,
      '--day-number-size': `${planner.dayNumberSize}px`,
    } as CSSProperties}>
      <header className="topbar">
        <a className="brand" href="#planner" aria-label="Year Planner home"><span className="brand-mark">Y</span><span>year / planner</span></a>
        <div className="top-actions">
          <button className="quiet-button" type="button" onClick={clearAll}>Clear all</button>
          <button className="quiet-button" type="button" onClick={exportPlanner}>Export backup</button>
          <button className="quiet-button" type="button" onClick={() => fileInput.current?.click()}>Import</button>
          <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importPlanner(event.target.files?.[0])} />
          <button className="print-button" type="button" onClick={() => window.print()}><span aria-hidden="true">↗</span> Print / PDF</button>
        </div>
      </header>

      <div className="workspace" id="planner">
        <aside className="controls" aria-label="Planner settings">
          <div className="eyebrow">YOUR PLANNER</div>
          <h1>Make room<br />for the year.</h1>
          <p className="intro">Set a date range, mark the moments, then print it your way.</p>

          <fieldset className="control-group date-controls">
            <legend>DATE RANGE</legend>
            <div className="field-pair">
              <label>Starts in
                <select value={planner.startMonth} onChange={(event) => update('startMonth', Number(event.target.value))}>
                  {monthNames.map((month, index) => <option value={index} key={month}>{month}</option>)}
                </select>
              </label>
              <label>Year
                <input type="number" min="1" max="9999" value={planner.startYear} onChange={(event) => update('startYear', Math.max(1, Number(event.target.value)))} />
              </label>
            </div>
            <label>Duration <span className="inline-value">{planner.duration} months</span>
              <input className="duration-range" type="range" min="1" max="18" value={planner.duration} onChange={(event) => update('duration', Number(event.target.value))} />
              <span className="range-ends"><span>1 month</span><span>18 months</span></span>
            </label>
            <label>Week starts on
              <select value={planner.weekStartsOn} onChange={(event) => update('weekStartsOn', Number(event.target.value))}>
                {weekdayNames.map((day, index) => <option value={index} key={day}>{day}</option>)}
              </select>
            </label>
          </fieldset>

          <fieldset className="control-group">
            <legend>PUBLIC HOLIDAYS</legend>
            <label>Country
              <select value={planner.countryCode} onChange={(event) => {
                update('countryCode', event.target.value)
                update('regionCode', '')
                update('moveWeekendHolidays', event.target.value === 'GB')
                update('removedHolidayDates', [])
                setAllHolidays([])
                setHolidayStatus('')
              }}>
                {countries.length === 0 && <option value={planner.countryCode}>Loading countries...</option>}
                {countries.map((country) => <option value={country.countryCode} key={country.countryCode}>{country.name}</option>)}
              </select>
            </label>
            <label>Region <span className="optional">optional</span>
              <select value={planner.regionCode} onChange={(event) => update('regionCode', event.target.value)}>
                <option value="">All regions</option>
                {regions.map((region) => <option value={region} key={region}>{region}</option>)}
              </select>
            </label>
            <label className="checkbox-setting">
              <input type="checkbox" checked={planner.moveWeekendHolidays} onChange={(event) => update('moveWeekendHolidays', event.target.checked)} />
              Move weekend holidays to the next available weekday
            </label>
            <button className="outline-button" type="button" onClick={() => void loadHolidays()} disabled={loadingHolidays}>
              {loadingHolidays ? 'Loading holidays...' : 'Load public holidays'}
            </button>
            <p className="field-hint">Holiday data provided by Nager.Date. Internet connection required.</p>
          </fieldset>

          <fieldset className="control-group print-settings">
            <legend>PRINT FORMAT</legend>
            <div className="field-pair">
              <label>Paper
                <select value={planner.paper} onChange={(event) => update('paper', event.target.value)}>
                  <option>A3</option><option>A4</option><option>A5</option><option>Letter</option><option>Legal</option><option>Ledger</option><option>Custom</option>
                </select>
              </label>
              <label>Layout
                <select value={planner.orientation} onChange={(event) => update('orientation', event.target.value as Planner['orientation'])}>
                  <option value="landscape">Landscape</option><option value="portrait">Portrait</option>
                </select>
              </label>
            </div>
            {planner.paper === 'Custom' && <div className="field-pair custom-size">
              <label>Width (mm)<input type="number" min="80" max="1200" value={planner.customWidth} onChange={(event) => update('customWidth', Number(event.target.value))} /></label>
              <label>Height (mm)<input type="number" min="80" max="1200" value={planner.customHeight} onChange={(event) => update('customHeight', Number(event.target.value))} /></label>
            </div>}
          </fieldset>
          <fieldset className="control-group accent-settings">
            <legend>COLOURS &amp; TYPE</legend>
            <label>Planner accent
              <input type="color" value={planner.accentColor} onChange={(event) => update('accentColor', event.target.value)} />
            </label>
            <label>Empty day cells
              <input type="color" value={planner.emptyCellColor} onChange={(event) => update('emptyCellColor', event.target.value)} />
            </label>
            <label>Weekend cells
              <input type="color" value={planner.weekendColor} onChange={(event) => update('weekendColor', event.target.value)} />
            </label>
            <label>Public holidays
              <input type="color" value={planner.holidayColor} onChange={(event) => update('holidayColor', event.target.value)} />
            </label>
            <label>Day number size <span className="inline-value">{planner.dayNumberSize}px</span>
              <input className="duration-range" type="range" min="7" max="18" step="1" value={planner.dayNumberSize} onChange={(event) => update('dayNumberSize', Number(event.target.value))} />
              <span className="range-ends"><span>7px</span><span>18px</span></span>
            </label>
          </fieldset>
          {holidayStatus && <p className="status-message" role="status">{holidayStatus}</p>}
          <footer className="save-state"><span className="save-dot" /> Saved in this browser</footer>
        </aside>

        <section className="preview" aria-label="Planner preview">
          <div className="preview-heading">
            <div><h2>{monthNames[planner.startMonth]} {planner.startYear}<span className="through"> — </span>{monthNames[(planner.startMonth + planner.duration - 1) % 12]} {months.at(-1)?.year}</h2></div>
            <div className="legend"><span><i className="legend-holiday" /> Holiday</span><span><i className="legend-note" /> Your notes</span></div>
          </div>
          <div className="planner-table-wrap">
            <table className="planner-table">
              <thead><tr><th className="month-column-head" scope="col">MONTH</th>{Array.from({ length: calendarSpan.columnCount }, (_, index) => <th key={index} scope="col">{weekdayAbbreviations[(planner.weekStartsOn + calendarSpan.firstColumn + index) % 7]}</th>)}</tr></thead>
              <tbody>{months.map(({ year, month }, index) => renderMonth(year, month, index))}</tbody>
            </table>
          </div>
          <div className="preview-foot"><span>Click a date to add a note or highlight</span><span>{planner.paper} · {planner.orientation}</span></div>
        </section>
      </div>

      {editingDate && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingDate(null) }}>
        <section className="note-dialog" role="dialog" aria-modal="true" aria-labelledby="note-title">
          <button className="dialog-close" type="button" aria-label="Close" onClick={() => setEditingDate(null)}>×</button>
          <span className="eyebrow">DAY NOTE</span>
          <h2 id="note-title">{new Intl.DateTimeFormat('en', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${editingDate}T00:00:00Z`))}</h2>
          <label>Note <textarea autoFocus rows={3} maxLength={160} value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} placeholder="Add a plan, reminder, or occasion" /></label>
          {holidays.some((holiday) => holiday.date === editingDate) && <div className="holiday-actions">
            <p>Public holiday: {holidays.filter((holiday) => holiday.date === editingDate).map((holiday) => holiday.name).join(', ')}</p>
            <button className="outline-button" type="button" onClick={() => removeHoliday(editingDate)}>Remove holiday from this day</button>
          </div>}
          <label className="note-highlight">Highlight<input type="color" value={draft.color} onChange={(event) => setDraft((current) => ({ ...current, color: event.target.value }))} /></label>
          <div className="dialog-actions"><button className="quiet-button" type="button" onClick={() => clearDay(editingDate)}>Clear day</button><button className="print-button" type="button" onClick={saveNote}>Save note</button></div>
        </section>
      </div>}
    </main>
  )
}

export default App

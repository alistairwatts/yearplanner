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
type Palette = {
  accentColor: string
  headerColor: string
  emptyCellColor: string
  weekendColor: string
  holidayColor: string
}
type SavedTheme = { name: string; palette: Palette }
type Tab = 'calendar' | 'holidays' | 'page' | 'style'
type Planner = Palette & {
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
  fontSizesOverridden: boolean
  titleFontSize: number
  dayNameFontSize: number
  monthNameFontSize: number
  yearNumberFontSize: number
  dayNumberFontSize: number
  useCustomTitle: boolean
  title: string
  theme: string
  notes: Record<string, Note>
}

const STORAGE_KEY = 'year-planner:v1'
const THEMES_KEY = 'year-planner:themes:v1'
const paletteKeys = ['accentColor', 'headerColor', 'emptyCellColor', 'weekendColor', 'holidayColor'] as const
const paletteLabels: Record<keyof Palette, string> = {
  accentColor: 'Accent', headerColor: 'Table heading', emptyCellColor: 'Empty cells', weekendColor: 'Weekends', holidayColor: 'Holidays',
}
const presetThemes: { id: string; name: string; palette: Palette }[] = [
  { id: 'monochrome', name: 'Monochrome', palette: { accentColor: '#222222', headerColor: '#d4d4d4', emptyCellColor: '#f2f2f2', weekendColor: '#e3e3e3', holidayColor: '#bcbcbc' } },
  { id: 'ocean', name: 'Ocean', palette: { accentColor: '#1f4e79', headerColor: '#b9d2e8', emptyCellColor: '#eef3f7', weekendColor: '#dce5ec', holidayColor: '#9dc0df' } },
  { id: 'sunset', name: 'Sunset', palette: { accentColor: '#a8436a', headerColor: '#f5c08a', emptyCellColor: '#fbf4ec', weekendColor: '#f6e3d5', holidayColor: '#f0a898' } },
]
const maxTitleLength = 80
const maxThemeNameLength = 40
const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayAbbreviations = weekdayNames.map((day) => day.slice(0, 3))
const legacyHighlightColors: Record<string, string> = {
  leaf: '#82a486', coral: '#df987f', sky: '#8aabb7', gold: '#d5bd70',
}
const numericLimits = {
  startMonth: [0, 11],
  startYear: [1, 9999],
  duration: [1, 18],
  weekStartsOn: [0, 6],
  customWidth: [80, 1200],
  customHeight: [80, 1200],
} as const
const fontSizeLimits = {
  titleFontSize: [2, 12],
  dayNameFontSize: [0.8, 5],
  monthNameFontSize: [1.5, 7],
  yearNumberFontSize: [1, 5],
  dayNumberFontSize: [1, 5],
} as const
const fontSizeSettings = [
  { key: 'titleFontSize', label: 'Title' },
  { key: 'dayNameFontSize', label: 'Day names' },
  { key: 'monthNameFontSize', label: 'Month names' },
  { key: 'yearNumberFontSize', label: 'Year number' },
  { key: 'dayNumberFontSize', label: 'Day number' },
] as const
type FontSizeKey = keyof typeof fontSizeLimits
type FontSizeValues = Record<FontSizeKey, number>
const fontSizeDefaults: FontSizeValues = {
  titleFontSize: 5.3,
  dayNameFontSize: 1.9,
  monthNameFontSize: 4.9,
  yearNumberFontSize: 3.5,
  dayNumberFontSize: 2.6,
}
const paperSizes = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Ledger', 'Custom'] as const
const paperDimensions: Record<string, [number, number]> = {
  A3: [297, 420], A4: [210, 297], A5: [148, 210],
  Letter: [216, 279], Legal: [216, 356], Ledger: [279, 432],
}

function paperScaleFor(paper: string, width: number, height: number) {
  const [shortEdge, longEdge] = paper === 'Custom' ? [height, width] : paperDimensions[paper]
  return Math.sqrt(shortEdge * longEdge / (210 * 297))
}

function fontSizeMaximum(key: FontSizeKey, paperScale: number) {
  const [minimum, maximum] = fontSizeLimits[key]
  return Math.max(minimum, Math.round(maximum * paperScale * 10) / 10)
}

function recommendedFontSizes(paperScale: number): FontSizeValues {
  return Object.fromEntries(fontSizeSettings.map(({ key }) => {
    const [minimum] = fontSizeLimits[key]
    return [key, Math.max(minimum, Math.round(fontSizeDefaults[key] * paperScale * 10) / 10)]
  })) as FontSizeValues
}

function clampFontSizes(sizes: FontSizeValues, paperScale: number): FontSizeValues {
  return Object.fromEntries(fontSizeSettings.map(({ key }) => {
    const [minimum] = fontSizeLimits[key]
    return [key, Math.max(minimum, Math.min(fontSizeMaximum(key, paperScale), sizes[key]))]
  })) as FontSizeValues
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
}

// Picks black or white text, whichever contrasts more with the background.
function inkFor(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance < 0.179 ? '#ffffff' : '#000000'
}

function pickPalette(source: Palette): Palette {
  return Object.fromEntries(paletteKeys.map((key) => [key, source[key]])) as Palette
}

function readSavedThemes(): SavedTheme[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(THEMES_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is SavedTheme => isRecord(item) && typeof item.name === 'string' && item.name.length > 0
      && isRecord(item.palette) && paletteKeys.every((key) => isHexColor((item.palette as Record<string, unknown>)[key])))
      .map((item) => ({ name: item.name.slice(0, maxThemeNameLength), palette: pickPalette(item.palette) }))
  } catch {
    return []
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function normalizeNoteColor(value: unknown) {
  if (typeof value !== 'string') return '#fffefa'
  return legacyHighlightColors[value] ?? (/^#[\da-f]{6}$/i.test(value) ? value : '#fffefa')
}

function normalizePlannerData(data: unknown): Planner {
  if (!isRecord(data)) throw new Error('This file does not look like a planner backup.')
  const knownKeys = ['startMonth', 'startYear', 'duration', 'weekStartsOn', 'countryCode', 'regionCode', 'moveWeekendHolidays', 'removedHolidayDates', 'paper', 'orientation', 'customWidth', 'customHeight', 'fontSizesOverridden', 'accentColor', 'headerColor', 'emptyCellColor', 'weekendColor', 'holidayColor', 'dayNumberSize', ...Object.keys(fontSizeLimits), 'useCustomTitle', 'title', 'theme', 'notes']
  if (!knownKeys.some((key) => key in data)) throw new Error('This file does not look like a planner backup.')

  const planner = defaultPlanner()
  for (const key of Object.keys(numericLimits) as (keyof typeof numericLimits)[]) {
    const value = data[key]
    if (value === undefined) continue
    const [minimum, maximum] = numericLimits[key]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`Invalid planner setting: ${key}.`)
    }
    planner[key] = value
  }
  if (data.countryCode !== undefined) {
    if (typeof data.countryCode !== 'string' || !/^[A-Za-z]{2}$/.test(data.countryCode)) throw new Error('Invalid planner country code.')
    planner.countryCode = data.countryCode.toUpperCase()
  }
  if (data.regionCode !== undefined) {
    if (typeof data.regionCode !== 'string') throw new Error('Invalid planner region.')
    planner.regionCode = data.regionCode
  }
  if (data.moveWeekendHolidays !== undefined) {
    if (typeof data.moveWeekendHolidays !== 'boolean') throw new Error('Invalid weekend holiday setting.')
    planner.moveWeekendHolidays = data.moveWeekendHolidays
  } else {
    planner.moveWeekendHolidays = planner.countryCode === 'GB'
  }
  if (data.removedHolidayDates !== undefined) {
    if (!Array.isArray(data.removedHolidayDates) || !data.removedHolidayDates.every(isDateKey)) throw new Error('Invalid removed holiday dates.')
    planner.removedHolidayDates = data.removedHolidayDates
  }
  if (data.paper !== undefined) {
    if (typeof data.paper !== 'string' || !paperSizes.includes(data.paper as typeof paperSizes[number])) throw new Error('Invalid paper size.')
    planner.paper = data.paper as Planner['paper']
  }
  if (data.orientation !== undefined) {
    if (data.orientation !== 'landscape' && data.orientation !== 'portrait') throw new Error('Invalid paper orientation.')
    planner.orientation = data.orientation
  }
  if (data.fontSizesOverridden !== undefined && typeof data.fontSizesOverridden !== 'boolean') {
    throw new Error('Invalid font-size override setting.')
  }
  const hasSavedFontSizes = Object.keys(fontSizeLimits).some((key) => data[key] !== undefined) || data.dayNumberSize !== undefined
  planner.fontSizesOverridden = data.fontSizesOverridden ?? (planner.paper === 'Custom' || hasSavedFontSizes)
  if (planner.paper === 'Custom') planner.fontSizesOverridden = true
  if (data.dayNumberSize !== undefined && (typeof data.dayNumberSize !== 'number' || !Number.isInteger(data.dayNumberSize) || data.dayNumberSize < 7 || data.dayNumberSize > 18)) {
    throw new Error('Invalid planner setting: dayNumberSize.')
  }
  const paperScale = paperScaleFor(planner.paper, planner.customWidth, planner.customHeight)
  const recommendedSizes = recommendedFontSizes(paperScale)
  for (const { key } of fontSizeSettings) {
    let value = data[key]
    if (value === undefined && key === 'dayNumberFontSize' && data.dayNumberSize !== undefined) {
      value = Math.round(data.dayNumberSize * 25.4 / 96 * paperScale * 10) / 10
    }
    if (value !== undefined) {
      const [minimum] = fontSizeLimits[key]
      if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum
        || Math.abs(value * 10 - Math.round(value * 10)) > 0.000001) {
        throw new Error(`Invalid planner font size: ${key}.`)
      }
      value = Math.min(fontSizeMaximum(key, paperScale), Math.round(value * 10) / 10)
    }
    planner[key] = planner.fontSizesOverridden && typeof value === 'number' ? value : recommendedSizes[key]
  }
  let hasColors = false
  for (const key of paletteKeys) {
    const value = data[key]
    if (value === undefined) continue
    if (!isHexColor(value)) throw new Error(`Invalid planner color: ${key}.`)
    planner[key] = value
    hasColors = true
  }
  if (hasColors) {
    planner.theme = 'custom'
    if (data.headerColor === undefined) planner.headerColor = '#f0f1ef'
  }
  if (data.theme !== undefined) {
    if (typeof data.theme !== 'string' || data.theme.length > maxThemeNameLength + 6) throw new Error('Invalid planner theme.')
    planner.theme = data.theme
  }
  if (data.useCustomTitle !== undefined) {
    if (typeof data.useCustomTitle !== 'boolean') throw new Error('Invalid custom title setting.')
    planner.useCustomTitle = data.useCustomTitle
  }
  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.length > maxTitleLength) throw new Error('Invalid planner title.')
    planner.title = data.title
  }
  if (data.notes !== undefined) {
    if (!isRecord(data.notes)) throw new Error('Invalid planner notes.')
    planner.notes = Object.fromEntries(Object.entries(data.notes).map(([date, value]) => {
      if (!isDateKey(date) || !isRecord(value) || typeof value.text !== 'string' || value.text.trim().length > 160) {
        throw new Error('Invalid planner note.')
      }
      return [date, { text: value.text.trim(), color: normalizeNoteColor(value.color) }]
    }))
  }
  return planner
}

function clampNumber(value: string, minimum: number, maximum: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(Math.max(minimum, Math.min(maximum, parsed))) : minimum
}

function clampDecimal(value: string, minimum: number, maximum: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : minimum
}

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
    fontSizesOverridden: false,
    ...presetThemes[0].palette,
    theme: presetThemes[0].id,
    useCustomTitle: false,
    title: '',
    ...clampFontSizes(recommendedFontSizes(paperScaleFor('A4', 297, 210)), 1),
    notes: {},
  }
}

function readSavedPlanner(): Planner {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizePlannerData(JSON.parse(raw))
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
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(readSavedThemes)
  const [themeName, setThemeName] = useState('')
  const [tab, setTab] = useState<Tab>('calendar')
  const [availableWidth, setAvailableWidth] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const sheetScroll = useRef<HTMLDivElement>(null)
  const holidayRequestId = useRef(0)

  useEffect(() => {
    try {
      localStorage.setItem(THEMES_KEY, JSON.stringify(savedThemes))
    } catch {
      setHolidayStatus('Browser storage is unavailable. Saved themes will not persist.')
    }
  }, [savedThemes])

  useEffect(() => {
    const element = sheetScroll.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setAvailableWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

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

  const [shortEdge, longEdge] = planner.paper === 'Custom'
    ? [Math.max(80, Math.min(planner.customHeight, 1200)), Math.max(80, Math.min(planner.customWidth, 1200))]
    : paperDimensions[planner.paper]
  const pageWidth = planner.orientation === 'landscape' ? longEdge : shortEdge
  const pageHeight = planner.orientation === 'landscape' ? shortEdge : longEdge
  const paperScale = paperScaleFor(planner.paper, planner.customWidth, planner.customHeight)
  const fontSizes = planner.fontSizesOverridden ? planner : recommendedFontSizes(paperScale)
  const monthRowHeight = Math.max(2, (pageHeight - 36 * paperScale) / planner.duration)
  const monthLabelWidth = 14 * paperScale
  const dateCellWidth = (pageWidth - 10 - monthLabelWidth) / calendarSpan.columnCount
  const referenceDateCellWidth = (297 - 10 - 14) / 42
  const referenceRowHeight = (210 - 36) / 14
  const dateFontScale = Math.min(dateCellWidth / referenceDateCellWidth, monthRowHeight / referenceRowHeight) / paperScale
  const monthFontScale = Math.min(monthRowHeight / referenceRowHeight / paperScale, 1)
  const weekdayFontScale = Math.min(dateCellWidth / referenceDateCellWidth / paperScale, 1)
  const dayNumberFontSize = Math.min(Math.max(0.8, fontSizes.dayNumberFontSize * dateFontScale), dateCellWidth * 0.65)
  const dayNameFontSize = Math.min(Math.max(0.4, fontSizes.dayNameFontSize * weekdayFontScale), dateCellWidth * 0.3)
  const monthNameFontSize = Math.max(0.8, fontSizes.monthNameFontSize * monthFontScale)
  const yearNumberFontSize = Math.max(0.8, fontSizes.yearNumberFontSize * monthFontScale)
  const dayNumberRight = Math.min(0.5, dateCellWidth * 0.05)

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.pageFormat = 'true'
    style.textContent = `@page { size: ${pageWidth}mm ${pageHeight}mm; margin: 5mm; } .month-row { height: ${monthRowHeight}mm; } @media print { .sheet-frame, .sheet { width: ${pageWidth - 10}mm !important; height: ${pageHeight - 10}mm !important; } }`
    document.head.append(style)
    return () => style.remove()
  }, [pageHeight, pageWidth, monthRowHeight])

  const mmToPx = 96 / 25.4
  // The sheet is laid out at true paper size and scaled to fit, so it matches the printout.
  const scale = availableWidth ? Math.max(0.5, Math.min(2, availableWidth / (pageWidth * mmToPx))) : 1

  function update<K extends keyof Planner>(key: K, value: Planner[K]) {
    setPlanner((current) => ({ ...current, [key]: value }))
  }

  function changePaper(paper: string) {
    setPlanner((current) => {
      const nextPaperScale = paperScaleFor(paper, current.customWidth, current.customHeight)
      const fontSizes = current.fontSizesOverridden
        ? clampFontSizes(current, nextPaperScale)
        : recommendedFontSizes(nextPaperScale)
      return {
        ...current,
        ...fontSizes,
        paper,
        fontSizesOverridden: paper === 'Custom' || current.fontSizesOverridden,
      }
    })
  }

  function setFontSizeOverride(enabled: boolean) {
    setPlanner((current) => {
      const nextPaperScale = paperScaleFor(current.paper, current.customWidth, current.customHeight)
      return {
        ...current,
        ...(!enabled ? recommendedFontSizes(nextPaperScale) : {}),
        fontSizesOverridden: current.paper === 'Custom' || enabled,
      }
    })
  }

  function updateCustomPaperDimension(key: 'customWidth' | 'customHeight', value: number) {
    setPlanner((current) => {
      const nextWidth = key === 'customWidth' ? value : current.customWidth
      const nextHeight = key === 'customHeight' ? value : current.customHeight
      const nextPaperScale = paperScaleFor('Custom', nextWidth, nextHeight)
      return {
        ...current,
        [key]: value,
        ...clampFontSizes(current, nextPaperScale),
      }
    })
  }

  const themeValue = presetThemes.some((theme) => theme.id === planner.theme) || savedThemes.some((theme) => `saved:${theme.name}` === planner.theme)
    ? planner.theme : 'custom'
  const activeSavedTheme = themeValue.startsWith('saved:') ? themeValue.slice(6) : null

  function applyTheme(value: string) {
    const palette = presetThemes.find((theme) => theme.id === value)?.palette
      ?? savedThemes.find((theme) => `saved:${theme.name}` === value)?.palette
    setPlanner((current) => ({ ...current, ...palette, theme: palette ? value : 'custom' }))
  }

  function setColor(key: keyof Palette, value: string) {
    setPlanner((current) => ({ ...current, [key]: value, theme: 'custom' }))
  }

  function saveTheme() {
    const name = themeName.trim().slice(0, maxThemeNameLength)
    if (!name) return
    const palette = pickPalette(planner)
    setSavedThemes((current) => [...current.filter((theme) => theme.name !== name), { name, palette }].sort((first, second) => first.name.localeCompare(second.name)))
    update('theme', `saved:${name}`)
    setThemeName('')
  }

  function deleteTheme() {
    if (!activeSavedTheme) return
    setSavedThemes((current) => current.filter((theme) => theme.name !== activeSavedTheme))
    update('theme', 'custom')
  }

  function invalidateHolidayRequest() {
    holidayRequestId.current += 1
    setLoadingHolidays(false)
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
    const requestId = ++holidayRequestId.current
    setLoadingHolidays(true)
    setHolidayStatus('')
    try {
      const results = await Promise.all([...years].map(async (year) => {
        const response = await fetch(`https://nagerholidays.com/api/v4/Holidays/${country}/${year}`)
        if (!response.ok) throw new Error(`Holiday service returned ${response.status} for ${year}.`)
        return await response.json() as Holiday[]
      }))
      if (requestId !== holidayRequestId.current) return
      const all = results.flat().filter((holiday) => holiday.holidayTypes?.includes('Public'))
      setAllHolidays(all)
      setHolidayStatus(`Loaded public holidays for ${country}. Choose a region to filter them.`)
      update('countryCode', country)
    } catch (error) {
      if (requestId === holidayRequestId.current) setHolidayStatus(error instanceof Error ? error.message : 'Could not load public holidays.')
    } finally {
      if (requestId === holidayRequestId.current) setLoadingHolidays(false)
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
      const planner = normalizePlannerData(JSON.parse(await file.text()))
      invalidateHolidayRequest()
      setPlanner(planner)
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
    invalidateHolidayRequest()
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
                className={`date-mark ${holiday ? 'is-holiday' : ''} ${note ? 'marked' : ''}`}
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
  const defaultTitle = `${monthNames[planner.startMonth]} ${planner.startYear} — ${monthNames[(planner.startMonth + planner.duration - 1) % 12]} ${months.at(-1)?.year}`
  const title = planner.useCustomTitle && planner.title.trim() ? planner.title.trim() : defaultTitle

  return (
    <main className="app-shell" style={{
      '--accent': planner.accentColor,
      '--accent-ink': inkFor(planner.accentColor),
      '--header-bg': planner.headerColor,
      '--header-ink': inkFor(planner.headerColor),
      '--empty-cell-color': planner.emptyCellColor,
      '--weekend-color': planner.weekendColor,
      '--holiday-color': planner.holidayColor,
      '--title-font-size': `${fontSizes.titleFontSize}mm`,
      '--weekday-font-size': `${dayNameFontSize}mm`,
      '--month-name-font-size': `${monthNameFontSize}mm`,
      '--month-year-font-size': `${yearNumberFontSize}mm`,
      '--day-number-font-size': `${dayNumberFontSize}mm`,
      '--day-number-right': `${dayNumberRight}mm`,
      '--month-label-width': `${monthLabelWidth}mm`,
      '--weekday-row-height': `${5 * paperScale}mm`,
      '--day-note-font-size': `${Math.max(4, (5 * 96 / 72) * dateFontScale)}px`,
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
          <div className="tabs" role="tablist" aria-label="Settings sections">
            {([['calendar', 'Calendar'], ['holidays', 'Holidays'], ['page', 'Page'], ['style', 'Style']] as const).map(([id, label]) => (
              <button key={id} className="tab" type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls="settings-panel" onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
          <div className="controls-panel" id="settings-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'calendar' && <>
          <fieldset className="control-group title-controls">
            <legend>TITLE</legend>
            <label className="checkbox-setting">
              <input type="checkbox" checked={planner.useCustomTitle} onChange={(event) => update('useCustomTitle', event.target.checked)} />
              Use a custom title
            </label>
            {planner.useCustomTitle && <label>Title
              <input type="text" maxLength={maxTitleLength} value={planner.title} placeholder={defaultTitle} onChange={(event) => update('title', event.target.value)} />
            </label>}
          </fieldset>

          <fieldset className="control-group date-controls">
            <legend>DATE RANGE</legend>
            <div className="field-pair">
              <label>Starts in
                <select value={planner.startMonth} onChange={(event) => update('startMonth', Number(event.target.value))}>
                  {monthNames.map((month, index) => <option value={index} key={month}>{month}</option>)}
                </select>
              </label>
              <label>Year
                <input type="number" min="1" max="9999" value={planner.startYear} onChange={(event) => update('startYear', clampNumber(event.target.value, 1, 9999))} />
              </label>
            </div>
            <label>Duration <span className="inline-value">{planner.duration} months</span>
              <input className="duration-range" type="range" min="1" max="18" value={planner.duration} onChange={(event) => update('duration', clampNumber(event.target.value, 1, 18))} />
              <span className="range-ends"><span>1 month</span><span>18 months</span></span>
            </label>
            <label>Week starts on
              <select value={planner.weekStartsOn} onChange={(event) => update('weekStartsOn', Number(event.target.value))}>
                {weekdayNames.map((day, index) => <option value={index} key={day}>{day}</option>)}
              </select>
            </label>
          </fieldset>
          </>}

          {tab === 'holidays' && <fieldset className="control-group">
            <legend>PUBLIC HOLIDAYS</legend>
            <label>Country
              <select value={planner.countryCode} onChange={(event) => {
                invalidateHolidayRequest()
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
          </fieldset>}

          {tab === 'page' && <fieldset className="control-group print-settings">
            <legend>PRINT FORMAT</legend>
            <div className="field-pair">
              <label>Paper
                <select value={planner.paper} onChange={(event) => changePaper(event.target.value)}>
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
              <label>Width (mm)<input type="number" min="80" max="1200" value={planner.customWidth} onChange={(event) => updateCustomPaperDimension('customWidth', clampNumber(event.target.value, 80, 1200))} /></label>
              <label>Height (mm)<input type="number" min="80" max="1200" value={planner.customHeight} onChange={(event) => updateCustomPaperDimension('customHeight', clampNumber(event.target.value, 80, 1200))} /></label>
            </div>}
            <hr className="group-divider" />
            <p className="font-size-heading">TYPOGRAPHY · MM</p>
            <label className="checkbox-setting">
              <input type="checkbox" checked={planner.paper === 'Custom' || planner.fontSizesOverridden} disabled={planner.paper === 'Custom'} onChange={(event) => setFontSizeOverride(event.target.checked)} />
              Override font sizes
            </label>
            {fontSizeSettings.map(({ key, label }) => {
              const [minimum] = fontSizeLimits[key]
              const maximum = fontSizeMaximum(key, paperScale)
              return <label key={key}>{label} <span className="inline-value">{fontSizes[key].toFixed(1)} mm</span>
                <input className="duration-range" type="range" min={minimum} max={maximum} step="0.1" value={fontSizes[key]} disabled={!planner.fontSizesOverridden && planner.paper !== 'Custom'} onChange={(event) => update(key, Math.round(clampDecimal(event.target.value, minimum, maximum) * 10) / 10)} />
                <span className="range-ends"><span>{minimum} mm</span><span>{maximum} mm</span></span>
              </label>
            })}
          </fieldset>}
          {tab === 'style' && <fieldset className="control-group accent-settings">
            <legend>THEME</legend>
            <label>Colour scheme
              <select value={themeValue} onChange={(event) => applyTheme(event.target.value)}>
                <optgroup label="Built in">{presetThemes.map((theme) => <option value={theme.id} key={theme.id}>{theme.name}</option>)}</optgroup>
                {savedThemes.length > 0 && <optgroup label="Saved">{savedThemes.map((theme) => <option value={`saved:${theme.name}`} key={theme.name}>{theme.name}</option>)}</optgroup>}
                <option value="custom">Custom</option>
              </select>
            </label>
            <div className="palette-grid">
              {paletteKeys.map((key) => <label key={key}>{paletteLabels[key]}
                <input type="color" value={planner[key]} onChange={(event) => setColor(key, event.target.value)} />
              </label>)}
            </div>
            {activeSavedTheme && <button className="outline-button" type="button" onClick={deleteTheme}>Delete “{activeSavedTheme}”</button>}
            {themeValue === 'custom' && <div className="save-theme">
              <input type="text" aria-label="Theme name" maxLength={maxThemeNameLength} placeholder="Name this theme" value={themeName} onChange={(event) => setThemeName(event.target.value)} />
              <button className="outline-button" type="button" onClick={saveTheme} disabled={!themeName.trim()}>Save</button>
            </div>}
          </fieldset>}
          </div>
          {holidayStatus && <p className="status-message" role="status">{holidayStatus}</p>}
          <footer className="save-state"><span className="save-dot" /> Saved in this browser</footer>
        </aside>

        <section className="preview" aria-label="Planner preview">
          <div className="preview-heading">
            <span className="paper-label">{planner.paper === 'Custom' ? `${pageWidth} × ${pageHeight} mm` : `${planner.paper} · ${planner.orientation}`}</span>
          </div>
          <div className="sheet-scroll" ref={sheetScroll}>
            <div className="sheet-frame" style={{ width: pageWidth * mmToPx * scale, height: pageHeight * mmToPx * scale }}>
              <div className="sheet" style={{ width: `${pageWidth}mm`, height: `${pageHeight}mm`, zoom: scale }}>
                <h1 className="sheet-title">{title}</h1>
                <div className="planner-table-wrap">
                  <table className="planner-table">
                    <thead><tr><th className="month-column-head" scope="col"></th>{Array.from({ length: calendarSpan.columnCount }, (_, index) => <th key={index} scope="col">{weekdayAbbreviations[(planner.weekStartsOn + calendarSpan.firstColumn + index) % 7]}</th>)}</tr></thead>
                    <tbody>{months.map(({ year, month }, index) => renderMonth(year, month, index))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="preview-foot"><span>Click a date to add a note or highlight</span></div>
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

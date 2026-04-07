import type { FestivalDayKey } from '../types'

const CR_OFFSET_MINUTES = -6 * 60

export type TimeSlot = {
  timeLabel: string
  startMinutes: number | null
  endMinutes: number | null
  startUtcIso: string | null
  endUtcIso: string | null
}

export function formatTimeFromMinutes(minutes: number): string {
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const suffix = h24 < 12 ? 'a.m.' : 'p.m.'
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function toGoogleCalendarDate(utcIso: string): string {
  const d = new Date(utcIso)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`
}

export function localCrMinutesToUtcIso(dateKey: FestivalDayKey, minutes: number): string {
  const [y, m, d] = dateKey.split('-').map((n) => Number(n))
  const utcMinutes = minutes - CR_OFFSET_MINUTES
  const base = Date.UTC(y, m - 1, d, 0, 0, 0, 0)
  return new Date(base + utcMinutes * 60_000).toISOString()
}

export function expandHorario(
  rawHorario: string,
  dateKey: FestivalDayKey,
  opts?: { preferEndForVsd?: 'fri6_satSun5' | 'first' | 'last' },
): TimeSlot[] {
  const clean = normalizeHorario(rawHorario)
  if (!clean) {
    return [
      {
        timeLabel: rawHorario.trim(),
        startMinutes: null,
        endMinutes: null,
        startUtcIso: null,
        endUtcIso: null,
      },
    ]
  }

  const preferEndForVsd = opts?.preferEndForVsd ?? 'fri6_satSun5'

  const rangeParts = splitFirst(clean, '-')
  if (rangeParts) {
    const [startRaw, endRaw] = rangeParts
    const start = parseTimeToMinutes(startRaw)
    const endCandidates = splitMultiTimes(endRaw)
    const endTimes = endCandidates
      .map((t) => parseTimeToMinutes(t, inferMeridiem(endRaw)))
      .filter((t): t is number => t !== null)

    if (start === null) {
      return [
        {
          timeLabel: rawHorario.trim(),
          startMinutes: null,
          endMinutes: null,
          startUtcIso: null,
          endUtcIso: null,
        },
      ]
    }

    const end = resolveEndMinutes(endTimes, dateKey, preferEndForVsd)
    const startUtcIso = localCrMinutesToUtcIso(dateKey, start)
    const endUtcIso =
      end === null ? localCrMinutesToUtcIso(dateKey, start + 60) : localCrMinutesToUtcIso(dateKey, end)

    return [
      {
        timeLabel:
          start !== null && end !== null
            ? `${formatTimeFromMinutes(start)} - ${formatTimeFromMinutes(end)}`
            : rawHorario.trim(),
        startMinutes: start,
        endMinutes: end,
        startUtcIso,
        endUtcIso,
      },
    ]
  }

  const singles = splitMultiTimes(clean)
  const tailMeridiem = inferMeridiem(clean)

  const slots: Array<TimeSlot | null> = singles.map((s): TimeSlot | null => {
    const minutes = parseTimeToMinutes(s, tailMeridiem)
    if (minutes === null) return null
    const startUtcIso = localCrMinutesToUtcIso(dateKey, minutes)
    const endUtcIso = localCrMinutesToUtcIso(dateKey, minutes + 60)
    return {
      timeLabel: formatTimeFromMinutes(minutes),
      startMinutes: minutes,
      endMinutes: minutes + 60,
      startUtcIso,
      endUtcIso,
    }
  })

  return slots.filter((x): x is TimeSlot => x !== null)
}

function resolveEndMinutes(
  candidates: number[],
  dateKey: FestivalDayKey,
  prefer: 'fri6_satSun5' | 'first' | 'last',
): number | null {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  if (prefer === 'first') return candidates[0]
  if (prefer === 'last') return candidates[candidates.length - 1]

  const day = dateKey
  const sorted = [...candidates].sort((a, b) => a - b)
  if (day === '2026-04-10') return sorted[sorted.length - 1]
  return sorted[0]
}

function normalizeHorario(raw: string): string {
  return raw
    .toLowerCase()
    .replaceAll('–', '-')
    .replaceAll('—', '-')
    .replace(/\s+/g, ' ')
    .replace(/a\.m\.?/g, 'am')
    .replace(/p\.m\.?/g, 'pm')
    .replace(/m\.d\.?/g, 'md')
    .replaceAll('m.d', 'md')
    .trim()
}

function splitFirst(s: string, delimiter: string): [string, string] | null {
  const idx = s.indexOf(delimiter)
  if (idx === -1) return null
  const a = s.slice(0, idx).trim()
  const b = s.slice(idx + delimiter.length).trim()
  if (!a || !b) return null
  return [a, b]
}

function splitMultiTimes(s: string): string[] {
  return s
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean)
    .flatMap((x) => x.split(' / ').map((y) => y.trim()).filter(Boolean))
}

function inferMeridiem(s: string): 'am' | 'pm' | 'md' | null {
  if (/\bmd\b/.test(s)) return 'md'
  if (/\bpm\b/.test(s)) return 'pm'
  if (/\bam\b/.test(s)) return 'am'
  const m = s.match(/(?:\s|^)(am|pm|md)\s*$/)
  return (m?.[1] as 'am' | 'pm' | 'md' | undefined) ?? null
}

function parseTimeToMinutes(input: string, fallbackMeridiem?: 'am' | 'pm' | 'md' | null): number | null {
  const s = input.trim().toLowerCase()
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|md)?\b/)
  if (!m) return null
  const hour = Number(m[1])
  const minutes = m[2] ? Number(m[2]) : 0
  const meridiem = (m[3] as 'am' | 'pm' | 'md' | undefined) ?? fallbackMeridiem ?? null
  if (hour < 1 || hour > 12) return null
  if (minutes < 0 || minutes > 59) return null
  if (!meridiem) return null
  let h24 = hour % 12
  if (meridiem === 'pm' || meridiem === 'md') h24 += 12
  if (meridiem === 'am' && hour === 12) h24 = 0
  return h24 * 60 + minutes
}

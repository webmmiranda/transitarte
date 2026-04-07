export type FestivalDayKey = '2026-04-10' | '2026-04-11' | '2026-04-12'

export type FestivalDay = {
  key: FestivalDayKey
  label: string
}

export type EventItem = {
  id: string
  category: string
  date: FestivalDay
  venue: string
  title: string
  artist: string
  description: string
  audience: string
  rawTime: string
  timeLabel: string
  startMinutes: number | null
  endMinutes: number | null
  startUtcIso: string | null
  endUtcIso: string | null
}


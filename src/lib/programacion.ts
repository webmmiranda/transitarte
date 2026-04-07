import type { EventItem, FestivalDay, FestivalDayKey } from '../types'
import { expandHorario } from './time'

const DAYS: Record<FestivalDayKey, FestivalDay> = {
  '2026-04-10': { key: '2026-04-10', label: 'Viernes 10' },
  '2026-04-11': { key: '2026-04-11', label: 'Sábado 11' },
  '2026-04-12': { key: '2026-04-12', label: 'Domingo 12' },
}

export function allFestivalDays(): FestivalDay[] {
  return [DAYS['2026-04-10'], DAYS['2026-04-11'], DAYS['2026-04-12']]
}

export function parseProgramacionText(raw: string): EventItem[] {
  const lines = raw.split(/\r?\n/)
  const headerIdx = lines.findIndex((l) => l.includes('| Categoría Principal |'))
  if (headerIdx === -1) return []

  const rows: string[] = []
  for (let i = headerIdx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line.startsWith('|')) {
      if (rows.length > 0) break
      continue
    }
    if (line.includes('| :---')) continue
    if (line.includes('| Categoría Principal |')) continue
    rows.push(line)
  }

  const out: EventItem[] = []

  for (const row of rows) {
    const cells = parseMarkdownRow(row)
    if (!cells) continue
    const [categoryRaw, fechaRaw, venue, horario, title, artist, description, audience] = cells
    const category = stripMarkdown(categoryRaw)
    const days = parseFechaField(fechaRaw)
    if (days.length === 0) continue

    for (const day of days) {
      const slots = expandSlots(fechaRaw, horario, day.key)
      if (slots.length === 0) continue

      for (const slot of slots) {
        const id = stableId([
          day.key,
          category,
          venue,
          title,
          artist,
          description,
          audience,
          slot.timeLabel,
        ])

        out.push({
          id,
          category,
          date: day,
          venue: stripMarkdown(venue),
          title: stripMarkdown(title),
          artist: stripMarkdown(artist),
          description: stripMarkdown(description),
          audience: stripMarkdown(audience),
          rawTime: stripMarkdown(horario),
          timeLabel: slot.timeLabel,
          startMinutes: slot.startMinutes,
          endMinutes: slot.endMinutes,
          startUtcIso: slot.startUtcIso,
          endUtcIso: slot.endUtcIso,
        })
      }
    }
  }

  return out
}

function expandSlots(fechaRaw: string, horarioRaw: string, dateKey: FestivalDayKey) {
  const fecha = stripMarkdown(fechaRaw).toLowerCase()
  const horario = stripMarkdown(horarioRaw)

  const isVsd = /v\s*\/\s*s\s*\/\s*d/i.test(fecha)
  const hasAmbiguousEnd = /\d{1,2}:\d{2}\s*\/\s*\d{1,2}:\d{2}/.test(horario.toLowerCase())

  const preferEndForVsd = isVsd && hasAmbiguousEnd ? 'fri6_satSun5' : 'last'
  return expandHorario(horario, dateKey, { preferEndForVsd })
}

function parseMarkdownRow(line: string): string[] | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|')) return null
  const rawCells = trimmed.split('|').slice(1, -1).map((c) => c.trim())
  if (rawCells.length < 8) return null
  return rawCells.slice(0, 8)
}

function stripMarkdown(s: string): string {
  return s.replaceAll('**', '').replace(/\s+/g, ' ').trim()
}

function parseFechaField(fechaRaw: string): FestivalDay[] {
  const fecha = stripMarkdown(fechaRaw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')

  if (fecha.includes('viernes') && fecha.includes('10')) return [DAYS['2026-04-10']]
  if (fecha.includes('sabado') && fecha.includes('11')) return [DAYS['2026-04-11']]
  if (fecha.includes('domingo') && fecha.includes('12')) return [DAYS['2026-04-12']]

  if (/v\s*\/\s*s\s*\/\s*d/i.test(fecha)) return allFestivalDays()
  if (/s\s*\/\s*d/i.test(fecha)) return [DAYS['2026-04-11'], DAYS['2026-04-12']]
  if (/v\s*\/\s*s/i.test(fecha)) return [DAYS['2026-04-10'], DAYS['2026-04-11']]

  return []
}

function stableId(parts: string[]): string {
  const input = parts.join('||')
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `e_${(h >>> 0).toString(16)}`
}


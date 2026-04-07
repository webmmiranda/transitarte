import { toGoogleCalendarDate } from './time'
import type { EventItem } from '../types'

export function googleCalendarUrl(event: EventItem): string | null {
  if (!event.startUtcIso) return null
  const start = toGoogleCalendarDate(event.startUtcIso)
  const end = event.endUtcIso ? toGoogleCalendarDate(event.endUtcIso) : toGoogleCalendarDate(addMinutes(event.startUtcIso, 60))

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
    details: buildDetails(event),
    location: event.venue,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcs(event: EventItem): string | null {
  if (!event.startUtcIso) return null
  const dtstamp = toGoogleCalendarDate(new Date().toISOString())
  const dtstart = toGoogleCalendarDate(event.startUtcIso)
  const dtend = event.endUtcIso ? toGoogleCalendarDate(event.endUtcIso) : toGoogleCalendarDate(addMinutes(event.startUtcIso, 60))

  const uid = `${event.id}@transitarte`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Transitarte//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `LOCATION:${escapeIcs(event.venue)}`,
    `DESCRIPTION:${escapeIcs(buildDetails(event))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

function buildDetails(event: EventItem): string {
  const parts = [
    `${event.category} · ${event.date.label} · ${event.timeLabel}`,
    event.artist ? `Artista/Encargado: ${event.artist}` : '',
    event.description ? `Detalle: ${event.description}` : '',
    event.audience ? `Público/Notas: ${event.audience}` : '',
  ].filter(Boolean)
  return parts.join('\n')
}

function escapeIcs(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
}

function addMinutes(utcIso: string, minutes: number): string {
  const d = new Date(utcIso)
  return new Date(d.getTime() + minutes * 60_000).toISOString()
}


import './App.css'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Apple, Calendar, Info, Share2, Star } from 'lucide-react'
import type { EventItem, FestivalDayKey } from './types'
import { categoryMeta, categoryKeyFromLabel, CATEGORY_ORDER, normalizeKey } from './lib/categories'
import { allFestivalDays, parseProgramacionText } from './lib/programacion'
import { buildIcs, googleCalendarUrl } from './lib/calendar'
import { Modal } from './components/Modal'
import { useInstallPrompt } from './hooks/useInstallPrompt'

function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as unknown as CSSProperties
}

function Icon({ path, size = 18 }: { path: string | string[]; size?: number }) {
  const paths = Array.isArray(path) ? path : [path]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

function App() {
  const { canInstall, promptInstall, ios, standalone } = useInstallPrompt()
  const [tab, setTab] = useState<'agenda' | 'mapas'>('agenda')
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('sjaqui:favorites:v1')
      if (!raw) return []
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      return []
    }
  })
  const favorites = useMemo(() => new Set(favoriteIds), [favoriteIds])
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sjaqui:favoritesOnly:v1') === '1'
    } catch {
      return false
    }
  })

  const [query, setQuery] = useState('')
  const [day, setDay] = useState<FestivalDayKey | 'all'>('all')
  const [category, setCategory] = useState<string | 'all'>('all')
  const [location, setLocation] = useState<string | 'all'>('all')

  const [openMap, setOpenMap] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('event')
    }
    return null
  })
  const [showInfo, setShowInfo] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/data/programacion.txt', { cache: 'no-cache' })
        if (!res.ok) throw new Error(`No se pudo cargar la programación (${res.status})`)
        const text = await res.text()
        const parsed = parseProgramacionText(text)
        if (!cancelled) setEvents(parsed)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando la programación')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('sjaqui:favorites:v1', JSON.stringify(favoriteIds))
    } catch {
      // ignore
    }
  }, [favoriteIds])

  useEffect(() => {
    try {
      localStorage.setItem('sjaqui:favoritesOnly:v1', favoritesOnly ? '1' : '0')
    } catch {
      // ignore
    }
  }, [favoritesOnly])

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const categories = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; count: number }>()
    for (const e of events) {
      const key = categoryKeyFromLabel(e.category)
      const prev = byKey.get(key)
      if (prev) byKey.set(key, { ...prev, count: prev.count + 1 })
      else byKey.set(key, { key, label: categoryMeta(e.category).label, count: 1 })
    }
    const raw = Array.from(byKey.values())
    const orderIndex = new Map(CATEGORY_ORDER.map((k, i) => [k, i]))
    return raw.sort((a, b) => (orderIndex.get(a.key) ?? 999) - (orderIndex.get(b.key) ?? 999))
  }, [events])

  const locations = useMemo(() => {
    const byKey = new Map<string, string>()
    for (const e of events) {
      if (!e.venue) continue
      const key = normalizeKey(e.venue)
      if (!byKey.has(key)) {
        byKey.set(key, e.venue)
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b))
  }, [events])

  const filtered = useMemo(() => {
    const q = normalizeKey(query)
    return events
      .filter((e) => {
        if (favoritesOnly && !favorites.has(e.id)) return false
        if (day !== 'all' && e.date.key !== day) return false
        if (category !== 'all' && categoryKeyFromLabel(e.category) !== category) return false
        if (location !== 'all' && normalizeKey(e.venue) !== normalizeKey(location)) return false
        if (!q) return true
        const haystack = normalizeKey(
          [e.title, e.artist, e.venue, e.description, e.category].filter(Boolean).join(' '),
        )
        return haystack.includes(q)
      })
      .sort((a, b) => {
        const aKey = a.startUtcIso ?? ''
        const bKey = b.startUtcIso ?? ''
        if (aKey !== bKey) return aKey.localeCompare(bKey)
        return a.title.localeCompare(b.title)
      })
  }, [events, query, day, category, location, favoritesOnly, favorites])

  const mapImages = useMemo(
    () => [
      { src: '/mapa/transitartelugares1.png', label: 'Parque Nacional' },
      { src: '/mapa/transitartelugares2.png', label: 'Parque Nacional y Alrededores' },
      { src: '/mapa/transitartelugares3.png', label: 'Parque Morazán' },
      { src: '/mapa/transitartelugares4.png', label: 'Parque España' },
      { src: '/mapa/transitartelugares5.png', label: 'Alrededores Plaza de la Democracia' },
      { src: '/mapa/transitartelugares7.png', label: 'Alrededores Asamblea Legislativa' },
      { src: '/mapa/transitartelugares8.png', label: 'Parque Jardín de Paz' },
    ],
    [],
  )

  const downloadAppleCalendar = (event: EventItem) => {
    const ics = buildIcs(event)
    if (!ics) return
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SJ, Aquí - ${event.title}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (selectedEventId) {
        url.searchParams.set('event', selectedEventId)
      } else {
        url.searchParams.delete('event')
      }
      window.history.replaceState({}, '', url)
    }
  }, [selectedEventId])

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((e) => e.id === selectedEventId) ?? null : null),
    [events, selectedEventId],
  )

  const canShowInstallEntry = !standalone && (canInstall || ios)

  useEffect(() => {
    try {
      const id = new URL(window.location.href).searchParams.get('event')
      if (id) {
        setTab('agenda')
        setShowInfo(false)
        setSelectedEventId(id)
      }
    } catch {
      void 0
    }
  }, [])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      if (selectedEventId) url.searchParams.set('event', selectedEventId)
      else url.searchParams.delete('event')
      window.history.replaceState({}, '', url)
    } catch {
      void 0
    }
  }, [selectedEventId])

  useEffect(() => {
    const onPopState = () => {
      try {
        const id = new URL(window.location.href).searchParams.get('event')
        setSelectedEventId(id)
      } catch {
        setSelectedEventId(null)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const shareUrl = async (url: string, title: string, text?: string) => {
    try {
      const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> }
      if (typeof nav.share === 'function') {
        await nav.share({ title, text, url })
        return
      }
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'name' in e && (e as Error).name === 'AbortError') return
    }

    try {
      const clip = navigator.clipboard as Clipboard | undefined
      if (clip) {
        await clip.writeText(url)
        alert('Enlace copiado al portapapeles')
        return
      }
    } catch {
      void 0
    }

    window.prompt('Copiar enlace:', url)
  }

  const shareApp = async () => {
    await shareUrl(window.location.origin + window.location.pathname, 'SJ, Aquí 26', 'Compartir la app')
  }

  const shareEvent = async (event: EventItem) => {
    const url = new URL(window.location.origin + window.location.pathname)
    url.searchParams.set('event', event.id)
    await shareUrl(url.toString(), `SJ, Aquí · ${event.title}`, event.artist ?? undefined)
  }

  return (
    <div className="app">
      <div className="phone">
        <div className="topBar">
          <div className="headerTitle">San José, Aquí</div>
          <div className="headerRight">
            <div className="segmented" role="tablist" aria-label="Secciones">
              <button
                type="button"
                className={tab === 'agenda' ? 'segButton segButtonActive' : 'segButton'}
                onClick={() => {
                  setShowInfo(false)
                  setTab('agenda')
                }}
                role="tab"
                aria-selected={tab === 'agenda'}
              >
                Lista
              </button>
              <button
                type="button"
                className={tab === 'mapas' ? 'segButton segButtonActive' : 'segButton'}
                onClick={() => {
                  setShowInfo(false)
                  setTab('mapas')
                }}
                role="tab"
                aria-selected={tab === 'mapas'}
              >
                Mapas
              </button>
            </div>
          </div>
        </div>

        {!showInfo ? (
          <>
            {canShowInstallEntry ? (
              <div className="installButtonContainer">
                <button className="installButton" type="button" onClick={() => setShowInstall(true)}>
                  Instalar aplicación
                </button>
              </div>
            ) : null}
            <header className="header">
              <div className="searchBox">
                <Icon path="M21 21l-4.3-4.3m1.8-5.2a7 7 0 1 1-14 0a7 7 0 0 1 14 0Z" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar eventos, artistas, lugares…"
                  inputMode="search"
                />
                {query ? (
                  <button
                    className="clearButton"
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                  >
                    <Icon path="M18 6L6 18M6 6l12 12" />
                  </button>
                ) : null}
              </div>

              <div className="selectRow">
                <label className="selectBox">
                  <span className="srOnly">Día</span>
                  <select value={day} onChange={(e) => setDay(e.target.value as FestivalDayKey | 'all')}>
                    <option value="all">Cualquier día</option>
                    {allFestivalDays().map((d) => (
                      <option key={d.key} value={d.key}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <Icon path="M6 9l6 6l6-6" />
                </label>

                <label className="selectBox">
                  <span className="srOnly">Categoría</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">Todas las categorías</option>
                    {categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {categoryMeta(c.label).label}
                      </option>
                    ))}
                  </select>
                  <Icon path="M6 9l6 6l6-6" />
                </label>

                <label className="selectBox">
                  <span className="srOnly">Ubicación</span>
                  <select value={location} onChange={(e) => setLocation(e.target.value)}>
                    <option value="all">Cualquier ubicación</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  <Icon path="M6 9l6 6l6-6" />
                </label>
              </div>
            </header>
          </>
        ) : null}

        <main className="main">
          {showInfo ? (
            <section className="infoPage" aria-label="Información">
              <div className="infoCard">
                <div className="infoIcon" aria-hidden="true">
                  i
                </div>
                <div className="infoTitle">Aviso</div>
                <div className="infoText">
                  Este es un servicio ad honorem (sin costo) y NO oficial. No nos hacemos responsables por cambios de
                  programación, cancelaciones, reubicaciones o cualquier modificación realizada por la organización.
                </div>
                <div className="infoText">
                  Esta app guarda tus preferencias (por ejemplo, favoritos) en tu dispositivo usando localStorage.
                </div>
                <a
                  className="infoLink"
                  href="https://www.msj.go.cr/docu/Comunicados/Programacion_Transitarte%202026.pdf?fbclid=IwY2xjawRBKLdleHRuA2FlbQIxMABicmlkETFNTkhDR0YwRU9sbFl0WHZ2c3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABHkV6N6PV133-ZfVp1ylMgopsp29SL2JsgmfplxPvjLRiRe15ARGBnUJCP-Xg_aem_Vim_hFMYQ4FpjmTs85uGEQ"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver programa oficial (PDF)
                </a>
                <div className="infoText">
                  Herramienta diseñada por{' '}
                  <a href="https://www.instagram.com/kymimacr" target="_blank" rel="noreferrer">
                    Kymima
                  </a>{' '}
                  y{' '}
                  <a href="https://www.instagram.com/kiwupro/" target="_blank" rel="noreferrer">
                    Kiwu.pro
                  </a>
                  .
                </div>
                <div className="socialTitle">¿Querés apoyar este proyecto?</div>
                <div className="socialText">Seguinos en Instagram para ver updates y futuras herramientas.</div>
                <div className="socialRow">
                  <a className="socialButton" href="https://www.instagram.com/kymimacr" target="_blank" rel="noreferrer">
                    Seguir a Kymima
                  </a>
                  <a className="socialButton" href="https://www.instagram.com/kiwupro/" target="_blank" rel="noreferrer">
                    Seguir a Kiwu.pro
                  </a>
                </div>
                <div className="socialTitle">¿Necesitás un sitio web o app?</div>
                <div className="socialText">Si querés una app o un sitio web para tu proyecto, escribinos.</div>
                <div className="socialRow">
                  <a className="socialButton" href="https://kiwu.pro/contacto" target="_blank" rel="noreferrer">
                    <img className="socialLogo" src="https://kiwu.pro/images/kiwulogo.svg" alt="" aria-hidden="true" />
                    Contactar en kiwu.pro
                  </a>
                </div>
                <button className="infoClose" type="button" onClick={() => setShowInfo(false)}>
                  Volver
                </button>
              </div>
            </section>
          ) : tab === 'agenda' ? (
            <>
              <div className="resultsRow">
                <div className="results">{filtered.length} eventos encontrados</div>
                <button className="resultsInfo" type="button" onClick={() => setShowInfo(true)} aria-label="Información">
                  <Info size={18} />
                </button>
                <button className="resultsShare" type="button" onClick={shareApp} aria-label="Compartir app" title="Compartir app">
                  <Share2 size={18} />
                </button>
                <button
                  className={favoritesOnly ? 'resultsFav resultsFavActive' : 'resultsFav'}
                  type="button"
                  onClick={() => setFavoritesOnly((v) => !v)}
                  aria-label={favoritesOnly ? 'Mostrando favoritos' : 'Mostrar solo favoritos'}
                  title={favoritesOnly ? 'Mostrando favoritos' : 'Mostrar solo favoritos'}
                >
                  <Star size={18} fill={favoritesOnly ? 'currentColor' : 'none'} />
                </button>
              </div>

              {loading ? <div className="state">Cargando programación…</div> : null}
              {error ? <div className="state stateError">{error}</div> : null}

              {!loading && !error ? (
                <section className="list" aria-label="Agenda">
                  {filtered.map((e) => {
                    const meta = categoryMeta(e.category)
                    const gcal = googleCalendarUrl(e)
                    const isFav = favorites.has(e.id)
                    return (
                      <article key={e.id} className="listItem" style={cssVar('--cat', meta.color)} onClick={() => setSelectedEventId(e.id)}>
                        <div className="itemTop">
                          <div className="catLine">
                            <span className="catDot" aria-hidden="true"></span>
                            <span className="catBar" aria-hidden="true"></span>
                            <div className="catMeta">
                              <span className="catLabel">{meta.label.toUpperCase()}</span>
                              {day === 'all' ? <span className="catDay">{e.date.label}</span> : null}
                            </div>
                          </div>
                          <div className="timePill">
                            <Icon path="M12 8v5l3 2m7-3a10 10 0 1 1-20 0a10 10 0 0 1 20 0Z" />
                            {e.timeLabel}
                          </div>
                        </div>

                        {(() => {
                          const isConcertSwap =
                            (e.title.toLowerCase().includes('concierto') ||
                              e.title.toLowerCase().includes('festival puro cuento')) &&
                            !!e.artist
                          const displayTitle = isConcertSwap ? e.artist : e.title
                          const displaySub = isConcertSwap ? e.title : e.artist
                          return (
                            <>
                              <div className="itemTitle">{displayTitle}</div>
                              {displaySub ? <div className="itemSub">{displaySub}</div> : null}
                            </>
                          )
                        })()}

                        <div className="itemBottom">
                          <div className="location">
                            <Icon path="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11Zm0-9a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z" />
                            <span>{e.venue}</span>
                          </div>
                          <div className="actions">
                            <button
                              className="iconAction"
                              type="button"
                              onClick={(ev) => {
                                ev.preventDefault()
                                ev.stopPropagation()
                                downloadAppleCalendar(e)
                              }}
                              onTouchEnd={(ev) => {
                                ev.preventDefault()
                                ev.stopPropagation()
                                downloadAppleCalendar(e)
                              }}
                              disabled={!e.startUtcIso}
                              aria-label="Descargar Apple Calendar"
                              title="Descargar Apple Calendar"
                            >
                              <Apple size={18} />
                            </button>

                            {gcal ? (
                              <a
                                className="iconAction"
                                href={gcal}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Agregar a Google Calendar"
                                title="Agregar a Google Calendar"
                                onClick={(ev) => ev.stopPropagation()}
                                onTouchEnd={(ev) => ev.stopPropagation()}
                              >
                                <Calendar size={18} />
                              </a>
                            ) : (
                              <span className="iconAction iconActionDisabled" aria-hidden="true">
                                <Calendar size={18} />
                              </span>
                            )}

                            <button
                              className="iconAction iconActionShare"
                              type="button"
                              onClick={(ev) => {
                                ev.preventDefault()
                                ev.stopPropagation()
                                void shareEvent(e)
                              }}
                              onTouchEnd={(ev) => {
                                ev.preventDefault()
                                ev.stopPropagation()
                                void shareEvent(e)
                              }}
                              aria-label="Compartir evento"
                              title="Compartir evento"
                            >
                              <Share2 size={18} />
                            </button>

                            <button
                              className={isFav ? 'iconAction iconActionFav iconActionFavActive' : 'iconAction iconActionFav'}
                              type="button"
                              onClick={(ev) => {
                                ev.preventDefault()
                                ev.stopPropagation()
                                toggleFavorite(e.id)
                              }}
                              onTouchEnd={(ev) => {
                                ev.preventDefault()
                                ev.stopPropagation()
                                toggleFavorite(e.id)
                              }}
                              aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                              title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                            >
                              <Star size={18} fill={isFav ? 'currentColor' : 'none'} />
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}

                  {filtered.length === 0 ? <div className="empty">No hay resultados.</div> : null}
                </section>
              ) : null}

              {!canInstall && ios && !standalone ? (
                <section id="instalar" className="installHint">
                  <div className="installHintTitle">Instalar en iPhone/iPad</div>
                  <div className="installHintText">
                    Abrí esta página en Safari → botón Compartir → “Añadir a pantalla de inicio”.
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="maps">
              <div className="mapsTitle">Mapas oficiales</div>
              <div className="mapsSubtitle">Tocá un mapa para abrirlo en pantalla completa.</div>
              <div className="mapGrid">
                {mapImages.map((m) => (
                  <button key={m.src} className="mapThumb" type="button" onClick={() => setOpenMap(m.src)}>
                    <img src={m.src} alt={m.label} loading="lazy" />
                    <div className="mapLabel">{m.label}</div>
                  </button>
                ))}
              </div>
              <Modal open={!!openMap} title="Mapa" onClose={() => setOpenMap(null)}>
                {openMap ? <img className="mapFull" src={openMap} alt="Mapa oficial" /> : null}
              </Modal>
            </section>
          )}

          {!showInfo ? (
            <div className="footerNote">
              <div className="footerLeft">
                <div>Zona horaria: Costa Rica (UTC-6)</div>
                <button className="footerInfoLink" type="button" onClick={() => setShowInfo(true)}>
                  Aviso / Información
                </button>
              </div>
              <a className="footerKiwu" href="https://kiwu.pro/" target="_blank" rel="noreferrer" aria-label="Kiwu.pro">
                <img className="footerKiwuLogo" src="https://kiwu.pro/images/kiwulogo.svg" alt="" aria-hidden="true" />
              </a>
            </div>
          ) : null}
        </main>
      </div>

      <Modal open={!!selectedEvent} title="Actividad" onClose={() => setSelectedEventId(null)} showHeader={false}>
        {selectedEvent ? (
          <div className="eventSheet">
            {(() => {
              const meta = categoryMeta(selectedEvent.category)
              return (
                <div className="eventSheetTop" style={cssVar('--cat', meta.color)}>
                  <div className="eventSheetCat">
                    <span className="eventSheetEmoji" aria-hidden="true">
                      <Icon path={meta.iconPaths} size={22} />
                    </span>
                    <div className="eventSheetCatMeta">
                      <div className="eventSheetCatLabel">{meta.label}</div>
                      <div className="eventSheetTime">
                        <Icon path="M12 8v5l3 2m7-3a10 10 0 1 1-20 0a10 10 0 0 1 20 0Z" />
                        {selectedEvent.date.label} · {selectedEvent.timeLabel}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {(() => {
              const isConcertSwap =
                (selectedEvent.title.toLowerCase().includes('concierto') ||
                  selectedEvent.title.toLowerCase().includes('festival puro cuento')) &&
                !!selectedEvent.artist
              const displayTitle = isConcertSwap ? selectedEvent.artist : selectedEvent.title
              const displaySub = isConcertSwap ? selectedEvent.title : selectedEvent.artist
              return (
                <>
                  <div className="eventSheetTitle">{displayTitle}</div>
                  {displaySub ? <div className="eventSheetArtist">{displaySub}</div> : null}
                </>
              )
            })()}

            <div className="eventSheetRow">
              <Icon path="M12 21s7-4.4 7-11a7 7 0 0 0-14 0c0 6.6 7 11 7 11Zm0-9a2 2 0 1 0 0-4a2 2 0 0 0 0 4Z" />
              <div className="eventSheetVenue">{selectedEvent.venue}</div>
            </div>

            {selectedEvent.description ? <div className="eventSheetText">{selectedEvent.description}</div> : null}
            {selectedEvent.audience ? <div className="eventSheetHint">{selectedEvent.audience}</div> : null}

            <div className="eventSheetActions">
              <button
                className="ctaButton iconAction"
                type="button"
                onClick={() => downloadAppleCalendar(selectedEvent)}
                disabled={!selectedEvent.startUtcIso}
                aria-label="Descargar Apple Calendar"
                title="Descargar Apple Calendar"
              >
                <Apple size={18} />
              </button>

              {googleCalendarUrl(selectedEvent) ? (
                <a
                  className="ctaButton iconAction"
                  href={googleCalendarUrl(selectedEvent)!}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Agregar a Google Calendar"
                  title="Agregar a Google Calendar"
                >
                  <Calendar size={18} />
                </a>
              ) : (
                <span className="ctaButton ctaDisabled iconAction" aria-hidden="true">
                  <Calendar size={18} />
                </span>
              )}

              <button
                className="ctaButton iconAction iconActionShare"
                type="button"
                onClick={() => {
                  void shareEvent(selectedEvent)
                }}
                aria-label="Compartir evento"
                title="Compartir evento"
              >
                <Share2 size={18} />
              </button>

              <button
                className={favorites.has(selectedEvent.id) ? 'ctaButton iconAction iconActionFav iconActionFavActive' : 'ctaButton iconAction iconActionFav'}
                type="button"
                onClick={() => toggleFavorite(selectedEvent.id)}
                aria-label={favorites.has(selectedEvent.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                title={favorites.has(selectedEvent.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                <Star size={18} fill={favorites.has(selectedEvent.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={showInstall} title="Instalar" onClose={() => setShowInstall(false)}>
        <div className="installModal">
          <div className="installHeader">
            <img className="installIcon" src="/favicon.svg" alt="" />
            <div className="installTitle">Instalar SJ, Aquí</div>
          </div>

          {canInstall ? (
            <>
              <div className="installText">Instalá la app para acceso rápido y una experiencia tipo aplicación.</div>
              <div className="installActions">
                <button
                  className="installPrimary"
                  type="button"
                  onClick={async () => {
                    await promptInstall()
                    setShowInstall(false)
                  }}
                >
                  Instalar ahora
                </button>
                <button className="installSecondary" type="button" onClick={() => setShowInstall(false)}>
                  Cancelar
                </button>
              </div>
            </>
          ) : ios ? (
            <>
              <div className="installText">En iPhone/iPad se instala desde Safari:</div>
              <ol className="installSteps">
                <li>Abrí esta página en Safari</li>
                <li>Tocá Compartir</li>
                <li>Elegí “Añadir a pantalla de inicio”</li>
              </ol>
              <div className="installActions">
                <button className="installPrimary" type="button" onClick={() => setShowInstall(false)}>
                  Entendido
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="installText">Buscá la opción “Instalar” en el menú del navegador.</div>
              <div className="installActions">
                <button className="installPrimary" type="button" onClick={() => setShowInstall(false)}>
                  Entendido
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default App

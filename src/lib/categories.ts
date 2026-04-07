export type CategoryMeta = {
  key: string
  label: string
  emoji: string
  iconPaths: string[]
  color: string
}

const META_BY_KEY: Record<string, CategoryMeta> = {
  musica: {
    key: 'musica',
    label: 'Música',
    emoji: '🎵',
    iconPaths: [
      'M9 18V5l12-2v13',
      'M9 18a3 3 0 1 0 0-6',
      'M21 16a3 3 0 1 0 0-6',
    ],
    color: '#2563eb',
  },
  danza: {
    key: 'danza',
    label: 'Danza / Baile',
    emoji: '💃',
    iconPaths: ['M12 5a2 2 0 1 0 0-4a2 2 0 0 0 0 4', 'M12 7v5l-3 3', 'M12 12l4 4', 'M9 20l3-5 3 5'],
    color: '#ec4899',
  },
  talleres: {
    key: 'talleres',
    label: 'Talleres',
    emoji: '🎨',
    iconPaths: ['M4 20h4l10-10-4-4L4 16v4Z', 'M13 3l4 4'],
    color: '#f97316',
  },
  mercados: {
    key: 'mercados',
    label: 'Mercados',
    emoji: '🛍️',
    iconPaths: ['M6 7h12l1 13H5L6 7Z', 'M9 7V6a3 3 0 0 1 6 0v1'],
    color: '#84cc16',
  },
  bibliotecas: {
    key: 'bibliotecas',
    label: 'Bibliotecas',
    emoji: '📚',
    iconPaths: ['M4 19a2 2 0 0 1 2-2h14', 'M6 3h14v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z'],
    color: '#14b8a6',
  },
  literatura: {
    key: 'literatura',
    label: 'Literatura',
    emoji: '📖',
    iconPaths: ['M12 6h8', 'M12 10h8', 'M12 14h8', 'M4 4h6a2 2 0 0 1 2 2v14H6a2 2 0 0 0-2 2V4Z'],
    color: '#f59e0b',
  },
  artesvisuales: {
    key: 'artesvisuales',
    label: 'Artes Visuales',
    emoji: '🖼️',
    iconPaths: ['M4 6h16v12H4V6Z', 'M7 15l3-3 4 4 2-2 3 3', 'M8 10h.01'],
    color: '#4f46e5',
  },
  deportes: {
    key: 'deportes',
    label: 'Deportes',
    emoji: '🏆',
    iconPaths: ['M8 4h8v3a4 4 0 0 1-8 0V4Z', 'M6 4H4v3a4 4 0 0 0 4 4', 'M18 4h2v3a4 4 0 0 1-4 4', 'M12 12v4', 'M8 20h8'],
    color: '#ef4444',
  },
  cine: {
    key: 'cine',
    label: 'Cine',
    emoji: '🎬',
    iconPaths: ['M4 7h16v10H4V7Z', 'M7 7v10', 'M17 7v10', 'M4 10h16', 'M4 14h16'],
    color: '#374151',
  },
  artesescenicas: {
    key: 'artesescenicas',
    label: 'Artes Escénicas',
    emoji: '🎭',
    iconPaths: ['M7 4h10v6a5 5 0 0 1-10 0V4Z', 'M9 8h.01', 'M15 8h.01', 'M9 12c1.2 1 4.8 1 6 0'],
    color: '#7c3aed',
  },
  bienestaranimal: {
    key: 'bienestaranimal',
    label: 'Bienestar Animal',
    emoji: '🐶',
    iconPaths: ['M12 21s-7-4.35-7-11a4 4 0 0 1 7-2a4 4 0 0 1 7 2c0 6.65-7 11-7 11Z'],
    color: '#10b981',
  },
  default: {
    key: 'default',
    label: 'Otras',
    emoji: '✨',
    iconPaths: ['M12 2l1.2 3.8L17 7l-3.8 1.2L12 12l-1.2-3.8L7 7l3.8-1.2L12 2Z', 'M5 13l.8 2.6L8 16l-2.2.7L5 19l-.8-2.3L2 16l2.2-.4L5 13Z'],
    color: '#d946ef',
  },
}

export const CATEGORY_ORDER: string[] = [
  'musica',
  'danza',
  'talleres',
  'mercados',
  'bibliotecas',
  'literatura',
  'artesvisuales',
  'deportes',
  'cine',
  'artesescenicas',
  'bienestaranimal',
  'default',
]

export function categoryKeyFromLabel(label: string): string {
  const normalized = normalizeKey(label)
  if (normalized.includes('musica')) return 'musica'
  if (normalized.includes('danza') || normalized.includes('baile')) return 'danza'
  if (normalized.includes('taller')) return 'talleres'
  if (normalized.includes('mercad')) return 'mercados'
  if (normalized.includes('bibliotec')) return 'bibliotecas'
  if (normalized.includes('literatur')) return 'literatura'
  if (normalized.includes('arte') && normalized.includes('visual')) return 'artesvisuales'
  if (normalized.includes('deport')) return 'deportes'
  if (normalized.includes('cine')) return 'cine'
  if (normalized.includes('escenic') || normalized.includes('teatro')) return 'artesescenicas'
  if (normalized.includes('animal') || normalized.includes('mascota')) return 'bienestaranimal'
  return 'default'
}

export function categoryMeta(label: string): CategoryMeta {
  const key = categoryKeyFromLabel(label)
  return META_BY_KEY[key] ?? META_BY_KEY.default
}

export function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '')
}

import type { StudioBackgroundCustom, StudioBackgroundTheme } from '@/types'

export const STUDIO_BACKGROUND_CUSTOM_DEFAULT: StudioBackgroundCustom = { a: '#E7B9B4', b: '#8C9A86' }

export const STUDIO_BACKGROUND_THEMES: {
  id: StudioBackgroundTheme
  name: string
  background: string
  blobA: string | null
  blobB: string | null
  previewA: string
  previewB: string
}[] = [
  { id: 'plain', name: '素紙', background: 'var(--color-studio-paper-plain)', blobA: null, blobB: null, previewA: 'transparent', previewB: 'transparent' },
  { id: 'oat', name: '燕麥', background: 'var(--color-studio-paper-oat)', blobA: 'var(--color-studio-blob-oat-a)', blobB: 'var(--color-studio-blob-oat-b)', previewA: '#D9CBB3', previewB: '#D2B48F' },
  { id: 'lemon', name: '檸檬薄荷', background: 'var(--color-studio-paper-lemon)', blobA: 'var(--color-studio-blob-lemon-a)', blobB: 'var(--color-studio-blob-lemon-b)', previewA: '#EDD38E', previewB: '#B7CBB0' },
  { id: 'rose', name: '玫瑰', background: 'var(--color-studio-paper-rose)', blobA: 'var(--color-studio-blob-rose-a)', blobB: 'var(--color-studio-blob-rose-b)', previewA: '#E7B9B4', previewB: '#F2CF8E' },
  { id: 'mist', name: '霧藍', background: 'var(--color-studio-paper-mist)', blobA: 'var(--color-studio-blob-mist-a)', blobB: 'var(--color-studio-blob-mist-b)', previewA: '#A9C6CF', previewB: '#B9C4D4' },
  { id: 'journal', name: '手帳', background: 'var(--color-studio-paper-journal)', blobA: 'var(--color-studio-blob-journal-a)', blobB: 'var(--color-studio-blob-journal-b)', previewA: '#A9C6CF', previewB: '#E2B4A8' },
  { id: 'custom', name: '自訂', background: 'var(--color-studio-paper-plain)', blobA: null, blobB: null, previewA: 'transparent', previewB: 'transparent' },
]

export const STUDIO_COLOR_SWATCHES = [
  { name: '白', hex: '#F4F1EA' }, { name: '米', hex: '#EFE6D2' }, { name: '燕麥', hex: '#D9CBB3' }, { name: '駝', hex: '#B88A5A' },
  { name: '咖啡', hex: '#5A4031' }, { name: '灰', hex: '#9A9893' }, { name: '黑', hex: '#232322' }, { name: '海軍藍', hex: '#2E3A4F' },
  { name: '藍', hex: '#8FA3BC' }, { name: '綠', hex: '#8C9A86' }, { name: '黃', hex: '#E8C66A' }, { name: '橘', hex: '#D98A4E' },
  { name: '紅', hex: '#A8423A' }, { name: '酒紅', hex: '#6E2E34' }, { name: '粉', hex: '#E7B9B4' }, { name: '紫', hex: '#8E7AA6' },
]

export function customBlobColor(hex: string) {
  if (!/^#[\da-f]{6}$/i.test(hex)) return 'transparent'
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  const alpha = luminance < 0.4 ? 0.16 : luminance < 0.65 ? 0.26 : 0.4
  return `rgb(${red} ${green} ${blue} / ${alpha})`
}

export function getStudioBackground(theme: StudioBackgroundTheme, custom: StudioBackgroundCustom) {
  const preset = STUDIO_BACKGROUND_THEMES.find((entry) => entry.id === theme) ?? STUDIO_BACKGROUND_THEMES[0]
  if (theme !== 'custom') return preset
  return {
    ...preset,
    blobA: customBlobColor(custom.a),
    blobB: customBlobColor(custom.b),
    previewA: custom.a,
    previewB: custom.b,
  }
}

function rgb(hex: string): [number, number, number] | null {
  if (!/^#[\da-f]{6}$/i.test(hex)) return null
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number]
}

function colorDistance(first: [number, number, number], second: [number, number, number]) {
  const redMean = (first[0] + second[0]) / 2
  const red = first[0] - second[0]
  const green = first[1] - second[1]
  const blue = first[2] - second[2]
  return Math.sqrt((2 + redMean / 256) * red ** 2 + 4 * green ** 2 + (2 + (255 - redMean) / 256) * blue ** 2)
}

/** 以衣物主色與各主題色塊的接近程度推薦；只提供提示，不自動切換主題。 */
export function recommendStudioTheme(items: { colorHex: string }[]): StudioBackgroundTheme | null {
  const colors = items.map((item) => rgb(item.colorHex)).filter((color): color is [number, number, number] => color !== null)
  if (!colors.length) return null

  const candidates = STUDIO_BACKGROUND_THEMES.filter((theme) => theme.id !== 'plain' && theme.id !== 'custom')
  let best: { id: StudioBackgroundTheme; score: number } | null = null
  for (const candidate of candidates) {
    const palette = [rgb(candidate.previewA), rgb(candidate.previewB)].filter((color): color is [number, number, number] => color !== null)
    const score = colors.reduce((total, color) => total + Math.min(...palette.map((swatch) => colorDistance(color, swatch))), 0) / colors.length
    if (!best || score < best.score) best = { id: candidate.id, score }
  }
  return best?.id ?? null
}

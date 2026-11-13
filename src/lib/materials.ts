import type { MaterialPercentages } from '@/types'

export const MATERIAL_DEFAULTS = [
  { name: '棉', aliases: ['Cotton'], sortOrder: 10 },
  { name: '羊毛', aliases: ['Wool'], sortOrder: 20 },
  { name: '喀什米爾', aliases: ['Cashmere'], sortOrder: 30 },
  { name: '聚酯纖維', aliases: ['Polyester', '聚脂纖維'], sortOrder: 40 },
  { name: '彈性纖維', aliases: ['Spandex', 'Elastane', '萊卡'], sortOrder: 50 },
  { name: '尼龍', aliases: ['Nylon'], sortOrder: 60 },
  { name: '麻', aliases: ['Linen'], sortOrder: 70 },
  { name: '絲', aliases: ['Silk'], sortOrder: 80 },
  { name: '嫘縈', aliases: ['Rayon', '人造絲'], sortOrder: 90 },
  { name: '丹寧', aliases: ['Denim', '牛仔布'], sortOrder: 100 },
  { name: '皮革', aliases: ['Leather'], sortOrder: 110 },
] as const

export function materialNames(value?: string) {
  return [...new Set((value ?? '').split('、').map((name) => name.trim()).filter(Boolean))]
}

export function parsePercentages(values: Record<string, string>): MaterialPercentages {
  return Object.fromEntries(Object.entries(values)
    .map(([name, value]) => [name, value.trim() ? Number(value) : null] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== null && Number.isFinite(entry[1])))
}

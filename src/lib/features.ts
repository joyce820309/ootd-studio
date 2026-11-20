import type { FeatureDefinition, FeatureDimension, FeatureTag, Slot } from '@/types'

export const FEATURE_DIMENSIONS: { id: FeatureDimension; label: string; mode: 'single' | 'multiple' }[] = [
  { id: 'waist', label: '腰高', mode: 'single' },
  { id: 'silhouette', label: '褲型／裙型', mode: 'single' },
  { id: 'shoulder', label: '肩線', mode: 'single' },
  { id: 'texture', label: '質感', mode: 'multiple' },
  { id: 'detail', label: '細節', mode: 'multiple' },
  { id: 'occasion', label: '場合', mode: 'multiple' },
]

export const FEATURE_DIMENSION_LABEL = Object.fromEntries(FEATURE_DIMENSIONS.map((entry) => [entry.id, entry.label])) as Record<FeatureDimension, string>
export const FEATURE_SINGLE_DIMENSIONS = new Set(FEATURE_DIMENSIONS.filter((entry) => entry.mode === 'single').map((entry) => entry.id))

const BOTTOMS = ['bottom:pants', 'bottom:wide', 'bottom:jeans', 'bottom:skirt', 'bottom:leggings']
const PANTS = ['bottom:pants', 'bottom:wide', 'bottom:jeans']
const SKIRTS = ['bottom:skirt']
const TOPS = ['top:tee', 'top:knit', 'top:vest', 'top:shirt', 'top:thermal']
const OUTER = ['outer:cardigan', 'outer:blazer', 'outer:jacket', 'outer:coat', 'outer:puffer', 'outer:gilet', 'outer:outdoor']

/** 首次載入時建立每個帳號的建議特徵；維度固定，特徵與別名可自行管理。 */
export const FEATURE_DEFAULTS: FeatureDefinition[] = [
  ...[
    ['高腰', [], 10], ['中高腰', [], 15], ['中腰', [], 20], ['低腰', [], 30],
  ].map(([name, aliases, sortOrder]) => ({ name: name as string, aliases: aliases as string[], sortOrder: sortOrder as number, dimension: 'waist' as const, applicableTypes: BOTTOMS, isHidden: false })),
  ...[
    ['寬褲', ['闊腿', '闊腿褲'], ['bottom:pants']], ['直筒', [], PANTS], ['錐形', [], PANTS], ['喇叭', [], PANTS], ['燈籠', [], PANTS],
    ['A 字', ['A字'], SKIRTS], ['窄裙', [], SKIRTS], ['傘裙', [], SKIRTS],
  ].map(([name, aliases, applicableTypes], index) => ({ name: name as string, aliases: aliases as string[], sortOrder: (10 + index * 10), dimension: 'silhouette' as const, applicableTypes: applicableTypes as string[], isHidden: false })),
  ...[
    ['正肩', [], [...TOPS, ...OUTER]], ['落肩', [], [...TOPS, ...OUTER]], ['墊肩', [], [...TOPS, ...OUTER]],
  ].map(([name, aliases, applicableTypes], index) => ({ name: name as string, aliases: aliases as string[], sortOrder: 10 + index * 10, dimension: 'shoulder' as const, applicableTypes: applicableTypes as string[], isHidden: false })),
  ...[
    ['厚磅', ['加厚', '厚款'], [...PANTS, ...OUTER, 'top:knit']],
    ['磨毛', ['內磨毛', '刷毛'], [...PANTS, ...TOPS, ...OUTER]],
    ['垂墜', ['垂感'], [...PANTS, ...SKIRTS, 'top:shirt']],
    ['挺版', ['挺'], [...PANTS, ...OUTER]],
    ['毛呢', ['呢料', '羊毛呢'], [...PANTS, ...SKIRTS, ...OUTER]],
  ].map(([name, aliases, applicableTypes], index) => ({ name: name as string, aliases: aliases as string[], sortOrder: 10 + index * 10, dimension: 'texture' as const, applicableTypes: applicableTypes as string[], isHidden: false })),
  ...[
    ['後鬆緊', ['鬆緊腰', '後腰鬆緊'], [...PANTS, ...SKIRTS]],
    ['全鬆緊', ['全腰鬆緊', '全鬆緊腰'], [...PANTS, ...SKIRTS]],
    ['打褶', ['褶'], [...PANTS, ...SKIRTS]],
    ['有口袋', ['口袋'], []],
    ['開衩', [], [...PANTS, ...SKIRTS, ...TOPS]],
  ].map(([name, aliases, applicableTypes], index) => ({ name: name as string, aliases: aliases as string[], sortOrder: 10 + index * 10, dimension: 'detail' as const, applicableTypes: applicableTypes as string[], isHidden: false })),
  ...[
    ['上班', ['通勤', 'OL']], ['運動', []], ['休閒', ['日常']], ['旅行', ['出遊']], ['約會', []], ['雪國', ['雪地', '滑雪']],
  ].map(([name, aliases], index) => ({ name: name as string, aliases: aliases as string[], sortOrder: 10 + index * 10, dimension: 'occasion' as const, applicableTypes: [], isHidden: false })),
]

export function featureTypeKeys(slot: Slot, typeId?: string | null) {
  return typeId ? [`${slot}:${typeId}`] : [`${slot}:*`]
}

export function featureAppliesTo(feature: Pick<FeatureDefinition, 'applicableTypes'>, typeKeys: string[]) {
  if (!feature.applicableTypes.length || feature.applicableTypes.includes('*')) return true
  return feature.applicableTypes.some((applicable) => typeKeys.some((key) => key === applicable
    || (applicable.endsWith(':*') && key.startsWith(applicable.slice(0, -1)))
    || (key.endsWith(':*') && applicable.startsWith(key.slice(0, -1)))))
}

export function normalizeFeatureTags(tags: FeatureTag[] | null | undefined): FeatureTag[] {
  const seen = new Set<string>()
  return (Array.isArray(tags) ? tags : []).flatMap((tag) => {
    if (!tag || typeof tag.name !== 'string' || typeof tag.dimension !== 'string') return []
    const name = tag.name.trim()
    if (!name || !FEATURE_DIMENSIONS.some((dimension) => dimension.id === tag.dimension)) return []
    const key = `${tag.dimension}:${name.normalize('NFKC').toLocaleLowerCase()}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ name, dimension: tag.dimension as FeatureDimension }]
  })
}

function normalizeText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000]/g, '')
}

/** 只以使用者已管理的名稱與別名比對，不從任意行銷文字推論特徵。 */
export function detectFeatureSuggestions(name: string, definitions: FeatureDefinition[], typeKeys: string[], selected: FeatureTag[] = [], dismissed: string[] = []) {
  const source = normalizeText(name)
  const selectedKeys = new Set(selected.map((tag) => `${tag.dimension}:${tag.name}`))
  const dismissedKeys = new Set(dismissed)
  const matches = definitions
    .filter((entry) => !entry.isHidden && featureAppliesTo(entry, typeKeys))
    .flatMap((entry) => [entry.name, ...entry.aliases].map((term) => ({ entry, term, index: source.indexOf(normalizeText(term)) })))
    .filter(({ term, index }) => normalizeText(term).length >= 2 && index >= 0)
    .sort((a, b) => a.index - b.index || normalizeText(b.term).length - normalizeText(a.term).length)
  const suggestions: { tag: FeatureTag; matchedText: string }[] = []
  const singleDimensions = new Set<FeatureDimension>()
  for (const match of matches) {
    const key = `${match.entry.dimension}:${match.entry.name}`
    if (selectedKeys.has(key) || dismissedKeys.has(key)) continue
    if (FEATURE_SINGLE_DIMENSIONS.has(match.entry.dimension)) {
      if (singleDimensions.has(match.entry.dimension) || selected.some((tag) => tag.dimension === match.entry.dimension)) continue
      singleDimensions.add(match.entry.dimension)
    }
    if (!suggestions.some(({ tag }) => tag.dimension === match.entry.dimension && tag.name === match.entry.name)) {
      suggestions.push({ tag: { name: match.entry.name, dimension: match.entry.dimension }, matchedText: match.term })
    }
  }
  return suggestions
}

export function normalizeFeatureAliases(aliases: string[], featureName: string) {
  const canonical = normalizeText(featureName)
  return [...new Set(aliases.map((value) => value.trim()).filter((value) => value && normalizeText(value) !== canonical))]
}

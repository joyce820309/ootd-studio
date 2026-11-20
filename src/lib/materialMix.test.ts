import assert from 'node:assert/strict'
import { test } from 'node:test'
import { materialColor, materialMix, materialMixText, MATERIAL_OTHER_COLOR } from './materialMix.ts'

test('依 % 從多到少排，不看輸入順序', () => {
  const mix = materialMix({ material: '彈性纖維、聚酯纖維', materialPercentages: { 彈性纖維: 15, 聚酯纖維: 85 } })
  assert.deepEqual(mix.parts.map((part) => [part.name, part.percent]), [['聚酯纖維', 85], ['彈性纖維', 15]])
  assert.equal(mix.hasPercent, true)
})

test('加總不到 100 補灰色「其他」', () => {
  const mix = materialMix({ material: '聚酯纖維、羊毛', materialPercentages: { 聚酯纖維: 70, 羊毛: 25 } })
  const other = mix.parts.at(-1)!
  assert.equal(other.name, '其他')
  assert.equal(other.percent, 5)
  assert.equal(other.color, MATERIAL_OTHER_COLOR)
  assert.equal(materialMixText(mix), '聚酯纖維 70%・羊毛 25%・其他 5%')
})

test('沒填 % 只列名稱、不畫比例條', () => {
  const mix = materialMix({ material: '棉、麻' })
  assert.equal(mix.hasPercent, false)
  assert.equal(materialMixText(mix), '棉・麻')
})

test('舊版成分原文也能讀出比例', () => {
  const mix = materialMix({ materialComposition: '棉 40% 聚酯纖維 60%' })
  assert.equal(materialMixText(mix), '聚酯纖維 60%・棉 40%')
})

test('清單卡片只取前兩種並用短名', () => {
  const mix = materialMix({ material: '聚酯纖維、彈性纖維、棉', materialPercentages: { 聚酯纖維: 80, 彈性纖維: 5, 棉: 15 } })
  assert.equal(materialMixText(mix, { limit: 2, short: true }), '聚酯 80%・棉 15%')
})

test('別名共用材質色', () => {
  assert.equal(materialColor('Polyester'), materialColor('聚酯纖維'))
  assert.equal(materialColor('自訂材質'), materialColor('自訂材質'))
})

test('沒有材質時回傳空', () => {
  assert.equal(materialMixText(materialMix({})), null)
})

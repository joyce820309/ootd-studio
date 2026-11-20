// 執行：npm test（node --test，Node 22.6+ 直接跑 TypeScript）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addColor, applyColorPick, createColor, familyOfHex, normalizeWishColors, removeColor, renameColor, setColorFamily, suggestColorName, toggleFavoriteColor, wishColorsToRow } from './wishColors.ts'
import type { WishlistColor } from '../types.ts'

const make = (id: string, name: string, hex: string, extra: Partial<WishlistColor> = {}): WishlistColor => ({ id, name, nameCustom: true, hex, family: familyOfHex(hex), familyCustom: false, source: 'photo', favorite: false, ...extra })
const sample = () => [
  make('a', '紫紅', '#8C3B5E', { favorite: true }),
  make('b', '芥末黃', '#C9A43A'),
  make('c', suggestColorName('#7E9A5A'), '#7E9A5A', { nameCustom: false }),
]
const snapshot = (colors: WishlistColor[]) => colors.map(({ id, name, hex, family }) => ({ id, name, hex, family }))

test('刪除一筆後，其他筆的 name／hex／family 都不變', () => {
  const before = sample()
  for (const target of before) {
    const after = removeColor(before, target.id)
    assert.equal(after.length, before.length - 1)
    assert.deepEqual(snapshot(after), snapshot(before.filter((color) => color.id !== target.id)))
  }
})

test('刪掉中間一筆不會讓後面的錯位', () => {
  const after = removeColor(sample(), 'b')
  assert.deepEqual(after.map((color) => [color.id, color.name, color.hex]), [['a', '紫紅', '#8C3B5E'], ['c', suggestColorName('#7E9A5A'), '#7E9A5A']])
})

test('改名絕不改 hex 與歸類，也不動其他筆', () => {
  const before = sample()
  const after = renameColor(before, 'a', '莓果紫')
  assert.equal(after[0].name, '莓果紫')
  assert.equal(after[0].nameCustom, true)
  assert.equal(after[0].hex, '#8C3B5E')
  assert.equal(after[0].family, before[0].family)
  assert.deepEqual(snapshot(after.slice(1)), snapshot(before.slice(1)))
})

test('改成跟色票同名也不會反推色碼', () => {
  const after = renameColor(sample(), 'b', '紫')
  assert.equal(after[1].hex, '#C9A43A')
  assert.equal(after[1].family, familyOfHex('#C9A43A'))
})

test('清空名稱：回到建議名、name_custom=false', () => {
  const after = renameColor(sample(), 'a', '  ')
  assert.equal(after[0].nameCustom, false)
  assert.equal(after[0].name, suggestColorName('#8C3B5E'))
  assert.equal(after[0].hex, '#8C3B5E')
})

test('自訂名在重新取色、點色票後都保留', () => {
  const picked = applyColorPick(sample(), 'b', { hex: '#5E6146', source: 'palette', name: '軍綠' })
  assert.equal(picked[1].name, '芥末黃')
  assert.equal(picked[1].hex, '#5E6146')
  assert.equal(picked[1].family, '綠')
})

test('建議名在換色後跟著換；只動那一筆', () => {
  const before = sample()
  const after = applyColorPick(before, 'c', { hex: '#5E6146', source: 'palette', name: '軍綠' })
  assert.equal(after[2].name, '軍綠')
  assert.equal(after[2].nameCustom, false)
  assert.deepEqual(snapshot(after.slice(0, 2)), snapshot(before.slice(0, 2)))
})

test('照片取色沒有色票名時用最接近的色票名當建議', () => {
  const after = applyColorPick(sample(), 'c', { hex: '#6E2E34', source: 'photo' })
  assert.equal(after[2].name, '酒紅')
  assert.equal(after[2].family, '紅粉')
  assert.equal(after[2].source, 'photo')
})

test('選色器帶回自訂名：建議名那一色改成自訂名，重新取色後保留', () => {
  const named = applyColorPick(sample(), 'c', { hex: '#808080', source: 'photo', name: '花灰', nameCustom: true })
  assert.equal(named[2].name, '花灰')
  assert.equal(named[2].nameCustom, true)
  const again = applyColorPick(named, 'c', { hex: '#222222', source: 'photo', name: '黑' })
  assert.equal(again[2].name, '花灰')
})

test('選色器清空自訂名：回到建議名', () => {
  const after = applyColorPick(sample(), 'a', { hex: '#222222', source: 'photo', name: '黑', nameCustom: false })
  assert.equal(after[0].name, '黑')
  assert.equal(after[0].nameCustom, false)
})

test('新增一色時可直接帶自訂名', () => {
  assert.equal(createColor({ hex: '#222222', source: 'photo', name: '墨黑', nameCustom: true }).nameCustom, true)
  assert.equal(createColor({ hex: '#222222', source: 'photo', name: '黑' }).nameCustom, false)
})

test('色票對不到的名字照樣依色碼歸類，例如黃瓜綠', () => {
  const green = createColor({ hex: '#7E9A5A', source: 'photo' })
  const cucumber = renameColor([green], green.id, '黃瓜綠')
  assert.equal(cucumber[0].name, '黃瓜綠')
  assert.equal(cucumber[0].family, '綠')
})

test('手動改歸類後，換色碼不再自動覆蓋', () => {
  const manual = setColorFamily(sample(), 'b', '棕')
  const after = applyColorPick(manual, 'b', { hex: '#2E3A4F', source: 'palette', name: '海軍藍' })
  assert.equal(after[1].family, '棕')
  assert.equal(after[1].familyCustom, true)
})

test('沒手動改過的歸類，換色碼會重新歸類', () => {
  const after = applyColorPick(sample(), 'c', { hex: '#2E3A4F', source: 'palette', name: '海軍藍' })
  assert.equal(after[2].family, '藍')
})

test('最想要最多一個', () => {
  const switched = toggleFavoriteColor(sample(), 'c')
  assert.deepEqual(switched.map((color) => color.favorite), [false, false, true])
  const cleared = toggleFavoriteColor(switched, 'c')
  assert.deepEqual(cleared.map((color) => color.favorite), [false, false, false])
})

test('新增顏色不重排、不重算其他筆', () => {
  const before = sample()
  const after = addColor(before, createColor({ hex: '#232322', source: 'palette', name: '黑' }))
  assert.deepEqual(snapshot(after.slice(0, 3)), snapshot(before))
  assert.equal(after[3].name, '黑')
  assert.equal(after[3].family, '灰黑')
})

test('舊資料 { family: 名稱 } 讀進來：family 變名稱、色系依色碼歸類、id 唯一', () => {
  const colors = normalizeWishColors([{ family: '米', hex: '#EFE8DA', favorite: true }, { family: '黃瓜綠', hex: '#7E9A5A' }, { family: '米', hex: '#EFE8DA', favorite: true }])
  assert.deepEqual(colors.map((color) => color.name), ['米', '黃瓜綠', '米'])
  assert.deepEqual(colors.map((color) => color.nameCustom), [false, true, false])
  assert.equal(colors[1].family, '綠')
  assert.equal(new Set(colors.map((color) => color.id)).size, 3)
  assert.deepEqual(colors.map((color) => color.favorite), [true, false, false])
})

test('新格式寫出再讀回不變', () => {
  const before = setColorFamily(renameColor(sample(), 'c', '黃瓜綠'), 'a', '紫')
  const after = normalizeWishColors(wishColorsToRow(before))
  assert.deepEqual(after, before)
})

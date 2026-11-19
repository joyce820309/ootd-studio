# 彈性尺寸規格（B20／BM17）

## 儲存方式

- `items`、`wishlist_items` 的 `flat_measurements` 儲存平放尺寸；`flat_stretch`（migration 0018）儲存拉開後的平放值。
- `flat_stretch` 的 key 必須同時存在於 `flat_measurements`，只允許胸寬、腰寬、臀寬、大腿寬、袖口、褲口等有彈性欄位；沒有平放值的拉伸值不存。
- 尺寸輸入可為單一數值或範圍；衣物資料表單由 `components/closet/FlatMeasureField` 共用。

## 顯示與判定

- 欄位、範圍解析、一圈量提示、舒適拉伸比例（60%）及彈性纖維提示集中在 `src/lib/stretch.ts`；尺寸對照和規則在 `src/lib/review.ts`。
- 顯示拉伸值時須明確區分平放／拉伸，不得將拉伸值當成一般平放尺寸。
- 所有頁面共用同一欄位規格與解析規則；變更後同步檢查新增衣物、衣物詳細、選購候選、比較試搭與踩雷覆盤。
- 顏色／視覺依 `design/general/B-Stretch.dc.html`、`design/mobile/B-M-Stretch.dc.html`，不自創另一套欄位狀態。

## 變更注意

涉及新尺寸欄位時需同步更新型別、尺寸欄位來源、表單草稿／驗證、資料 mapping、AI 匯出文字（若相關）及新的 migration；不要改舊 migration。

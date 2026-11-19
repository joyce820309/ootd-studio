# 今日搭配與搭配工作台

## 今日搭配

- 部位依 `Slot`：外套、上衣、下身、鞋子、包包、配件；上衣、下身、鞋子必選。定義見 [categories.md](categories.md)。
- 三種板型：`full` 完整平鋪、`column` 三件直列、`free` 自由擺放。固定板型用 CSS `grid-template-areas`，上衣在上、下身中、鞋子下。
- 可放衣櫃單品或選購候選（`OutfitPick` 的 `closet`／`wish`）。
- 手機單欄且搭配板在最上方；選單品用 bottom sheet。

## 自由擺放

- `Placement` 用百分比儲存 x／y 中心點、w 寬度、rot 旋轉、z 圖層；只有 `template = 'free'` 時存至 `outfits.layout`。
- 支援拖曳、方向鍵移動、上移／下移圖層。預設位置、邊界與圖層操作在 `src/lib/freeLayout.ts`。

## 搭配工作台背景

主題與背景樣式依 `design/general/B-Studio.dc.html`、`design/mobile/B-M-Studio.dc.html`、`B-M-Studio-Bg.dc.html`：

- 主題：plain 素紙（新穿搭預設、無色塊）、oat 燕麥、lemon 檸檬薄荷、rose 玫瑰、mist 霧藍、journal 手帳、custom 自訂。
- 背景色與色塊 rgba 依設計稿 `renderVals()` 的 `TH` 陣列，不自行改值。
- 自訂色從 18 色系取兩個 HEX（排除多色／其他），允許輸入 HEX；依亮度轉 rgba：亮度 `<0.4` 為 `.16`、`<0.65` 為 `.26`、其餘 `.4`。
- 色塊模式 `on`／`soft`（25%）／`off`。`on` 時選取單品編輯自動降至 25%（0.2 秒 transition），取消選取後恢復。
- 推薦主題依畫布單品顏色計算，只標示，不自動切換；plain 與 custom 不參與推薦。
- 背景主題與穿搭一起儲存：`outfits.bg_theme`、`bg_blob_mode`、`bg_custom`（migration 0013）。匯出圖片與日記沿用同一背景。
- 桌面顯示主題列與色塊模式；手機從畫布右上角「背景」打開底部主題面板。
- 不做拖曳色塊位置或依季節自動切換。

實作邏輯在 `src/lib/studioBackground.ts`，畫布與選擇器在 `src/components/outfit/`。

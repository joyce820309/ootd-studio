# 設計系統、共用元件與無障礙

## 設計基礎

- 風格 B：溫暖燕麥紙底、低彩度粉彩、微傾斜紙標籤、透明色塊 multiply 疊加。
- `src/styles/tokens.css` 是顏色、字體、圓角、陰影的唯一來源；Tailwind 預設色盤已關閉。新增顏色先加 token，不在元件中寫 hex；衣物資料本身的 `colorHex` 例外。
- 紙與文字 token：`paper`、`card`、`apricot`、`tile`、`line`、`line-strong`、`ink`、`ink-2`、`ink-3`。主題色 `oat`、`mist`、`rose`、`sage` 含 DEFAULT／soft／edge／deep／ink／wash。狀態色以 `status-*` token 為準。
- 正文使用 `ink`／`ink-2`；`ink-3` 僅供次要小字。主題 deep/ink 供文字及圖示，須符合足夠對比。

## 字體

| 用途 | Tailwind | 規則 |
|---|---|---|
| 標題、傾斜標籤、穿搭名稱（LXGW Marker Gothic） | `font-hd` | 只有 400，不加粗；只用於 17px 以上 |
| 內文、按鈕、表單（Chiron GoRound TC） | `font-sans` | 正文至少 12px；內文 400、按鈕／標籤 500、強調 700 |
| 數字（Nunito） | `font-num tabular` | 價格、尺寸、日期、次數 |
| Logo（Fredoka） | `font-logo` | 僅 LogoSticker |

`base.css` 關閉字重合成；不要用加粗強調 `font-hd`。不得使用新細明體、標楷體或其他明體／楷體。

## 共用元件慣例

- 優先沿用 `components/ui`：Button、Chip／StatusTag、Checkbox、Select、Combobox、DatePicker、PaperCard、TiltLabel、Tape、WashBlob、StickyNote、PhotoColorTag、Icon、Toast。
- 便利貼 StickyNote（B19，全專案）：本體一律不旋轉（旋轉會讓瀏覽器重新取樣文字，字會糊）。角度只放在膠帶（-3°）和後面墊的另一張紙（同色系較深、旋轉 1°，`tilt="none"` 可不墊）。摺角統一在右下 22px：右下那塊是頁面底色、摺起來的三角在左上（`linear-gradient(135deg, 摺角色 50%, 頁面底色 50%)`）。另有 `tone="lavender"`、`paper="squared"`（22px 方格紙）、`titleStyle="label"`（14px 粗體標題＋`titleNote` 小字）、`size="compact"`、`fold={false}`，給選購商品完整頁面的小便利貼用。
- 購買明細選擇器 BuyPicker（B28，`components/wishlist/BuyPicker.tsx`）：`BuyPickerEditor` 依頁面有 panel（完整頁面彈出面板，色塊三欄）、sheet（手機 Bottom Sheet，兩欄、按鈕 48px）、strip（預覽抽屜底部，小膠囊）、mini（比較欄、採購籃列）四種長相；`BuySummary` 有 bar／strip／card 三種摘要；外框用 `BuyPickerPopover`、`BuyPickerSheet`。規則見 [wishlist.md](wishlist.md)。提示 Toast 支援「復原」等動作（停留 5 秒）。
- 紙膠帶色（`--color-washi-*`）：燕麥黃、霧藍、鼠尾草、蜜桃粉、薰衣草，半透明平光；PhotoColorTag（B27）與便利貼膠帶共用。
- 固定選項用 `components/ui/Select`；可輸入新值用 `Combobox`。不可使用原生 `<select>`／`<datalist>`。
- 日期欄位用 `components/ui/DatePicker`，值為 `YYYY-MM-DD` 字串；不可使用 `<input type="date">`。日期工具在 `src/lib/date.ts`。
- 材質比例 `components/ui/MaterialMix.tsx`：比例條＋圖例，規則見 [wishlist.md](wishlist.md) 的「材質比例」。一行文字用 `materialMixText`（`src/lib/materialMix.ts`），不要各頁自己組字串。
- B21 Checkbox：`components/ui/Checkbox.tsx`。點擊區 44×44，視覺框 24px／圓角 7px；使用透明原生 checkbox 支援鍵盤與輔助科技；勾選、部分選取、停用與焦點視覺依 B21。卡片內嵌外觀可用 `CheckboxMark`，但須保留原生 input 語意。
- Header 使用紙色背景與燕麥色 Logo 貼紙，導覽目前頁面用燕麥色底線。
- 圓角 token：`rounded-tag`（3）、`rounded-sm`（8）、`rounded-btn`（10）、`rounded-tile`（12）、`rounded-card`（14）、`rounded-block`（20）。陰影 token：`shadow-paper`、`shadow-sticker`、`shadow-float`、`shadow-sheet`、`shadow-oat`；衣物圖用 `drop-shadow-garment`。
- 分隔線常用 `1.5px dashed` 與 `line-strong`。
- UI 元件新增／調整先對照 `docs/design-map.md` 的對應設計稿；禁止修改設計 HTML。

## 版面與無障礙

- 尺寸以桌面 1440、手機 390 為準。手機單欄、可單手操作，不可水平捲動；彈性區域注意 `min-w-0`。
- 互動目標至少 44×44px；互動元素須有可見鍵盤焦點；只有圖示的按鈕必須有 `aria-label`。
- 使用語意 HTML 與正確的 label；選擇狀態不能只靠顏色表達。
- 尊重 `prefers-reduced-motion`。對話框、bottom sheet、表單須提供關閉／錯誤處理並避免焦點遺失。
- 空狀態、載入中、錯誤、離線都要有畫面；參考 `design/general/B-States.dc.html`。
- 原生 `<dialog>` 的 class 不可直接放 `flex`／`grid` 等 display 工具類，會蓋掉瀏覽器「未開啟就隱藏」的預設，關閉後畫面仍留著。改用 `hidden open:flex`，或在 CSS 寫 `.xxx[open] { display: flex; }` 並以 `hidden` 當基底。

### 選色器 ColorPicker（design/B-ColorPicker.dc.html）
- 取代原生 input type="color"；不使用瀏覽器 EyeDropper API（只取單點、iOS 不支援）
- 分頁「色名」：GARMENT_COLORS 依 family 分排，色塊下顯示色名；最上排為最近用過 6 色
- 分頁「從照片取色」：只能在該衣物自己的照片上取色；圓圈直徑＝圖片短邊 4%（最少 9 px），在原圖座標取樣
- 取色演算法：排除亮度最暗與最亮各 10% 的像素，R、G、B 各取中位數；用 OKLab 距離對應最近的色名，依距離顯示「很接近／差一點／差蠻多」
- 回傳 { name, family（色系）, hex, source: 'photo' | 'palette', nameCustom }；底部名稱可直接改，改過（或這一色原本就是自訂名）時重新取色不覆蓋，回傳 `nameCustom: true`；沒改則回傳建議名
- 一次只綁定一色：觸發鈕 `trigger="swatch"`（44px 色塊，標題「改『X』這一色・只動這一列」）或 `trigger="add"`（「＋ 新增顏色」，加在最後）
- 底部：目前色 → 新選的色、可編輯的名稱框（建議名：「建議名，可直接改」；自訂名：「用你改的名稱，重新取色不會換掉」），再來是取消／套用。照片取色結果寫「歸類：X・建議名稱『Y』」，按鈕「套用這個顏色」
- HEX 只在選色器裡顯示與輸入；色票格子不常駐在表單裡
- 用在：B6 新增衣物、B7.1 加入選購、換貨換顏色
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

- 優先沿用 `components/ui`：Button、Chip／StatusTag、Checkbox、Select、Combobox、DatePicker、PaperCard、TiltLabel、Tape、WashBlob、StickyNote、Icon、Toast。
- 固定選項用 `components/ui/Select`；可輸入新值用 `Combobox`。不可使用原生 `<select>`／`<datalist>`。
- 日期欄位用 `components/ui/DatePicker`，值為 `YYYY-MM-DD` 字串；不可使用 `<input type="date">`。日期工具在 `src/lib/date.ts`。
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

### 選色器 ColorPicker（design/B-ColorPicker.dc.html）
- 取代原生 input type="color"；不使用瀏覽器 EyeDropper API（只取單點、iOS 不支援）
- 分頁「色名」：GARMENT_COLORS 依 family 分排，色塊下顯示色名；最上排為最近用過 6 色
- 分頁「從照片取色」：只能在該衣物自己的照片上取色；圓圈直徑＝圖片短邊 4%（最少 9 px），在原圖座標取樣
- 取色演算法：排除亮度最暗與最亮各 10% 的像素，R、G、B 各取中位數；用 OKLab 距離對應最近的色名，依距離顯示「很接近／差一點／差蠻多」
- 儲存 { name, family, hex, source: 'photo' | 'pick' }；「只用色名」時 hex 用色票預設值
- 用在：B6 新增衣物、B7.1 加入選購、換貨換顏色
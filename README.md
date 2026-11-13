# My Closet・OOTD Studio

OOTD 手帳感的私人造型工作室。延續 2021 年的 [OOTD](https://github.com/joyce820309/OOTD) 專案：整理衣櫃、依部位勾選完成今日搭配、比較網拍候選並和衣櫃混搭試穿。

技術：React 19 ＋ TypeScript ＋ Vite ＋ Tailwind CSS v4 ＋ Supabase（Auth、Database、Storage、Edge Functions）＋ Vercel。

## 快速開始

```bash
npm install
npm run dev
```

沒有設定 Supabase 時，App 會以**示範模式**執行：不需要登入，使用 `src/data/sample.ts` 的示範衣物，儲存動作只會模擬成功。

## 接上 Supabase

1. 在 Supabase 建立專案，複製 `.env.example` 為 `.env.local`，填入 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`。
2. 依序套用 `supabase/migrations/` 的 migration（目前至 `0006_item_add_flow.sql`），或使用 Supabase CLI：`supabase db push`。
3. 這是私人衣櫃，請到 **Authentication › Sign In / Providers** 關閉「Allow new users to sign up」，再到 **Users** 手動邀請自己的帳號。
4. 若要使用 Google 登入，在 Providers 啟用 Google，並把網站網址加入 **URL Configuration › Redirect URLs**。

### 去背 Edge Function

新增衣物流程會先建立隱藏草稿並上傳原圖至私人 `closet-images/{使用者 ID}/{草稿 ID}/original.{jpg|png|webp}`，再以 `supabase.functions.invoke('remove-background', { body: { itemId } })` 呼叫去背。Function 也支援以 `{ wishlistItemId }` 處理選購候選；只接受資料列識別碼，並以使用者 JWT/RLS 讀寫原圖與結果。原圖不會被覆蓋。HEIC 可保留為原圖，但目前不支援自動去背。

目前 Function 使用 remove.bg API，需自行建立 API key，並只設定在 Supabase Function Secret `REMOVE_BG_API_KEY`（不可放進 `VITE_` 前端環境變數）。在專案根目錄執行 `supabase secrets set REMOVE_BG_API_KEY=你的金鑰`，再執行 `supabase functions deploy remove-background`。Function 對每張圖有 10 MB 上傳限制；去背供應商可能依方案計費。部署前請先確認供應商方案與隱私條款。

## 部署到 Vercel

匯入此 repo，Framework 選 Vite，環境變數填入上面兩個值即可。`vercel.json` 已設定 SPA 路由重寫。

## 版號與推送紀錄

首頁頁尾會顯示 `src/lib/version.ts` 的應用版號。建立提交時執行 `npm run commit -- "繁體中文摘要"`；腳本會按日期遞增版號、更新 `APP_VERSION` 與 `CHANGELOG.md`、執行 build/lint，再確認後建立帶版號的 commit。格式為 `YYYYMMDD-N`（日期使用提交當天；同日流水號加 1，每日從 1 開始）。腳本不會執行 `git push`，推送前確認 commit 已含版號與紀錄。加 `--dry-run` 可只預覽，不改檔也不提交。

## 設計系統（風格 B）

所有顏色、字體、圓角、陰影只定義在 **`src/styles/tokens.css`**，Tailwind 預設色盤已停用，不會混入設計以外的顏色。

| 用途 | token | 規則 |
| --- | --- | --- |
| 紙張 | `paper` `card` `apricot` `tile` | 背景永遠是紙色，不用純白 |
| 文字 | `ink` `ink-2` `ink-3` | 對比皆 ≥ 4.5:1 |
| 品牌色 | `oat` `mist` `rose` `sage` | 實色用於面積 |
| 疊色 | `*-wash` | 搭配 `mix-blend-multiply`，只做裝飾，文字不放在交界處 |
| 深色 | `*-deep` `*-ink` | 品牌色上的文字與圖示 |

字體：

| 用途 | token | 字體 | 規則 |
| --- | --- | --- | --- |
| 大標、區塊標題、貼紙標籤、穿搭名稱 | `font-hd` | 霞鶩漫黑 LXGW Marker Gothic | 只有 400，不要加 `font-bold`；17px 以上 |
| 內文、按鈕、表單 | `font-sans`（預設） | 晴熙圓體 Chiron GoRound TC | 400 內文、500 按鈕與標籤、700 強調；最小 12px |
| 價格、尺寸、日期 | `font-num` | Nunito | 搭配 `tabular` 對齊 |
| Logo | `font-logo` | Fredoka | |

手帳元素都包成元件（`src/components/ui/Paper.tsx`），頁面裡不直接寫數值：

- `TiltLabel`：傾斜紙張標籤，只用於區塊標題，角度自動限制在 ±2°
- `Tape`：紙膠帶，只用於釘選或精選的卡片
- `WashBlob`：透明疊色塊
- `LogoSticker`：燕麥色貼紙 Logo

## 專案結構

```
src/
  styles/        tokens.css（設計 token）、base.css
  components/
    ui/          Button、Chip、StatusTag、Icon、Paper（手帳元素）、Toast
    layout/      AppHeader、MobileTabBar、AppLayout、PageStub
    closet/      ItemImage、ItemTile、GarmentArt（示範剪影）
    outfit/      OutfitBoard（固定板型）、SlotPicker（依部位勾選）
      outfit/      StudioCanvas（多件單品自由搭配畫布）
    pages/         Landing、Login、Home、Closet、Outfit、Studio、Profile，以及尚在製作的頁面
  lib/           supabase、auth、data（資料存取）、slots、outfit
  data/          示範資料
supabase/
  migrations/    資料表、RLS、Storage 權限與工作台資料
  functions/     remove-background（呼叫 remove.bg 的去背 Edge Function）
```

## 目前進度

- [x] 設計 token 與核心元件
- [x] Landing、登入（Google／密碼／免密碼登入連結）
- [x] 今日搭配：依部位勾選、兩種固定板型、搭配檢查、存進穿搭日記
- [x] 今日搭配：第三種板型「自由擺放」（拖曳、縮放、旋轉、圖層、鍵盤微調）
- [x] 進階搭配工作台：多件單品自由擺放、衣櫃／選購切換、草稿、復原重做、匯出圖片
- [x] 個人體態資料頁與量測紀錄 CRUD
- [x] 量測紀錄歷史：依日期、相鄰快照差值、可捲動對照表、手機單次明細
- [x] 共用載入、空狀態、錯誤狀態與離線提示（離線變更目前不會自動同步）
- [x] 去背 Edge Function（需設定 remove.bg API Secret 並部署）
- [x] 首頁、衣櫃列表（搜尋與分類篩選）
- [x] Supabase 資料表與 RLS
- [x] 新增衣物四步流程：多張照片、選擇／略過去背、衣物資料、存入衣櫃或選購清單
- [ ] 衣物詳細、穿搭日記
- [ ] 選購清單與比較試搭台
- [ ] AI 搭配建議（Edge Function）

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
2. 執行資料表與 RLS：在 SQL Editor 貼上 `supabase/migrations/0001_init.sql`，或使用 Supabase CLI：`supabase db push`。
3. 這是私人衣櫃，請到 **Authentication › Sign In / Providers** 關閉「Allow new users to sign up」，再到 **Users** 手動邀請自己的帳號。
4. 若要使用 Google 登入，在 Providers 啟用 Google，並把網站網址加入 **URL Configuration › Redirect URLs**。

## 部署到 Vercel

匯入此 repo，Framework 選 Vite，環境變數填入上面兩個值即可。`vercel.json` 已設定 SPA 路由重寫。

## 設計系統（風格 B）

所有顏色、字體、圓角、陰影只定義在 **`src/styles/tokens.css`**，Tailwind 預設色盤已停用，不會混入設計以外的顏色。

| 用途 | token | 規則 |
| --- | --- | --- |
| 紙張 | `paper` `card` `apricot` `tile` | 背景永遠是紙色，不用純白 |
| 文字 | `ink` `ink-2` `ink-3` | 對比皆 ≥ 4.5:1 |
| 品牌色 | `oat` `mist` `rose` `sage` | 實色用於面積 |
| 疊色 | `*-wash` | 搭配 `mix-blend-multiply`，只做裝飾，文字不放在交界處 |
| 深色 | `*-deep` `*-ink` | 品牌色上的文字與圖示 |

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
  pages/         Landing、Login、Home、Closet、Outfit，以及尚在製作的頁面
  lib/           supabase、auth、data（資料存取）、slots、outfit
  data/          示範資料
supabase/
  migrations/    資料表、RLS、Storage 權限
```

## 目前進度

- [x] 設計 token 與核心元件
- [x] Landing、登入（Google／密碼／免密碼登入連結）
- [x] 今日搭配：依部位勾選、兩種固定板型、搭配檢查、存進穿搭日記
- [x] 首頁、衣櫃列表（搜尋與分類篩選）
- [x] Supabase 資料表與 RLS
- [ ] 新增衣物與去背（Edge Function）
- [ ] 衣物詳細、穿搭日記
- [ ] 選購清單與比較試搭台
- [ ] 個人體態資料
- [ ] AI 搭配建議（Edge Function）

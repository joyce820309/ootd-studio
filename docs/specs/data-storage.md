# Supabase、資料與圖片儲存規範

## Schema 與權限

- 所有資料表以 `owner_id default auth.uid()` 限制使用者資料，啟用 RLS，使用者只能讀寫自己的資料；新增表格照此模式。
- 新使用者由 `handle_new_user` trigger 建立 profile 與預設分類；分類不要寫死在 UI。
- Schema 變更一律新增 `supabase/migrations/000N_description.sql`，不可修改舊 migration；同步更新 `src/types.ts`、`src/lib/data.ts` mapping、示範資料和相關 UI。
- migration 需可依序套用。已部署後不得假設舊 migration 可重跑。

## 示範模式

- `.env.local` 未填 `VITE_SUPABASE_URL`／`VITE_SUPABASE_ANON_KEY` 時 `isDemoMode = true`，不需登入，資料由 `src/data/sample.ts` 提供，寫入回傳 `{ demo: true }`。
- 新增資料功能需同時支援 Supabase 與示範模式；資料存取以 `src/lib/data.ts` 為準。

## 圖片與 Storage

- 私人 bucket：`closet-images`。Storage 路徑第一層必須是使用者 id：`{uid}/...`。
- 衣物原圖路徑 `{uid}/{item_id}/original.ext`；多圖索引在 `item_photos`，讀取用 signed URL。
- 未完成新增的衣物以 `items.is_draft = true` 隱藏。
- 衣物去背 Edge Function：`supabase/functions/remove-background`，使用 remove.bg Secret。新增衣物可略過去背；失敗時保留原圖。

## 穿搭日記與統計

- 穿搭日記定義：`outfits` 中 `worn_on` 有值且 `is_hypothetical = false`。今日搭配儲存至日記也會出現。
- 場合可複選 `occasions`；感受 `feel`；天氣與氣溫可選填；照片路徑 `{uid}/outfits/{outfit_id}/...`。
- `wear_count`／`last_worn_at` 由 migration 0007 的 trigger 依 `outfit_items` 增減；前端不可重複加減。

## 目前主要資料表

`profiles`、`categories`、`items`、`item_photos`、`wishlist_items`、`compare_groups`、`compare_group_items`、`compare_group_closet_items`、`outfits`、`outfit_items`、`body_measurements`、`body_profile`、`measurement_trend_prefs`、`brands`、`brand_distinct_groups`、`shops`、`materials`、`lesson_rules`。

- migration 0025 將比較資料改為多對多選購關聯；`compare_groups` 沿用 `owner_id` RLS 欄位，名稱為 `name`，並新增封存與更新時間。舊 `compare_group_id` 已搬移並由新關聯筆數核對後移除。`compare_group_closet_items` 暫時保留，不屬於本階段的新比較表。
- migration 0026 為選購候選新增可為 null 的 `garment_length`（`short`／`mid`／`long`），由選購表單及篩選器使用。
- migration 0027 為選購候選新增可為 null 的 `flat_measurements_size`，標記平放／拉伸尺寸量測尺碼；最想要顏色旗標存於 `colors` JSONB 元素，不另增欄位。`colors` 最多只有一個元素 `favorite: true`。
- migration 0028 為 `compare_group_items` 新增 `is_decided`，並提供受 RLS 保護的 `set_compare_decision` RPC，每個比較最多標記一個最後決定商品。

資料表欄位及功能 migration 以 `supabase/migrations/` 為準；規格索引見本目錄其他文件。

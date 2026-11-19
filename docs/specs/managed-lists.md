# 品牌、通路與材質管理

- 品牌名稱仍存在 `items.brand`／`wishlist_items.brand` 文字欄位；`brands` 只存使用者手動新增的品牌，`brand_distinct_groups` 記錄兩個名稱「不是同一個品牌」。
- 品牌新增、改名、合併、刪除一律走 `replace_brands` RPC（衣物與選購清單一起更新）；復原走 `restore_brand`。
- 品牌相似偵測、排序與日期格式集中在 `src/lib/brands.ts`。
- 購買通路 `shops` 管理包含網路／實體類型與網址；選購候選網址只解析已知網域、不抓網頁，且僅店家欄空白時自動推測。
- 材質 `materials` 支援新增、改名、合併、刪除、隱藏、別名與排序；預設及正規化在 `src/lib/materials.ts`。
- 對應路由 `/me/brands`、`/me/shops`、`/me/materials`。桌面與手機稿索引見 [design-map.md](../design-map.md)。

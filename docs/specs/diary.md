# 穿搭日記

- 日記資料是 `outfits` 中 `worn_on` 有值且 `is_hypothetical = false` 的穿搭；今日搭配「存進穿搭日記」也會建立紀錄。
- 場合可複選，存在 `occasions`；感受 `feel`；天氣／氣溫可選填；照片存至 `{uid}/outfits/{outfit_id}/...`。
- 日記場合、天氣、感受文案、月曆格、月統計，以及「再穿一次／今天排好的單品」共用邏輯在 `src/lib/diary.ts`。
- 衣物 `wear_count`／`last_worn_at` 由 migration 0007 trigger 依 `outfit_items` 更新；前端不可另外加減。
- 路由：`/diary` 月曆；`?view=list` 切列表；支援 `?month=`、`?date=`、`?item=`；`/diary/new` 新增、`/diary/:id/edit` 編輯、`/diary/:id` 單日紀錄。
- 桌面用對話框記錄／編輯；手機用 bottom sheet，單日紀錄為獨立頁。設計稿索引見 [design-map.md](../design-map.md)。

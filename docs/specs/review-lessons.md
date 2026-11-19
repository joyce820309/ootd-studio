# 踩雷覆盤、換貨與挑選規則

## 踩雷處理與紀錄

- 衣物處理方式：已退貨、換貨、留著不穿、轉賣／送人。狀態 `returned`、`exchanged`、`unworn`、`given_away` 不列入衣櫃、今日搭配及一般統計，但保留照片與尺寸。
- 換貨記錄可包含更換尺寸／顏色／款式、換貨日期與補差價；從舊衣複製到 `/closet/new?from=:id&reason=exchange`。新衣用 `items.exchanged_from` 連回舊衣，`received_on` 起算 7 天鑑賞期。
- 複製衣物換尺寸時清空平放尺寸；收到日期必填以計算鑑賞期。
- 踩雷標記、覆盤與筆記本設計稿索引見 [design-map.md](../design-map.md)。

## 尺寸覆盤

- 身體資料取購買日前最近一次 `body_measurements`；衣物圍度以平放尺寸 ×2。
- 「常穿範圍」以同類別、保留中且穿過至少 5 次的衣物，計算（衣物尺寸－身體尺寸）的最小至最大值。
- 個別部位怎麼比較（高腰、坐姿、鞋寬、股上等）見 [body-measurements.md](body-measurements.md)；拉伸尺寸見 [stretch-sizes.md](stretch-sizes.md)。

## 外部 AI 與規則判斷

- 平台不呼叫 AI。覆盤頁只整理可複製的提示文字，並讓使用者貼回外部 AI 回覆。
- 解析回覆格式「原因：／規則：- 範圍｜條件」，轉成 AI 覆盤便利貼與規則草稿；規則是否命中全部由程式比對。
- `lesson_rules` 支援品牌／類別／尺寸範圍、條件與開關。在選購清單、比較試搭、新增衣物時命中只提醒、不阻擋；同一條規則 7 天提醒一次。
- 便利貼樣式：我的體感使用 `mist-soft`、AI 覆盤使用 `sage-soft`；標題使用霞鶩漫黑 22px、內文晴熙圓體 14px。元件使用 `StickyNote`，細節見 [components.md](components.md)。

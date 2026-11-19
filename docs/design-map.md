# 設計稿與路由索引

此文件是設計稿的索引；開發前依功能找到對應畫面，再直接閱讀 `design/` 的 HTML 原稿。

## 使用方式

- 風格以「B・OOTD 手帳」為準；A 版是舊方向，不採用。
- 桌面設計稿通常為 1440px，手機稿為 390px；沒有手機稿時依 `docs/specs/components.md` 的手機規則延伸。
- 設計稿含 `<sc-for>` 等模板語法，只供參考；不可 import 到 App，也不可修改。
- 版面、文字、間距與顏色以設計稿為準，實作改用設計 token class。
- 設計稿新增或改名時，同步更新本表。

## 畫面索引

| 功能 | 桌面設計稿 | 手機設計稿 | 路由／用途 |
|---|---|---|---|
| Landing | `design/general/B-Landing.dc.html` | `design/mobile/B-M-Landing.dc.html` | `/` |
| 登入 | `design/general/B-Login.dc.html` | `design/mobile/B-M-Login.dc.html` | `/login` |
| 設計系統 | `design/general/B-System.dc.html` | — | 色彩、字體、共用元件 |
| 首頁 | `design/general/B-Home.dc.html` | `design/mobile/B-M-Home.dc.html` | `/home` |
| 衣櫃 | `design/general/B-Closet.dc.html` | — | `/closet` |
| 衣物詳細 | `design/general/B-Detail.dc.html` | `design/mobile/B-M-Detail.dc.html` | `/closet/:id` |
| 新增衣物 | `design/general/B-Add.dc.html` | `design/mobile/B-M-Add.dc.html`、`B-M-Add-Cutout.dc.html`、`B-M-Add-Info.dc.html`、`B-M-Add-Done.dc.html` | `/closet/new` |
| 複製／換貨 | `design/general/B-Exchange.dc.html` | `design/mobile/B-M-Exchange.dc.html` | `/closet/new?from=:id&reason=exchange|copy` |
| 今日搭配 | `design/general/B-Outfit.dc.html` | `design/mobile/B-M-Outfit.dc.html`、`B-M-Sheet.dc.html` | `/outfit`；選單品、三種板型 |
| 自由畫布與背景 | `design/general/B-Studio.dc.html` | `design/mobile/B-M-Studio.dc.html`、`B-M-Studio-Bg.dc.html` | `/outfit` 的自由擺放 |
| 選購清單 | `design/general/B-Wishlist.dc.html` | — | `/wishlist` |
| 加入選購 | `design/general/B-Wishlist-Add.dc.html` | `design/mobile/B-M-Wishlist-Add.dc.html` | 選購清單新增／編輯 |
| 篩選與選取給 AI | `design/general/B-Wishlist-Select.dc.html` | `design/mobile/B-M-Wishlist-Select.dc.html` | `/wishlist` 選取模式 |
| 選購比較 | `design/general/B-Compare.dc.html`、`B-Compare-Picker.dc.html` | `design/mobile/B-M-Compare.dc.html`、`B-M-Compare-Picker.dc.html` | `/wishlist/compare/:id`；比較挑選器為 Dialog／Bottom Sheet |
| 個人資料與量測 | `design/general/B-Body.dc.html` | `design/mobile/B-M-Body.dc.html` | `/me`、量測新增／編輯 |
| 量測紀錄 | `design/general/B-History.dc.html`、`B-History-Table.dc.html`、`B-History-Trend.dc.html` | `design/mobile/B-M-History.dc.html`、`B-M-History-Detail.dc.html`、`B-M-History-Trend.dc.html` | `/me/measurements`、`:id` |
| 穿搭日記 | `design/general/B-Diary.dc.html`、`B-Diary-List.dc.html`、`B-Diary-New.dc.html` | `design/mobile/B-M-Diary.dc.html`、`B-M-Diary-Day.dc.html`、`B-M-Diary-New.dc.html` | `/diary`、`/diary/new`、`/diary/:id` |
| 品牌管理 | `design/general/B-Brands.dc.html`、`B-Combobox.dc.html` | `design/mobile/B-M-Brands.dc.html`、`B-M-Brands-Actions.dc.html`、`B-M-Brands-Merge.dc.html`、`B-M-Brands-Delete.dc.html`、`B-M-Combobox.dc.html` | `/me/brands`、品牌 Combobox |
| 通路與材質 | `design/general/B-Shops.dc.html`、`design/mobile/B-Materials.dc.html`（桌面尺寸稿） | `design/mobile/B-M-Shops.dc.html`、`design/mobile/B-M-Materials.dc.html` | `/me/shops`、`/me/materials` |
| 踩雷覆盤與筆記本 | `design/general/B-Review-Mark.dc.html`、`B-Review.dc.html`、`B-Review-AI.dc.html`、`B-Exchange.dc.html`、`B-Lessons.dc.html` | `design/mobile/B-M-Review-Mark.dc.html`、`B-M-Review.dc.html`、`B-M-Review-AI.dc.html`、`B-M-Exchange.dc.html`、`B-M-Lessons.dc.html` | 衣物踩雷、換貨、`/closet/:id/review`、`/closet/lessons` |
| 共用狀態 | `design/general/B-States.dc.html` | — | 空狀態、載入、錯誤、離線 |
| 共用元件 | `design/general/B-DatePicker.dc.html`、`B-Combobox.dc.html`、`B-StickyNote.dc.html`、`B-Checkbox.dc.html`、`B-Stretch.dc.html` | `design/mobile/B-M-Stretch.dc.html` | DatePicker、Combobox、StickyNote、Checkbox、彈性尺寸 |

## 路由進度

| 路徑 | 頁面／狀態 | 主要設計稿 |
|---|---|---|
| `/`、`/login` | Landing、登入：完成 | B-Landing、B-Login |
| `/home`、`/closet` | 首頁、衣櫃：完成 | B-Home、B-Closet |
| `/closet/new` | 新增衣物四步流程：完成 | B-Add、B-M-Add-* |
| `/closet/new?from=:id` | 複製／換貨：完成 | B-Exchange、B-M-Exchange |
| `/closet/:id` | 衣物詳細：完成 | B-Detail、B-M-Detail |
| `/outfit` | 今日搭配：完成 | B-Outfit、B-M-Outfit、B-Studio |
| `/wishlist` | 選購清單、選取給 AI：完成 | B-Wishlist、B-Wishlist-Select、B-M-Wishlist-Select |
| `/wishlist/compare`、`/wishlist/compare/:id` | 選購比較：完成 | B23、B23.1、BM20、BM20.1 |
| `/diary`、`/diary/new`、`/diary/:id` | 穿搭日記：完成 | B-Diary 系列 |
| `/me`、`/me/measurements/*` | 個人資料與量測：完成 | B-Body、B-History 系列 |
| `/me/brands`、`/me/shops`、`/me/materials` | 清單管理：完成 | B-Brands、B-Shops、B-Materials 系列 |
| `/closet/:id/review`、`/closet/lessons` | 踩雷覆盤、踩雷筆記本：完成 | B-Review、B-Lessons 系列 |

新頁面需拆成 `src/pages/XxxPage.tsx`，並優先查找桌面與手機對應設計稿。設計稿不存在的手機畫面，依手機單欄、底部主要按鈕、選擇操作改 bottom sheet 的原則延伸。


# 設計稿對照表

設計稿都在 `design/`，用瀏覽器打開即可預覽。改任何畫面前，先在這裡找到對應的設計稿。
寬 1440＝桌機、760＝桌機對話框、390＝手機。

## 桌機

| 編號  | 名稱                             | 設計稿                        | 寬   | 路徑／元件                                   |
|-------|----------------------------------|-------------------------------|------|----------------------------------------------|
| B0    | Landing 首頁（未登入）           | `B-Landing.dc.html`           | 1440 | `/`（未登入）                                |
| B0.1  | 登入                             | `B-Login.dc.html`             | 1440 | `/login`                                     |
| B1    | 風格 B 設計系統                  | `B-System.dc.html`            | 1440 | —（顏色、字體、元件基礎）                    |
| B2    | 今日搭配・完整平鋪／直列排序     | `B-Outfit.dc.html`            | 1440 | `/outfit`                                    |
| B3    | 首頁                             | `B-Home.dc.html`              | 1440 | `/`（已登入）                                |
| B4    | 我的衣櫃                         | `B-Closet.dc.html`            | 1440 | `/closet`                                    |
| B5    | 衣物詳細                         | `B-Detail.dc.html`            | 1440 | `/closet/:id`                                |
| B5-P  | 我的筆記三種樣式比較（參考）     | `B-Note-Explore.dc.html`      | 1440 | —（已定案，見 B19）                          |
| B6    | 新增衣物流程（去背可略過）       | `B-Add.dc.html`               | 1440 | `/closet/new`                                |
| B7    | 選購清單                         | `B-Wishlist.dc.html`          | 1440 | `/wishlist`                                  |
| B7.1  | 加入選購清單（Dialog）           | `B-Wishlist-Add.dc.html`      | 760  | 選購清單 › 加入（無獨立路徑）                |
| B7.2  | 選購清單・篩選與選取給 AI        | `B-Wishlist-Select.dc.html`   | 1440 | `/wishlist`（選取模式）                      |
| B7+   | 舊版比較試搭台（作廢）           | 舊檔名沿用；內容已由 B23 取代   | —    | 不再參照                                      |
| B8    | 個人體態資料・新增量測・固定資料 | `B-Body.dc.html`              | 1440 | `/me`                                        |
| B8.1  | 量測紀錄・依日期                 | `B-History.dc.html`           | 1440 | `/me/measurements`                           |
| B8.2  | 量測紀錄・對照表                 | `B-History-Table.dc.html`     | 1440 | `/me/measurements?view=table`                |
| B8.3  | 量測紀錄・趨勢                   | `B-History-Trend.dc.html`     | 1440 | `/me/measurements?view=trend`                |
| B9    | 自由畫布・背景主題（後續版本）   | `B-Studio.dc.html`            | 1440 | 後續版本，尚未排入                           |
| B10   | 空狀態・載入・錯誤               | `B-States.dc.html`            | 1440 | —（各頁共用狀態）                            |
| B11   | 元件：日期選擇器 DatePicker      | `B-DatePicker.dc.html`        | 1440 | `components/ui/DatePicker.tsx`（元件）       |
| B12   | 穿搭日記・月曆                   | `B-Diary.dc.html`             | 1440 | `/diary`                                     |
| B12.1 | 穿搭日記・列表與篩選             | `B-Diary-List.dc.html`        | 1440 | `/diary?view=list`                           |
| B12.2 | 穿搭日記・記一筆                 | `B-Diary-New.dc.html`         | 1440 | `/diary/new`                                 |
| B13   | 元件：可輸入的下拉選單           | `B-Combobox.dc.html`          | 1440 | `components/ui/Combobox.tsx`（元件）         |
| B14   | 品牌管理                         | `B-Brands.dc.html`            | 1440 | `/me/brands`                                 |
| B15   | 購買通路管理                     | `B-Shops.dc.html`             | 1440 | `/me/shops`                                  |
| B16   | 材質管理                         | `B-Materials.dc.html`         | 1440 | `/me/materials`                              |
| B17   | 標記踩雷・含換貨（Dialog）       | `B-Review-Mark.dc.html`       | 1440 | 衣物詳細 › 這件踩雷了（無獨立路徑）          |
| B17.1 | 踩雷覆盤                         | `B-Review.dc.html`            | 1440 | `/closet/:id/review`                         |
| B17.2 | 換貨／複製成新衣物               | `B-Exchange.dc.html`          | 1440 | `/closet/new?from=:id&reason=exchange\|copy`  |
| B17.3 | AI 覆盤・複製資料與貼上回覆      | `B-Review-AI.dc.html`         | 1440 | 覆盤頁內（無獨立路徑）                       |
| B18   | 踩雷筆記本                       | `B-Lessons.dc.html`           | 1440 | `/closet/lessons`                            |
| B19   | 元件：便利貼 StickyNote          | `B-StickyNote.dc.html`        | 1440 | `components/ui/StickyNote.tsx`（元件）       |
| B20   | 規格：彈性尺寸（平放＋可拉伸）   | `B-Stretch.dc.html`           | 1440 | —（共用狀態，見表內「各頁套用」）            |
| B21   | 元件：勾選框 Checkbox            | `B-Checkbox.dc.html`          | 1440 | `components/ui/Checkbox.tsx`（元件）         |
| B22   | 元件：選色器 ColorPicker         | `B-ColorPicker.dc.html`       | 1440 | `components/ui/ColorPicker.tsx`（元件）      |
| B23   | 選購比較 | `B-Compare.dc.html` | 1440 | `/wishlist/compare/:id` |
| B23.1 | 比較・加入商品 | `B-Compare-Picker.dc.html` | 1440 | `/wishlist/compare/:id`（Dialog） |
| B23.2 | 比較・快速預覽 | `B-Compare-Preview.dc.html` | 1440 | `/wishlist/compare/:id?preview=:itemId` |
| B24   | 元件：特徵標籤 | `B-Features.dc.html` | 1440 | 元件（用在 B7.1、B6） |
| B25   | 特徵管理 | `B-Features-Manage.dc.html` | 1440 | `/me/features` |
| B26   | 元件：懸浮展開鈕 | `B-FloatToggle.dc.html` | 1440 | 元件（用在 B23、BM20） |

## 手機

| 編號   | 名稱                         | 設計稿                         | 寬  | 路徑／元件                                          |
|--------|------------------------------|--------------------------------|-----|-----------------------------------------------------|
| BM0    | 手機 Landing                 | `B-M-Landing.dc.html`          | 390 | `/`（未登入）                                       |
| BM0.1  | 手機登入                     | `B-M-Login.dc.html`            | 390 | `/login`                                            |
| BM1    | 手機首頁                     | `B-M-Home.dc.html`             | 390 | `/`（已登入）                                       |
| BM2    | 手機今日搭配                 | `B-M-Outfit.dc.html`           | 390 | `/outfit`                                           |
| BM2.1  | 手機今日搭配・直列排序       | `B-M-Outfit-Column.dc.html`    | 390 | `/outfit`（直列排序）                               |
| BM3    | 選擇單品 Bottom Sheet        | `B-M-Sheet.dc.html`            | 390 | 今日搭配內（無獨立路徑）                            |
| BM4    | 舊版手機比較試搭（作廢）     | 舊檔名沿用；內容已由 BM20 取代 | —   | 不再參照                                           |
| BM5    | 手機自由畫布（後續版本）     | `B-M-Studio.dc.html`           | 390 | 後續版本，尚未排入                                  |
| BM5.1  | 手機畫布背景主題             | `B-M-Studio-Bg.dc.html`        | 390 | 自由畫布 › 背景（後續版本）                         |
| BM6    | 手機量測紀錄                 | `B-M-History.dc.html`          | 390 | `/me/measurements`                                  |
| BM6.1  | 手機單次紀錄                 | `B-M-History-Detail.dc.html`   | 390 | `/me/measurements/:id`                              |
| BM6.2  | 手機量測趨勢                 | `B-M-History-Trend.dc.html`    | 390 | `/me/measurements?view=trend`                       |
| BM7    | 手機穿搭日記                 | `B-M-Diary.dc.html`            | 390 | `/diary`                                            |
| BM7.1  | 手機單日紀錄                 | `B-M-Diary-Day.dc.html`        | 390 | `/diary/:date`                                      |
| BM7.2  | 手機記一筆                   | `B-M-Diary-New.dc.html`        | 390 | `/diary/new`                                        |
| BM8    | 手機新增衣物・照片           | `B-M-Add.dc.html`              | 390 | `/closet/new`（步驟 1）                             |
| BM8.1  | 手機去背（可略過）           | `B-M-Add-Cutout.dc.html`       | 390 | `/closet/new`（步驟 2）                             |
| BM8.2  | 手機衣物資料                 | `B-M-Add-Info.dc.html`         | 390 | `/closet/new`（步驟 3）                             |
| BM8.3  | 手機放到哪裡                 | `B-M-Add-Done.dc.html`         | 390 | `/closet/new`（完成）                               |
| BM9    | 手機品牌選擇（可能打錯字）   | `B-M-Combobox.dc.html`         | 390 | `components/ui/Combobox.tsx`（手機樣式）            |
| BM10   | 手機品牌管理                 | `B-M-Brands.dc.html`           | 390 | `/me/brands`                                        |
| BM10.1 | 品牌動作・改名               | `B-M-Brands-Actions.dc.html`   | 390 | `/me/brands`（動作面板）                            |
| BM10.2 | 合併品牌                     | `B-M-Brands-Merge.dc.html`     | 390 | `/me/brands`（合併）                                |
| BM10.3 | 刪除品牌・復原提示           | `B-M-Brands-Delete.dc.html`    | 390 | `/me/brands`（刪除）                                |
| BM11   | 手機「我的」                 | `B-M-Lists.dc.html`            | 390 | `/me`（手機）                                       |
| BM12   | 手機購買通路管理             | `B-M-Shops.dc.html`            | 390 | `/me/shops`                                         |
| BM13   | 手機材質管理                 | `B-M-Materials.dc.html`        | 390 | `/me/materials`                                     |
| BM14   | 手機標記踩雷・含換貨         | `B-M-Review-Mark.dc.html`      | 390 | 衣物詳細 › 這件踩雷了（無獨立路徑）                 |
| BM14.1 | 手機踩雷覆盤                 | `B-M-Review.dc.html`           | 390 | `/closet/:id/review`                                |
| BM14.2 | 手機換貨／複製成新衣物       | `B-M-Exchange.dc.html`         | 390 | `/closet/new?from=:id&reason=exchange\|copy`         |
| BM14.3 | 手機 AI 覆盤・複製與貼上     | `B-M-Review-AI.dc.html`        | 390 | 覆盤頁內（無獨立路徑）                              |
| BM15   | 手機踩雷筆記本               | `B-M-Lessons.dc.html`          | 390 | `/closet/lessons`                                   |
| BM16   | 手機衣物詳細                 | `B-M-Detail.dc.html`           | 390 | `/closet/:id`                                       |
| BM17   | 手機彈性尺寸                 | `B-M-Stretch.dc.html`          | 390 | —（共用狀態）                                       |
| BM18   | 手機新增量測                 | `B-M-Body.dc.html`             | 390 | `/me/measurements/new`、`/me/measurements/:id/edit` |
| BM19   | 手機加入選購清單             | `B-M-Wishlist-Add.dc.html`     | 390 | 選購清單 › 加入（全螢幕）                           |
| BM19.1 | 手機選購清單・選取給 AI      | `B-M-Wishlist-Select.dc.html`  | 390 | `/wishlist`（選取模式）                             |
| BM20  | 手機選購比較 | `B-M-Compare.dc.html` | 390 | `/wishlist/compare/:id` |
| BM20.1| 手機比較・加入商品 | `B-M-Compare-Picker.dc.html` | 390 | `/wishlist/compare/:id`（Bottom Sheet） |
| BM20.2| 手機比較・快速預覽 | `B-M-Compare-Preview.dc.html` | 390 | `/wishlist/compare/:id?preview=:itemId` |
| BM21  | 手機特徵標籤 | `B-M-Features.dc.html` | 390 | 元件（用在 BM19、BM8.2） |
| BM22  | 手機特徵管理 | `B-M-Features-Manage.dc.html` | 390 | `/me/features` |



## 路徑規則

- `/me` 依螢幕寬度顯示不同內容：桌機＝B8（量測表單＋側欄）；手機＝BM11「我的」總覽，量測表單在 `/me/measurements/new`（桌機進入時導回 `/me`）。
- 手機每個主要分頁右上角都有頭像，連到 `/me`。
- 衣櫃、選購清單沒有手機版主頁設計稿，手機版照桌機內容改成單欄，頭像位置同 BM1。
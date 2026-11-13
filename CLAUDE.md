# My Closet・OOTD Studio

私人衣櫃 Web App：管理衣物、排今日穿搭、比較網拍候選並和衣櫃混搭。是舊專案 OOTD 的後繼版本。
介面文字、註解、commit 說明一律用**繁體中文**；程式碼識別字用英文。

設計稿（風格 B・OOTD 手帳）：https://claude.ai/artifact/MtWAfd1LBVJrZbtuA7M8Ct
實作時以「風格 B」頁面為準；風格 A 只是保留的舊方向，不要參考。

**設計稿原始檔在 `design/`**（`B-*.dc.html`，桌面 1440；`B-M-*` 為手機 390）。
實作新頁面前先讀對應檔案，照它的版面、文字、間距與顏色做，再把 inline style 換成 Tailwind token class。
這些檔案是參考用的設計稿（含 `<sc-for>` 等模板語法），不要 import 進 App，也不要修改。

## 技術棧與指令

- React 19 + TypeScript + Vite，React Router v7（`createBrowserRouter`）
- Tailwind CSS v4（`@tailwindcss/vite`，沒有 `tailwind.config.js`）
- Supabase：Auth、Postgres（RLS）、Storage、Edge Functions
- 部署：Vercel（`vercel.json` 已設 SPA rewrite）
- 路徑別名 `@/` = `src/`

```bash
npm install
npm run dev      # 開發
npm run build    # tsc -b && vite build，改完一定要跑過
npm run lint     # oxlint
```

### 示範模式

`.env.local` 沒填 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 時，`isDemoMode = true`：
不需登入、資料來自 `src/data/sample.ts`、儲存只回傳 `{ demo: true }`。
新增資料存取功能時，**兩種模式都要能跑**（見 `src/lib/data.ts` 的寫法）。

## 資料夾結構

```
src/
  App.tsx                路由
  types.ts               所有共用型別（Slot、ClosetItem、WishlistItem、Outfit…）
建立準備 push 的提交請使用 `npm run commit -- "繁體中文摘要"`；腳本會按提交日期遞增版號、更新 `src/lib/version.ts` 與 `CHANGELOG.md`、執行 build/lint，並在使用者確認後建立含版號的 commit。版號格式為 `YYYYMMDD-N`，同日流水號加 1、每日從 1 開始。腳本不會 push；push 前須確認提交已包含版號與紀錄。
  styles/
    tokens.css           @theme：唯一的設計 token 來源（顏色、圓角、陰影、字體）
    base.css             body、focus、reduced-motion、@utility（bg-dot-grid、tabular、bg-ruled）
  lib/
    supabase.ts          client 與 isDemoMode
    auth.tsx             AuthProvider、RequireAuth
    data.ts              衣物、選購、穿搭、個人偏好與量測紀錄資料存取
    slots.ts             部位中繼資料、必選部位、狀態文字、isWearable
    outfit.ts            Picks、預設勾選、缺少必選檢查
    freeLayout.ts        自由擺放：預設位置、範圍限制、圖層操作
    diary.ts             日記場合／天氣／感受文字、月曆格、月統計、今日搭配↔日記（再穿一次、今天排好的單品）
    wishlist.ts          選購狀態文字、價格格式、網址推測店家、衣櫃可搭件數／重複度估算
    brands.ts            品牌：相似品牌偵測（可能重複）、排序、日期格式
    materials.ts         材質預設與名稱正規化、選取及成分百分比處理
    studioBackground.ts  搭配工作台背景主題、色塊透明度、自訂色與推薦主題
  data/sample.ts         示範資料（繁中）
  components/
    ui/                  Button、Chip/StatusTag、Icon、Select、Combobox、DatePicker、Paper（PaperCard、TiltLabel、Tape、WashBlob、LogoSticker）、Toast
    layout/              AppHeader、MobileTabBar、AppLayout、PageStub、ProfileNav（`/me` 底下共用外框 ProfileLayout：xl 以上左側子導覽，以下用 ProfileBreadcrumb 麵包屑）
    closet/              GarmentArt（示範剪影）、ItemImage、ItemTile
    outfit/              OutfitBoard（固定板型）、SlotPicker、FreeCanvas（自由擺放）
                         StudioCanvas、StudioBackgroundPicker、StudioBackgroundSurface（搭配工作台背景）
    diary/               DiaryParts（評分、場合／感受標籤、月曆小拼貼）、DiaryEntryDialog（記一筆／編輯）
    wishlist/            WishlistTabs、WishlistForm（新增／編輯）、BoughtDialog（移至已購買）、CompareGroupDialog
  pages/                 Landing、Login、Home、Closet、AddItem、ItemDetail、Outfit、Studio、Wishlist、Compare、Diary、Profile、MeasurementHistory、Brands、ManagedLists
supabase/migrations/     0001_init.sql … 0013_outfit_background_themes.sql（依序執行）
```

## 路由與進度

| 路徑 | 頁面 | 狀態 |
|---|---|---|
| `/` | Landing | 完成 |
| `/login` | 登入（Google、Email、登入連結） | 完成 |
| `/home` | 首頁 | 完成 |
| `/closet` | 衣櫃列表 | 完成 |
| `/outfit` | 今日搭配（三種板型） | 完成 |
| `/closet/new` | 新增衣物四步流程（照片／去背／資料／存放位置） | 完成 → B-Add、B-M-Add-* |
| `/closet/:id` | 衣物詳細 | stub |
| `/diary` | 穿搭日記・月曆／列表（`?view=list`、`?month=`、`?date=`、`?item=`） | 完成 → B-Diary、B-Diary-List、B-M-Diary |
| `/diary/new`、`/diary/:id/edit` | 記一筆／編輯（桌面對話框、手機 bottom sheet） | 完成 → B-Diary-New、B-M-Diary-New |
| `/diary/:id` | 單日紀錄（手機獨立頁；桌面在月曆右側） | 完成 → B-M-Diary-Day |
| `/wishlist` | 選購清單（新增／編輯／改狀態／移至已購買／刪除；`?status=`、`?item=`） | 完成 → B-Wishlist |
| `/wishlist/compare` | **比較試搭台**（主要功能；群組 CRUD、加入／淘汰候選、混搭試穿、決定買；`?group=`） | 完成 → B-Compare、B-M-Compare |
| `/me` | 個人資料・新增量測（儲存為新快照） | 完成 → B-Body |
| `/me/measurements` | 量測紀錄・依日期／對照表（`?view=table`） | 完成 → B-History、B-History-Table、B-M-History |
| `/me/measurements/:id` | 單次紀錄（手機獨立頁；桌面在列表右側） | 完成 → B-M-History-Detail |
| `/me/brands` | 品牌管理（新增／改名／合併／刪除＋10 秒復原、可能重複提示；`/me` 頁首有入口） | 完成 → B-Brands、B-M-Brands-* |
| `/me/shops` | 購買通路管理（新增／改名／合併／刪除，含網路／實體類型與網址） | 完成 → B-Shops、B-M-Shops |
| `/me/materials` | 材質管理（新增／改名／合併／刪除／隱藏、別名與排序） | 完成 → B-Materials、B-M-Materials |

新頁面一律拆成獨立檔案 `src/pages/XxxPage.tsx`，並對照設計稿同名畫面（含手機版 B-M-*）；尚未實作的頁面可用 `components/layout/PageStub` 暫代。

## 核心功能規則

### 今日搭配（`/outfit`）
- 依部位勾選：外套、上衣、下身、鞋子、包包、配件（`Slot`）。上衣、下身、鞋子必選。
- 三種板型（tab）：`full` 完整平鋪、`column` 三件直列、`free` 自由擺放。
- 固定板型用 CSS `grid-template-areas`，上衣在上、下身中、鞋子下。
- 自由擺放：位置用百分比存（`Placement`：x/y 中心點、w 寬度、rot、z），只在 `template = 'free'` 時存進 `outfits.layout`。支援拖曳、鍵盤（方向鍵移動）、上移／下移圖層。
- 可放衣櫃單品或選購清單商品（`OutfitPick` 的 `closet` / `wish`）。
- 手機：單欄、搭配板在最上方；選單品用 bottom sheet。

### 比較試搭台（`/wishlist/compare`）— 最重要的功能
使用者常猶豫要不要買網拍衣服，會在不同網站比對類似單品。
- 一個比較群組 = 同一需求的多個候選（例：「冬天想要一條寬褲」）。
- 並排比較：含運價格、你的尺寸是否有貨、衣櫃可搭件數、退換天數；標示「最省」「最多」。
- 混搭試穿：候選可和衣櫃單品、**其他想買的單品**一起放上搭配板；未購買單品用虛線框標示，並算出未購買合計。
- 結果：存成穿搭，或「決定買這件」（狀態改為 bought，保留所有資料）。

## 設計系統（風格 B・OOTD 手帳）

溫暖燕麥紙色底、低彩度粉彩、微傾斜紙標籤、透明色塊以 multiply 疊加。

### 顏色：只能用 token
`tokens.css` 用 `--color-*: initial` 關掉了 Tailwind 預設色盤，所以 `bg-blue-500` 這類 class **不存在**。
只能用：
- 紙與文字：`paper`、`card`、`apricot`、`tile`、`line`、`line-strong`、`ink`、`ink-2`、`ink-3`
- 四個主題色，各有 `DEFAULT / soft / edge / deep / ink / wash`：`oat`（燕麥）、`mist`（霧藍）、`rose`（玫瑰）、`sage`（鼠尾草）
  - 例：`bg-oat`、`bg-rose-soft`、`text-mist-deep`、`bg-sage-wash`
- 衣物狀態：`ok`、`cleaning`、`repair`、`lent`、`stored`（各有 bg/fg）

需要新顏色時，先加到 `tokens.css`，不要在元件裡寫 hex（衣物本身的顏色 `colorHex` 例外）。
文字對比：正文用 `ink` / `ink-2`；`ink-3` 只給次要小字。

### 字體
| 用途 | 字體 | Tailwind | 規則 |
|---|---|---|---|
| 標題、傾斜標籤、穿搭名稱 | 霞鶩漫黑 LXGW Marker Gothic | `font-hd` | **只有 400，不可加 `font-bold`**；只用在 17px 以上 |
| 內文、按鈕、表單 | 晴熙圓體 Chiron GoRound TC | `font-sans`（預設） | 400 內文（最小 12px）、500 按鈕與標籤、700 強調 |
| 數字（價格、尺寸、次數） | Nunito | `font-num` + `tabular` | 等寬對齊 |
| Logo | Fredoka | `font-logo` | 只用在 LogoSticker |

`base.css` 設了 `font-synthesis-weight: none`，霞鶩漫黑加粗也不會變粗，所以不要靠加粗做強調。
不要使用新細明體、標楷體或任何明體／楷體字型。

### 元件慣例
- 日期欄位一律用 `components/ui/DatePicker`（值為 `'YYYY-MM-DD'` 字串），**不要用原生 `<input type="date">`**；日期工具在 `src/lib/date.ts`，設計規格見 `design/B-DatePicker.dc.html`。
- 優先用 `components/ui` 的現有元件：`Button`（primary / oat / secondary / ghost / danger / sage）、`DatePicker`、`Chip`、`StatusTag`、`PaperCard`、`TiltLabel`、`Tape`、`WashBlob`、`Icon`、`Toast`。
- 下拉選單**不要用原生 `<select>`／`<datalist>`**：固定選項用 `components/ui/Select`（桌面浮動清單、手機底部清單，可用 `display`／`triggerClassName` 自訂按鈕外觀）；可打字建立新值的用 `Combobox`。樣式依 `design/general/B-Combobox.dc.html`。
- Header：紙色背景＋燕麥色貼紙 Logo，目前頁面用燕麥色底線標示。
- 圓角 token：`rounded-tag`(3) `sm`(8) `btn`(10) `tile`(12) `card`(14) `block`(20)。
- 陰影 token：`shadow-paper`、`sticker`、`float`、`sheet`、`oat`；衣物圖用 `drop-shadow-garment`。
- 分隔線多用 `1.5px dashed` + `line-strong`。

### 版面與無障礙
- 設計尺寸：桌面 1440、手機 390。手機要能單手操作，不可出現水平捲動（注意 `min-w-0`）。
- 觸控目標至少 44×44px。
- 每個互動元素要有可見 focus（`base.css` 已設定）；只有圖示的按鈕要加 `aria-label`。
- 尊重 `prefers-reduced-motion`。
- 錯誤、空狀態、載入中、離線都要有畫面（參考設計稿 B-States）。

## Supabase

- 體態量測：`/me` 每次儲存都新增一筆 `body_measurements`「當天完整快照」，以最近一筆預填，不覆蓋舊紀錄；編輯歷史紀錄則更新指定快照。歷史頁用相鄰兩筆比較：不同→燕麥底顯示差值、上一筆沒有→霧藍「第一次記」、相同→「—」。只列數字，**不畫趨勢圖、不用紅綠色評價增減**。欄位 migration 已整併至 `0005_split_body_circumferences.sql`：上胸圍／下胸圍、肚臍圍，以及五指襪／一般襪／裸腳各自的腳長／腳寬／前掌圍／腳背圍。
- 資料表：`profiles`、`categories`、`items`、`item_photos`、`wishlist_items`、`compare_groups`、`outfits`、`outfit_items`、`body_measurements`、`brands`、`brand_distinct_groups`。
- 品牌名稱仍存在 `items.brand`／`wishlist_items.brand` 文字欄位；`brands` 只放手動新增的品牌，`brand_distinct_groups` 記「不是同一個」。改名、合併、刪除一律走 `replace_brands` RPC（衣物與選購一起更新），復原用 `restore_brand`。
- 每張表都有 `owner_id default auth.uid()` 並啟用 RLS，只有本人能讀寫。新增資料表時照同樣模式。
- 新使用者註冊時由 `handle_new_user` trigger 建立 profile 與預設分類；分類不要寫死在 UI。
- 圖片放私人 bucket `closet-images`，路徑第一層必須是使用者 id：`{uid}/...`；衣物原圖為 `{uid}/{item_id}/original.ext`，多圖索引在 `item_photos`，讀取用 signed URL。未完成新增會以 `items.is_draft = true` 隱藏。
- 穿搭日記＝`outfits` 中 `worn_on` 有值且 `is_hypothetical = false` 的穿搭（今日搭配「存進穿搭日記」也會出現）。場合可複選（`occasions`）、感受 `feel`、天氣與氣溫、照片 `{uid}/outfits/{outfit_id}/...`。衣物的 `wear_count`／`last_worn_at` 由 `0007` 的 trigger 依 `outfit_items` 增減，前端不要另外加減。
- Schema 變更：新增 `supabase/migrations/000N_xxx.sql`，**不要改舊的 migration**；同步更新 `src/types.ts`。
- 去背 Edge Function 位於 `supabase/functions/remove-background`，使用 remove.bg Secret；新增衣物可略過去背，失敗時保留原圖。

## 工作習慣

- 改完執行 `npm run build` 確認型別與建置通過。
- 新頁面先對照設計稿同名畫面，桌面與手機都要做。
- 示範資料與畫面文字使用自然的台灣繁體中文。
- 建立提交請使用 `npm run commit -- "繁體中文摘要"`；腳本會遞增版號、更新 `src/lib/version.ts` 與 `CHANGELOG.md`、執行 build/lint，並在使用者確認後建立含版號的 commit。版號格式為 `YYYYMMDD-N`，同日流水號加 1、每日從 1 開始。腳本不會 push；每次 `git push` 前確認提交已包含版號與紀錄。

### 搭配工作台背景主題（design/B-Studio.dc.html、B-M-Studio.dc.html、B-M-Studio-Bg.dc.html）
- 主題：plain 素紙(新穿搭預設、無色塊) / oat 燕麥 / lemon 檸檬薄荷 / rose 玫瑰 / mist 霧藍 / journal 手帳 / custom 自訂
- 主題的背景色與色塊 rgba 值，照 design/B-Studio.dc.html 裡 renderVals() 的 TH 陣列
- 自訂：兩個 hex 取自 18 色系（排除多色/其他），可輸入 HEX；轉成 rgba 時依亮度決定透明度：<0.4→.16、<0.65→.26、其他→.4
- 色塊模式 blobMode：on / soft(25%) / off；on 狀態下選取單品編輯時自動降到 25%（transition .2s），取消選取恢復
- 推薦主題（★）依畫布上單品顏色計算，只做標示，不自動切換；素紙與自訂不參與推薦
- 主題跟著穿搭一起存（outfits.bg_theme、bg_blob_mode、bg_custom jsonb，migration 0013）；匯出圖片與日記紀錄顯示沿用同一個背景
- 桌面顯示主題列與色塊模式；手機從畫布右上角「背景」開啟底部主題面板
- 不做：拖曳色塊位置、依季節自動切換

### 設計稿對照表（`design/`）

| 編號 | 畫面 | 設計檔 | 尺寸 | 對應路由／程式 |
|---|---|---|---|---|
| B0 | Landing 首頁（未登入） | `B-Landing.dc.html` | 1440 | `/` |
| B0.1 | 登入 | `B-Login.dc.html` | 1440 | `/login` |
| B1 | 設計系統（色彩、字體、元件） | `B-System.dc.html` | 1440 | `src/styles/tokens.css`、`components/ui/` |
| B2 | 今日搭配・基礎版 | `B-Outfit.dc.html` | 1440 | `/outfit` |
| B3 | 首頁 | `B-Home.dc.html` | 1440 | `/home` |
| B4 | 我的衣櫃 | `B-Closet.dc.html` | 1440 | `/closet` |
| B5 | 衣物詳細 | `B-Detail.dc.html` | 1440 | `/closet/:id` |
| B6 | 新增衣物流程 | `B-Add.dc.html` | 1440 | `/closet/new` |
| B7 | 選購清單 | `B-Wishlist.dc.html` | 1440 | `/wishlist` |
| B7+ | 比較試搭台（主要功能） | `B-Compare.dc.html` | 1440 | `/wishlist/compare` |
| B8 | 個人體態資料・新增量測 | `B-Body.dc.html` | 1440 | `/me` |
| B8.1 | 量測紀錄・依日期 | `B-History.dc.html` | 1440 | `/me/measurements` |
| B8.2 | 量測紀錄・對照表 | `B-History-Table.dc.html` | 1440 | `/me/measurements?view=table` |
| B9 | 自由畫布（進階版，後續） | `B-Studio.dc.html` | 1440 | `/outfit` 的「自由擺放」tab（`FreeCanvas`） |
| B10 | 空狀態・載入・錯誤 | `B-States.dc.html` | 1440 | 各頁共用 |
| B11 | 元件：日期選擇器 | `B-DatePicker.dc.html` | 1440 | `components/ui/DatePicker.tsx` |
| B12 | 穿搭日記・月曆 | `B-Diary.dc.html` | 1440 | `/diary` |
| B12.1 | 穿搭日記・列表與篩選 | `B-Diary-List.dc.html` | 1440 | `/diary?view=list` |
| B12.2 | 穿搭日記・記一筆 | `B-Diary-New.dc.html` | 1440 | `/diary/new`（對話框） |
| B13 | 元件：可輸入的下拉選單（品牌） | `B-Combobox.dc.html` | 1440 | `components/ui/Combobox` |
| B14 | 品牌管理 | `B-Brands.dc.html` | 1440 | `/me/brands` |
| B15 | 購買通路管理 | `B-Shops.dc.html` | 1440 | `/me/shops` |
| B16 | 材質管理 | `B-Materials.dc.html` | 1440 | `/me/materials` |

| BM0 | 手機 Landing | `B-M-Landing.dc.html` | 390 | `/` |
| BM0.1 | 手機登入 | `B-M-Login.dc.html` | 390 | `/login` |
| BM1 | 手機首頁 | `B-M-Home.dc.html` | 390 | `/home` |
| BM2 | 手機今日搭配 | `B-M-Outfit.dc.html` | 390 | `/outfit` |
| BM3 | 選擇單品 Bottom Sheet | `B-M-Sheet.dc.html` | 390 | `/outfit`（`SlotPicker`） |
| BM4 | 手機比較試搭 | `B-M-Compare.dc.html` | 390 | `/wishlist/compare` |
| BM5 | 手機自由畫布（後續） | `B-M-Studio.dc.html` | 390 | `/outfit` 的「自由擺放」tab |
| BM6 | 手機量測紀錄 | `B-M-History.dc.html` | 390 | `/me/measurements` |
| BM6.1 | 手機單次紀錄 | `B-M-History-Detail.dc.html` | 390 | `/me/measurements/:id` |
| BM7 | 手機穿搭日記 | `B-M-Diary.dc.html` | 390 | `/diary` |
| BM7.1 | 手機單日紀錄 | `B-M-Diary-Day.dc.html` | 390 | `/diary/:id` |
| BM7.2 | 手機記一筆 | `B-M-Diary-New.dc.html` | 390 | `/diary/new`（bottom sheet） |
| BM8 | 手機新增衣物・照片 | `B-M-Add.dc.html` | 390 | `/closet/new` |
| BM8.1 | 手機去背（可略過） | `B-M-Add-Cutout.dc.html` | 390 | `/closet/new`（第 2 步） |
| BM8.2 | 手機衣物資料 | `B-M-Add-Info.dc.html` | 390 | `/closet/new`（第 3 步） |
| BM8.3 | 手機放到哪裡 | `B-M-Add-Done.dc.html` | 390 | `/closet/new`（第 4 步） |
| BM9 | 手機品牌選擇 | `B-M-Combobox.dc.html` | 390 | `components/ui/Combobox`（手機版） |
| BM10 | 手機品牌管理 | `B-M-Brands.dc.html` | 390 | `/me/brands` |
| BM10.1 | 品牌動作・改名 | `B-M-Brands-Actions.dc.html` | 390 | `/me/brands`（底部面板） |
| BM10.2 | 合併品牌 | `B-M-Brands-Merge.dc.html` | 390 | `/me/brands`（底部面板） |
| BM10.3 | 刪除品牌・復原 | `B-M-Brands-Delete.dc.html` | 390 | `/me/brands`（底部面板） |
| BM11 | 手機個人資料・清單管理入口 | `B-M-Lists.dc.html` | 390 | `/me` |
| BM12 | 手機購買通路管理 | `B-M-Shops.dc.html` | 390 | `/me/shops` |
| BM13 | 手機材質管理 | `B-M-Materials.dc.html` | 390 | `/me/materials` |

沒有手機版設計稿的頁面（衣櫃、衣物詳細、新增衣物、選購清單、個人資料），比照 BM 開頭的版面規則自行延伸：單欄排列、底部固定主要按鈕、選擇類操作改用 bottom sheet。
# My Closet・OOTD Studio

私人衣櫃 Web App：管理衣物、排今日穿搭、比較網拍候選並和衣櫃混搭。介面文字、註解與 commit 說明使用台灣繁體中文；程式識別字使用英文。

> 本檔只放專案入口與規格索引。實作前按功能讀對應規格及設計稿，不要把長篇功能規則複製回本檔。

## 規格索引

### 設計稿與路由
- 設計稿／路由／進度對照：[docs/design-map.md](docs/design-map.md)
- 設計風格以 B・OOTD 手帳為準。實作前先看對應 `design/` HTML；設計稿只讀，不可 import 或修改。

### 功能規格
- 部位、分類、衣物類型：[docs/specs/categories.md](docs/specs/categories.md)
- 今日搭配與搭配工作台：[docs/specs/outfit-studio.md](docs/specs/outfit-studio.md)
- 穿搭日記：[docs/specs/diary.md](docs/specs/diary.md)
- 彈性尺寸與尺寸欄位：[docs/specs/stretch-sizes.md](docs/specs/stretch-sizes.md)
- 體態量測、歷史與趨勢：[docs/specs/body-measurements.md](docs/specs/body-measurements.md)
- 選購清單、選購比較、選取給外部 AI：[docs/specs/wishlist.md](docs/specs/wishlist.md)
- 踩雷覆盤、換貨、挑選規則：[docs/specs/review-lessons.md](docs/specs/review-lessons.md)
- 品牌、通路與材質管理：[docs/specs/managed-lists.md](docs/specs/managed-lists.md)
- Supabase、示範模式、圖片儲存：[docs/specs/data-storage.md](docs/specs/data-storage.md)
- 設計 token、共用元件、版面與無障礙：[docs/specs/components.md](docs/specs/components.md)

### 規格使用原則
- 收到新規格時，先讀本索引找到要更新的文件，再只改相關規格檔；本檔只在新增／移除規格類別時更新索引。
- 規格與程式不一致時，先指出差異，不要自行選邊；依使用者指示更新規格或程式。
- 設計 HTML 是視覺參考；功能規則以對應 `docs/specs/*.md` 為準。

## 專案與常用指令

- React 19、TypeScript、Vite、React Router v7、Tailwind CSS v4、Supabase；部署至 Vercel。
- 路徑別名 `@/` 對應 `src/`；新頁面獨立放 `src/pages/XxxPage.tsx`。
- 示範模式與資料存取規則見 [docs/specs/data-storage.md](docs/specs/data-storage.md)。

```bash
npm install
npm run dev
npm run build
npm run lint
```

改完執行 `npm run build` 與 `npm run lint`。

## 開發與資料庫變更

- 新增 Schema 只加 migration，不改已存在的 migration；同步型別、資料 mapping 與示範資料。細節見 [docs/specs/data-storage.md](docs/specs/data-storage.md)。
- 新頁面與元件先對照 [docs/design-map.md](docs/design-map.md) 中的設計稿；繁中介面需自然符合台灣用語。
- 本專案不在平台內呼叫 AI；凡標示「整理給 AI」皆為產生文字並交由使用者複製至外部服務。

## 提交與推送

- 使用 `npm run commit -- "繁體中文摘要"` 建立提交。腳本依日期遞增版號、更新 `src/lib/version.ts` 與 `CHANGELOG.md`、執行 build/lint，並在使用者確認後建立含版號的 commit。
- 版號格式 `YYYYMMDD-N`；每日從 1 開始，同日流水號遞增。腳本不會 push。
- push 前確認提交已包含版號與變更紀錄；未經使用者要求，不自行 commit 或 push。

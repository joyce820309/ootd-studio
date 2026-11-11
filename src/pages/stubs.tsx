import { PageStub } from '@/components/layout/PageStub'

export const ItemDetailPage = () => (
  <PageStub title="衣物詳細" items={['去背圖與原始照片切換', '穿著次數、最近穿著、每次穿著成本', '完整資料與手帳橫線筆記', '常一起穿的單品、封存與刪除（二次確認）']} />
)

export const AddItemPage = () => (
  <PageStub title="新增衣物" accent="rose" items={['拍照、選圖或拖放', '自動去背（Edge Function），失敗可略過', '4 個必填欄位，其餘收合', '存入衣櫃或選購清單']} />
)

export const DiaryPage = () => (
  <PageStub title="穿搭日記" accent="mist" items={['依日期列出存過的穿搭', '評分、穿著感受與備註', '一鍵重穿：帶回今日搭配']} />
)

export const WishlistPage = () => (
  <PageStub title="選購清單" accent="rose" items={['依狀態檢視：考慮中、等待降價、準備購買', '與衣櫃的搭配數與重複度', '移至已購買時保留所有資料']} />
)

export const ComparePage = () => (
  <PageStub title="比較試搭台" accent="rose" items={['貼上不同網站的商品網址，建立比較群組', '並排比較含運價格、材質、尺寸、退換與可搭件數', '和衣櫃、其他想買的單品混搭，算出未購買合計']} />
)

export const ProfilePage = () => (
  <PageStub title="個人資料" accent="mist" items={['可收合的量測欄位，不要求一次填完', '多規格鞋碼對照', '版型偏好與「本次不使用體態資料」設定', '歷史量測紀錄（不畫趨勢圖）']} />
)

import { useOutletContext } from 'react-router-dom'

export interface ProfileNavContext {
  /** 更新左側子導覽上的數字（例：品牌數量） */
  setNavCount: (path: string, count: number) => void
}

/** 在 /me 底下的頁面取得子導覽控制；不在 ProfileLayout 裡時回傳 null */
export const useProfileNav = () => useOutletContext<ProfileNavContext | undefined>() ?? null

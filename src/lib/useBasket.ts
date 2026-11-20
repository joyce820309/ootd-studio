import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import type { ToastMessage } from '@/components/ui/Toast'
import { buildBasket, buyQty, effectiveBuyLines, type BasketRow } from '@/lib/basket'
import { fetchShoppingTarget, markWishlistBought, saveShoppingTarget, saveWishlistBasket } from '@/lib/data'
import type { BuyLine, CompareGroup, CompareGroupItem, WishlistItem } from '@/types'

interface UseBasketInput {
  items: WishlistItem[]
  setItems: Dispatch<SetStateAction<WishlistItem[]>>
  groups: CompareGroup[]
  links: CompareGroupItem[]
  setToast: (toast: ToastMessage) => void
  /** 寫入失敗或移到已購買後重新讀資料 */
  reload: () => Promise<unknown>
}

const demoSuffix = (demo: boolean) => (demo ? '（示範模式，重新整理後會還原）' : '')
const errorText = (cause: unknown, fallback: string) => (cause instanceof Error ? `${fallback}：${cause.message}` : `${fallback}。`)

/** 採購籃共用狀態：比較頁與選購清單頁都用（B23.3） */
export function useBasket({ items, setItems, groups, links, setToast, reload }: UseBasketInput) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const basket = useMemo(() => buildBasket(items, groups, links), [items, groups, links])

  useEffect(() => {
    let active = true
    fetchShoppingTarget().then((value) => { if (active) setTarget(value) }).catch(() => undefined)
    return () => { active = false }
  }, [])
  // 籃子空了就自動收起
  const isOpen = open && basket.kinds > 0

  const patchItem = (id: string, patch: Partial<WishlistItem>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  /** 按「放進採購籃／確定」才寫入（B28）：狀態改準備購買、明細換成這份 */
  async function putInBasket(item: WishlistItem, lines: BuyLine[], { quiet = false }: { quiet?: boolean } = {}) {
    const wasReady = item.status === 'ready'
    patchItem(item.id, { status: 'ready', buyLines: lines })
    try {
      const { demo } = await saveWishlistBasket(item.id, lines)
      if (!quiet) setToast({ tone: 'success', text: `${wasReady ? '已更新' : '已放進採購籃：'}「${item.name}」${buyQty(lines)} 件${demoSuffix(demo)}` })
      return true
    } catch (cause) {
      setToast({ tone: 'error', text: errorText(cause, '採購籃沒有儲存') })
      await reload()
      return false
    }
  }

  /** 摘要上的「移出」：清空明細、狀態改回考慮中（或指定的狀態），跳 5 秒「已移出・復原」 */
  async function takeOutOfBasket(item: WishlistItem, status: 'considering' | 'dropped' = 'considering') {
    const previous = effectiveBuyLines(item)
    patchItem(item.id, { status, buyLines: [] })
    try {
      const { demo } = await saveWishlistBasket(item.id, null, status)
      setToast({
        tone: 'success',
        text: `已移出「${item.name}」${status === 'dropped' ? '，改為已放棄' : ''}${demoSuffix(demo)}`,
        action: { label: '復原', onClick: () => void putInBasket({ ...item, status }, previous, { quiet: true }) },
      })
    } catch (cause) {
      setToast({ tone: 'error', text: errorText(cause, '沒有移出採購籃') })
      await reload()
    }
  }

  async function changeTarget(value: number | null) {
    const previous = target
    setTarget(value)
    try {
      await saveShoppingTarget(value)
    } catch (cause) {
      setTarget(previous)
      setToast({ tone: 'error', text: errorText(cause, '目標金額沒有儲存') })
    }
  }

  async function markBought({ purchaseDate, rows }: { purchaseDate: string; rows: BasketRow[] }) {
    setSaving(true)
    let created = 0
    let demo = false
    const done: string[] = []
    try {
      for (const row of rows) {
        const result = await markWishlistBought(row.item.id, { purchaseDate, paidPrice: null, lines: row.lines })
        created += result.itemIds.length
        demo = result.demo
        done.push(row.item.name)
      }
      setToast({ tone: 'success', text: `已移到已購買：${done.length} 款、建立 ${created} 件衣物${demoSuffix(demo)}` })
    } catch (cause) {
      setToast({ tone: 'error', text: `${done.length ? `已完成 ${done.length} 款，` : ''}${errorText(cause, '其餘沒有移到已購買')}` })
    } finally {
      setSaving(false)
      await reload()
    }
  }

  return { basket, open: isOpen, setOpen, target, saving, putInBasket, takeOutOfBasket, changeTarget, markBought }
}

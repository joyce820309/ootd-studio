import { Link } from 'react-router-dom'
import { ItemTile } from '@/components/closet/ItemTile'
import { ProfileAvatarLink } from '@/components/layout/ProfileAvatarLink'
import { Icon } from '@/components/ui/Icon'
import { ButtonLink } from '@/components/ui/Button'
import { LogoSticker, PaperCard, Tape, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { LoadingState, PageState } from '@/components/ui/PageState'
import { fetchClosetItems, useAsync } from '@/lib/data'
import { APP_VERSION } from '@/lib/version'

const dateLabel = () =>
  new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

export function HomePage() {
  const { data: items, loading, error } = useAsync(fetchClosetItems)
  return (
    <>
    {/* 手機頂部（B-M-Home）：頭像進入「我的」 */}
    <header className="flex items-center border-b-[1.5px] border-dashed border-line-strong bg-paper py-2.5 pl-4 pr-2 md:hidden">
      <LogoSticker size="sm" />
      <button type="button" aria-label="通知" className="ml-auto flex size-11 items-center justify-center rounded-btn text-ink-2"><Icon name="bell" /></button>
      <ProfileAvatarLink />
    </header>
    <main className="mx-auto flex max-w-[1200px] flex-col gap-10 px-[clamp(16px,4vw,48px)] pt-10 pb-16">
      <section className="flex flex-wrap items-stretch gap-8">
        <div className="flex flex-[1_1_380px] flex-col justify-center gap-4">
          <span className="font-num text-xs font-bold tracking-[0.16em] text-ink-3">{dateLabel()}</span>
          <h1 className="m-0 font-hd text-[clamp(32px,4vw,46px)] leading-tight">今天想穿什麼？</h1>
          <div className="flex flex-wrap gap-2.5">
            <ButtonLink to="/outfit" variant="primary" size="lg">
              開始今日搭配
            </ButtonLink>
            <ButtonLink to="/closet/new" variant="oat" size="lg">
              新增衣物
            </ButtonLink>
          </div>
        </div>
        <PaperCard className="relative flex flex-[1_1_380px] flex-col gap-3 p-5">
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-card">
            <WashBlob accent="rose" className="-right-10 -bottom-10 size-40" />
          </span>
          <Tape accent="mist" className="z-20" />
          <span className="relative z-10 font-hd text-xl">網拍還在猶豫？</span>
          <p className="relative z-10 m-0 text-sm leading-relaxed text-ink-2">
            把不同網站的類似商品放進比較試搭台，並排比價，再和衣櫃裡的衣服混搭看看。
          </p>
          <ButtonLink to="/wishlist/compare" variant="secondary" className="relative z-10 self-start">
            打開比較試搭台
          </ButtonLink>
        </PaperCard>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <TiltLabel accent="oat" as="h2">最近新增</TiltLabel>
          <Link to="/closet" className="text-sm">
            看全部衣物
          </Link>
        </div>
        {loading && <LoadingState label="正在準備最近新增的衣物…" rows={2} />}
        {error && <PageState icon="alert" tone="rose" compact title="衣物暫時載入失敗" description="首頁資料沒有讀取成功，可以重新載入再試。" action={<ButtonLink to="/home" variant="secondary" onClick={(event) => { event.preventDefault(); window.location.reload() }}>重新載入</ButtonLink>} />}
        {items && items.length === 0 && <PageState icon="closet" tone="oat" compact title="衣櫃還是空的" description="新增幾件常穿的衣物，就能從今天的搭配開始。" action={<ButtonLink to="/closet/new" variant="primary">加入第一件衣物</ButtonLink>} />}
        {items && items.length > 0 && <div className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
          {items.slice(0, 6).map((item) => <ItemTile key={item.id} item={item} />)}
        </div>}
      </section>
      <footer className="home-page__version flex justify-end border-t border-dashed border-line-strong pt-3 text-xs text-ink-3">
        版本 {APP_VERSION}
      </footer>
    </main>
    </>
  )
}

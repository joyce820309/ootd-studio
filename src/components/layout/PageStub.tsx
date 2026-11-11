import { ButtonLink } from '@/components/ui/Button'
import { PaperCard, TiltLabel, WashBlob } from '@/components/ui/Paper'

type Accent = 'oat' | 'mist' | 'rose' | 'sage'

/** 尚未實作的頁面：說明會有什麼，並引導到已完成的功能。 */
export function PageStub({ title, accent = 'oat', items }: { title: string; accent?: Accent; items: string[] }) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-[clamp(16px,4vw,48px)] pt-9 pb-14">
      <TiltLabel accent={accent} as="h1">
        {title}
      </TiltLabel>
      <PaperCard className="relative overflow-hidden p-6">
        <WashBlob accent={accent} className="-top-8 -right-8 size-[130px]" tilt={14} />
        <p className="relative m-0 text-[15px] leading-relaxed text-ink-2">這一頁還在製作中，設計稿已經完成，接下來會有：</p>
        <ul className="relative mt-3 mb-5 flex flex-col gap-1.5 pl-5 text-sm leading-relaxed">
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <ButtonLink to="/outfit" variant="oat" className="relative">
          先去今日搭配
        </ButtonLink>
      </PaperCard>
    </main>
  )
}

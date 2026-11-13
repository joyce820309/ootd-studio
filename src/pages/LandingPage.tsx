import { Link } from 'react-router-dom'
import { OutfitBoard } from '@/components/outfit/OutfitBoard'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LogoSticker, PaperCard, Tape, TiltLabel, WashBlob } from '@/components/ui/Paper'

const FEATURES = [
  { n: '01', t: '整理衣櫃', d: '拍一張照，自動去背。依分類、顏色、季節和狀態整理，送洗或借出也記得清清楚楚。', accent: 'oat' as const, deep: 'text-oat-deep' },
  { n: '02', t: '今日搭配', d: '依部位勾選單品，系統自動排好版：上衣在上、下身在中、鞋子在下。', accent: 'sage' as const, deep: 'text-sage-deep' },
  { n: '03', t: '比較試搭台', d: '把不同網站的候選並排比價、比材質、比可搭件數，再和衣櫃混搭，想清楚再下單。', accent: 'rose' as const, deep: 'text-rose-deep', main: true },
]

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-dashed border-line-strong px-[clamp(16px,4vw,56px)] py-4">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <LogoSticker />
          <span className="hidden font-num text-[10px] font-bold tracking-[0.2em] text-ink-3 sm:inline">OOTD STUDIO</span>
        </Link>
        <ButtonLink to="/login" variant="primary" className="ml-auto">
          登入
        </ButtonLink>
      </header>

      <main>
        <section className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-14 px-[clamp(16px,4vw,56px)] py-[clamp(40px,7vw,72px)]">
          <div className="flex flex-[1_1_420px] flex-col gap-5">
            <span className="font-num text-xs font-bold tracking-[0.18em] text-ink-3 uppercase">Your private styling studio</span>
            <h1 className="m-0 font-hd text-[clamp(38px,5vw,58px)] leading-tight">
              把衣櫃
              <br />
              收進手帳裡。
            </h1>
            <p className="m-0 max-w-[520px] text-[17px] leading-loose text-ink-2">
              記下每一件衣服，勾一勾就排好今天的穿搭；網拍猶豫時，把不同網站的候選並排比較，再和衣櫃裡的衣服混搭看看。
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/login" variant="primary" size="lg">
                登入我的衣櫃
              </ButtonLink>
              <a href="#features" className="inline-flex h-[50px] items-center rounded-btn border-[1.5px] border-line-strong bg-card px-[22px] text-[15px] font-medium text-ink no-underline">
                看看怎麼用
              </a>
            </div>
            <span className="flex items-center gap-2 text-[13px] text-ink-2">
              <Icon name="lock" size={16} />
              私人空間・僅限受邀帳號登入
            </span>
          </div>
          <div aria-hidden="true" className="relative h-[460px] flex-[1_1_440px]">
            <WashBlob accent="oat" className="top-[6%] left-[4%] h-[62%] w-[56%]" tilt={-5} />
            <WashBlob accent="mist" className="top-0 left-[40%] h-[52%] w-[52%]" tilt={4} />
            <WashBlob accent="rose" className="top-[46%] left-[30%] h-1/2 w-[60%]" tilt={-3} />
            <PaperCard className="absolute top-[8%] left-[10%] w-[62%] p-3.5" style={{ rotate: '-2deg' }}>
              <Tape accent="mist" />
              <OutfitBoard
                compact
                template="full"
                className="h-[280px]"
                pieces={{
                  outer: { name: '炭灰短版西裝外套', colorHex: '#3D3D3B', shape: 'coat' },
                  top: { name: '燕麥色針織衫', colorHex: '#D9CBB3', shape: 'knit' },
                  bottom: { name: '淺藍直筒牛仔褲', colorHex: '#8FA3BC', shape: 'pants' },
                  shoes: { name: '黑色皮革短靴', colorHex: '#2A2826', shape: 'boot' },
                  bag: { name: '焦糖托特包', colorHex: '#9A6B43', shape: 'bag' },
                  acc: { name: '灰色羊毛圍巾', colorHex: '#9A9893', shape: 'scarf' },
                }}
              />
            </PaperCard>
            <span className="absolute bottom-[4%] left-[4%]">
              <TiltLabel accent="rose" tilt={-2}>今天想穿什麼？</TiltLabel>
            </span>
          </div>
        </section>

        <section id="features" className="bg-apricot px-[clamp(16px,4vw,56px)] py-[72px]">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-9">
            <div className="flex flex-col items-start gap-3">
              <TiltLabel accent="oat">三件事</TiltLabel>
              <h2 className="m-0 font-hd text-[clamp(28px,3.4vw,38px)]">整理、搭配、想清楚再買</h2>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-5">
              {FEATURES.map((f) => (
                <PaperCard key={f.n} className={`relative flex flex-col gap-3.5 overflow-hidden p-6 ${f.main ? 'outline-2 -outline-offset-2 outline-solid outline-ink' : ''}`}>
                  <WashBlob accent={f.accent} className="-top-8 -right-8 size-[130px]" tilt={14} />
                  <span className={`relative font-num text-sm font-bold ${f.deep}`}>{f.n}</span>
                  <h3 className="relative m-0 font-hd text-2xl">{f.t}</h3>
                  <p className="relative m-0 text-[15px] leading-loose text-ink-2">{f.d}</p>
                  {f.main && <span className="relative self-start rounded-full bg-rose-deep px-2.5 py-1 text-xs text-white">最常用</span>}
                </PaperCard>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 px-6 py-[72px] text-center">
          <h2 className="m-0 font-hd text-[clamp(30px,3.6vw,40px)]">今天想穿什麼？</h2>
          <ButtonLink to="/login" variant="primary" size="lg">
            登入我的衣櫃
          </ButtonLink>
        </section>
      </main>

      <footer className="flex flex-wrap justify-between gap-3 border-t-[1.5px] border-dashed border-line-strong px-[clamp(16px,4vw,56px)] py-6 text-[13px] text-ink-2">
        <span>© 2026 My Closet・延續 2021 年的 OOTD 專案</span>
        <span>私人使用・不開放註冊</span>
      </footer>
    </div>
  )
}

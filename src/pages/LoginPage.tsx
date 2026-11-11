import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { LogoSticker, TiltLabel, WashBlob } from '@/components/ui/Paper'
import { useAuth } from '@/lib/auth'
import { isDemoMode, supabase } from '@/lib/supabase'

type Mode = 'password' | 'magic' | 'sent'

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/home'

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('請輸入 Email。')
      return
    }
    if (isDemoMode || !supabase) {
      navigate(from)
      return
    }
    setBusy(true)
    try {
      if (mode === 'password') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        navigate(from, { replace: true })
      } else {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${from}` },
        })
        if (err) throw err
        setMode('sent')
      }
    } catch {
      setError(mode === 'password' ? 'Email 或密碼不太對，再試一次，或改用登入連結。' : '登入連結寄送失敗，確認 Email 是否正確。')
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle() {
    if (!supabase) return navigate(from)
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${from}` } })
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      aria-pressed={mode === m}
      onClick={() => {
        setMode(m)
        setError(null)
      }}
      className={`h-[42px] rounded-btn text-sm font-medium text-ink ${mode === m ? 'bg-card shadow-sticker' : 'bg-transparent'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex min-h-dvh flex-wrap bg-paper">
      <aside aria-hidden="true" className="relative flex min-h-[260px] flex-[1_1_480px] flex-col justify-end overflow-hidden bg-apricot p-12 max-md:min-h-[200px] max-md:p-6">
        <WashBlob accent="oat" className="top-[10%] left-[8%] h-[40%] w-[44%]" tilt={-6} />
        <WashBlob accent="mist" className="top-[4%] left-[40%] h-[36%] w-[46%]" tilt={5} />
        <WashBlob accent="rose" className="top-[34%] left-[28%] h-[34%] w-[52%]" tilt={-3} />
        <WashBlob accent="sage" className="top-[46%] left-[10%] h-[22%] w-[30%]" tilt={7} />
        <div className="relative flex max-w-[440px] flex-col gap-3 max-md:hidden">
          <TiltLabel accent="rose">歡迎回來</TiltLabel>
          <p className="m-0 font-hd text-3xl leading-snug font-bold">
            你的衣櫃一直都在這裡，
            <br />
            慢慢來，今天也穿得開心。
          </p>
        </div>
      </aside>

      <main className="flex flex-[1_1_440px] items-center justify-center px-[clamp(16px,4vw,56px)] py-12">
        <div className="flex w-full max-w-[420px] flex-col gap-6">
          <Link to="/" className="self-start no-underline">
            <LogoSticker />
          </Link>

          {mode === 'sent' ? (
            <div role="status" className="relative flex flex-col gap-3.5 overflow-hidden rounded-[18px] bg-sage-soft p-7 text-sage-ink">
              <WashBlob accent="oat" className="-top-8 -right-8 size-[120px]" tilt={12} />
              <span className="relative flex size-[52px] items-center justify-center rounded-[16px] bg-card" style={{ rotate: '-4deg' }}>
                <Icon name="mail" size={26} />
              </span>
              <h1 className="relative m-0 font-hd text-[28px] font-bold">去信箱看看吧</h1>
              <p className="relative m-0 text-sm leading-relaxed">
                登入連結已寄到 <b className="font-medium">{email}</b>。沒收到的話，看一下垃圾郵件匣。
              </p>
              <button type="button" onClick={() => setMode('magic')} className="relative self-start bg-transparent p-0 text-[13px] text-sage-ink underline">
                換一個 Email
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <h1 className="m-0 font-hd text-[32px] font-bold">登入你的衣櫃</h1>
                <span className="text-sm text-ink-2">私人空間，僅限受邀帳號。</span>
              </div>

              <Button variant="secondary" size="lg" className="w-full" onClick={signInWithGoogle}>
                <GoogleMark />
                使用 Google 帳號登入
              </Button>

              <div className="flex items-center gap-3 text-xs text-ink-2">
                <span className="flex-1 border-t-[1.5px] border-dashed border-line-strong" />
                或用 Email
                <span className="flex-1 border-t-[1.5px] border-dashed border-line-strong" />
              </div>

              <div role="group" aria-label="登入方式" className="grid grid-cols-2 rounded-tile bg-tile p-[3px]">
                {tab('password', '密碼')}
                {tab('magic', '登入連結（免密碼）')}
              </div>

              {error && (
                <div role="alert" id="login-error" className="flex items-start gap-2.5 rounded-tile border-[1.5px] border-rose bg-rose-soft px-3.5 py-3 text-[13px] leading-relaxed text-rose-ink">
                  <Icon name="alert" size={18} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-[13px] font-medium">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    aria-describedby={error ? 'login-error' : undefined}
                    className="h-[50px] w-full rounded-tile border-[1.5px] border-line-strong bg-paper px-3.5 text-[15px] text-ink"
                  />
                </div>
                {mode === 'password' ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between">
                        <label htmlFor="password" className="text-[13px] font-medium">
                          密碼
                        </label>
                        <button type="button" onClick={() => setMode('magic')} className="bg-transparent p-0 text-[13px] text-mist-deep underline">
                          忘記密碼？
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPw ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          aria-invalid={!!error}
                          className={`h-[50px] w-full rounded-tile border-[1.5px] bg-paper pr-[52px] pl-3.5 text-[15px] text-ink ${error ? 'border-rose-deep' : 'border-line-strong'}`}
                        />
                        <button
                          type="button"
                          aria-label={showPw ? '隱藏密碼' : '顯示密碼'}
                          onClick={() => setShowPw((v) => !v)}
                          className="absolute top-[3px] right-1 flex size-11 items-center justify-center bg-transparent text-ink-2"
                        >
                          <Icon name="eye" />
                        </button>
                      </div>
                    </div>
                    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                      {busy ? '登入中…' : '登入'}
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] leading-relaxed text-ink-2">我們會寄一封信到這個信箱，點信裡的連結就能登入，不用記密碼。</span>
                    <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
                      {busy ? '寄送中…' : '寄送登入連結'}
                    </Button>
                  </>
                )}
              </form>
            </div>
          )}

          <span className="text-xs leading-relaxed text-ink-2">
            這是私人衣櫃，不開放註冊。{isDemoMode && '目前為示範模式，任何 Email 都能進入。'}
          </span>
        </div>
      </main>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
      <path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" />
      <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6z" fill="#FBBC05" />
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 6 12 6z" fill="#EA4335" />
    </svg>
  )
}

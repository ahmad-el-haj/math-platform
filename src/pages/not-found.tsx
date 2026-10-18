import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { buttonStyles } from '@/components/ui/button'
import { Logo } from '@/components/brand/logo'

export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="noise-overlay" aria-hidden="true" />

      <Link to="/" aria-label="العودة إلى الصفحة الرئيسية">
        <Logo size={34} />
      </Link>

      <div className="mt-10 max-w-md">
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-gold-soft text-gold">
          <Compass className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-6 font-serif text-5xl text-gold">404</h1>
        <h2 className="mt-3 text-xl font-bold text-ink">الصفحة غير موجودة</h2>
        <p className="mt-3 text-sm leading-[1.9] text-ink-2">
          ربما تغيّر الرابط أو حُذفت الصفحة التي تحاول الوصول إليها. يمكنك
          العودة إلى الصفحة الرئيسية ومتابعة التصفّح.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className={buttonStyles('primary', 'md')}>
            الصفحة الرئيسية
          </Link>
          <Link to="/app" className={buttonStyles('secondary', 'md')}>
            لوحة التحكم
          </Link>
        </div>
      </div>
    </div>
  )
}

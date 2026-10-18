import { Link } from 'react-router-dom'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/hooks/use-auth'
import { Logo } from '@/components/brand/logo'
import { Hero } from '@/components/marketing/hero'
import { FeatureGrid, HowItWorks, TeacherSection } from '@/components/marketing/sections'
import { MarketingFooter } from '@/components/marketing/footer'
import { buttonStyles } from '@/components/ui/button'
import { LANDING_NAV } from '@/config/navigation'

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const { status, role } = useAuth()

  const appPath = role === 'teacher' ? '/app/teacher' : '/app/student'

  return (
    <div className="relative min-h-dvh">
      <div className="noise-overlay" aria-hidden="true" />

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link to="/" aria-label="رِواق — الصفحة الرئيسية">
            <Logo size={32} />
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="أقسام الصفحة">
            {LANDING_NAV.map((item) => (
              <a
                key={item.to}
                href={item.to}
                className="text-sm text-ink-2 transition-colors hover:text-gold"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl p-2.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={theme === 'midnight' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            >
              {theme === 'midnight' ? (
                <Sun className="size-[18px]" aria-hidden="true" />
              ) : (
                <Moon className="size-[18px]" aria-hidden="true" />
              )}
            </button>

            {status === 'authenticated' ? (
              <Link to={appPath} className={buttonStyles('primary', 'sm')}>
                لوحة التحكم
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <>
                <Link to="/login" className={buttonStyles('ghost', 'sm')}>
                  دخول
                </Link>
                <Link to="/register" className={buttonStyles('primary', 'sm')}>
                  حساب طالب
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative">
        <Hero />
        <FeatureGrid />
        <HowItWorks />
        <TeacherSection />
      </main>

      <MarketingFooter />
    </div>
  )
}

import { Link } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'
import { LANDING_NAV } from '@/config/navigation'

export function MarketingFooter() {
  return (
    <footer className="border-t border-line bg-surface/30">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Logo size={32} />
          <p className="mt-4 text-sm leading-[1.9] text-ink-2">
            منصة رياضيات تعليمية عربية. تُدار بالكامل من لوحة المعلّم،
            وتحرم خصوصية الطلاب بانفتاح كامل.
          </p>
        </div>

        <nav aria-label="روابط الموقع" className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-ink">روابط</p>
          {LANDING_NAV.map((item) => (
            <a
              key={item.to}
              href={item.to}
              className="text-sm text-ink-2 transition-colors hover:text-gold"
            >
              {item.label}
            </a>
          ))}
          <Link to="/login" className="text-sm text-ink-2 transition-colors hover:text-gold">
            تسجيل الدخول
          </Link>
          <Link to="/register" className="text-sm text-ink-2 transition-colors hover:text-gold">
            إنشاء حساب طالب
          </Link>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-ink-3 sm:flex-row sm:px-8">
          <p>© {new Date().getFullYear()} رِواق — منصة الرياضيات التعليمية.</p>
          <p>مبنية على Supabase وReact.</p>
        </div>
      </div>
    </footer>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { MathMotif } from '@/components/marketing/math-motif'

export type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * Two column layout for the authentication pages: the form on the inline
 * start side and a quiet mathematical panel on the end side. On small
 * screens the panel is dropped so the form gets the full width.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1fr_0.85fr]">
      <div className="noise-overlay" aria-hidden="true" />

      <div className="relative flex flex-col px-5 py-8 sm:px-8 lg:px-14">
        <Link to="/" className="inline-flex w-fit" aria-label="العودة إلى الصفحة الرئيسية">
          <Logo size={32} />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
            <p className="mt-2.5 text-sm leading-relaxed text-ink-2">{subtitle}</p>

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-7 text-sm text-ink-2">{footer}</div> : null}
          </div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-s border-line bg-surface/40 lg:block">
        <div className="math-grid absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-center px-14 py-16">
          <div className="surface-card overflow-hidden rounded-3xl p-1.5">
            <div className="overflow-hidden rounded-[1.35rem] bg-[#060b1a]/50">
              <MathMotif />
            </div>
          </div>

          <blockquote className="mt-10">
            <p className="font-serif text-2xl leading-[1.7] text-ink">
              «الرياضيات ليست أرقامًا فقط، بل طريقة في التفكير.»
            </p>
            <footer className="mt-4 flex items-center gap-2 text-sm text-ink-3">
              <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
              <span>من فلسفة التعليم</span>
            </footer>
          </blockquote>

          <a
            href="/"
            className="mt-10 inline-flex w-fit items-center gap-2 text-sm text-ink-2 transition-colors hover:text-gold"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
            العودة إلى الصفحة الرئيسية
          </a>
        </div>
      </aside>
    </div>
  )
}

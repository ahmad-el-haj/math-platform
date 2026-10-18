import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpenCheck, MessageCircle, Sparkles } from 'lucide-react'
import { MathMotif } from '@/components/marketing/math-motif'
import { buttonStyles } from '@/components/ui/button'

const EQUATIONS = [
  { text: 'a² + b² = c²', tone: 'gold' },
  { text: '∑ n = 1…∞', tone: 'neutral' },
  { text: 'f(x) = 2x + 3', tone: 'neutral' },
  { text: '∫ f(x) dx', tone: 'info' },
] as const

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="math-grid pointer-events-none absolute inset-0 -z-10" aria-hidden="true" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-28">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold-soft px-3.5 py-1.5 text-xs font-semibold text-gold">
            <Sparkles className="size-3.5" aria-hidden="true" />
            منصة تعليمية عربية مصمَّمة للمعلّم والطالب
          </span>

          <h1 className="mt-6 text-[2.15rem] font-bold leading-[1.22] text-ink sm:text-5xl lg:text-[3.4rem]">
            رياضياتٌ تُفهَم،
            <br />
            <span className="text-gold-gradient">لا تُحفظ.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-[1.9] text-ink-2 sm:text-lg">
            منصة تجمع صفوفك ودروسك وموادك التعليمية في مكان واحد، وتمنح طلابك
            공간ًا خاصًا للتساؤل. كل ما تحتاجه لتُدرّس بوضوح — بلا تعديلات
            برمجية، وبلا استيراد ملفات إلى خدمات خارجية.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register" className={buttonStyles('primary', 'lg')}>
              ابدأ كطالب
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/login" className={buttonStyles('outline', 'lg')}>
              تسجيل الدخول
            </Link>
          </div>

          <ul className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-ink-3">
            <li className="flex items-center gap-2">
              <BookOpenCheck className="size-4 text-gold" aria-hidden="true" />
              صفوف ودروس تُنشر فورًا
            </li>
            <li className="flex items-center gap-2">
              <MessageCircle className="size-4 text-gold" aria-hidden="true" />
              رسائل خاصة بين المعلم والطالب
            </li>
          </ul>
        </div>

        <div className="animate-fade relative" style={{ animationDelay: '120ms' }}>
          <div className="surface-card relative overflow-hidden rounded-3xl p-1.5">
            <div className="relative overflow-hidden rounded-[1.35rem] bg-[#060b1a]/60">
              <MathMotif className="h-auto w-full" />
            </div>

            <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
              {EQUATIONS.map((equation) => (
                <span
                  key={equation.text}
                  className="rounded-lg border border-line bg-[#060b1a]/80 px-3 py-1.5 font-serif text-sm text-ink-2 backdrop-blur-sm"
                  dir="ltr"
                >
                  {equation.text}
                </span>
              ))}
            </div>
          </div>

          <div
            className="absolute -top-4 -start-4 hidden rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-lift)] sm:block"
            aria-hidden="true"
          >
            <p className="text-[11px] text-ink-3">متوسّط التحسّن</p>
            <p className="font-serif text-xl text-gold">+27%</p>
          </div>
        </div>
      </div>
    </section>
  )
}

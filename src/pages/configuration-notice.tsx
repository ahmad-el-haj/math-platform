import { AlertTriangle, ExternalLink, Terminal } from 'lucide-react'
import { missingConfig } from '@/config/env'
import { Logo } from '@/components/brand/logo'

/**
 * Shown when the public environment variables are missing.
 *
 * The application never crashes in that situation — it explains exactly which
 * values have to be supplied and where to get them.
 */
export default function ConfigurationNoticePage() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="noise-overlay" aria-hidden="true" />

      <div className="surface-card w-full max-w-2xl p-7 sm:p-9">
        <Logo size={34} />

        <span className="mt-8 flex size-12 items-center justify-center rounded-2xl bg-warning/12 text-warning">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>

        <h1 className="mt-5 text-2xl font-bold text-ink">المنصة لم تُهيّأ بعد</h1>
        <p className="mt-3 text-sm leading-[1.9] text-ink-2">
          لربط المنصة بمشروع Supabase الخاص بك، أضف القيم التالية في ملف
          ‎<code className="rounded bg-surface-2 px-1.5 py-0.5 text-[13px] text-gold">.env.local</code>{' '}
          في جذر المشروع، ثم أعد تشغيل خادم التطوير.
        </p>

        <ul className="mt-6 space-y-3">
          {missingConfig.map((item) => (
            <li
              key={item.variable}
              className="rounded-xl border border-line bg-surface-2/50 p-4"
            >
              <code className="block text-sm font-semibold text-gold" dir="ltr">
                {item.variable}
              </code>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{item.hint}</p>
            </li>
          ))}
        </ul>

        <div className="mt-7 rounded-xl border border-line bg-surface-2/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Terminal className="size-4 text-gold" aria-hidden="true" />
            خطوات سريعة
          </p>
          <ol className="mt-3 space-y-2 text-xs leading-relaxed text-ink-2">
            <li>1. أنشئ مشروعًا على supabase.com ثم أنشئ مفتاحًا عامًا من الإعدادات.</li>
            <li>2. انسخ القيم إلى ‎.env.local‎ كما في ملف ‎.env.example‎.</li>
            <li>3. طبّق ترحيلات قاعدة البيانات من مجلد ‎supabase/migrations‎.</li>
            <li>4. أنشئ حساب المعلّم الأول عبر ‎npm run teacher:provision‎.</li>
          </ol>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline"
        >
          افتح لوحة Supabase
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

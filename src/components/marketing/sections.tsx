import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FileText,
  FolderKanban,
  GraduationCap,
  MessagesSquare,
  PenLine,
  ShieldCheck,
} from 'lucide-react'
import { buttonStyles } from '@/components/ui/button'

const FEATURES = [
  {
    icon: FolderKanban,
    title: 'صفوف تُبنى أثناء العمل',
    body: 'أنشئ أي عدد من الصفوف وابدأ من الصفر. الدرجة، العنوان، الترتيب — كل شيء من لوحة المعلّم دون تعديل الكود.',
  },
  {
    icon: PenLine,
    title: 'دروس مرتّبة وقابلة للنشر',
    body: 'رتّب الدروس، حرّر العناوين والأوصاف، وانشر ما ينتهي فقط. وينعكس هذا الترتيب فورًا على واجهة الطالب.',
  },
  {
    icon: FileText,
    title: 'ملفات PDF و DOCX',
    body: 'ارفع أوراق العمل والامتحانات، عاينها داخل المنصة، واسمح للطالب بالتحميل. الملفات مخزّنة بشكل خاص.',
  },
  {
    icon: MessagesSquare,
    title: 'رسائل خاصة لكل طالب',
    body: 'محادثة مستقلة بينك وبين كل طالب. لا يطّلع على رسائل غيره أحد، ويُعلَم الطالب فور وصول رسالة جديدة.',
  },
  {
    icon: ShieldCheck,
    title: 'صلاحيات على مستوى قاعدة البيانات',
    body: 'كل جدول محمي بسياسات Row Level Security. الطالب لا يستطيع تعديل صف أو نشر درس حتى لو عبث بالواجهة.',
  },
  {
    icon: GraduationCap,
    title: 'تجربة عربية كاملة',
    body: 'واجهة من اليمين إلى اليسار، خطوط عربية مقروءة، وتخطيط يعمل على الجوال واللوحي والحاسوب.',
  },
] as const

const STEPS = [
  {
    title: 'أنشئ حسابك',
    body: 'الطالب يسجّل بنفسه خلال أقل من دقيقة ويبدأ بتصفّح الصفوف المتاحة.',
  },
  {
    title: 'ينشر المعلّم المحتوى',
    body: 'ينشئ الصفوف والدروس، يرفع الملفات، وينشر ما يراه مناسبًا. تظهر التغييرات فورًا.',
  },
  {
    title: 'يتعلّم الطالب ويسأل',
    body: 'يقرأ الدروس، يحمّل أوراق العمل، ويرسل سؤالًا خاصًا للمعلّم في أي وقت.',
  },
] as const

export function FeatureGrid() {
  return (
    <section id="features" className="relative scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-gold">المزايا</p>
          <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
            كل ما يحتاجه المعلم، في مكان واحد
          </h2>
          <p className="mt-4 text-base leading-[1.9] text-ink-2">
            ليست واجهة تجريبية ولا بيانات وهمية. كل زر في هذه المنصة مرتبط
            بعملية حقيقية على قاعدة البيانات.
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <li key={feature.title} className="surface-card surface-card-interactive p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-gold-soft text-gold">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-[1.85] text-ink-2">{feature.body}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative scroll-mt-20 border-y border-line bg-surface/30 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide text-gold">كيف تعمل</p>
          <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">ثلاث خطوات فقط</h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full border border-gold/35 bg-gold-soft font-serif text-base font-bold text-gold">
                  {index + 1}
                </span>
                {index < STEPS.length - 1 ? (
                  <span
                    className="h-px flex-1 bg-gradient-to-l from-transparent via-line-strong to-transparent"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <h3 className="mt-5 text-lg font-bold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-[1.85] text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function TeacherSection() {
  return (
    <section id="teacher" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="gold-rule mb-8" />
          <p className="text-sm font-semibold tracking-wide text-gold">للمعلّم</p>
          <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
            المنصة تتبعك، لا العكس
          </h2>
          <p className="mt-5 text-base leading-[1.9] text-ink-2">
            لا تطلب من مطوّر تعديل قاعدة بيانات لتضيف صفًّا جديدًا. أنشئ الصف،
            أضف الدروس، ارفع الملفات، انشر — وستظهر لدى طلابك في اليوم نفسه.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              'ترتيب يدوي للدروس والصفوف',
              'نشر أي محتوى أو إخفاؤه في لحظة',
              'معاينة ملفات PDF داخل المنصة وتحميلها',
              'محادثات مستقلة مع كل طالب',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-ink-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <Link to="/login" className={buttonStyles('outline', 'md', 'mt-9')}>
            الدخول إلى لوحة المعلّم
            <ArrowLeft className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="order-1 lg:order-2">
          <div className="surface-card p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-ink">الصف التاسع — جبر</p>
                <p className="mt-1 text-xs text-ink-3">آخر تحديث قبل دقيقة</p>
              </div>
              <span className="rounded-full border border-success/30 bg-success/12 px-3 py-1 text-[11px] font-semibold text-success">
                منشور
              </span>
            </div>

            <ul className="mt-6 space-y-3">
              {[
                { title: 'المعادلات التربيعية', meta: '3 ملفات', done: true },
                { title: 'الدوال الخطية', meta: 'ملفان', done: true },
                { title: 'المتباينات', meta: 'لا ملفات', done: false },
              ].map((lesson) => (
                <li
                  key={lesson.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink">{lesson.title}</span>
                  <span className="text-xs text-ink-3">{lesson.meta}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: 'الطلاب', value: '24' },
                { label: 'الرسائل', value: '3' },
                { label: 'الملفات', value: '11' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-line bg-surface-2/40 p-3 text-center">
                  <p className="font-serif text-xl text-gold">{stat.value}</p>
                  <p className="mt-1 text-[11px] text-ink-3">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

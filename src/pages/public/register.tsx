import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2 } from 'lucide-react'
import { registerSchema, type RegisterInput } from '@/lib/validation'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { toAppError } from '@/lib/errors'

export default function RegisterPage() {
  const { signUp, status, role } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      gradeLevel: '',
    },
  })

  const passwordValue = useWatch({ control, name: 'password' })

  if (status === 'authenticated') {
    return <Navigate to={role === 'teacher' ? '/app/teacher' : '/app/student'} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      const result = await signUp({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        gradeLevel: values.gradeLevel,
      })

      if (result.needsEmailConfirmation) {
        setAwaitingConfirmation(true)
        return
      }

      toast.success('أهلًا بك في رِواق', 'تم إنشاء حسابك بنجاح.')
      navigate('/app/student', { replace: true })
    } catch (error) {
      const appError = toAppError(error, 'auth')
      setFormError(appError.message)
    }
  })

  if (awaitingConfirmation) {
    return (
      <AuthLayout
        title="تحقّق من بريدك"
        subtitle="أرسلنا إليك رسالة تحتوي على رابط التأكيد. افتح الرابط لتفعيل حسابك ثم سجّل الدخول."
      >
        <div className="rounded-2xl border border-success/25 bg-success/8 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden="true" />
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            تفرض بعض إعدادات المشروع تأكيد البريد قبل تفعيل الحساب. إن كان حسابك
            مُفعّلًا بالفعل، فسجّل الدخول مباشرة.
          </p>
          <Link to="/login" className="mt-5 inline-block">
            <Button variant="outline">الانتقال إلى تسجيل الدخول</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="إنشاء حساب طالب"
      subtitle="سجّل مجانًا وابدأ بتصفّح الصفوف والدروس المنشورة."
      footer={
        <p>
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="font-semibold text-gold hover:underline">
            سجّل الدخول
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {formError ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {formError}
          </div>
        ) : null}

        <Input
          label="الاسم الكامل"
          autoComplete="name"
          placeholder="مثال: ليان أحمد"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <Input
          label="البريد الإلكتروني"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          placeholder="name@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="الصف الدراسي (اختياري)"
          placeholder="مثال: الصف التاسع"
          error={errors.gradeLevel?.message}
          {...register('gradeLevel')}
        />

        <Input
          label="كلمة المرور"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          placeholder="8 أحرف على الأقل"
          hint="ثمانية أحرف على الأقل، وتحتوي على حرف ورقم."
          error={errors.password?.message}
          {...register('password')}
        />

        {passwordValue && passwordValue.length > 0 && !errors.password ? (
          <PasswordStrength value={passwordValue} />
        ) : null}

        <Input
          label="تأكيد كلمة المرور"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          placeholder="••••••••"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'جارٍ إنشاء الحساب…' : 'إنشاء الحساب'}
        </Button>

        <p className="text-xs leading-relaxed text-ink-3">
          الحسابات الجديدة تحصل على صلاحية «طالب» تلقائيًا. صلاحيات المعلّم
          تُمنح من طرف مالك المنصة عبر أداة provisioning منفصلة.
        </p>
      </form>
    </AuthLayout>
  )
}

function PasswordStrength({ value }: { value: string }) {
  const score = [value.length >= 8, /[A-Za-z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length
  const labels = ['ضعيفة جدًا', 'ضعيفة', 'متوسطة', 'جيدة', 'قوية']
  const tones = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-gold', 'bg-success']

  return (
    <div className="-mt-2">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index < score ? tones[score] : 'bg-surface-3'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-3">
        قوة كلمة المرور: <span className="text-ink-2">{labels[score]}</span>
      </p>
    </div>
  )
}

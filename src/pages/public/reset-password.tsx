import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { resetPasswordSchema, type ResetPasswordInput } from '@/lib/validation'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { toAppError } from '@/lib/errors'

export default function ResetPasswordPage() {
  const { updatePassword, status } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)

  // Supabase exchanges the recovery token for a session when the page loads.
  // Give the client a moment to finish that exchange before validating.
  useEffect(() => {
    // A zero delay when the session is already restored, otherwise give the
    // client a moment to finish exchanging the recovery token.
    const delay = status === 'authenticated' ? 0 : 1200
    const timer = window.setTimeout(() => setRecoveryReady(true), delay)
    return () => window.clearTimeout(timer)
  }, [status])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await updatePassword(values.password)
      toast.success('تم تحديث كلمة المرور', 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.')
      navigate('/login', { replace: true })
    } catch (error) {
      setFormError(toAppError(error, 'auth').message)
    }
  })

  return (
    <AuthLayout
      title="تعيين كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية لا تقلّ عن ثمانية أحرف."
      footer={
        <p>
          <Link to="/login" className="font-semibold text-gold hover:underline">
            العودة لتسجيل الدخول
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

        {status === 'anonymous' && recoveryReady ? (
          <div
            role="alert"
            className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            لم نعثر على جلسة استعادة صالحة. افتح الرابط من رسالة البريد
            الإلكتروني مباشرة، واطلب رابطًا جديدًا إن انتهت صلاحيته.
          </div>
        ) : null}

        <Input
          label="كلمة المرور الجديدة"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          placeholder="8 أحرف على الأقل"
          hint="ثمانية أحرف على الأقل، وتحتوي على حرف ورقم."
          error={errors.password?.message}
          {...register('password')}
        />

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
          {isSubmitting ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}
        </Button>

        <p className="flex items-center justify-center gap-2 text-xs text-ink-3">
          <KeyRound className="size-3.5" aria-hidden="true" />
          بعد الحفظ سيتم تحويلك إلى صفحة تسجيل الدخول.
        </p>
      </form>
    </AuthLayout>
  )
}

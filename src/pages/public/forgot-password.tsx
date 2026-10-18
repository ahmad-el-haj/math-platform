import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validation'
import { useAuth } from '@/hooks/use-auth'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { toAppError } from '@/lib/errors'

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await sendPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      setFormError(toAppError(error, 'auth').message)
    }
  })

  if (sent) {
    return (
      <AuthLayout
        title="تحقّق من بريدك"
        subtitle="إن كان البريد مسجّلًا لدينا فسيصلك رابط إعادة التعيين خلال دقائق."
      >
        <div className="rounded-2xl border border-success/25 bg-success/8 p-6 text-center">
          <MailCheck className="mx-auto size-10 text-success" aria-hidden="true" />
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            أُرسل الرابط إلى بريدك. إن لم يصلك خلال دقائق، تحقّق من مجلد الرسائل
            غير المرغوبة أو من إعدادات تأكيد البريد في مشروع Supabase.
          </p>
          <Link to="/login" className="mt-5 inline-block">
            <Button variant="outline">العودة لتسجيل الدخول</Button>
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل إليك رابطًا لإعادة تعيين كلمة المرور."
      footer={
        <p>
          تذكّرت كلمة المرور؟{' '}
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

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'جارٍ الإرسال…' : 'إرسال رابط الاستعادة'}
        </Button>
      </form>
    </AuthLayout>
  )
}

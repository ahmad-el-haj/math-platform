import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validation'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { AuthLayout } from '@/components/layout/auth-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { toAppError } from '@/lib/errors'

export default function LoginPage() {
  const { signIn, status, role } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? (role === 'teacher' ? '/app/teacher' : '/app/student')} replace />
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    try {
      await signIn(values.email, values.password)
      toast.success('أهلًا بعودتك', 'تم تسجيل الدخول بنجاح.')
      navigate('/app', { replace: true })
    } catch (error) {
      const appError = toAppError(error, 'auth')
      setFormError(appError.message)
    }
  })

  return (
    <AuthLayout
      title="تسجيل الدخول"
      subtitle="أدخل بيانات حسابك للوصول إلى صفوفك ودروسك ورسائلك."
      footer={
        <p>
          ليس لديك حساب؟{' '}
          <Link to="/register" className="font-semibold text-gold hover:underline">
            أنشئ حساب طالب
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

        <Input
          label="كلمة المرور"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />

        <div className="flex justify-start">
          <Link
            to="/forgot-password"
            className="text-sm text-ink-2 underline-offset-4 transition-colors hover:text-gold hover:underline"
          >
            نسيت كلمة المرور؟
          </Link>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'جارٍ الدخول…' : 'دخول'}
        </Button>
      </form>
    </AuthLayout>
  )
}

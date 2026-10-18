import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { updateOwnProfile } from '@/services/profiles'
import { profileSchema, type ProfileInput } from '@/lib/validation'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toAppError } from '@/lib/errors'
import { displayName } from '@/lib/format'

export default function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: '', gradeLevel: '' },
  })

  useEffect(() => {
    reset({
      fullName: profile?.full_name ?? '',
      gradeLevel: profile?.grade_level ?? '',
    })
  }, [profile, reset])

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    try {
      await updateOwnProfile(user!.id, {
        full_name: values.fullName,
        grade_level: values.gradeLevel,
      })
      await refreshProfile()
      toast.success('تم تحديث ملفك الشخصي')
    } catch (error) {
      toast.error('تعذّر تحديث الملف', toAppError(error, 'validation').message)
    } finally {
      setSaving(false)
    }
  })

  const name = displayName(profile?.full_name, user?.email)

  return (
    <>
      <PageHeader
        title="الملف الشخصي"
        description="حدّث بياناتك الظاهرة للمعلّم. لا يمكن تعديل صلاحياتك من هنا — فهي تُدار من طرف مالك المنصة."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>البيانات الشخصية</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <Input
                label="الاسم الكامل"
                autoComplete="name"
                error={errors.fullName?.message}
                {...register('fullName')}
              />

              <Input
                label="الصف الدراسي"
                placeholder="مثال: الصف التاسع"
                error={errors.gradeLevel?.message}
                {...register('gradeLevel')}
              />

              <div>
                <span className="text-sm font-medium text-ink-2">البريد الإلكتروني</span>
                <p
                  className="mt-1.5 rounded-xl border border-line bg-surface-2/50 px-4 py-2.5 text-sm text-ink-2"
                  dir="ltr"
                >
                  {user?.email}
                </p>
                <p className="mt-1.5 text-xs text-ink-3">
                  تغيير البريد الإلكتروني يتم من إعدادات حساب Supabase.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={saving} disabled={!isDirty}>
                  {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
                </Button>
                {isDirty ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      reset({
                        fullName: profile?.full_name ?? '',
                        gradeLevel: profile?.grade_level ?? '',
                      })
                    }
                  >
                    تراجع
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <Avatar name={name} src={profile?.avatar_url || null} size="lg" />
              <p className="text-base font-bold text-ink">{name}</p>
              <Badge tone={role === 'teacher' ? 'gold' : 'info'}>
                {role === 'teacher' ? 'معلّم' : 'طالب'}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">الصلاحيات محمية</p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                  صلاحيتك محفوظة في قاعدة البيانات ولا يمكن تعديلها من هذه الواجهة.
                  محاولات تغيير الدور تُرفض على مستوى الخادم.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

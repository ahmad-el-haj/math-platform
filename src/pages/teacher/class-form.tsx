import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { classSchema, type ClassInput } from '@/lib/validation'
import { createClass, getClass, updateClass } from '@/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Textarea } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/feedback'
import { toAppError } from '@/lib/errors'

export default function ClassFormPage() {
  const { classId } = useParams()
  const isEditing = Boolean(classId)
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const classQuery = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ClassInput>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      title: '',
      description: '',
      displayOrder: 0,
      isPublished: false,
    },
  })

  useEffect(() => {
    if (!classQuery.data) return
    reset({
      title: classQuery.data.title,
      description: classQuery.data.description,
      displayOrder: classQuery.data.display_order,
      isPublished: classQuery.data.is_published,
    })
  }, [classQuery.data, reset])

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (isEditing) {
        await updateClass(classId!, values)
        toast.success('تم تحديث الصف')
        navigate(`/app/teacher/classes/${classId}`)
      } else {
        const created = await createClass(values, user!.id)
        toast.success('تم إنشاء الصف', 'أضف إليه الدروس الآن.')
        navigate(`/app/teacher/classes/${created.id}`)
      }
    } catch (error) {
      toast.error('تعذّر الحفظ', toAppError(error, 'conflict').message)
    } finally {
      setSaving(false)
    }
  })

  if (isEditing && classQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="mt-8 h-80" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={isEditing ? 'تعديل الصف' : 'إنشاء صف جديد'}
        description={
          isEditing
            ? 'عدّل اسم الصف أو وصفه أو ترتيبه أو حالة نشره.'
            : 'أنشئ صفًا بأي اسم تريد. لن تحتاج إلى تعديل الكود لاحقًا.'
        }
        breadcrumb={{ label: 'الصفوف', to: '/app/teacher/classes' }}
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>بيانات الصف</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <Input
              label="اسم الصف"
              placeholder="مثال: الصف التاسع — جبر"
              error={errors.title?.message}
              {...register('title')}
            />

            <Textarea
              label="الوصف"
              rows={4}
              placeholder="نبذة عن محتوى الصف ومحاوره."
              error={errors.description?.message}
              {...register('description')}
            />

            <Input
              label="ترتيب العرض"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              hint="الأصغر يظهر أولًا في قائمة الصفوف."
              error={errors.displayOrder?.message}
              {...register('displayOrder', { valueAsNumber: true })}
            />

            <Controller
              control={control}
              name="isPublished"
              render={({ field }) => (
                <Checkbox
                  label="نشر الصف للطلاب"
                  description="عند النشر يظهر الصف فورًا في واجهة الطلاب مع دروسه المنشورة."
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={saving}>
                {saving ? 'جارٍ الحفظ…' : isEditing ? 'حفظ التعديلات' : 'إنشاء الصف'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/app/teacher/classes')}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

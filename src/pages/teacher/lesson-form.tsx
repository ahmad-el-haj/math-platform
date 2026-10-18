import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { lessonSchema, type LessonInput } from '@/lib/validation'
import { createLesson, getLesson, updateLesson, type LessonFormInput } from '@/services/lessons'
import { getClass } from '@/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Textarea } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/feedback'
import { toAppError } from '@/lib/errors'

export default function LessonFormPage() {
  const { classId = '', lessonId } = useParams()
  const isEditing = Boolean(lessonId)
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const classQuery = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId),
    enabled: Boolean(classId),
  })

  const lessonQuery = useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => getLesson(lessonId!),
    enabled: isEditing,
  })

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema),
    defaultValues: {
      title: '',
      description: '',
      displayOrder: 0,
      isPublished: false,
    },
  })

  useEffect(() => {
    if (!lessonQuery.data) return
    reset({
      title: lessonQuery.data.title,
      description: lessonQuery.data.description,
      displayOrder: lessonQuery.data.display_order,
      isPublished: lessonQuery.data.is_published,
    })
  }, [lessonQuery.data, reset])

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (isEditing) {
        await updateLesson(lessonId!, values)
        toast.success('تم تحديث الدرس')
        navigate(`/app/teacher/classes/${classId}`)
      } else {
        const payload: LessonFormInput = { ...values, classId }
        await createLesson(payload, user!.id)
        toast.success('تم إنشاء الدرس', 'ارفع الآن المواد التعليمية الخاصة به.')
        navigate(`/app/teacher/classes/${classId}`)
      }
    } catch (error) {
      toast.error('تعذّر الحفظ', toAppError(error, 'conflict').message)
    } finally {
      setSaving(false)
    }
  })

  if (isEditing && lessonQuery.isLoading) {
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
        title={isEditing ? 'تعديل الدرس' : 'درس جديد'}
        description={
          isEditing
            ? 'عدّل عنوان الدرس أو وصفه أو ترتيبه أو حالة نشره.'
            : 'أضف درسًا إلى الصف. يمكنك إرفاق ملفات PDF و DOCX بعد إنشائه.'
        }
        breadcrumb={
          classQuery.data
            ? { label: classQuery.data.title, to: `/app/teacher/classes/${classId}` }
            : { label: 'الصفوف', to: '/app/teacher/classes' }
        }
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>بيانات الدرس</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <Input
              label="عنوان الدرس"
              placeholder="مثال: المعادلات التربيعية"
              error={errors.title?.message}
              {...register('title')}
            />

            <Textarea
              label="الوصف"
              rows={4}
              placeholder="ما الذي سيتعلّمه الطالب في هذا الدرس؟"
              error={errors.description?.message}
              {...register('description')}
            />

            <Input
              label="ترتيب العرض"
              type="number"
              inputMode="numeric"
              min={0}
              max={9999}
              hint="الأصغر يظهر أولًا داخل الصف."
              error={errors.displayOrder?.message}
              {...register('displayOrder', { valueAsNumber: true })}
            />

            <Controller
              control={control}
              name="isPublished"
              render={({ field }) => (
                <Checkbox
                  label="نشر الدرس للطلاب"
                  description="الدرس المنشور يظهر ضمن الصف في واجهة الطلاب."
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
                {saving ? 'جارٍ الحفظ…' : isEditing ? 'حفظ التعديلات' : 'إنشاء الدرس'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}

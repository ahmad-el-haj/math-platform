import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen,
  FileText,
  GraduationCap,
  MessageCircle,
  Plus,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { fetchTeacherStats } from '@/services/stats'
import { listClasses } from '@/services/classes'
import { listConversations } from '@/services/conversations'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, SectionHeading } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { buttonStyles } from '@/components/ui/button'
import { formatRelativeTime, displayName } from '@/lib/format'

export default function TeacherDashboard() {
  const { user, profile } = useAuth()

  const statsQuery = useQuery({
    queryKey: ['stats', 'teacher', user?.id],
    queryFn: () => fetchTeacherStats(user!.id),
    enabled: Boolean(user?.id),
  })

  const classesQuery = useQuery({
    queryKey: ['classes', 'teacher'],
    queryFn: () => listClasses({ includeArchived: true, withLessonCounts: true }),
  })

  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id],
    queryFn: () => listConversations(user!.id),
    enabled: Boolean(user?.id),
  })

  const teacherName = displayName(profile?.full_name, user?.email)
  const classes = classesQuery.data ?? []
  const conversations = conversationsQuery.data ?? []

  return (
    <>
      <PageHeader
        title="أهلاً وسهلاً بالأستاذ وسيم"
        description="أدر صفوفك ودروسك وموادك التعليمية من هنا. كل تعديل يُحفظ في قاعدة البيانات فورًا."
        action={
          <Link to="/app/teacher/classes/new" className={buttonStyles('primary', 'sm')}>
            <Plus className="size-4" aria-hidden="true" />
            صف جديد
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsQuery.isLoading ? (
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)
        ) : statsQuery.isError ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <ErrorState
              description={statsQuery.error.message}
              onRetry={() => void statsQuery.refetch()}
            />
          </div>
        ) : (
          <>
            <StatCard
              icon={<GraduationCap className="size-5" aria-hidden="true" />}
              label="صفوف منشورة"
              value={statsQuery.data?.publishedClasses ?? 0}
              hint={`من ${statsQuery.data?.totalClasses ?? 0} صفًا`}
            />
            <StatCard
              icon={<BookOpen className="size-5" aria-hidden="true" />}
              label="الدروس"
              value={statsQuery.data?.lessons ?? 0}
              hint={`${statsQuery.data?.publishedLessons ?? 0} منشورًا`}
            />
            <StatCard
              icon={<FileText className="size-5" aria-hidden="true" />}
              label="المواد التعليمية"
              value={statsQuery.data?.documents ?? 0}
            />
            <StatCard
              icon={<Users className="size-5" aria-hidden="true" />}
              label="الطلاب المسجّلون"
              value={statsQuery.data?.students ?? 0}
            />
          </>
        )}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeading
            title="الصفوف"
            description="نظرة سريعة على صفوفك وحالة نشرها."
            action={
              <Link to="/app/teacher/classes" className={buttonStyles('ghost', 'sm')}>
                إدارة الصفوف
              </Link>
            }
          />

          <div className="mt-5">
            {classesQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-20" />
                ))}
              </div>
            ) : classesQuery.isError ? (
              <ErrorState
                description={classesQuery.error.message}
                onRetry={() => void classesQuery.refetch()}
              />
            ) : classes.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="size-5" aria-hidden="true" />}
                title="لم تنشئ أي صف بعد"
                description="أنشئ أول صف لك وأضف إليه الدروس والمواد التعليمية. سيظهر لدى الطلاب فور النشر."
                action={
                  <Link to="/app/teacher/classes/new" className={buttonStyles('primary', 'sm')}>
                    <Plus className="size-4" aria-hidden="true" />
                    إنشاء صف
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {classes.slice(0, 6).map((classItem) => (
                  <li key={classItem.id}>
                    <Card interactive>
                      <Link
                        to={`/app/teacher/classes/${classItem.id}`}
                        className="flex items-center gap-4 p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{classItem.title}</p>
                          <p className="mt-1 text-xs text-ink-3">
                            {classItem.lessonCount} درسًا
                          </p>
                        </div>
                        <Badge tone={classItem.is_published ? 'success' : 'neutral'}>
                          {classItem.is_published ? 'منشور' : 'مسودة'}
                        </Badge>
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <SectionHeading
            title="أحدث المحادثات"
            action={
              <Link to="/app/teacher/conversations" className={buttonStyles('ghost', 'sm')}>
                عرض الكل
              </Link>
            }
          />

          <div className="mt-5">
            {conversationsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-16" />
                ))}
              </div>
            ) : conversationsQuery.isError ? (
              <ErrorState
                description={conversationsQuery.error.message}
                onRetry={() => void conversationsQuery.refetch()}
              />
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={<MessageCircle className="size-5" aria-hidden="true" />}
                title="لا توجد محادثات"
                description="ستظهر هنا محادثات الطلاب معك فور وصول أول رسالة."
              />
            ) : (
              <ul className="space-y-3">
                {conversations.slice(0, 5).map((conversation) => (
                  <li key={conversation.id}>
                    <Card interactive>
                      <Link
                        to={`/app/teacher/conversations/${conversation.id}`}
                        className="flex items-center gap-3 p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">
                            {displayName(conversation.peer?.full_name, conversation.peer?.email)}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-3">
                            {formatRelativeTime(conversation.lastMessageAt)}
                          </p>
                        </div>
                        {conversation.unreadCount > 0 ? (
                          <span className="flex min-w-6 items-center justify-center rounded-full bg-gold px-2 py-1 text-[11px] font-bold text-on-gold">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: number
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-serif text-2xl leading-none text-ink">{value}</p>
          <p className="mt-1.5 truncate text-xs text-ink-3">{label}</p>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-ink-3">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

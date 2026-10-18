import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, GraduationCap, MessageCircle } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { fetchStudentStats } from '@/services/stats'
import { listClasses } from '@/services/classes'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, SectionHeading } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { buttonStyles } from '@/components/ui/button'
import { displayName } from '@/lib/format'

export default function StudentDashboard() {
  const { user, profile } = useAuth()

  const statsQuery = useQuery({
    queryKey: ['stats', 'student', user?.id],
    queryFn: () => fetchStudentStats(user!.id),
    enabled: Boolean(user?.id),
  })

  const classesQuery = useQuery({
    queryKey: ['classes', 'student'],
    queryFn: () => listClasses(),
  })

  const firstName = displayName(profile?.full_name, user?.email).split(' ')[0]
  const classes = classesQuery.data ?? []

  return (
    <>
      <PageHeader
        title={`أهلًا ${firstName}`}
        description="هذه مساحتك التعليمية. تصفّح الصفوف المنشورة، واطّلع على الدروس الجديدة، وابعث سؤالك للمعلّم في أي وقت."
        action={
          <Link to="/app/student/messages" className={buttonStyles('secondary', 'sm')}>
            <MessageCircle className="size-4" aria-hidden="true" />
            الرسائل
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsQuery.isLoading
          ? Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))
          : (
              <>
                <StatCard
                  icon={<GraduationCap className="size-5" aria-hidden="true" />}
                  label="الصفوف المنشورة"
                  value={statsQuery.data?.publishedClasses ?? 0}
                />
                <StatCard
                  icon={<BookOpen className="size-5" aria-hidden="true" />}
                  label="الدروس المتاحة"
                  value={statsQuery.data?.lessons ?? 0}
                />
                <StatCard
                  icon={<FileText className="size-5" aria-hidden="true" />}
                  label="المواد التعليمية"
                  value={statsQuery.data?.documents ?? 0}
                />
                <StatCard
                  icon={<MessageCircle className="size-5" aria-hidden="true" />}
                  label="رسائل غير مقروءة"
                  value={statsQuery.data?.unreadMessages ?? 0}
                  tone={statsQuery.data?.unreadMessages ? 'gold' : 'neutral'}
                />
              </>
            )}
      </div>

      <section className="mt-10">
        <SectionHeading
          title="الصفوف المتاحة"
          description="الصفوف التي نشرها المعلم تظهر هنا فور نشرها."
          action={
            <Link to="/app/student/classes" className={buttonStyles('ghost', 'sm')}>
              عرض الكل
            </Link>
          }
        />

        <div className="mt-5">
          {classesQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-40" />
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
              title="لا توجد صفوف منشورة بعد"
              description="لم ينشر المعلم أي صف حتى الآن. ستظهر الصفوف هنا فور نشرها، دون حاجة لتحديث الصفحة."
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {classes.slice(0, 6).map((classItem) => (
                <li key={classItem.id}>
                  <Card interactive className="h-full">
                    <Link to={`/app/student/classes/${classItem.id}`} className="block p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-bold text-ink">{classItem.title}</h3>
                        <Badge tone="success">منشور</Badge>
                      </div>
                      {classItem.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-2">
                          {classItem.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-ink-3">لا يوجد وصف لهذا الصف.</p>
                      )}
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-10">
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-ink">لديك سؤال؟</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              راسل معلّمك مباشرة. محادثتك خاصة بك وحده ولا يطّلع عليها طالب آخر.
            </p>
          </div>
          <Link to="/app/student/messages" className={buttonStyles('primary', 'sm')}>
            <MessageCircle className="size-4" aria-hidden="true" />
            افتح المحادثة
          </Link>
        </Card>
      </section>
    </>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'neutral' | 'gold'
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
        <span
          className={
            tone === 'gold'
              ? 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold'
              : 'flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2'
          }
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-serif text-2xl leading-none text-ink">{value}</p>
          <p className="mt-1.5 truncate text-xs text-ink-3">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

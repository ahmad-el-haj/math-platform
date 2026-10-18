import { Outlet } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import { useUnreadCount } from '@/hooks/use-unread-count'
import { navigationFor } from '@/config/navigation'
import { Logo } from '@/components/brand/logo'
import { UserMenu } from '@/components/layout/user-menu'
import { NavLinks } from '@/components/layout/nav-links'
import { cn } from '@/lib/cn'

export function AppShell() {
  const { role } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const unread = useUnreadCount()
  const items = navigationFor(role)

  return (
    <div className="relative min-h-dvh">
      <div className="noise-overlay" aria-hidden="true" />

      <div className="relative flex min-h-dvh">
        {/* Sidebar — anchored to the inline start edge, which is the right
            hand side in the Arabic layout. */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-surface/60 backdrop-blur-sm lg:flex xl:w-72">
          <div className="px-6 py-6">
            <LinkToBrand />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="التنقّل الرئيسي">
            <NavLinks items={items} unread={unread} />
          </nav>

          <div className="border-t border-line px-6 py-4">
            <p className="text-[11px] leading-relaxed text-ink-3">
              منصة تعليمية تُدار بالكامل من لوحة المعلّم.
            </p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="lg:hidden">
                <LinkToBrand compact />
              </div>

              <div className="hidden min-w-0 lg:block">
                <p className="truncate text-sm text-ink-3">
                  {role === 'teacher'
                    ? 'لوحة المعلّم — أدر الصفوف والدروس والمواد التعليمية.'
                    : 'مساحتك التعليمية — تصفّح الدروس واطرح أسئلتك.'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="rounded-xl p-2.5 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label={theme === 'midnight' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
                >
                  {theme === 'midnight' ? (
                    <Sun className="size-[18px]" aria-hidden="true" />
                  ) : (
                    <Moon className="size-[18px]" aria-hidden="true" />
                  )}
                </button>
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 sm:pt-8 lg:pb-12">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur-md',
          'safe-area-bottom lg:hidden',
        )}
        aria-label="التنقّل السريع"
      >
        <NavLinks items={items} unread={unread} variant="bottom" />
      </nav>
    </div>
  )
}

function LinkToBrand({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="/app"
      className="inline-flex items-center rounded-xl transition-opacity hover:opacity-85"
      aria-label="رِواق — الصفحة الرئيسية"
    >
      <Logo size={compact ? 30 : 34} showWordmark={!compact} />
    </a>
  )
}

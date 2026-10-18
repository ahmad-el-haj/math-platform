import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Avatar } from '@/components/ui/avatar'
import { displayName } from '@/lib/format'

export function UserMenu() {
  const { user, profile, signOut, isTeacher } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const name = displayName(profile?.full_name, user?.email)
  const profilePath = isTeacher ? '/app/teacher/profile' : '/app/student/profile'

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('تم تسجيل الخروج بنجاح')
      navigate('/', { replace: true })
    } catch {
      toast.error('تعذّر تسجيل الخروج', 'حاول مرة أخرى بعد قليل.')
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-surface-2"
      >
        <Avatar name={name} src={profile?.avatar_url || null} size="sm" />
        <span className="hidden text-start sm:block">
          <span className="block max-w-36 truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block text-[11px] text-ink-3">
            {isTeacher ? 'معلّم' : 'طالب'}
          </span>
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-rise surface-card absolute end-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden p-1.5"
        >
          <div className="border-b border-line px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-3" dir="ltr">
              {user?.email}
            </p>
          </div>

          <Link
            to={profilePath}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <UserIcon className="size-4" aria-hidden="true" />
            الملف الشخصي
          </Link>
          <Link
            to={profilePath}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <Settings className="size-4" aria-hidden="true" />
            إعدادات الحساب
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void handleSignOut()
            }}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-line px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
          >
            <LogOut className="size-4" aria-hidden="true" />
            تسجيل الخروج
          </button>
        </div>
      ) : null}
    </div>
  )
}

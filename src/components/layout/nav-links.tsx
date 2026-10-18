import { NavLink } from 'react-router-dom'
import type { NavItem } from '@/config/navigation'
import { cn } from '@/lib/cn'

export type NavLinksProps = {
  items: NavItem[]
  unread: number
  variant?: 'sidebar' | 'bottom'
}

export function NavLinks({ items, unread, variant = 'sidebar' }: NavLinksProps) {
  if (variant === 'bottom') {
    return (
      <ul className="grid grid-cols-4 items-stretch">
        {items.slice(0, 4).map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end ?? false}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium',
                    'transition-colors',
                    isActive ? 'text-gold' : 'text-ink-3 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className="size-5" aria-hidden="true" />
                      {item.showsUnreadBadge && unread > 0 ? (
                        <span className="absolute -end-1.5 -top-1 flex min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[9px] font-bold text-on-gold">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate">{item.label}</span>
                    {isActive ? (
                      <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold" />
                    ) : null}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium',
                  'transition-colors duration-200',
                  isActive
                    ? 'bg-gold-soft text-gold'
                    : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                  {item.showsUnreadBadge && unread > 0 ? (
                    <span className="ms-auto flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-bold text-on-gold">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  ) : null}
                  {isActive ? (
                    <span className="absolute -start-3.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-e-full bg-gold" />
                  ) : null}
                </>
              )}
            </NavLink>
          </li>
        )
      })}
    </ul>
  )
}

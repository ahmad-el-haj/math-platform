/**
 * Rendering smoke tests for the public pages.
 *
 * They prove that the marketing and the authentication pages really mount
 * (no runtime error, no missing provider) and that the primary calls to
 * action are present.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/lib/supabase', async () => {
  const { createFakeSupabase } = await import('../support/fake-backend')
  const client = createFakeSupabase()
  ;(globalThis as Record<string, unknown>).__riwaq_fake_supabase__ = client
  return { supabase: client }
})

import { AuthProvider } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
import { ToastProvider } from '@/hooks/use-toast'
import LandingPage from '@/pages/public/landing'
import LoginPage from '@/pages/public/login'
import RegisterPage from '@/pages/public/register'
import NotFoundPage from '@/pages/not-found'
import { resetFakeDb } from '../support/harness'

/**
 * The pages are rendered inside the same provider stack as the real
 * application. The render is wrapped in `act` so the asynchronous session
 * restore of the `AuthProvider` is flushed before the assertions.
 */
async function renderPage(element: React.ReactElement) {
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter>{element}</MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>,
    )
  })
  return result as ReturnType<typeof render>
}

beforeEach(() => {
  resetFakeDb()
})

describe('the landing page', () => {
  it('mounts and shows the main call to action', async () => {
    await renderPage(<LandingPage />)

    expect(screen.getAllByRole('link', { name: /ابدأ|تسجيل/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
  })

  it('uses logical (direction agnostic) layout properties', async () => {
    const { container } = (await renderPage(<LandingPage />))!
    // The layout is written with `start`/`end` instead of `left`/`right`, so
    // it mirrors automatically in the right to left Arabic layout.
    expect(container.querySelector('[class*="ms-"], [class*="me-"]')).toBeTruthy()
  })
})

describe('the authentication pages', () => {
  it('mounts the login form', async () => {
    await renderPage(<LoginPage />)

    expect(screen.getByRole('button', { name: /دخول/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/البريد/)).toBeInTheDocument()
  })

  it('mounts the registration form', async () => {
    await renderPage(<RegisterPage />)

    expect(screen.getByRole('button', { name: /إنشاء/ })).toBeInTheDocument()
  })
})

describe('the not found page', () => {
  it('mounts and offers a way back', async () => {
    await renderPage(<NotFoundPage />)

    expect(screen.getAllByRole('link', { name: /الرئيسية/ }).length).toBeGreaterThan(0)
  })
})

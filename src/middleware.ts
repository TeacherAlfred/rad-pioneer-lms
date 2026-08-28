import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  
  const url = request.nextUrl.clone()

  // 1. Create an initial response
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 2. Initialize Supabase with a more robust cookie handler
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      global: {
        // Bound the auth round-trip so a slow/unresponsive Supabase Auth
        // API fails fast instead of hanging until Vercel's edge middleware
        // execution limit kills the whole request with a 504
        // MIDDLEWARE_INVOCATION_TIMEOUT.
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
      },
    }
  )

  // 3. IMPORTANT: Use getUser() to validate the session.
  // Fail closed (treat as logged-out) if Supabase Auth doesn't respond in time.
  let user: { id: string } | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  // 4. THE REDIRECT LOGIC
  // IF YOU are logged in, funnel you to admin
  if (user?.id === 'adfefd6c-954c-4e13-9423-5519aa89980a') {
    if (url.pathname === '/' || url.pathname === '/staff/dashboard' || url.pathname === '/login') {
      url.pathname = '/admin/courses'
      return NextResponse.redirect(url)
    }
  }

  // PROTECT /admin
  if (url.pathname.startsWith('/admin')) {
    if (!user) {
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    // Only YOU (info@radacademy.co.za)
    if (user.id !== 'adfefd6c-954c-4e13-9423-5519aa89980a') {
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    /* // --- MFA ENFORCEMENT TEMPORARILY DISABLED ---
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    
    // Check if user has MFA set up (nextLevel === 'aal2') 
    // but isn't verified for this session (currentLevel !== 'aal2')
    const needsMfaVerification = aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2'

    const isMfaPath = 
      url.pathname === '/admin/verify' || 
      url.pathname === '/admin/setup-mfa'

    if (needsMfaVerification && !isMfaPath) {
      url.pathname = '/admin/verify'
      return NextResponse.redirect(url)
    }
    */
  }

  return supabaseResponse
}

export const config = {
  // Only run this (Supabase-hitting) middleware on the paths that actually
  // need the auth/redirect check. Previously matched almost every route
  // (including API endpoints like the WhatsApp webhook), so a slow Supabase
  // Auth response caused MIDDLEWARE_INVOCATION_TIMEOUT site-wide.
  matcher: ['/', '/login', '/staff/dashboard', '/admin/:path*'],
}
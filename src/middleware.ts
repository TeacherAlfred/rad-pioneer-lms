import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
    }
  )

  // 3. IMPORTANT: Use getUser() to validate the session
  const { data: { user } } = await supabase.auth.getUser()

  // DEBUG LOG - Check your terminal again after this change
  console.log("Middleware Check - User ID:", user?.id || "NONE");

  // 4. THE REDIRECT LOGIC
  const url = request.nextUrl.clone()

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
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
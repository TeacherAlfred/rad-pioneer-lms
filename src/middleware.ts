import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// 1. Define routes
const isPublicPortalRoute = createRouteMatcher(['/projects/portal(.*)'])
const isAdminRoute = (path: string) => path.startsWith('/admin') && !path.startsWith('/admin/login')

export default clerkMiddleware(async (auth, request) => {
  const url = request.nextUrl.clone()
  const pathname = request.nextUrl.pathname

  // -------------------------------------------------------------
  // NEW: TEMPORARY ADMIN BYPASS LOGIC
  // -------------------------------------------------------------
  if (isAdminRoute(pathname)) {
    const adminToken = request.cookies.get('admin_token')
    if (!adminToken) {
      url.pathname = '/admin/login'
      return NextResponse.redirect(url)
    }
  }

  // -------------------------------------------------------------
  // EXISTING CLERK AUTH LOGIC
  // -------------------------------------------------------------
  if (isPublicPortalRoute(request)) {
    return NextResponse.next()
  }

  // -------------------------------------------------------------
  // EXISTING SUPABASE AUTH LOGIC
  // -------------------------------------------------------------
  if (pathname.startsWith('/student')) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // We still initialize the Supabase client and get the user to ensure the session 
  // cookies are refreshed via the setAll method above, but we no longer trap the admin.
  await supabase.auth.getUser()

  return supabaseResponse
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    '/(api|trpc)(.*)',
  ],
}
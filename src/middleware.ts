import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Protected routes
  const protectedRoutes = ['/app', '/trips']
  
  // Check if the current route is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  if (isProtectedRoute) {
    // Check for group-based session cookies
    const sessionCookie = request.cookies.get('vacation-planner-session')
    const groupIdCookie = request.cookies.get('vacation-planner-group-id')
    const travelerNameCookie = request.cookies.get('vacation-planner-traveler-name')
    
    // Validate group-based authentication
    if (!sessionCookie?.value || !groupIdCookie?.value || !travelerNameCookie?.value) {
      // Redirect to landing page
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Validate session format (should start with 'group-')
    if (!sessionCookie.value.startsWith('group-')) {
      // Invalid session format, redirect to landing page
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/'
      redirectUrl.searchParams.set('redirectedFrom', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
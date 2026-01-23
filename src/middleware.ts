import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
    // Public paths that don't require authentication
    const publicPaths = ['/login', '/signup', '/forgot-password'];
    const isPublicPath = publicPaths.some(path =>
        request.nextUrl.pathname.startsWith(path)
    );

    // Skip authentication for public paths (allow access without checking auth)
    if (isPublicPath) {
        return NextResponse.next();
    }

    // For protected routes, check authentication
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    try {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => {
                            request.cookies.set(name, value);
                        });
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        });
                        cookiesToSet.forEach(({ name, value, options }) => {
                            response.cookies.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        // If user is not authenticated, redirect to login
        if (!user) {
            const loginUrl = new URL('/login', request.url);
            loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
            return NextResponse.redirect(loginUrl);
        }

        return response;
    } catch (error) {
        // On error, allow access (fail-open for development)
        console.error('Middleware auth error:', error);
        return NextResponse.next();
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (images, etc.)
         * - api routes
         */
        '/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};

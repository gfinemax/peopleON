import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

function isInvalidRefreshTokenError(error: unknown) {
    const message =
        typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : '';

    return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found');
}

function buildLoginRedirect(request: NextRequest) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return loginUrl;
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
    request.cookies.getAll()
        .filter(({ name }) => name.startsWith('sb-'))
        .forEach(({ name }) => {
            request.cookies.delete(name);
            response.cookies.set(name, '', {
                maxAge: 0,
                expires: new Date(0),
                path: '/',
            });
        });
}

export async function proxy(request: NextRequest) {
    // Public paths that don't require authentication
    const publicPaths = ['/login', '/signup', '/forgot-password', '/debug'];
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

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
            if (isInvalidRefreshTokenError(authError)) {
                const redirectResponse = NextResponse.redirect(buildLoginRedirect(request));
                clearSupabaseAuthCookies(request, redirectResponse);
                return redirectResponse;
            }

            throw authError;
        }

        // If user is not authenticated, redirect to login
        if (!user) {
            return NextResponse.redirect(buildLoginRedirect(request));
        }

        return response;
    } catch (error) {
        if (isInvalidRefreshTokenError(error)) {
            const redirectResponse = NextResponse.redirect(buildLoginRedirect(request));
            clearSupabaseAuthCookies(request, redirectResponse);
            return redirectResponse;
        }

        // On error, allow access (fail-open for development)
        console.error('Proxy auth error:', error);
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

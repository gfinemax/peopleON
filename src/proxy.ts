import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { hasValidApiKey } from '@/lib/server/apiKeyAuth';

function isInvalidRefreshTokenError(error: unknown) {
    const message =
        typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : '';

    return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found');
}

function isMissingAuthSessionError(error: unknown) {
    const message =
        typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : '';

    return message.includes('Auth session missing');
}

function buildLoginRedirect(request: NextRequest) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return loginUrl;
}

function buildUnauthorizedResponse(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.redirect(buildLoginRedirect(request));
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
    if (
        request.nextUrl.pathname === '/api/members/table' &&
        hasValidApiKey(request.headers)
    ) {
        return NextResponse.next();
    }

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

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
            if (isMissingAuthSessionError(authError)) {
                return buildUnauthorizedResponse(request);
            }

            if (isInvalidRefreshTokenError(authError)) {
                const unauthorizedResponse = buildUnauthorizedResponse(request);
                clearSupabaseAuthCookies(request, unauthorizedResponse);
                return unauthorizedResponse;
            }

            throw authError;
        }

        // If user is not authenticated, redirect to login
        if (!user) {
            return buildUnauthorizedResponse(request);
        }

        return response;
    } catch (error) {
        if (isMissingAuthSessionError(error)) {
            return buildUnauthorizedResponse(request);
        }

        if (isInvalidRefreshTokenError(error)) {
            const unauthorizedResponse = buildUnauthorizedResponse(request);
            clearSupabaseAuthCookies(request, unauthorizedResponse);
            return unauthorizedResponse;
        }

        console.error('Proxy auth error:', error);
        return buildUnauthorizedResponse(request);
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
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};

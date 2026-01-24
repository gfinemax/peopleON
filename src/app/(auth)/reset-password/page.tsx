'use client';

import { useActionState, useState, useEffect, Suspense } from 'react';
import { updatePassword, AuthState } from '@/app/actions/auth';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { MaterialIcon } from '@/components/ui/icon';

function ResetPasswordForm() {
    const [state, formAction, isPending] = useActionState<AuthState, FormData>(updatePassword, {});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const { theme, setTheme } = useTheme();

    // Check if we have the necessary tokens from the URL
    const [isValidSession, setIsValidSession] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        // Supabase redirects with tokens in the URL hash
        const hash = window.location.hash;
        const hasAccessToken = hash.includes('access_token') || hash.includes('type=recovery');

        setIsValidSession(hasAccessToken || hash.length > 1);
        setIsChecking(false);
    }, []);

    if (isChecking) {
        return (
            <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 bg-pattern-dark dark:bg-pattern-dark bg-gradient-light">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <MaterialIcon name="progress_activity" className="animate-spin" size="lg" />
                    <span>확인 중...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 bg-pattern-dark dark:bg-pattern-dark bg-gradient-light">
            {/* Theme Toggle Button */}
            <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="absolute top-4 right-4 p-2 rounded-lg bg-card/50 border border-border hover:bg-accent transition-colors z-10"
                aria-label="Toggle theme"
            >
                <MaterialIcon
                    name={theme === 'dark' ? 'light_mode' : 'dark_mode'}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    size="md"
                />
            </button>

            {/* Main Card Container */}
            <div className="w-full max-w-[440px] flex flex-col bg-card rounded-lg border border-border shadow-2xl relative overflow-hidden">
                {/* Top Gradient Line */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

                <div className="flex flex-col p-8 sm:p-10 gap-6">
                    {/* Header Section */}
                    <div className="flex flex-col items-center justify-center gap-2 mb-2">
                        {/* Logo / Brand */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/10 border border-primary/20 text-primary">
                                <MaterialIcon name="lock" size="lg" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-glow">
                                새 비밀번호
                            </h1>
                        </div>
                        <p className="text-muted-foreground text-sm font-medium tracking-wide text-center">
                            새로운 비밀번호를 입력해주세요
                        </p>
                    </div>

                    {/* Invalid Session Warning */}
                    {!isValidSession && (
                        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3">
                            <MaterialIcon name="warning" className="text-warning flex-shrink-0 mt-0.5" size="md" />
                            <div>
                                <p className="text-warning text-sm font-medium">유효하지 않은 링크</p>
                                <p className="text-warning/80 text-xs mt-1">
                                    비밀번호 재설정 링크가 만료되었거나 유효하지 않습니다.
                                    다시 비밀번호 찾기를 요청해주세요.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {state.error && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
                            <MaterialIcon name="error" className="text-destructive flex-shrink-0" size="md" />
                            <p className="text-destructive text-sm">{state.error}</p>
                        </div>
                    )}

                    {/* Form Section */}
                    {isValidSession && (
                        <form action={formAction} className="flex flex-col gap-5 w-full">
                            {/* New Password Input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground/80 ml-1" htmlFor="password">
                                    새 비밀번호
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MaterialIcon
                                            name="lock"
                                            className="text-muted-foreground group-focus-within:text-primary transition-colors"
                                            size="md"
                                        />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="새 비밀번호 (6자 이상)"
                                        required
                                        minLength={6}
                                        className="w-full h-12 rounded-lg bg-background dark:bg-[#0f172a] border border-input text-foreground placeholder:text-muted-foreground pl-10 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 hover:border-muted-foreground/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-0 inset-y-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <MaterialIcon
                                            name={showPassword ? 'visibility_off' : 'visibility'}
                                            size="md"
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Confirm Password Input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground/80 ml-1" htmlFor="confirmPassword">
                                    비밀번호 확인
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MaterialIcon
                                            name="lock_clock"
                                            className="text-muted-foreground group-focus-within:text-primary transition-colors"
                                            size="md"
                                        />
                                    </div>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="비밀번호 확인"
                                        required
                                        minLength={6}
                                        className="w-full h-12 rounded-lg bg-background dark:bg-[#0f172a] border border-input text-foreground placeholder:text-muted-foreground pl-10 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 hover:border-muted-foreground/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-0 inset-y-0 px-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <MaterialIcon
                                            name={showConfirmPassword ? 'visibility_off' : 'visibility'}
                                            size="md"
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full h-12 mt-2 bg-primary hover:bg-[#0f6bd0] active:bg-[#0d5bb8] text-white text-base font-bold rounded-lg shadow-lg shadow-primary/20 transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isPending ? (
                                    <>
                                        <MaterialIcon name="progress_activity" className="animate-spin" size="md" />
                                        <span>변경 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>비밀번호 변경</span>
                                        <MaterialIcon
                                            name="check"
                                            className="group-hover:scale-110 transition-transform"
                                            size="md"
                                        />
                                    </>
                                )}
                            </button>
                        </form>
                    )}

                    {/* Link to request new reset */}
                    {!isValidSession && (
                        <Link
                            href="/forgot-password"
                            className="w-full h-12 bg-primary hover:bg-[#0f6bd0] text-white text-base font-bold rounded-lg shadow-lg shadow-primary/20 transition-all duration-200 flex items-center justify-center gap-2"
                        >
                            <span>비밀번호 찾기로 이동</span>
                            <MaterialIcon name="arrow_forward" size="md" />
                        </Link>
                    )}

                    {/* Back to Login Link */}
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
                        <Link href="/login" className="hover:text-primary transition-colors flex items-center gap-1">
                            <MaterialIcon name="arrow_back" size="sm" />
                            로그인으로 돌아가기
                        </Link>
                    </div>
                </div>
            </div>

            {/* Bottom Copyright */}
            <div className="mt-8 text-muted-foreground text-xs text-center">
                <p>© People On Corp. All rights reserved.</p>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 bg-pattern-dark dark:bg-pattern-dark bg-gradient-light">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    <span>로딩 중...</span>
                </div>
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}

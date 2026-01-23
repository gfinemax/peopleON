'use client';

import { useActionState, useState } from 'react';
import { signIn, AuthState } from '@/app/actions/auth';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { MaterialIcon } from '@/components/ui/icon';

export default function LoginPage() {
    const [state, formAction, isPending] = useActionState<AuthState, FormData>(signIn, {});
    const [showPassword, setShowPassword] = useState(false);
    const { theme, setTheme } = useTheme();

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
            <div className="w-full max-w-[440px] flex flex-col bg-card rounded-xl border border-border shadow-2xl relative overflow-hidden">
                {/* Top Gradient Line */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
                
                <div className="flex flex-col p-8 sm:p-10 gap-6">
                    {/* Header Section */}
                    <div className="flex flex-col items-center justify-center gap-2 mb-2">
                        {/* Logo / Brand */}
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/10 border border-primary/20 text-primary">
                                <MaterialIcon name="apartment" size="lg" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-glow">
                                People On
                            </h1>
                        </div>
                        <p className="text-muted-foreground text-sm font-medium tracking-wide">
                            통합 CRM &amp; ERP 플랫폼
                        </p>
                    </div>

                    {/* Error Message */}
                    {state.error && (
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
                            <MaterialIcon name="error" className="text-destructive flex-shrink-0" size="md" />
                            <p className="text-destructive text-sm">{state.error}</p>
                        </div>
                    )}

                    {/* Form Section */}
                    <form action={formAction} className="flex flex-col gap-5 w-full">
                        {/* ID Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground/80 ml-1" htmlFor="email">
                                아이디
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <MaterialIcon 
                                        name="person" 
                                        className="text-muted-foreground group-focus-within:text-primary transition-colors" 
                                        size="md"
                                    />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="아이디를 입력하세요"
                                    required
                                    className="w-full h-12 rounded-lg bg-background dark:bg-[#0f172a] border border-input text-foreground placeholder:text-muted-foreground pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 hover:border-muted-foreground/50"
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-foreground/80 ml-1" htmlFor="password">
                                비밀번호
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
                                    placeholder="비밀번호를 입력하세요"
                                    required
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

                        {/* Remember Me */}
                        <div className="flex items-center mt-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-input bg-background dark:bg-[#0f172a] checked:border-primary checked:bg-primary transition-all focus:ring-2 focus:ring-primary/30 focus:ring-offset-0"
                                    />
                                    <MaterialIcon 
                                        name="check" 
                                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] text-white opacity-0 peer-checked:opacity-100 pointer-events-none font-bold"
                                        size="xs"
                                    />
                                </div>
                                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                                    아이디 저장
                                </span>
                            </label>
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
                                    <span>로그인 중...</span>
                                </>
                            ) : (
                                <>
                                    <span>로그인</span>
                                    <MaterialIcon 
                                        name="arrow_forward" 
                                        className="group-hover:translate-x-0.5 transition-transform" 
                                        size="md"
                                    />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground pt-2 border-t border-border">
                        <Link href="/forgot-password" className="hover:text-primary transition-colors">
                            비밀번호 찾기
                        </Link>
                        <span className="text-border">|</span>
                        <Link href="/signup" className="hover:text-primary transition-colors">
                            계정 신청 문의
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

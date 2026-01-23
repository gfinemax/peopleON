'use client';

import { useActionState, useState } from 'react';
import { requestPasswordReset, AuthState } from '@/app/actions/auth';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { MaterialIcon } from '@/components/ui/icon';

export default function ForgotPasswordPage() {
    const [state, formAction, isPending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
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
                                <MaterialIcon name="lock_reset" size="lg" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-glow">
                                비밀번호 찾기
                            </h1>
                        </div>
                        <p className="text-muted-foreground text-sm font-medium tracking-wide text-center">
                            가입한 이메일로 비밀번호 재설정 링크를 보내드립니다
                        </p>
                    </div>

                    {/* Success Message */}
                    {state.success && (
                        <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex items-center gap-3">
                            <MaterialIcon name="check_circle" className="text-success flex-shrink-0" size="md" />
                            <div>
                                <p className="text-success text-sm font-medium">이메일을 확인해주세요!</p>
                                <p className="text-success/80 text-xs mt-1">비밀번호 재설정 링크가 발송되었습니다.</p>
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
                    {!state.success && (
                        <form action={formAction} className="flex flex-col gap-5 w-full">
                            {/* Email Input */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium text-foreground/80 ml-1" htmlFor="email">
                                    이메일
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <MaterialIcon 
                                            name="email" 
                                            className="text-muted-foreground group-focus-within:text-primary transition-colors" 
                                            size="md"
                                        />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="가입한 이메일을 입력하세요"
                                        required
                                        className="w-full h-12 rounded-lg bg-background dark:bg-[#0f172a] border border-input text-foreground placeholder:text-muted-foreground pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 hover:border-muted-foreground/50"
                                    />
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
                                        <span>발송 중...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>재설정 링크 발송</span>
                                        <MaterialIcon 
                                            name="send" 
                                            className="group-hover:translate-x-0.5 transition-transform" 
                                            size="md"
                                        />
                                    </>
                                )}
                            </button>
                        </form>
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

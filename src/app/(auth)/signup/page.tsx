'use client';

import { useActionState, useState } from 'react';
import { signUp, AuthState } from '@/app/actions/auth';
import Image from 'next/image';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { User, Lock, Mail, AlertCircle, Info, Loader2, CheckCircle2 } from 'lucide-react';

export default function SignUpPage() {
    const [state, formAction, isPending] = useActionState<AuthState, FormData>(signUp, {});
    const [passwordError, setPasswordError] = useState<string | null>(null);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        const formData = new FormData(event.currentTarget);
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirmPassword') as string;

        if (password !== confirmPassword) {
            event.preventDefault();
            setPasswordError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setPasswordError(null);
    };

    if (state.success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8 bg-[#0d1525]">
                <div className="w-full max-w-md space-y-8 text-center bg-slate-900/50 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
                    <div className="flex justify-center">
                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-white text-3xl font-bold">회원 가입 완료!</h2>
                        <p className="text-slate-400">
                            이메일 인증을 위해 발송된 메일을 확인해주세요.<br />
                            (인증 후 로그인이 가능합니다)
                        </p>
                    </div>
                    <Button asChild className="w-full h-12 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold">
                        <Link href="/login">로그인 화면으로 이동</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Branding (consistent with login) */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
                {/* Logo */}
                <div className="flex items-center gap-3 z-10">
                    <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        P
                    </div>
                    <span className="text-white font-semibold text-lg">PEOPLE ON</span>
                </div>

                {/* Main Title */}
                <div className="z-10 space-y-4">
                    <h1 className="text-white text-4xl font-bold leading-tight">
                        데이터로 관리하는<br />
                        <span className="text-cyan-400">효율적인 협동조합</span>
                    </h1>
                    <p className="text-slate-400 text-lg">
                        투명한 정보 공유와 관리 업무 자동화를 시작하세요
                    </p>
                </div>

                {/* Robot Mascot */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-90">
                    <Image
                        src="/robot-mascot.png"
                        alt="People On Mascot"
                        width={400}
                        height={400}
                        className="object-contain"
                    />
                </div>

                {/* System Notice */}
                <div className="z-10 bg-slate-900/50 border border-slate-700 rounded-lg p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold mb-2">
                        <Info className="h-4 w-4" />
                        GETTING STARTED
                    </div>
                    <p className="text-slate-400 text-sm leading-relaxed">
                        계정을 생성하면 관리자 승인 후 시스템의 모든 기능을 사용할 수 있습니다.
                    </p>
                </div>
            </div>

            {/* Right Panel - Sign Up Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#0d1525]">
                <div className="w-full max-w-md space-y-8">
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                            P
                        </div>
                        <span className="text-white font-semibold text-xl">PEOPLE ON</span>
                    </div>

                    {/* Header */}
                    <div className="text-center lg:text-left">
                        <h2 className="text-white text-3xl font-bold">계정 만들기</h2>
                        <p className="text-slate-400 mt-2">People On 시스템 이용을 위해 정보를 입력해주세요</p>
                    </div>

                    {/* Error Messages */}
                    {(state.error || passwordError) && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                            <p className="text-red-400 text-sm">{state.error || passwordError}</p>
                        </div>
                    )}

                    {/* Form */}
                    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
                        {/* Name Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-slate-300 text-sm ml-1">
                                성함
                            </Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="실명을 입력해주세요"
                                    className="pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                                    required
                                />
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-slate-300 text-sm ml-1">
                                이메일 주소
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="example@email.com"
                                    className="pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-slate-300 text-sm ml-1">
                                비밀번호
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="6자 이상 입력하세요"
                                    className="pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                                    required
                                    minLength={6}
                                />
                            </div>
                        </div>

                        {/* Confirm Password Field */}
                        <div className="space-y-1.5">
                            <Label htmlFor="confirmPassword" className="text-slate-300 text-sm ml-1">
                                비밀번호 확인
                            </Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="비밀번호를 다시 입력하세요"
                                    className="pl-10 h-11 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-cyan-500/20"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-base transition-all duration-200"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        가입 신청 중...
                                    </>
                                ) : (
                                    '가입 신청하기'
                                )}
                            </Button>
                        </div>
                    </form>

                    {/* Back to Login */}
                    <div className="text-center pt-4">
                        <p className="text-slate-400">
                            이미 계정이 있으신가요?{' '}
                            <Link href="/login" className="text-cyan-400 font-semibold hover:underline">
                                로그인하기
                            </Link>
                        </p>
                    </div>

                    {/* Copyright */}
                    <div className="text-center text-slate-500 text-sm mt-8 border-t border-slate-800 pt-8">
                        Copyright © People On. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    );
}

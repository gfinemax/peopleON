'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export interface AuthState {
    error?: string;
    success?: boolean;
}

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
    console.log('--- Sign In Attempt ---');

    // Debug: Check Env Vars (safely)
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log('Env Check (SignIn):', {
        urlExists: !!sbUrl,
        urlPrefix: sbUrl ? sbUrl.substring(0, 15) + '...' : 'UNDEFINED',
        urlLen: sbUrl?.length,
        keyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });

    const supabase = await createClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    console.log('Attempting sign in for:', email);

    if (!email || !password) {
        return { error: '이메일과 비밀번호를 입력해주세요.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        console.error('Sign In Error:', error.message, error.status);
        // Show raw error to user for debugging
        return { error: `에러 상세: ${error.message} (${error.status || 'No Status'})` };
    }

    console.log('Sign In Success for:', data.user?.email);

    revalidatePath('/', 'layout');
    redirect('/');
}

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
    console.log('--- Sign Up Attempt ---');

    // Debug: Check Env Vars (safely)
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log('Env Check (SignUp):', {
        urlExists: !!sbUrl,
        urlPrefix: sbUrl ? sbUrl.substring(0, 15) + '...' : 'UNDEFINED',
        urlLen: sbUrl?.length,
        keyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });

    const supabase = await createClient();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    console.log('Attempting sign up for:', email);

    if (!email || !password) {
        return { error: '이메일과 비밀번호를 입력해주세요.' };
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name || email.split('@')[0],
            },
        },
    });

    if (error) {
        console.error('Sign Up Error:', error.message, error.status);
        if (error.message.includes('fetch failed')) {
            return { error: '서버 연결 실패: 환경변수/네트워크 설정을 확인해주세요.' };
        }
        return { error: `회원가입 실패: ${error.message}` };
    }

    console.log('Sign Up Success for:', data.user?.email);
    return { success: true };
}

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    revalidatePath('/', 'layout');
    redirect('/login');
}

export async function requestPasswordReset(prevState: AuthState, formData: FormData): Promise<AuthState> {
    console.log('--- Password Reset Request ---');
    const supabase = await createClient();

    const email = formData.get('email') as string;

    if (!email) {
        return { error: '이메일을 입력해주세요.' };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password`,
    });

    if (error) {
        console.error('Password Reset Error:', error.message);
        return { error: `비밀번호 재설정 요청 실패: ${error.message}` };
    }

    return { success: true };
}

export async function updatePassword(prevState: AuthState, formData: FormData): Promise<AuthState> {
    console.log('--- Password Update ---');
    const supabase = await createClient();

    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (!password || !confirmPassword) {
        return { error: '비밀번호를 입력해주세요.' };
    }

    if (password !== confirmPassword) {
        return { error: '비밀번호가 일치하지 않습니다.' };
    }

    if (password.length < 6) {
        return { error: '비밀번호는 최소 6자 이상이어야 합니다.' };
    }

    const { error } = await supabase.auth.updateUser({
        password: password,
    });

    if (error) {
        console.error('Password Update Error:', error.message);
        return { error: `비밀번호 변경 실패: ${error.message}` };
    }

    revalidatePath('/', 'layout');
    redirect('/login?message=password-updated');
}

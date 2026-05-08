import type { Metadata } from 'next';
import { listAdminUsers } from '@/app/actions/users';
import { requirePageRole, ROLE_GROUPS } from '@/lib/server/authz';
import { AdminUsersManager } from './AdminUsersManager';

export const metadata: Metadata = {
    title: '계정 권한 관리 | People On',
    description: '관리자가 로그인 계정별 접근 권한을 지정합니다.',
};

export default async function AdminUsersPage() {
    await requirePageRole(ROLE_GROUPS.admin);
    const users = await listAdminUsers();

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden bg-background">
            <div className="border-b border-border bg-card px-6 py-5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">계정 권한 관리</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    가입 계정별 역할을 지정합니다. 권한 변경은 감사 로그에 기록됩니다.
                </p>
            </div>
            <main className="flex-1 overflow-y-auto p-6">
                <AdminUsersManager initialUsers={users} />
            </main>
        </div>
    );
}

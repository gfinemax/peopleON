'use client';

import { useMemo, useState, useTransition } from 'react';
import {
    type AdminUserListItem,
    type AssignableUserRole,
    updateUserRole,
} from '@/app/actions/users';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MaterialIcon } from '@/components/ui/icon';

const roleOptions: Array<{ value: AssignableUserRole; label: string; description: string }> = [
    { value: 'admin', label: '관리자', description: '감사 로그, 중복 병합, 권한 관리' },
    { value: 'finance_manager', label: '재무 담당', description: '설정, 납부, 조합원 생성/업로드' },
    { value: 'ops_manager', label: '운영 담당', description: '조합원 정보 및 상태 수정' },
    { value: 'staff', label: '일반 직원', description: '기본 업무 접근' },
];

const roleLabelMap = new Map(roleOptions.map((role) => [role.value, role.label]));

function formatDateTime(value: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('ko-KR');
}

function roleBadgeClass(role: string | null) {
    if (role === 'admin' || role === 'super_admin') return 'bg-red-500/10 text-red-600 border-red-500/20';
    if (role === 'finance_manager') return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (role === 'ops_manager') return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    if (role === 'staff') return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
}

export function AdminUsersManager({ initialUsers }: { initialUsers: AdminUserListItem[] }) {
    const [users, setUsers] = useState(initialUsers);
    const [selectedRoles, setSelectedRoles] = useState<Record<string, AssignableUserRole>>(() =>
        Object.fromEntries(
            initialUsers.map((user) => [
                user.id,
                roleOptions.some((role) => role.value === user.rawRole)
                    ? (user.rawRole as AssignableUserRole)
                    : 'staff',
            ]),
        ),
    );
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    const roleCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const user of users) {
            const role = user.rawRole || user.role || 'none';
            counts.set(role, (counts.get(role) || 0) + 1);
        }
        return counts;
    }, [users]);

    const handleRoleChange = (userId: string, role: AssignableUserRole) => {
        setSelectedRoles((prev) => ({ ...prev, [userId]: role }));
        setMessage(null);
    };

    const handleSave = (user: AdminUserListItem) => {
        const nextRole = selectedRoles[user.id];
        setPendingUserId(user.id);
        setMessage(null);

        startTransition(async () => {
            const result = await updateUserRole(user.id, nextRole);
            if (result.error) {
                setMessage({ type: 'error', text: result.error });
                setPendingUserId(null);
                return;
            }

            setUsers((prev) =>
                prev.map((item) =>
                    item.id === user.id
                        ? {
                              ...item,
                              role: nextRole,
                              rawRole: nextRole,
                          }
                        : item,
                ),
            );
            setMessage({ type: 'success', text: `${user.email} 권한을 저장했습니다.` });
            setPendingUserId(null);
        });
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
                {roleOptions.map((role) => (
                    <div key={role.value} className="rounded-lg border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-bold text-foreground">{role.label}</div>
                            <Badge variant="outline">{roleCounts.get(role.value) || 0}</Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{role.description}</p>
                    </div>
                ))}
            </div>

            {message && (
                <div
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
                        message.type === 'success'
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                            : 'border-red-500/20 bg-red-500/10 text-red-700'
                    }`}
                >
                    <MaterialIcon name={message.type === 'success' ? 'check_circle' : 'error'} size="sm" />
                    {message.text}
                </div>
            )}

            <div className="overflow-hidden rounded-lg border bg-card">
                <div className="grid grid-cols-[minmax(220px,1.5fr)_160px_220px_170px_130px] gap-0 border-b bg-muted/40 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <div>계정</div>
                    <div>현재 권한</div>
                    <div>권한 변경</div>
                    <div>최근 로그인</div>
                    <div className="text-right">저장</div>
                </div>

                {users.length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">가입 계정이 없습니다.</div>
                ) : (
                    <div className="divide-y">
                        {users.map((user) => {
                            const selectedRole = selectedRoles[user.id];
                            const currentLabel = user.role ? roleLabelMap.get(user.role as AssignableUserRole) || user.role : '미지정';
                            const hasChange = selectedRole !== user.rawRole;
                            const isSaving = isPending && pendingUserId === user.id;

                            return (
                                <div
                                    key={user.id}
                                    className="grid grid-cols-[minmax(220px,1.5fr)_160px_220px_170px_130px] items-center gap-0 px-4 py-4 text-sm"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-semibold text-foreground">{user.email}</div>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="truncate">{user.name || '이름 미등록'}</span>
                                            <span className="font-mono">...{user.id.slice(-6)}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <Badge variant="outline" className={roleBadgeClass(user.role)}>
                                            {currentLabel}
                                        </Badge>
                                    </div>

                                    <div>
                                        <Select
                                            value={selectedRole}
                                            onValueChange={(value) => handleRoleChange(user.id, value as AssignableUserRole)}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roleOptions.map((role) => (
                                                    <SelectItem key={role.value} value={role.value}>
                                                        {role.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="text-xs text-muted-foreground">{formatDateTime(user.lastSignInAt)}</div>

                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            variant={hasChange ? 'default' : 'outline'}
                                            disabled={!hasChange || isSaving}
                                            onClick={() => handleSave(user)}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <MaterialIcon name="progress_activity" size="sm" className="animate-spin" />
                                                    저장
                                                </>
                                            ) : (
                                                '저장'
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

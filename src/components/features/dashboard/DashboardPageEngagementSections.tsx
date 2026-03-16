import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    ActionRequiredRow,
    ActivityItem,
    DuplicateConflictRow,
} from '@/components/features/dashboard/DashboardPagePrimitives';
import type {
    DashboardActionItem,
    DashboardFavoriteMember,
} from '@/lib/server/dashboardOverview';

export function DashboardFavoritesSection({
    favoriteList,
}: {
    favoriteList: DashboardFavoriteMember[];
}) {
    if (favoriteList.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 px-1">
                <MaterialIcon name="star" size="md" className="text-yellow-400" filled />
                <h3 className="text-lg font-extrabold text-foreground">즐겨찾기 조합원</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {favoriteList.map((member) => (
                    <Link
                        key={member.id}
                        href={`/members?q=${member.name}`}
                        className="group relative flex flex-col rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:bg-muted/50 hover:shadow-md"
                    >
                        <div className="absolute top-3 right-3 text-yellow-400">
                            <MaterialIcon name="star" size="sm" filled />
                        </div>
                        <div className="mb-3 flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-sm font-bold text-blue-500 transition-colors group-hover:bg-blue-500/20">
                                {member.name.slice(0, 1)}
                            </div>
                            <div>
                                <p className="font-bold text-foreground">{member.name}</p>
                                <p className="font-mono text-[11px] text-muted-foreground">{member.member_number}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <span className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                {member.tier || '차수미정'}
                            </span>
                            <span
                                className={cn(
                                    'rounded border px-2 py-0.5 text-[10px] font-bold',
                                    member.status === '정상'
                                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                        : member.status === '탈퇴'
                                          ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                                          : 'border-orange-500/20 bg-orange-500/10 text-orange-500',
                                )}
                            >
                                {member.status || '상태미정'}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export function DashboardActionActivitySection({
    actionList,
}: {
    actionList: DashboardActionItem[];
}) {
    return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:col-span-8">
                <div className="flex items-center justify-between border-b border-border/50 bg-card/30 p-6">
                    <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                            <MaterialIcon name="warning" className="text-destructive" size="sm" />
                        </div>
                        <div>
                            <h3 className="text-lg font-extrabold text-foreground">조치 필요 조합원</h3>
                            <p className="mt-0.5 text-[10px] font-bold text-muted-foreground">
                                <span className="mr-1 rounded bg-destructive/10 px-1 py-0.5 text-destructive">High Risk</span>
                                긴급 관리가 필요한 조합원 목록입니다.
                            </p>
                        </div>
                    </div>
                    <Link href="/members" className="text-sm font-bold text-primary transition-colors hover:text-primary-hover">
                        전체 보기
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b border-border/30 text-muted-foreground/50">
                            <tr>
                                <th className="py-3 pl-6 pr-4 text-[10px] font-black uppercase tracking-[0.2em]">이름 / 조합원 번호</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]">구분</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em]">상태</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em]">전화번호</th>
                                <th className="py-3 pl-4 pr-6 text-center text-[10px] font-black uppercase tracking-[0.2em]">조치</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {actionList.length > 0 ? (
                                actionList.map((member) =>
                                    member.status === '충돌오류' ? (
                                        <DuplicateConflictRow key={member.id} member={member} />
                                    ) : (
                                        <ActionRequiredRow
                                            key={member.id}
                                            name={member.name}
                                            memberId={member.member_number}
                                            tier={member.tier || '-'}
                                            status={member.status || '미확인'}
                                            statusColor={
                                                member.status === '탈퇴'
                                                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                                    : member.status === '소송중'
                                                      ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                                      : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                            }
                                            amount={member.phone || '-'}
                                            actionLabel="상세 보기"
                                            isPrimaryAction={true}
                                            href={member.href}
                                        />
                                    ),
                                )
                            ) : (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-sm font-bold text-muted-foreground">
                                        조치가 필요한 조합원이 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="h-fit rounded-lg border border-border bg-card shadow-sm lg:col-span-4">
                <div className="flex items-center justify-between border-b border-border/50 p-4">
                    <h3 className="text-lg font-extrabold text-foreground">최근 활동</h3>
                    <button className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/20 hover:text-foreground">
                        <MaterialIcon name="more_horiz" size="sm" />
                    </button>
                </div>
                <div className="flex flex-col bg-card/10 p-6">
                    <ActivityItem
                        icon="sms"
                        iconColor="text-blue-400"
                        iconBg="bg-blue-400/10"
                        title="납부 안내 문자 발송"
                        desc="미납 회원 24명에게 안내 메시지 발송 완료"
                        time="10분 전"
                        isLast={false}
                    />
                    <ActivityItem
                        icon="payments"
                        iconColor="text-success"
                        iconBg="bg-success/10"
                        title="수납 확인: 김철수"
                        desc="3차 분담금 15,000,000원 입금 확인"
                        time="1시간 전"
                        isLast={false}
                    />
                    <ActivityItem
                        icon="person_add"
                        iconColor="text-purple-400"
                        iconBg="bg-purple-400/10"
                        title="신규 회원 등록"
                        desc="신규 지주 조합원 '이미자' 등록 완료"
                        time="3시간 전"
                        isLast={false}
                    />
                    <ActivityItem
                        icon="edit_note"
                        iconColor="text-orange-400"
                        iconBg="bg-orange-400/10"
                        title="규약 변경 승인"
                        desc="관리자 승인 대기중"
                        time="어제"
                        isLast={true}
                    />
                </div>
            </div>
        </div>
    );
}

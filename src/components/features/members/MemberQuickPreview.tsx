'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { fetchMemberDetail } from './memberDetailDialogOperations';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';

export function MemberQuickPreview({ memberId, memberIds, open, onOpenChange, returnTo }: { memberId: string | null; memberIds: string[] | null; open: boolean; onOpenChange: (open: boolean) => void; returnTo: string }) {
    const [member, setMember] = useState<MemberDetailDialogMember | null>(null);

    useEffect(() => {
        if (!open || !memberIds?.length) return;
        let cancelled = false;
        void fetchMemberDetail(memberIds).then((data) => {
            if (!cancelled) setMember(data);
        });
        return () => { cancelled = true; };
    }, [memberIds, open]);

    const workspaceHref = memberId ? `/members/${memberId}?tab=info&returnTo=${encodeURIComponent(returnTo)}` : '/members';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-[#0F151B] p-0 text-white sm:max-w-lg">
                <DialogTitle className="sr-only">조합원 빠른보기</DialogTitle>
                {!member ? (
                    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-400"><MaterialIcon name="refresh" size="sm" className="animate-spin" />정보를 불러오는 중입니다.</div>
                ) : (
                    <div>
                        <header className="border-b border-white/10 px-5 py-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-black">{member.name}</h2><span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-300">{member.status || '미정'}</span></div><p className="mt-1 text-xs text-slate-500">빠른 확인 · 수정과 상세 업무는 통합정보에서 처리합니다.</p></header>
                        <div className="grid gap-3 p-5 sm:grid-cols-2">
                            <PreviewField icon="phone" label="휴대전화" value={member.phone || '미입력'} />
                            <PreviewField icon="badge" label="구분" value={(member.tiers || [member.tier]).filter(Boolean).join(', ') || '미지정'} />
                            <PreviewField icon="home" label="주소" value={member.address_legal || '미입력'} wide />
                            <PreviewField icon="groups" label="대표 관계인" value={member.representative ? `${member.representative.name} · ${member.representative.relation}` : '없음'} wide />
                            <PreviewField icon="description" label="대표 가입신청필증" value={member.certificate_display || '없음'} wide />
                            <PreviewField icon="notes" label="관리자 메모" value={member.memo || '메모 없음'} wide />
                        </div>
                        <footer className="flex items-center justify-end gap-2 border-t border-white/10 bg-[#121c27] px-5 py-4"><button onClick={() => onOpenChange(false)} className="min-h-11 rounded-lg border border-white/10 px-4 text-xs font-bold text-slate-300">닫기</button><Link href={workspaceHref} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-sky-600 px-4 text-xs font-black text-white hover:bg-sky-500"><MaterialIcon name="open_in_new" size="xs" />통합정보 열기</Link></footer>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function PreviewField({ icon, label, value, wide = false }: { icon: string; label: string; value: string; wide?: boolean }) {
    return <div className={wide ? 'sm:col-span-2' : ''}><div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500"><MaterialIcon name={icon} size="xs" />{label}</div><p className="mt-1 break-words text-sm font-semibold text-slate-100">{value}</p></div>;
}

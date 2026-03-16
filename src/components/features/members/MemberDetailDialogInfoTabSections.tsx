'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { InfoRow, RepresentativeRow } from './MemberDetailDialogFields';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
} from './memberDetailDialogTypes';

const FEEDBACK_TONE_CLASSNAME: Record<MemberDetailDialogSaveFeedback['tone'], string> = {
    success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    warn: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    error: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
};

interface MemberDetailDialogInfoTabProps {
    member: MemberDetailDialogMember;
    formData: Partial<MemberDetailDialogMember>;
    isEditing: boolean;
    isSsnRevealed: boolean;
    setIsSsnRevealed: (next: boolean) => void;
    setFormData: Dispatch<SetStateAction<Partial<MemberDetailDialogMember>>>;
    saveFeedback: MemberDetailDialogSaveFeedback | null;
}

export function MemberDetailDialogInfoTab({
    member,
    formData,
    isEditing,
    isSsnRevealed,
    setIsSsnRevealed,
    setFormData,
    saveFeedback,
}: MemberDetailDialogInfoTabProps) {
    const updateField = <K extends keyof MemberDetailDialogMember>(
        field: K,
        value: MemberDetailDialogMember[K],
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
            <div className="group relative mb-6 overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br from-[#233040] to-[#1e2836] p-4 shadow-lg">
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="smart_toy" className="text-xl text-blue-400" />
                        <h3 className="text-sm font-bold tracking-wide text-white">AI 분석 인사이트</h3>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {(member.tags || ['#강성민원', '#납부약정']).map((tag, index) => (
                            <div
                                key={`${tag}-${index}`}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5',
                                    tag.includes('강성')
                                        ? 'border-red-500/20 bg-red-500/10 text-red-200'
                                        : tag.includes('납부')
                                          ? 'border-blue-500/20 bg-blue-500/10 text-blue-200'
                                          : 'border-gray-600/50 bg-gray-700/50 text-gray-300',
                                )}
                            >
                                <MaterialIcon
                                    name={tag.includes('강성') ? 'warning' : tag.includes('납부') ? 'thumb_up' : 'schedule'}
                                    className={cn(
                                        'text-[16px]',
                                        tag.includes('강성')
                                            ? 'text-red-400'
                                            : tag.includes('납부')
                                              ? 'text-blue-400'
                                              : 'text-gray-400',
                                    )}
                                />
                                <span className="text-xs font-bold">{tag}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#233040] p-5 shadow-sm">
                <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                    <span className="h-4 w-1 rounded-full bg-blue-500" />
                    기본 연락처
                </h3>
                <div className="flex flex-col gap-0">
                    <div className="grid grid-cols-2">
                        <InfoRow
                            icon="person"
                            label="성명"
                            value={member.name || '미입력'}
                            isEditing={isEditing}
                            editElement={
                                <Input
                                    className="h-8 border-white/10 bg-[#1A2633] text-sm font-bold text-white"
                                    value={formData.name || ''}
                                    onChange={(event) => updateField('name', event.target.value)}
                                />
                            }
                        />
                        <InfoRow
                            icon="cake"
                            label="생년월일"
                            value={member.birth_date || '미입력'}
                            isEditing={isEditing}
                            editElement={
                                <Input
                                    className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                                    value={formData.birth_date || ''}
                                    onChange={(event) => updateField('birth_date', event.target.value)}
                                    placeholder="YYYY-MM-DD"
                                />
                            }
                        />
                    </div>
                    <div className="grid grid-cols-2">
                        <InfoRow
                            icon="badge"
                            label="주민번호"
                            value={
                                isEditing ? (
                                    ''
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span>
                                            {isSsnRevealed
                                                ? member.resident_registration_number || '미입력'
                                                : member.resident_registration_number
                                                  ? `${member.resident_registration_number.slice(0, 8)}******`
                                                  : '미입력'}
                                        </span>
                                        {member.resident_registration_number ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setIsSsnRevealed(!isSsnRevealed)}
                                                className="h-6 px-1.5 text-[10px] text-gray-500 hover:bg-white/5 hover:text-white"
                                            >
                                                <MaterialIcon name={isSsnRevealed ? 'visibility_off' : 'visibility'} size="xs" />
                                            </Button>
                                        ) : null}
                                    </div>
                                )
                            }
                            isEditing={isEditing}
                            editElement={
                                <Input
                                    className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                                    value={formData.resident_registration_number || ''}
                                    onChange={(event) => updateField('resident_registration_number', event.target.value)}
                                    placeholder="000000-0000000"
                                />
                            }
                        />
                    </div>
                    <div className="grid grid-cols-2">
                        <InfoRow
                            icon="smartphone"
                            label="휴대전화"
                            value={member.phone || '미입력'}
                            isEditing={isEditing}
                            editElement={
                                <Input
                                    className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                                    value={formData.phone || ''}
                                    onChange={(event) => updateField('phone', event.target.value)}
                                />
                            }
                        />
                        <InfoRow
                            icon="phone"
                            label="보조 휴대전화"
                            value={member.secondary_phone || '미입력'}
                            isEditing={isEditing}
                            editElement={
                                <Input
                                    className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                                    value={formData.secondary_phone || ''}
                                    onChange={(event) => updateField('secondary_phone', event.target.value)}
                                />
                            }
                        />
                    </div>
                    <div className="grid grid-cols-2">
                        <InfoRow
                            icon="mail"
                            label="이메일"
                            value={member.email || '미입력'}
                            isEditing={isEditing}
                            editElement={
                                <Input
                                    className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                                    value={formData.email || ''}
                                    onChange={(event) => updateField('email', event.target.value)}
                                />
                            }
                        />
                    </div>
                    <InfoRow
                        icon="home"
                        label="현주소"
                        value={member.address_legal || '미입력'}
                        isEditing={isEditing}
                        editElement={
                            <Input
                                className="h-8 border-white/10 bg-[#1A2633] text-sm text-white"
                                value={formData.address_legal || ''}
                                onChange={(event) => updateField('address_legal', event.target.value)}
                            />
                        }
                    />
                </div>

                <h3 className="mt-6 mb-3 flex items-center gap-2 text-base font-bold text-white">
                    <span className="h-4 w-1 rounded-full bg-emerald-500" />
                    대리인 정보
                </h3>
                {member.representative || member.representative2 || isEditing ? (
                    <div className="space-y-3 text-left">
                        <RepresentativeRow
                            label="대리인1"
                            data={formData.representative}
                            isEditing={isEditing}
                            onChange={(value) => updateField('representative', value)}
                        />
                        <RepresentativeRow
                            label="대리인2"
                            data={formData.representative2}
                            isEditing={isEditing}
                            onChange={(value) => updateField('representative2', value)}
                        />
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-white/10 bg-gray-800/10 p-6 text-center">
                        <p className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
                            지정된 대리인 정보가 없습니다.
                        </p>
                    </div>
                )}

                {(member.memo || isEditing || member.acts_as_agent_for?.length) && (
                    <div className="flex flex-col gap-3 pt-4">
                        <div className="flex items-center gap-2">
                            <MaterialIcon name="sticky_note_2" className="text-[18px] text-yellow-500/70" />
                            <p className="text-xs font-medium text-gray-400">관리자 메모</p>
                        </div>
                        {isEditing ? (
                            <textarea
                                className="h-24 w-full resize-none rounded-lg border border-white/10 bg-[#1A2633] p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={formData.memo || ''}
                                onChange={(event) => updateField('memo', event.target.value)}
                            />
                        ) : (
                            <div className="flex flex-col gap-2 rounded-lg border border-yellow-500/20 bg-yellow-900/10 p-4">
                                {member.acts_as_agent_for?.length ? (
                                    <div className="flex flex-col gap-1 border-b border-yellow-500/10 pb-2 last:border-0 last:pb-0">
                                        {member.acts_as_agent_for.map((agentFor, index) => (
                                            <span key={`${agentFor.id}-${index}`} className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                                                <MaterialIcon name="person" size="xs" />
                                                {agentFor.name}의 대리인
                                                <span className="text-xs font-normal text-emerald-500/70">({agentFor.relation})</span>
                                            </span>
                                        ))}
                                    </div>
                                ) : null}
                                <p className="break-keep whitespace-pre-wrap text-left text-sm leading-relaxed text-gray-200">
                                    {member.memo || (member.acts_as_agent_for?.length ? '' : '메모가 없습니다.')}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {saveFeedback ? (
                <div className="pt-4">
                    <p className={cn('rounded-lg border px-3 py-2 text-xs font-semibold', FEEDBACK_TONE_CLASSNAME[saveFeedback.tone])}>
                        {saveFeedback.message}
                    </p>
                </div>
            ) : null}
        </div>
    );
}

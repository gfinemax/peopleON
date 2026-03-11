'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ActivityTimelineTab } from './ActivityTimelineTab';
import { PaymentStatusTab } from './PaymentStatusTab';
import { logSystemInteraction, checkAndLogAssetRightConflicts } from '@/app/actions/interaction';
import { createAuditLog } from '@/app/actions/audit';
import { deleteMemberEntities } from '@/app/actions/member';
import {
    buildCertificateStorageFields,
    classifyCertificateInput,
    getCertificateDisplayText,
    getConfirmedCertificateNumbers,
    resolveCertificateRight,
    RIGHT_NUMBER_STATUS_LABEL,
    RIGHT_NUMBER_STATUS_OPTIONS,
    type RightNumberStatus,
} from '@/lib/certificates/rightNumbers';

type AssetRight = {
    id: string;
    entity_id: string;
    right_type?: string | null;
    right_number?: string | null;
    right_number_raw?: string | null;
    right_number_status?: RightNumberStatus | null;
    right_number_note?: string | null;
    issued_at?: string | null;
    principal_amount?: number | string | null;
    holder_name?: string | null;
    issued_date?: string | null;
    price_text?: string | null;
    certificate_price?: number | string | null;
    premium_price?: number | string | null;
    broker_fee?: number | string | null;
    acquisition_source?: string | null;
    certificate_number_normalized?: string | null;
    certificate_number_raw?: string | null;
    certificate_status?: RightNumberStatus | null;
    note?: any | null;
    meta?: {
        cert_name?: string;
        [key: string]: any;
    } | null;
};

type CertificateSummaryReviewStatus = 'pending' | 'reviewed' | 'manual_locked';

const CERTIFICATE_SUMMARY_STATUS_LABEL: Record<CertificateSummaryReviewStatus, string> = {
    pending: '검수대기',
    reviewed: '검토완료',
    manual_locked: '수동고정',
};

interface Member {
    id: string;
    name: string;
    member_number: string;
    certificate_display?: string | null;
    certificate_numbers?: string[] | null;
    phone: string | null;
    secondary_phone?: string | null;
    email: string | null;
    address_legal: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    memo: string | null;
    tags?: string[] | null;
    tiers?: string[] | null;
    role_code?: string | null;
    representative?: {
        id: string;
        name: string;
        relation: string;
        phone: string | null;
    } | null;
    representative2?: {
        id: string;
        name: string;
        relation: string;
        phone: string | null;
    } | null;
    assetRights?: AssetRight[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
    birth_date?: string | null;
    resident_registration_number?: string | null;
    acts_as_agent_for?: { id: string; name: string; relation: string }[] | null;
    owner_group?: 'registered' | 'others' | null;
    provisional_certificate_count?: number | null;
    manual_certificate_count?: number | null;
    effective_certificate_count?: number | null;
    certificate_summary_review_status?: CertificateSummaryReviewStatus | null;
    certificate_summary_note?: string | null;
    certificate_summary_conflict_count?: number | null;
    certificate_summary_is_grouped?: boolean;
}

interface MemberDetailDialogProps {
    memberId: string | null;
    memberIds: string[] | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved?: () => void;
    initialTab?: TabType;
}

type TabType = 'info' | 'timeline' | 'payment' | 'admin';

export function MemberDetailDialog({
    memberId,
    memberIds,
    open,
    onOpenChange,
    onSaved,
    initialTab
}: MemberDetailDialogProps) {
    const [member, setMember] = useState<Member | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Member>>({});
    const [saveFeedback, setSaveFeedback] = useState<{
        tone: 'success' | 'warn' | 'error';
        message: string;
    } | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('info');

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab || 'info');
        }
    }, [open, initialTab]);

    const [rightInput, setRightInput] = useState('');
    const [isAddingRight, setIsAddingRight] = useState(false);
    const [conflictRightNumbers, setConflictRightNumbers] = useState<string[]>([]);
    const [deletedRightsIds, setDeletedRightsIds] = useState<string[]>([]);
    const [isSsnRevealed, setIsSsnRevealed] = useState(false);

    // Real Owner Search State
    const [ownerSearch, setOwnerSearch] = useState('');
    const [ownerResults, setOwnerResults] = useState<{ id: string, name: string, phone?: string }[]>([]);
    const [isSearchingOwner, setIsSearchingOwner] = useState(false);
    const canEditCertificateSummary = (memberIds?.length || 0) <= 1;

    const handleAddRight = async () => {
        if (!rightInput.trim() || !member) return;

        // Validation: Prevent date-like strings from being added as certificates
        const isDateLike = (v: string): boolean => {
            const s = v.trim();
            const m = s.match(/^(19[2-9]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
            if (m) return +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
            const m2 = s.match(/^(19[2-9]\d)(\d{2})(\d{2})$/);
            if (m2) return +m2[2] >= 1 && +m2[2] <= 12 && +m2[3] >= 1 && +m2[3] <= 31;
            return false;
        };
        if (isDateLike(rightInput)) {
            alert('이 입력값은 생년월일 형식입니다. 권리증 번호가 확실한지 확인하시거나, 생년월일 칸에 입력해 주세요.');
            return;
        }

        setIsAddingRight(true);
        try {
            const supabase = createClient();
            const classifiedRight = classifyCertificateInput(rightInput.trim());
            const { error } = await supabase
                .from('certificate_registry')
                .insert({
                    entity_id: member.id,
                    certificate_number_normalized: classifiedRight.confirmedNumber,
                    certificate_number_raw: classifiedRight.rawValue,
                    certificate_status: classifiedRight.status,
                    note: JSON.stringify({ manual_add: true }),
                    is_active: true,
                    source_type: 'manual'
                });

            if (error) throw error;

            // Check for conflict and log interaction
            const newNumber = classifiedRight.confirmedNumber;
            const currentIds = (memberIds && memberIds.length > 0) ? memberIds : (member.id ? [member.id] : []);
            if (newNumber) {
                await checkAndLogAssetRightConflicts(currentIds, [newNumber]);
            }

            setRightInput('');
            if (memberIds && memberIds.length > 0) {
                await fetchMember(memberIds);
            } else {
                await fetchMember([member.id]);
            }

            if (onSaved) onSaved();
        } catch (error: any) {
            alert('권리증 추가 중 오류가 발생했습니다: ' + error.message);
        } finally {
            setIsAddingRight(false);
        }
    };

    const handleSetRealOwner = async (ownerId: string | null) => {
        if (!member) return;
        try {
            const supabase = createClient();
            await supabase
                .from('entity_relationships')
                .delete()
                .eq('from_entity_id', member.id)
                .eq('relation_type', 'nominee_owner');

            if (ownerId) {
                const { error } = await supabase
                    .from('entity_relationships')
                    .insert({
                        from_entity_id: member.id,
                        to_entity_id: ownerId,
                        relation_type: 'nominee_owner',
                        relation_note: '실소유자'
                    });
                if (error) throw error;
            }

            if (memberIds && memberIds.length > 0) {
                await fetchMember(memberIds);
            } else {
                await fetchMember([member.id]);
            }
            if (onSaved) onSaved();

            setOwnerSearch('');
            setOwnerResults([]);
        } catch (error: any) {
            alert('실소유자 설정 중 오류가 발생했습니다: ' + error.message);
        }
    };

    useEffect(() => {
        const searchOwners = async () => {
            if (ownerSearch.length < 2) {
                setOwnerResults([]);
                return;
            }
            setIsSearchingOwner(true);
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('account_entities')
                    .select('id, display_name, phone')
                    .ilike('display_name', `%${ownerSearch}%`)
                    .limit(10);

                if (error) throw error;

                const nameGroups = new Map<string, { id: string, name: string, phone?: string }>();
                (data || []).forEach(d => {
                    const name = d.display_name;
                    const existing = nameGroups.get(name);
                    if (!existing || (!existing.phone && d.phone)) {
                        nameGroups.set(name, {
                            id: d.id,
                            name: d.display_name,
                            phone: d.phone
                        });
                    }
                });
                setOwnerResults(Array.from(nameGroups.values()).slice(0, 5));
            } catch (err) {
                console.error('Owner search failed:', err);
            } finally {
                setIsSearchingOwner(false);
            }
        };

        const timer = setTimeout(searchOwners, 300);
        return () => clearTimeout(timer);
    }, [ownerSearch]);

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                });
            }
        };
        const handlePointerUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, dragStart]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    const handleClose = () => {
        handleDialogOpenChange(false);
    };

    const handleDialogOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
        if (nextOpen) {
            setPosition({ x: 0, y: 0 });
            setActiveTab('info');
            setSaveFeedback(null);
        }
    };

    async function fetchMember(ids: string[]) {
        if (ids.length === 0) return;
        setLoading(true);
        setIsEditing(false);
        setSaveFeedback(null);
        const supabase = createClient();

        const { data: entities, error: entitiesError } = await supabase
            .from('account_entities')
            .select('*')
            .in('id', ids);

        if (entitiesError || !entities || entities.length === 0) {
            setLoading(false);
            return;
        }

        const entity = entities[0];
        const normalizePhone = (val: string | null | undefined) => (val || '').replace(/\D/g, '');

        const [roleRes, relRes, revRelRes, rightsRes] = await Promise.all([
            supabase.from('membership_roles').select('role_code, is_registered').in('entity_id', ids),
            supabase.from('entity_relationships').select('from_entity_id, to_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name, phone)').in('to_entity_id', ids).eq('relation_type', 'agent'),
            supabase.from('entity_relationships').select('from_entity_id, to_entity_id, relation_type, relation_note, owner_entity:account_entities!to_entity_id(display_name, phone)').in('from_entity_id', ids).eq('relation_type', 'agent'),
            supabase.from('certificate_registry').select('*').in('entity_id', ids).eq('is_active', true)
        ]);

        const uniqueRelations = relRes.data ? Array.from(new Map(relRes.data.map(r => [r.from_entity_id, r])).values()) : [];

        const assetRights = ((rightsRes.data || []) as AssetRight[]).map((right) => ({
            ...right,
            right_number: right.certificate_number_normalized || right.certificate_number_raw,
            right_number_raw: right.certificate_number_raw,
            right_number_status: (right.certificate_status || 'review_required') as RightNumberStatus,
            right_number_note: typeof right.note === 'object' ? JSON.stringify(right.note) : (right.note || ''),
        }));

        const normalizeTierLabel = (rawTier?: string | null, isRegistered = false) => {
            if (!rawTier) return isRegistered ? '등기조합원' : null;
            const t = rawTier.replace(/\s+/g, '').toLowerCase();
            if (t === '1차') return '등기조합원';
            if (t === '2차') return '2차';
            if (t === '일반' || t === '일반분양' || t === '3차') return '일반분양';
            if (t === '지주조합원') return '지주조합원';
            if (t === '지주') return '지주';
            if (t === '대리인' || t === '대리') return '대리인';
            if (t === '예비' || t === '예비조합원') return '예비조합원';
            if (t === '권리증보유자') return '권리증보유자';
            if (t === '권리증환불' || t === '비조합원권리증') return '권리증환불';
            if (t === '관계인') return '관계인';
            return rawTier;
        };

        const rolesData = roleRes.data || [];
        const tiers = Array.from(new Set(rolesData.map(r => normalizeTierLabel(r.role_code, r.is_registered)).filter(Boolean))) as string[];

        let certNumbers = getConfirmedCertificateNumbers(assetRights);
        let certificateDisplay = getCertificateDisplayText(assetRights, { includeFallbackStatus: true });

        const effectiveSummaryCount = certNumbers.length;
        const provisionalSummaryCount = certNumbers.length;
        const summaryReviewStatus: CertificateSummaryReviewStatus = 'reviewed';
        const summaryNote = '';
        const ownerGroup = (rolesData.some(r => r.is_registered) ? 'registered' : 'others');

        const allPhonesNumeric = new Set<string>();
        const uniqueDisplayPhones: string[] = [];
        entities.forEach(e => {
            if (!e.phone) return;
            const phones = e.phone.split(',').map((p: string) => p.trim()).filter(Boolean);
            for (const p of phones) {
                const digits = normalizePhone(p);
                if (digits && !allPhonesNumeric.has(digits)) {
                    allPhonesNumeric.add(digits);
                    if (digits.length === 11) uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
                    else if (digits.length === 10) uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
                    else uniqueDisplayPhones.push(p);
                }
            }
        });

        const isDateLikeValue = (v: string): boolean => {
            const s = v.trim();
            const m = s.match(/^(19[2-9]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
            if (m) return +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
            const m2 = s.match(/^(19[2-9]\d)(\d{2})(\d{2})$/);
            if (m2) return +m2[2] >= 1 && +m2[2] <= 12 && +m2[3] >= 1 && +m2[3] <= 31;
            return false;
        };

        let derivedBirthDate = entity.birth_date || null;
        if (!derivedBirthDate) {
            const allPossibleCerts = certNumbers.filter(Boolean);
            const dateLikeValue = allPossibleCerts.find(cn => isDateLikeValue(cn));
            if (dateLikeValue) derivedBirthDate = dateLikeValue;
        }

        const uniqueSecondaryPhones: string[] = [];
        const secondaryPhoneDigits = new Set<string>();
        entities.forEach((e) => {
            if (!e.phone_secondary) return;
            const phones = e.phone_secondary.split(',').map((p: string) => p.trim()).filter(Boolean);
            for (const p of phones) {
                const digits = normalizePhone(p);
                if (!digits || secondaryPhoneDigits.has(digits)) continue;
                secondaryPhoneDigits.add(digits);
                if (digits.length === 11) uniqueSecondaryPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
                else if (digits.length === 10) uniqueSecondaryPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
                else uniqueSecondaryPhones.push(p);
            }
        });

        const combinedData: Member = {
            ...entity,
            name: entity.display_name,
            phone: uniqueDisplayPhones.join(', '),
            secondary_phone: uniqueSecondaryPhones.join(', ') || null,
            member_number: entity.member_number || '-',
            certificate_display: certificateDisplay,
            certificate_numbers: certNumbers,
            tiers: tiers,
            role_code: rolesData[0]?.role_code || null,
            representative: uniqueRelations.length > 0 ? {
                id: uniqueRelations[0].from_entity_id,
                name: (uniqueRelations[0].agent_entity as any)?.display_name || 'N/A',
                relation: uniqueRelations[0].relation_note || '대리인',
                phone: (uniqueRelations[0].agent_entity as any)?.phone || null
            } : null,
            representative2: uniqueRelations.length > 1 ? {
                id: uniqueRelations[1].from_entity_id,
                name: (uniqueRelations[1].agent_entity as any)?.display_name || 'N/A',
                relation: uniqueRelations[1].relation_note || '대리인',
                phone: (uniqueRelations[1].agent_entity as any)?.phone || null
            } : null,
            acts_as_agent_for: revRelRes.data ? revRelRes.data.map(r => ({
                id: r.to_entity_id,
                name: (r.owner_entity as any)?.display_name || 'N/A',
                relation: r.relation_note || '대리인'
            })) : null,
            assetRights: assetRights,
            birth_date: derivedBirthDate,
            owner_group: ownerGroup,
            provisional_certificate_count: provisionalSummaryCount,
            manual_certificate_count: null,
            effective_certificate_count: effectiveSummaryCount,
            certificate_summary_review_status: summaryReviewStatus,
            certificate_summary_note: summaryNote || null,
            certificate_summary_conflict_count: 0,
            certificate_summary_is_grouped: ids.length > 1,
        };

        setMember(combinedData);
        setFormData(combinedData);
        setLoading(false);

        // Conflict check
        if (certNumbers.length > 0) {
            await checkAndLogAssetRightConflicts(ids, certNumbers);
        }
    }

    useEffect(() => {
        if (open && memberIds && memberIds.length > 0) {
            void fetchMember(memberIds);
        }
    }, [open, memberIds]);
    const handleRightChange = (rightId: string, field: string, value: string) => {
        setFormData(prev => {
            if (!prev.assetRights) return prev;
            return {
                ...prev,
                assetRights: prev.assetRights.map(r => {
                    if (r.id !== rightId) return r;
                    if (field === 'cert_name') {
                        return { ...r, meta: { ...(r.meta || {}), cert_name: value } };
                    }
                    if (field === 'right_number') {
                        const classified = classifyCertificateInput(value);
                        return {
                            ...r,
                            right_number: classified.confirmedNumber,
                            right_number_raw: value,
                            right_number_status: classified.status,
                        };
                    }
                    return { ...r, [field]: value };
                })
            };
        });
    };

    const handleRightStatusChange = (rightId: string, status: RightNumberStatus) => {
        setFormData(prev => {
            if (!prev.assetRights) return prev;
            return {
                ...prev,
                assetRights: prev.assetRights.map((r) => {
                    if (r.id !== rightId) return r;
                    return {
                        ...r,
                        right_number_status: status,
                    };
                }),
            };
        });
    };

    const handleDeleteRight = (rightId: string) => {
        if (!confirm('해당 권리증을 목록에서 제외하시겠습니까?\n(우측 상단의 [저장] 버튼을 누르셔야 실제 DB에서 삭제됩니다.)')) return;

        setFormData(prev => {
            if (!prev.assetRights) return prev;
            return {
                ...prev,
                assetRights: prev.assetRights.filter(r => r.id !== rightId)
            };
        });

        if (!rightId.startsWith('new-')) {
            setDeletedRightsIds(prev => [...prev, rightId]);
        }
    };

    const handleDeleteMember = async () => {
        if (!member) return;
        const targetIds = memberIds && memberIds.length > 0 ? memberIds : [member.id];
        const label = targetIds.length > 1 ? `${member.name || '선택한 인물'} 포함 ${targetIds.length}건` : (member.name || '선택한 인물');
        const confirmed = confirm(
            `${label} 정보를 삭제하시겠습니까?\n권리증, 정산, 납부 이력이 있으면 삭제가 차단됩니다.`
        );

        if (!confirmed) return;

        setDeleting(true);
        setSaveFeedback(null);

        const result = await deleteMemberEntities(targetIds);

        if (!result.success) {
            setSaveFeedback({
                tone: 'error',
                message: result.error || '인물 정보 삭제에 실패했습니다.'
            });
            setDeleting(false);
            return;
        }

        setDeleting(false);
        handleDialogOpenChange(false);
        if (onSaved) onSaved();
    };

    const handleSave = async () => {
        if (!memberId) return;
        setSaving(true);
        setSaveFeedback(null);

        const cleanRep = (rep: any) => {
            if (!rep) return null;
            const hasIdentity = Boolean(rep.name?.trim() || rep.phone?.trim());
            if (!hasIdentity) return null;
            return rep;
        };

        const canEditCertificateReview = (memberIds?.length || 0) <= 1;

        const response = await fetch('/api/members/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: memberId,
                ids: memberIds,
                name: formData.name,
                phone: formData.phone,
                secondary_phone: formData.secondary_phone,
                email: formData.email,
                address_legal: formData.address_legal,
                memo: formData.memo,
                role_code: formData.role_code,
                representative: cleanRep(formData.representative),
                representative2: cleanRep(formData.representative2),
                birth_date: formData.birth_date,
                resident_registration_number: formData.resident_registration_number,
                manual_certificate_count: canEditCertificateReview ? formData.manual_certificate_count : undefined,
                certificate_summary_review_status: canEditCertificateReview ? formData.certificate_summary_review_status : undefined,
                certificate_summary_note: canEditCertificateReview ? formData.certificate_summary_note : undefined,
            }),
        }).catch(() => null);

        const payload = response ? await response.json().catch(() => null) : null;

        if (!response || !response.ok || !payload?.success) {
            setSaveFeedback({ tone: 'error', message: payload?.error || '저장에 실패했습니다.' });
            setSaving(false);
            return;
        }

        // Save asset rights changes
        let rightsSaveError: any = null;
        let newlyChangedRightNumbers: string[] = [];

        if (formData.assetRights && member?.assetRights) {
            const supabase = createClient();
            for (const r of formData.assetRights) {
                const original = member.assetRights.find(o => o.id === r.id);
                if (original && (
                    original.right_number_raw !== r.right_number_raw ||
                    original.right_number_status !== r.right_number_status ||
                    original.right_number_note !== r.right_number_note ||
                    original.issued_at !== r.issued_at ||
                    original.principal_amount !== r.principal_amount ||
                    original.meta?.cert_name !== r.meta?.cert_name
                )) {
                    const amountToSave = r.principal_amount === '' ? 0 : Number(r.principal_amount) || 0;

                    const { error: rightError } = await supabase.from('certificate_registry').update({
                        certificate_number_normalized: r.right_number,
                        certificate_number_raw: r.right_number_raw,
                        certificate_status: r.right_number_status,
                        note: r.right_number_note,
                        issued_at: r.issued_at || null,
                        principal_amount: amountToSave,
                        meta: r.meta
                    }).eq('id', r.id);

                    if (rightError) {
                        rightsSaveError = rightError;
                        break;
                    }
                    if (original.right_number !== r.right_number && r.right_number) {
                        newlyChangedRightNumbers.push(r.right_number);
                    }
                    // Audit logging for certificate number change
                    if (original.right_number_raw !== (r.right_number_raw || '')) {
                        const targetIds = memberIds && memberIds.length > 0 ? memberIds : (memberId ? [memberId] : []);
                        for (const tid of targetIds) {
                            await createAuditLog('UPDATE_CERTIFICATE_NUMBER', tid, {
                                old_number: original.right_number_raw || null,
                                new_number: r.right_number_raw || null
                            });
                        }
                    }
                }
            }
        }

        // Process deletions
        if (deletedRightsIds.length > 0 && !rightsSaveError) {
            const supabase = createClient();
            const { error: delError } = await supabase.from('certificate_registry').delete().in('id', deletedRightsIds);
            if (delError) {
                rightsSaveError = delError;
            } else {
                await createAuditLog('DELETE_ASSET_RIGHTS', memberId || (memberIds && memberIds[0]) || undefined, {
                    deleted_ids: deletedRightsIds
                });
            }
        }

        if (rightsSaveError) {
            console.error("Asset rights update error:", rightsSaveError, JSON.stringify(rightsSaveError));
            const isDuplicate = rightsSaveError.message?.toLowerCase().includes('duplicate') || rightsSaveError.code === '23505';
            setSaveFeedback({
                tone: 'error',
                message: isDuplicate ? '이미 등록된 권리증 번호입니다. 중복 여부를 확인해주세요.' : `저장 실패: ${rightsSaveError.message || '알 수 없는 오류'}`
            });
            setSaving(false);
            return;
        }

        // --- Audit Log ---
        await createAuditLog('UPDATE_ASSET_RIGHTS', memberId || (memberIds && memberIds[0]) || undefined, {
            rightsInfo: formData.assetRights
        });
        // ------------------

        // Check and log conflicts for newly changed rights
        if (newlyChangedRightNumbers.length > 0) {
            const currentIds = (memberIds && memberIds.length > 0) ? memberIds : (memberId ? [memberId] : []);
            await checkAndLogAssetRightConflicts(currentIds, newlyChangedRightNumbers);
        }

        setSaveFeedback({ tone: 'success', message: '성공적으로 저장되었습니다.' });
        setTimeout(() => {
            setIsEditing(false);
            if (memberIds && memberIds.length > 0) {
                void fetchMember(memberIds);
            } else if (memberId) {
                void fetchMember([memberId]);
            }
            if (onSaved) onSaved();
        }, 1000);
        setSaving(false);
    };

    const tabs = [
        { id: 'info' as TabType, label: '기본', icon: 'person' },
        { id: 'timeline' as TabType, label: '이력', icon: 'history' },
        { id: 'payment' as TabType, label: '납부', icon: 'payments' },
        { id: 'admin' as TabType, label: '행정/권리증', icon: 'description' },
    ];

    if (!member && !loading) {
        return (
            <Dialog open={open} onOpenChange={handleDialogOpenChange}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogTitle className="sr-only">정보 없음</DialogTitle>
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                        <MaterialIcon name="error_outline" size="xl" className="opacity-50 mb-2" />
                        <p>정보를 불러올 수 없습니다.</p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                className="w-full h-full max-w-none max-h-none h-screen sm:h-auto sm:max-h-[85vh] sm:max-w-2xl p-0 border-0 sm:border sm:border-white/[0.1] bg-[#0F151B] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl sm:top-[12vh] sm:translate-y-0"
                style={{ marginLeft: position.x, marginTop: position.y }}
            >
                <div className="shrink-0 px-6 pt-6 pb-1 flex items-start justify-between bg-[#0F151B] relative z-20 cursor-move select-none" onPointerDown={handlePointerDown}>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <DialogTitle className="text-white text-2xl font-bold leading-tight tracking-tight drop-shadow-md flex items-center gap-2">
                                {isEditing ? <Input className="bg-[#1A2633] border-emerald-500/30 h-9 text-xl font-bold text-white max-w-[200px]" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} autoFocus /> : member?.name || 'Loading...'}
                            </DialogTitle>
                            {member && <span className={cn("inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm", member.status === '정상' ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : member.status === '차명' ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-gray-500/20 border-gray-500/30 text-gray-300")}>{member.status || '미정'}</span>}
                            <div className="flex gap-1.5 flex-wrap">
                                {(() => {
                                    let combinedTiers = [...(member?.tiers || [])];
                                    if (member?.acts_as_agent_for && member.acts_as_agent_for.length > 0 && !combinedTiers.includes('대리인')) {
                                        combinedTiers.push('대리인');
                                    }
                                    return combinedTiers
                                        .map(t => {
                                            const priorityMap: Record<string, number> = {
                                                '등기조합원': 1,
                                                '지주조합원': 2,
                                                '2차': 3,
                                                '일반분양': 4,
                                                '예비조합원': 5,
                                                '권리증보유자': 6,
                                                '지주': 7,
                                                '대리인': 8,
                                                '관계인': 9,
                                            };
                                            return { t, p: priorityMap[t] || 99 };
                                        })
                                        .sort((a, b) => a.p - b.p)
                                        .map(({ t }, idx) => {
                                            let display = t;
                                            if (t === '등기조합원') display = '조합원(등기)';
                                            else if (t === '지주조합원') display = '조합원(지주)';
                                            else if (t === '2차') display = '조합원(2차)';
                                            else if (t === '일반분양') display = '조합원(일반분양)';
                                            else if (t === '예비조합원') display = '조합원(예비)';
                                            else if (t === '지주') display = '원지주';
                                            else if (t === '권리증보유자') display = '권리증보유';

                                            return (
                                                <span key={`${member?.id}-${idx}`} className="inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm bg-emerald-500/20 border-emerald-500/30 text-emerald-300">
                                                    {display}
                                                </span>
                                            );
                                        })
                                })()}
                            </div>
                        </div>
                        <p className="text-gray-400 text-sm font-normal">회원번호: <span className="text-gray-300 font-mono">{member?.member_number}</span></p>
                        <p className="text-gray-500 text-xs font-normal">권리증: <span className="text-gray-300 font-mono">{member?.certificate_display || '-'}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-8 px-3 text-xs text-gray-400 hover:text-white hover:bg-white/5">취소</Button>
                                <Button size="sm" onClick={handleSave} disabled={saving || deleting} className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20">{saving ? '저장...' : '저장'}</Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDeleteMember}
                                    disabled={deleting || loading || !member}
                                    className="h-8 px-3 text-xs border-rose-500/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-rose-100 font-bold"
                                >
                                    <MaterialIcon name="delete" size="xs" className="mr-1.5" />
                                    {deleting ? '삭제 중...' : '인물 삭제'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={deleting} className="h-8 px-3 text-xs border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 font-bold"><MaterialIcon name="edit" size="xs" className="mr-1.5" />정보 수정</Button>
                            </>
                        )}
                        <Link href={`/members/${member?.id}`} className="group p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center" title="전체 페이지로 이동"><MaterialIcon name="open_in_new" className="text-gray-400 group-hover:text-white transition-colors" size="sm" /></Link>
                        <button onClick={handleClose} className="group p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"><MaterialIcon name="close" className="text-gray-400 group-hover:text-white transition-colors" size="sm" /></button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 relative px-0 pb-0 bg-[#0F151B]">
                    <div className="flex items-end px-4 relative z-10">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("relative group flex items-center justify-center pb-3 outline-none transition-all", isActive ? "min-w-[100px] px-4 pt-3.5 z-20" : "min-w-[110px] px-6 pt-4 text-gray-500 hover:text-gray-300 z-10")}>
                                    {isActive ? (
                                        <>
                                            {/* Dashboard-style bottom curves (wings) */}
                                            <div className="absolute bottom-0 -left-4 w-4 h-4 z-10 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, transparent 16px, #1A2633 16.5px)' }} />
                                            {/* Main Background with subtle outline */}
                                            <div className="absolute inset-0 bg-[#1A2633] rounded-t-xl z-0 shadow-[-1px_-1px_0_rgba(255,255,255,0.05)]" />
                                            {/* Gradient top line */}
                                            <div className="absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0 opacity-70 z-20" />
                                            {/* Dashboard-style right curve */}
                                            <div className="absolute bottom-0 -right-4 w-4 h-4 z-10 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)' }} />

                                            <div className="relative z-20 flex items-center gap-2">
                                                <MaterialIcon name={tab.icon} className="text-[18px] text-blue-400" />
                                                <p className="text-white text-sm font-bold tracking-wide">{tab.label}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="relative z-10 flex items-center gap-2">
                                            <MaterialIcon name={tab.icon} className="text-[18px]" />
                                            <p className="text-xs font-semibold">{tab.label}</p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#1A2633] z-0" />
                    </div>

                    <div className="flex-1 bg-[#1A2633] relative z-0 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50"><MaterialIcon name="refresh" className="animate-spin" /><span className="text-xs font-bold">로딩 중...</span></div>
                            ) : (
                                <>
                                    {activeTab === 'info' && member && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
                                            <div className="mb-6 rounded-xl bg-gradient-to-br from-[#233040] to-[#1e2836] p-4 shadow-lg border border-white/5 relative overflow-hidden group">
                                                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                                                    <div className="flex items-center gap-2"><MaterialIcon name="smart_toy" className="text-blue-400 text-xl" /><h3 className="text-white text-sm font-bold tracking-wide">AI 분석 인사이트</h3></div>
                                                    <div className="flex flex-wrap items-center gap-2 justify-end">
                                                        {(member.tags || ['#강성민원', '#납부약정']).map((tag, i) => (
                                                            <div key={i} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 border", tag.includes('강성') ? "bg-red-500/10 border-red-500/20 text-red-200" : tag.includes('납부') ? "bg-blue-500/10 border-blue-500/20 text-blue-200" : "bg-gray-700/50 border-gray-600/50 text-gray-300")}>
                                                                <MaterialIcon name={tag.includes('강성') ? 'warning' : tag.includes('납부') ? 'thumb_up' : 'schedule'} className={cn("text-[16px]", tag.includes('강성') ? "text-red-400" : tag.includes('납부') ? "text-blue-400" : "text-gray-400")} />
                                                                <span className="text-xs font-bold">{tag}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-[#233040] rounded-xl shadow-sm border border-white/5 p-5">
                                                <h3 className="text-white text-base font-bold mb-3 flex items-center gap-2"><span className="w-1 h-4 bg-blue-500 rounded-full"></span>기본 연락처</h3>
                                                <div className="flex flex-col gap-0">
                                                    <div className="grid grid-cols-2">
                                                        <InfoRow icon="person" label="성명" value={member.name || '미입력'} isEditing={isEditing} editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white font-bold" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} />} />
                                                        <InfoRow icon="cake" label="생년월일" value={member.birth_date || '미입력'} isEditing={isEditing} editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.birth_date || ''} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} placeholder="YYYY-MM-DD" />} />
                                                    </div>
                                                    <div className="grid grid-cols-2">
                                                        <InfoRow
                                                            icon="badge"
                                                            label="주민번호"
                                                            value={isEditing ? '' : (
                                                                <div className="flex items-center gap-2">
                                                                    <span>{isSsnRevealed ? (member.resident_registration_number || '미입력') : (member.resident_registration_number ? member.resident_registration_number.slice(0, 8) + '******' : '미입력')}</span>
                                                                    {!isEditing && member.resident_registration_number && (
                                                                        <Button variant="ghost" size="sm" onClick={() => setIsSsnRevealed(!isSsnRevealed)} className="h-6 px-1.5 text-[10px] text-gray-500 hover:text-white hover:bg-white/5">
                                                                            <MaterialIcon name={isSsnRevealed ? 'visibility_off' : 'visibility'} size="xs" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            isEditing={isEditing}
                                                            editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.resident_registration_number || ''} onChange={e => setFormData({ ...formData, resident_registration_number: e.target.value })} placeholder="000000-0000000" />}
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2">
                                                        <InfoRow icon="smartphone" label="휴대전화" value={member.phone || '미입력'} isEditing={isEditing} editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />} />
                                                        <InfoRow icon="phone" label="보조 휴대전화" value={member.secondary_phone || '미입력'} isEditing={isEditing} editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.secondary_phone || ''} onChange={e => setFormData({ ...formData, secondary_phone: e.target.value })} />} />
                                                    </div>
                                                    <div className="grid grid-cols-2">
                                                        <InfoRow icon="mail" label="이메일" value={member.email || '미입력'} isEditing={isEditing} editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />} />
                                                    </div>
                                                    <InfoRow icon="home" label="현주소" value={member.address_legal || '미입력'} isEditing={isEditing} editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.address_legal || ''} onChange={e => setFormData({ ...formData, address_legal: e.target.value })} />} />
                                                </div>

                                                <h3 className="text-white text-base font-bold mt-6 mb-3 flex items-center gap-2"><span className="w-1 h-4 bg-emerald-500 rounded-full"></span>대리인 정보</h3>
                                                {(member.representative || member.representative2 || isEditing) ? (
                                                    <div className="space-y-3 text-left">
                                                        <RepresentativeRow label="대리인1" data={formData.representative} isEditing={isEditing} onChange={val => setFormData({ ...formData, representative: val })} />
                                                        <RepresentativeRow label="대리인2" data={formData.representative2} isEditing={isEditing} onChange={val => setFormData({ ...formData, representative2: val })} />
                                                    </div>
                                                ) : <div className="bg-gray-800/10 border border-dashed border-white/10 rounded-xl p-6 text-center"><p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest">지정된 대리인 정보가 없습니다.</p></div>}

                                                {/* Admin memo - always shown regardless of representative data */}
                                                {(member.memo || isEditing || (member.acts_as_agent_for && member.acts_as_agent_for.length > 0)) && (
                                                    <div className="flex flex-col gap-3 pt-4">
                                                        <div className="flex items-center gap-2"><MaterialIcon name="sticky_note_2" className="text-yellow-500/70 text-[18px]" /><p className="text-gray-400 text-xs font-medium">관리자 메모</p></div>
                                                        {isEditing ? (
                                                            <textarea className="w-full h-24 rounded-lg bg-[#1A2633] border border-white/10 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-white resize-none" value={formData.memo || ''} onChange={e => setFormData({ ...formData, memo: e.target.value })} />
                                                        ) : (
                                                            <div className="bg-yellow-900/10 border border-yellow-500/20 p-4 rounded-lg flex flex-col gap-2">
                                                                {member.acts_as_agent_for && member.acts_as_agent_for.length > 0 && (
                                                                    <div className="flex flex-col gap-1 pb-2 border-b border-yellow-500/10 last:border-0 last:pb-0">
                                                                        {member.acts_as_agent_for.map((af, idx) => (
                                                                            <span key={idx} className="text-emerald-400 font-bold text-sm flex items-center gap-1.5"><MaterialIcon name="person" size="xs" /> {af.name}의 대리인 <span className="text-xs font-normal text-emerald-500/70">({af.relation})</span></span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <p className="text-gray-200 text-sm leading-relaxed break-keep text-left whitespace-pre-wrap">{member.memo || (member.acts_as_agent_for?.length ? '' : '메모가 없습니다.')}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {saveFeedback && <div className="pt-4"><p className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", saveFeedback.tone === 'success' && 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200', saveFeedback.tone === 'warn' && 'border-amber-400/20 bg-amber-500/10 text-amber-200', saveFeedback.tone === 'error' && 'border-rose-400/20 bg-rose-500/10 text-rose-200')}>{saveFeedback.message}</p></div>}
                                        </div>
                                    )}

                                    {activeTab === 'admin' && member && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
                                            <div className="bg-[#1a2333] p-4 rounded-xl border border-sky-500/20 flex items-center gap-3">
                                                <div className="flex-1"><p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mb-1 text-left">신규 권리증 등록</p><Input value={rightInput} onChange={(e) => setRightInput(e.target.value)} placeholder="권리증 번호 입력" className="h-9 bg-slate-900 border-slate-700 text-sky-100 font-mono text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAddRight()} /></div>
                                                <Button onClick={handleAddRight} disabled={isAddingRight || !rightInput.trim()} className="mt-5 h-9 bg-sky-600 hover:bg-sky-500 text-white gap-1.5" size="sm"><MaterialIcon name="add_circle" size="xs" /><span className="text-xs font-bold whitespace-nowrap">추가</span></Button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">등록 row 수</span>
                                                    <span className="text-2xl font-black text-white font-mono">{member.assetRights?.length || 0} <span className="text-sm font-normal text-gray-400">개</span></span>
                                                </div>
                                                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">사람별 잠정 개수</span>
                                                    <span className="text-2xl font-black text-sky-300 font-mono">{member.provisional_certificate_count || 0} <span className="text-sm font-normal text-gray-400">개</span></span>
                                                    <span className="text-[11px] text-gray-400">registry dedupe 기준</span>
                                                </div>
                                                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">최종 권리증 개수</span>
                                                    <span className="text-2xl font-black text-emerald-300 font-mono">{member.effective_certificate_count || 0} <span className="text-sm font-normal text-gray-400">개</span></span>
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                                        <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-200">
                                                            {CERTIFICATE_SUMMARY_STATUS_LABEL[member.certificate_summary_review_status || 'pending']}
                                                        </span>
                                                        {(member.certificate_summary_conflict_count || 0) > 0 && (
                                                            <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-200">
                                                                충돌 {member.certificate_summary_conflict_count}건
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="bg-[#1a2333] p-4 rounded-xl border border-emerald-500/15 space-y-3">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">사람별 확정 개수</p>
                                                        <p className="text-xs text-gray-400">
                                                            번호 row 수와 별개로, 실제 보유 개수를 수동 확정하는 영역입니다.
                                                        </p>
                                                    </div>
                                                    {member.certificate_summary_is_grouped && (
                                                        <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                                                            통합 인물 묶음: 직접 수정 비활성화
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">수동 최종 개수</span>
                                                        {isEditing && canEditCertificateSummary ? (
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                className="bg-[#1A2633] border-white/10 h-8 text-sm text-white font-mono"
                                                                value={formData.manual_certificate_count ?? ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    manual_certificate_count: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0),
                                                                })}
                                                                placeholder={String(member.provisional_certificate_count || 0)}
                                                            />
                                                        ) : (
                                                            <div className="h-8 rounded-md border border-white/10 bg-[#1A2633] px-3 flex items-center text-sm font-bold text-white font-mono">
                                                                {member.manual_certificate_count ?? '-'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">검수 상태</span>
                                                        {isEditing && canEditCertificateSummary ? (
                                                            <select
                                                                className="bg-[#1A2633] border border-white/10 h-8 text-sm text-white rounded-md px-2 w-full"
                                                                value={formData.certificate_summary_review_status || 'pending'}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    certificate_summary_review_status: e.target.value as CertificateSummaryReviewStatus,
                                                                })}
                                                            >
                                                                {Object.entries(CERTIFICATE_SUMMARY_STATUS_LABEL).map(([value, label]) => (
                                                                    <option key={value} value={value}>
                                                                        {label}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <div className="h-8 rounded-md border border-white/10 bg-[#1A2633] px-3 flex items-center text-sm font-bold text-white">
                                                                {CERTIFICATE_SUMMARY_STATUS_LABEL[member.certificate_summary_review_status || 'pending']}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">소유 구분</span>
                                                        <div className="h-8 rounded-md border border-white/10 bg-[#1A2633] px-3 flex items-center text-sm font-bold text-white">
                                                            {member.owner_group === 'registered' ? '등기조합원' : '기타'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase">개수 메모</span>
                                                    {isEditing && canEditCertificateSummary ? (
                                                        <Input
                                                            className="bg-[#1A2633] border-white/10 h-8 text-sm text-white"
                                                            value={formData.certificate_summary_note || ''}
                                                            onChange={(e) => setFormData({ ...formData, certificate_summary_note: e.target.value })}
                                                            placeholder="예: 오학동 실보유 4개, 추가 확인 완료"
                                                        />
                                                    ) : (
                                                        <div className="min-h-8 rounded-md border border-white/10 bg-[#1A2633] px-3 py-2 text-sm font-medium text-white">
                                                            {member.certificate_summary_note || '-'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            {member.assetRights && member.assetRights.length > 0 ? (
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-2 gap-4 text-left">
                                                        <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider text-left">권리증 row</span><span className="text-2xl font-black text-white font-mono text-left">{member.assetRights.length} <span className="text-sm font-normal text-gray-400">개</span></span></div>
                                                        <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider text-left">권리증 총액</span><span className="text-2xl font-black text-blue-400 font-mono text-left">₩{member.assetRights.reduce((acc: number, r: any) => acc + (Number(r.certificate_price) || Number(r.principal_amount) || 0), 0).toLocaleString()}</span>{member.assetRights.some((r: any) => Number(r.premium_price) > 0) && <span className="text-[11px] font-bold text-amber-400">+ 프리미엄 ₩{member.assetRights.reduce((acc: number, r: any) => acc + (Number(r.premium_price) || 0), 0).toLocaleString()}</span>}</div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <h3 className="text-white text-base font-bold flex items-center gap-2"><span className="w-1 h-4 bg-sky-500 rounded-full"></span>상세 보유 내역</h3>
                                                        <div className="grid gap-3">
                                                            {(formData.assetRights || []).map((right) => (
                                                                <div key={right.id} className="bg-[#233040] rounded-xl border border-white/5 p-5 hover:border-white/10 transition-colors">
                                                                    <div className="flex items-start justify-between mb-3 text-left gap-4">
                                                                        <div className="flex flex-col gap-1 text-left flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest text-left">{right.right_type === 'certificate' ? '권리증' : right.right_type || '권리증'}</span>
                                                                                {conflictRightNumbers.includes(right.right_number || '') && (
                                                                                    <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-500 rounded border border-rose-500/20 text-[10px] font-black shrink-0">⚠️ 중복(경합)</span>
                                                                                )}
                                                                                {right.right_number_status && (
                                                                                    <span className="px-1.5 py-0.5 bg-sky-500/10 text-sky-300 rounded border border-sky-500/20 text-[10px] font-black shrink-0">
                                                                                        {RIGHT_NUMBER_STATUS_LABEL[right.right_number_status]}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {isEditing ? (
                                                                                <Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white font-mono font-bold" value={right.right_number_raw || right.right_number || ''} onChange={e => handleRightChange(right.id, 'right_number', e.target.value)} placeholder="번호 또는 원문 입력" />
                                                                            ) : (
                                                                                <span className="text-lg font-black text-white font-mono tracking-tight text-left truncate">{right.right_number || right.right_number_raw || '번호 없음'}</span>
                                                                            )}
                                                                            {!isEditing && right.right_number_status && right.right_number_status !== 'confirmed' && right.right_number_raw && (
                                                                                <span className="text-[11px] text-gray-400 text-left truncate">원문: {right.right_number_raw}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-right flex flex-col gap-1 w-[120px] shrink-0 pt-1">
                                                                            <div className="flex items-center justify-end gap-2">
                                                                                {isEditing && (
                                                                                    <button onClick={() => handleDeleteRight(right.id)} className="flex items-center justify-center px-1.5 py-0.5 text-rose-400 hover:bg-rose-500/20 bg-rose-500/10 rounded border border-rose-500/20 transition-colors gap-1 text-[10px]">
                                                                                        <MaterialIcon name="delete" size="xs" className="text-[12px]" />
                                                                                        삭제
                                                                                    </button>
                                                                                )}
                                                                                <span className="text-[10px] font-bold text-gray-500 uppercase">발급일</span>
                                                                            </div>
                                                                            {isEditing ? (
                                                                                <Input className="bg-[#1A2633] border-white/10 h-8 text-xs text-white font-mono px-2 text-right" value={right.issued_at || ''} onChange={e => handleRightChange(right.id, 'issued_at', e.target.value)} placeholder="YYYY-MM-DD" />
                                                                            ) : (
                                                                                <span className="text-xs font-bold text-gray-300 font-mono">{right.issued_at || '미상'}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-[1fr_1fr] gap-4 pt-3 border-t border-white/5 text-left">
                                                                        <div className="flex flex-col gap-1 text-left min-w-0">
                                                                            <span className="text-[10px] font-bold text-gray-500 uppercase text-left">가액 / 납부액</span>
                                                                            {isEditing ? (
                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-sm font-bold text-gray-500">₩</span>
                                                                                    <Input type="number" className="bg-[#1A2633] border-white/10 h-8 text-sm text-white font-mono w-full" value={right.principal_amount || ''} onChange={e => handleRightChange(right.id, 'principal_amount', e.target.value)} placeholder="0" />
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-white font-mono text-left truncate">₩{(Number(right.principal_amount) || 0).toLocaleString()}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 text-left min-w-0">
                                                                            <span className="text-[10px] font-bold text-gray-500 uppercase text-left">권리 명의자</span>
                                                                            {isEditing ? (
                                                                                <Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white w-full" value={right.meta?.cert_name || ''} onChange={e => handleRightChange(right.id, 'cert_name', e.target.value)} placeholder={member.name} />
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-white flex items-center gap-1.5 text-left truncate">
                                                                                    <span className="truncate">{right.meta?.cert_name || member.name}</span>
                                                                                    {(right.meta?.cert_name && right.meta.cert_name !== member.name) && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 rounded border border-yellow-500/20 font-black shrink-0">성명 상이</span>}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/5 text-left">
                                                                        <div className="flex flex-col gap-1 text-left min-w-0">
                                                                            <span className="text-[10px] font-bold text-gray-500 uppercase text-left">권리증 상태</span>
                                                                            {isEditing ? (
                                                                                <select
                                                                                    className="bg-[#1A2633] border border-white/10 h-8 text-sm text-white rounded-md px-2"
                                                                                    value={right.right_number_status || 'review_required'}
                                                                                    onChange={(e) => handleRightStatusChange(right.id, e.target.value as RightNumberStatus)}
                                                                                >
                                                                                    {RIGHT_NUMBER_STATUS_OPTIONS.map((status) => (
                                                                                        <option key={status} value={status}>
                                                                                            {RIGHT_NUMBER_STATUS_LABEL[status]}
                                                                                        </option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-white text-left">
                                                                                    {right.right_number_status ? RIGHT_NUMBER_STATUS_LABEL[right.right_number_status] : '-'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex flex-col gap-1 text-left min-w-0">
                                                                            <span className="text-[10px] font-bold text-gray-500 uppercase text-left">검수 메모</span>
                                                                            {isEditing ? (
                                                                                <Input
                                                                                    className="bg-[#1A2633] border-white/10 h-8 text-sm text-white w-full"
                                                                                    value={right.right_number_note || ''}
                                                                                    onChange={e => handleRightChange(right.id, 'right_number_note', e.target.value)}
                                                                                    placeholder="검수 메모"
                                                                                />
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-white text-left truncate">{right.right_number_note || '-'}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* 취득 정보 (엑셀 마이그레이션 데이터) */}
                                                                    {(right.holder_name || right.price_text || right.acquisition_source || right.issued_date) && (
                                                                        <div className="mt-3 pt-3 border-t border-white/5">
                                                                            <div className="flex items-center gap-1.5 mb-2">
                                                                                <MaterialIcon name="receipt_long" size="xs" className="text-amber-400/70" />
                                                                                <span className="text-[10px] font-bold text-amber-400/70 uppercase tracking-wider">취득 정보</span>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                                {right.holder_name && (
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[9px] font-bold text-gray-500 uppercase">필증 성명</span>
                                                                                        <span className="text-xs font-bold text-gray-200">{right.holder_name}</span>
                                                                                    </div>
                                                                                )}
                                                                                {right.issued_date && (
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[9px] font-bold text-gray-500 uppercase">필증 발급일</span>
                                                                                        <span className="text-xs font-bold text-gray-200 font-mono">{right.issued_date}</span>
                                                                                    </div>
                                                                                )}
                                                                                {right.price_text && (
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[9px] font-bold text-gray-500 uppercase">거래 가격</span>
                                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                                            {Number(right.certificate_price) > 0 && (
                                                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20">
                                                                                                    필증 {(Number(right.certificate_price) / 10000).toLocaleString()}만
                                                                                                </span>
                                                                                            )}
                                                                                            {Number(right.premium_price) > 0 && (
                                                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-300 rounded border border-amber-500/20">
                                                                                                    P {(Number(right.premium_price) / 10000).toLocaleString()}만
                                                                                                </span>
                                                                                            )}
                                                                                            {Number(right.broker_fee) > 0 && (
                                                                                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-500/10 text-gray-400 rounded border border-gray-500/20">
                                                                                                    수수료 {(Number(right.broker_fee) / 10000).toLocaleString()}만
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {right.acquisition_source && (
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[9px] font-bold text-gray-500 uppercase">구입처</span>
                                                                                        <span className="text-xs font-bold text-gray-200">{right.acquisition_source}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-50 gap-3 border border-dashed border-white/10 rounded-2xl"><MaterialIcon name="database_off" size="xl" /><p className="text-sm font-bold">연동된 권리증 데이터가 없습니다.</p></div>}
                                        </div>
                                    )}
                                    {activeTab === 'timeline' && memberIds && <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><ActivityTimelineTab memberIds={memberIds} /></div>}
                                    {activeTab === 'payment' && memberIds && member && <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><PaymentStatusTab memberIds={memberIds} memberName={member?.name ?? ''} unitGroup={member?.unit_group} /></div>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InfoRow({ icon, label, value, isEditing, editElement }: { icon: string; label: string; value: string | React.ReactNode; isEditing: boolean; editElement: React.ReactNode; }) {
    return (
        <div className="grid grid-cols-[80px_1fr] items-center gap-4 border-b border-white/5 py-3 last:border-0">
            <div className="flex items-center gap-2"><MaterialIcon name={icon} className="text-gray-500 text-[18px]" /><p className="text-gray-400 text-xs font-medium">{label}</p></div>
            {isEditing ? editElement : <div className="text-gray-100 text-sm font-normal break-all text-left">{value}</div>}
        </div>
    );
}

function RepresentativeRow({ label, data, isEditing, onChange }: { label: string, data: any, isEditing: boolean, onChange: (val: any) => void }) {
    if (!data && !isEditing) return null;
    return (
        <div className="bg-[#182a3a]/40 border border-emerald-500/10 rounded-xl p-4">
            <div className="grid grid-cols-[1fr_0.8fr_1.5fr] gap-4 items-end">
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-left pl-1">{label} 성명</p>
                    {isEditing ? <Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={data?.name || ''} onChange={e => onChange({ ...(data || { id: '', name: '', relation: '대리인', phone: '' }), name: e.target.value })} placeholder="성명" /> : <p className="text-sm font-bold text-white flex items-center gap-2 pl-1 mb-1"><MaterialIcon name="person" size="xs" className="text-emerald-400" />{data?.name || '없음'}</p>}
                </div>
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-left pl-1">관계</p>
                    {isEditing ? <Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white w-full" value={data?.relation || ''} onChange={e => onChange({ ...(data || { id: '', name: '', relation: '', phone: '' }), relation: e.target.value })} placeholder="관계" /> : <div className="pl-1 mb-1"><span className="text-xs font-medium text-emerald-200 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{data?.relation || '-'}</span></div>}
                </div>
                <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase text-left pl-1">연락처</p>
                    {isEditing ? <Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={data?.phone || ''} onChange={e => onChange({ ...(data || { id: '', name: '', relation: '대리인', phone: '' }), phone: e.target.value })} placeholder="전화번호" /> : <p className="text-sm font-mono text-gray-300 pl-1 mb-1">{data?.phone || '-'}</p>}
                </div>
            </div>
        </div>
    );
}

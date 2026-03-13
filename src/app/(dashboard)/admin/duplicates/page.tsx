import { Metadata } from 'next';
import { getDuplicateGroups } from '@/app/actions/duplicates';
import DuplicatesManager from './DuplicatesManager';

export const metadata: Metadata = {
    title: '중복 인물 관리 | People On',
    description: '시스템 내 전화번호가 동일한 중복 의심 인물을 비교하고 병합합니다.',
};

export default async function AdminDuplicatesPage() {
    // 서버 컴포넌트에서 데이터 직접 패치
    const duplicateGroups = await getDuplicateGroups();

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight mb-2 text-foreground">중복 인물 관리</h1>
                <p className="text-muted-foreground">
                    연락처가 동일하지만 성명이 다르거나 시스템이 일치 여부를 확신하지 못해 자동 병합되지 않은 인물 그룹입니다.
                    수동으로 검토하여 동일인일 경우 하나로 병합하거나, 가족/대리인 등으로 별개의 인물이 맞을 경우 '병합 제외'로 처리하세요.
                </p>
            </div>

            <DuplicatesManager initialGroups={duplicateGroups} />
        </div>
    );
}

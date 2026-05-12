import { MemberDetailPageClient } from './MemberDetailPageClient';

export default async function MemberDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    return <MemberDetailPageClient memberId={id} />;
}

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createAuditLog } from '@/app/actions/audit';
import { AuthorizationError, authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';

const BUCKET = 'member-profile-images';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

async function requireMemberAccess() {
    const supabase = await createClient();
    const auth = await requireRole(ROLE_GROUPS.opsAdmin, supabase);
    return { supabase, auth };
}

async function getEntityMeta(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin.from('account_entities').select('meta').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data?.meta && typeof data.meta === 'object' ? data.meta : {}) as Record<string, unknown>;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireMemberAccess();
        const { id } = await params;
        const meta = await getEntityMeta(id);
        const path = typeof meta.profile_image_path === 'string' ? meta.profile_image_path : null;
        if (!path) return NextResponse.json({ url: null });
        const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        if (error) return NextResponse.json({ url: null, error: error.message }, { status: 404 });
        return NextResponse.json({ url: data.signedUrl });
    } catch (error) {
        if (error instanceof AuthorizationError) return authzErrorResponse(error);
        return NextResponse.json({ error: error instanceof Error ? error.message : '사진 조회 실패' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { auth } = await requireMemberAccess();
        const { id } = await params;
        const form = await request.formData();
        const file = form.get('file');
        if (!(file instanceof File)) return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
        const extension = MIME_EXTENSIONS[file.type];
        if (!extension) return NextResponse.json({ error: 'JPG, PNG, WebP 파일만 업로드할 수 있습니다.' }, { status: 400 });
        if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: '파일은 5MB 이하여야 합니다.' }, { status: 400 });

        const admin = createAdminClient();
        const buckets = await admin.storage.listBuckets();
        if (!buckets.data?.some((bucket) => bucket.name === BUCKET)) {
            const created = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_BYTES, allowedMimeTypes: Object.keys(MIME_EXTENSIONS) });
            if (created.error) throw created.error;
        }

        const previousMeta = await getEntityMeta(id);
        const previousPath = typeof previousMeta.profile_image_path === 'string' ? previousMeta.profile_image_path : null;
        const path = `${id}/profile-${Date.now()}.${extension}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        const uploaded = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '3600' });
        if (uploaded.error) throw uploaded.error;

        const updatedAt = new Date().toISOString();
        const { error: updateError } = await admin.from('account_entities').update({
            meta: { ...previousMeta, profile_image_path: path, profile_image_updated_at: updatedAt, profile_image_updated_by: auth.user.id },
        }).eq('id', id);
        if (updateError) {
            await admin.storage.from(BUCKET).remove([path]);
            throw updateError;
        }
        if (previousPath) await admin.storage.from(BUCKET).remove([previousPath]);
        await createAuditLog('UPDATE_MEMBER_PROFILE_IMAGE', id, { previous_path: previousPath, new_path: path, mime_type: file.type, size: file.size });
        revalidatePath(`/members/${id}`);
        const signed = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        return NextResponse.json({ success: true, url: signed.data?.signedUrl || null, path, updatedAt });
    } catch (error) {
        if (error instanceof AuthorizationError) return authzErrorResponse(error);
        return NextResponse.json({ error: error instanceof Error ? error.message : '사진 업로드 실패' }, { status: 500 });
    }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { auth } = await requireMemberAccess();
        const { id } = await params;
        const admin = createAdminClient();
        const meta = await getEntityMeta(id);
        const path = typeof meta.profile_image_path === 'string' ? meta.profile_image_path : null;
        const nextMeta = { ...meta, profile_image_path: null, profile_image_updated_at: new Date().toISOString(), profile_image_updated_by: auth.user.id };
        const { error } = await admin.from('account_entities').update({ meta: nextMeta }).eq('id', id);
        if (error) throw error;
        if (path) await admin.storage.from(BUCKET).remove([path]);
        await createAuditLog('DELETE_MEMBER_PROFILE_IMAGE', id, { previous_path: path });
        revalidatePath(`/members/${id}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthorizationError) return authzErrorResponse(error);
        return NextResponse.json({ error: error instanceof Error ? error.message : '사진 삭제 실패' }, { status: 500 });
    }
}

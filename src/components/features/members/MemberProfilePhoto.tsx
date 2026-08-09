'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

async function normalizeProfileImage(file: File) {
    const bitmap = await createImageBitmap(file);
    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.max(0, (bitmap.width - sourceSize) / 2);
    const sourceY = Math.max(0, (bitmap.height - sourceSize) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리할 수 없습니다.');
    context.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!blob) throw new Error('사진을 변환할 수 없습니다.');
    return new File([blob], 'profile.webp', { type: 'image/webp' });
}

export function MemberProfilePhoto({ memberId, name, hasImage, onChanged }: { memberId: string; name: string; hasImage: boolean; onChanged?: () => void }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            if (!hasImage) {
                await Promise.resolve();
                if (!cancelled) setUrl(null);
                return;
            }
            const response = await fetch(`/api/members/${memberId}/profile-image`, { cache: 'no-store' });
            const payload = response.ok ? await response.json() : null;
            if (!cancelled) setUrl(payload?.url || null);
        })();
        return () => { cancelled = true; };
    }, [memberId, hasImage]);

    const upload = async (file?: File) => {
        if (!file) return;
        setBusy(true); setFeedback(null);
        try {
            const normalized = await normalizeProfileImage(file);
            const form = new FormData(); form.append('file', normalized);
            const response = await fetch(`/api/members/${memberId}/profile-image`, { method: 'POST', body: form });
            const payload = await response.json().catch(() => null);
            if (response.ok) { setUrl(payload?.url || null); onChanged?.(); }
            else setFeedback(payload?.error || '사진을 저장하지 못했습니다.');
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : '사진을 처리하지 못했습니다.');
        }
        setBusy(false);
    };

    const remove = async () => {
        if (!confirm('조합원 사진을 삭제하시겠습니까?')) return;
        setBusy(true); setFeedback(null);
        const response = await fetch(`/api/members/${memberId}/profile-image`, { method: 'DELETE' });
        const payload = await response.json().catch(() => null);
        if (response.ok) { setUrl(null); onChanged?.(); }
        else setFeedback(payload?.error || '사진을 삭제하지 못했습니다.');
        setBusy(false);
    };

    return <div className="group relative shrink-0">
        <button type="button" disabled={!url} onClick={() => setPreviewOpen(true)} className="relative flex size-14 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-slate-100 text-2xl font-black text-sky-700 shadow-lg disabled:cursor-default" aria-label={url ? `${name} 사진 크게 보기` : undefined} title={url ? '사진 크게 보기' : undefined}>
            {url ? <Image src={url} alt={`${name} 조합원 사진`} fill sizes="56px" unoptimized className="object-cover" onError={() => setUrl(null)} /> : name.slice(0, 1) || '조'}
        </button>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-cyan-300/30 bg-[#0a2237] text-cyan-300 shadow-md hover:bg-cyan-500/20" aria-label="조합원 사진 업로드"><MaterialIcon name={busy ? 'progress_activity' : 'photo_camera'} size="xs" className={busy ? 'animate-spin' : ''} /></button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        {url ? <button type="button" onClick={() => void remove()} className="absolute -left-1 -top-1 hidden size-5 items-center justify-center rounded-full bg-rose-500 text-white group-hover:flex" aria-label="조합원 사진 삭제"><MaterialIcon name="close" size="xs" /></button> : null}
        {feedback ? <span className="absolute left-0 top-16 z-50 w-56 rounded border border-rose-400/20 bg-[#101d2b] p-2 text-xs text-rose-300 shadow-xl">{feedback}</span> : null}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-3xl border-white/10 bg-[#071521] p-3">
                <DialogTitle className="px-2 text-base font-bold text-slate-100">{name} 사진</DialogTitle>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/30">
                    {url ? <Image src={url} alt={`${name} 조합원 사진 크게 보기`} fill sizes="min(90vw, 768px)" unoptimized className="object-contain" /> : null}
                </div>
            </DialogContent>
        </Dialog>
    </div>;
}

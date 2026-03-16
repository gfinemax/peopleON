"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { MaterialIcon } from "@/components/ui/icon"
import { ScrollArea } from "@/components/ui/scroll-area"

type PreviewStatus = 'matched' | 'duplicate_member_name' | 'duplicate_source_name' | 'member_not_found'

type PreviewRow = {
    rowNumber: number
    sourceName: string
    maskedResidentRegistrationNumber: string
    status: PreviewStatus
    matchedMemberName: string | null
    targetEntityIds: string[]
    hasExistingResidentNumber: boolean
}

type MissingMemberRow = {
    id: string
    name: string
    entityIds: string[]
    hasExistingResidentNumber: boolean
}

type PreviewPayload = {
    filePath: string
    fileName: string
    registeredMemberCount: number
    sourceRowCount: number
    matchedCount: number
    duplicateMemberNameCount: number
    duplicateSourceNameCount: number
    memberNotFoundCount: number
    missingRegisteredCount: number
    existingResidentCount: number
    previewRows: PreviewRow[]
    missingMembers: MissingMemberRow[]
}

interface ResidentRegistryImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const statusLabel: Record<PreviewStatus, string> = {
    matched: '정확 매칭',
    duplicate_member_name: '명단 중복',
    duplicate_source_name: '엑셀 중복',
    member_not_found: '명단 없음',
}

const statusTone: Record<PreviewStatus, string> = {
    matched: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    duplicate_member_name: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    duplicate_source_name: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
    member_not_found: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
}

export function ResidentRegistryImportDialog({ open, onOpenChange }: ResidentRegistryImportDialogProps) {
    const router = useRouter()
    const [loadingPreview, setLoadingPreview] = React.useState(false)
    const [submitting, setSubmitting] = React.useState(false)
    const [forceOverwrite, setForceOverwrite] = React.useState(false)
    const [preview, setPreview] = React.useState<PreviewPayload | null>(null)
    const [error, setError] = React.useState<string | null>(null)
    const [resultMessage, setResultMessage] = React.useState<string | null>(null)

    const loadPreview = React.useCallback(async () => {
        setLoadingPreview(true)
        setError(null)
        setResultMessage(null)
        try {
            const response = await fetch('/api/members/resident-registry-import', { cache: 'no-store' })
            const json = await response.json()
            if (!response.ok || !json.success) {
                throw new Error(json.error || '주민번호 미리보기를 불러오지 못했습니다.')
            }
            setPreview(json.preview as PreviewPayload)
        } catch (fetchError) {
            setPreview(null)
            setError(fetchError instanceof Error ? fetchError.message : '주민번호 미리보기를 불러오지 못했습니다.')
        } finally {
            setLoadingPreview(false)
        }
    }, [])

    React.useEffect(() => {
        if (!open) return
        void loadPreview()
    }, [loadPreview, open])

    const handleImport = async () => {
        setSubmitting(true)
        setError(null)
        setResultMessage(null)
        try {
            const response = await fetch('/api/members/resident-registry-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forceOverwrite }),
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                throw new Error(json.error || '주민번호 일괄 반영에 실패했습니다.')
            }

            const result = json.result as {
                syncedCount: number
                skippedExistingCount: number
                matchedCount: number
            }

            setResultMessage(`반영 완료: 동기화 ${result.syncedCount}건, 기존값 유지 ${result.skippedExistingCount}건, 정확 매칭 ${result.matchedCount}건`)
            await loadPreview()
            router.refresh()
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : '주민번호 일괄 반영에 실패했습니다.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[860px] bg-slate-950 border-slate-800 text-slate-100 max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MaterialIcon name="badge" className="text-amber-300" />
                        주민번호 일괄 반영
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        엑셀의 116명 주민번호를 전용 Supabase 보관소에 저장한 뒤 기본탭 주민번호로 동기화합니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    {loadingPreview ? (
                        <div className="flex h-64 items-center justify-center text-slate-400 text-sm font-bold">
                            주민번호 미리보기 불러오는 중...
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200">
                            {error}
                        </div>
                    ) : preview ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
                                <div className="flex flex-wrap gap-2 text-xs font-bold">
                                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-sky-200">파일 {preview.fileName}</span>
                                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">등기조합원 {preview.registeredMemberCount}명</span>
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">정확 매칭 {preview.matchedCount}건</span>
                                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-300">명단 중복 {preview.duplicateMemberNameCount}건</span>
                                    <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-orange-300">엑셀 중복 {preview.duplicateSourceNameCount}건</span>
                                    <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-300">명단 없음 {preview.memberNotFoundCount}건</span>
                                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-violet-300">기존 주민번호 {preview.existingResidentCount}건</span>
                                </div>
                                <p className="mt-3 text-xs text-slate-500 break-all">{preview.filePath}</p>
                            </div>

                            {resultMessage && (
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                                    {resultMessage}
                                </div>
                            )}

                            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                                <Checkbox
                                    id="force-overwrite-resident"
                                    checked={forceOverwrite}
                                    onCheckedChange={(checked) => setForceOverwrite(Boolean(checked))}
                                    className="mt-0.5 border-white/20 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                />
                                <div>
                                    <Label htmlFor="force-overwrite-resident" className="cursor-pointer text-sm font-bold text-amber-100">
                                        기존 주민번호가 있어도 엑셀 값으로 덮어쓰기
                                    </Label>
                                    <p className="mt-1 text-xs text-amber-200/80">
                                        기본값은 꺼짐입니다. 켜지면 기존 기본탭 주민번호도 새 값으로 바뀝니다.
                                    </p>
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                                <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                                    <div className="border-b border-slate-800 px-4 py-3 text-sm font-black text-white">엑셀 반영 미리보기</div>
                                    <ScrollArea className="h-[320px]">
                                        <div className="divide-y divide-slate-800">
                                            {preview.previewRows.map((row) => (
                                                <div key={`resident-preview-${row.rowNumber}-${row.sourceName}`} className="px-4 py-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-black text-white">{row.sourceName}</p>
                                                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone[row.status]}`}>
                                                            {statusLabel[row.status]}
                                                        </span>
                                                        {row.hasExistingResidentNumber && (
                                                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                                                                기존값 있음
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="mt-2 text-xs text-slate-400">
                                                        <p>주민번호 {row.maskedResidentRegistrationNumber}</p>
                                                        <p>기본탭 대상 {row.matchedMemberName || '-'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>

                                <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                                    <div className="border-b border-slate-800 px-4 py-3 text-sm font-black text-white">엑셀에 없는 등기조합원</div>
                                    <ScrollArea className="h-[320px]">
                                        <div className="divide-y divide-slate-800">
                                            {preview.missingMembers.length > 0 ? preview.missingMembers.map((member) => (
                                                <div key={`resident-missing-${member.id}`} className="px-4 py-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-black text-white">{member.name}</p>
                                                        {member.hasExistingResidentNumber && (
                                                            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                                                                기존값 있음
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-2 text-xs text-slate-500">엑셀에서 이름을 찾지 못했습니다.</p>
                                                </div>
                                            )) : (
                                                <div className="px-4 py-8 text-center text-sm font-semibold text-emerald-300">
                                                    누락된 등기조합원이 없습니다.
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>

                <DialogFooter className="mt-4 flex-col gap-2 sm:flex-row sm:justify-between">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="text-slate-300 hover:bg-white/5"
                    >
                        닫기
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => void loadPreview()}
                            disabled={loadingPreview || submitting}
                            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                        >
                            <MaterialIcon name="refresh" size="xs" />
                            다시 확인
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={!preview || preview.matchedCount === 0 || submitting}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
                        >
                            <MaterialIcon name="verified_user" size="xs" />
                            {submitting ? '반영 중...' : '전용 보관소 저장 후 기본탭 반영'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

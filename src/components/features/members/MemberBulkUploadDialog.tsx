"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
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

interface MemberBulkUploadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function MemberBulkUploadDialog({ open, onOpenChange }: MemberBulkUploadDialogProps) {
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [parsedData, setParsedData] = React.useState<any[]>([])
    const [fileName, setFileName] = React.useState("")

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (evt) => {
            const bstr = evt.target?.result
            const wb = XLSX.read(bstr, { type: "binary" })
            const wsname = wb.SheetNames[0]
            const ws = wb.Sheets[wsname]
            const data = XLSX.utils.sheet_to_json(ws)

            // Basic mapping/cleaning
            const mapped = data.map((row: any) => ({
                name: row["성명"] || row["이름"] || row["Name"],
                phone: row["연락처"] || row["전화번호"] || row["Phone"],
                member_number: row["번호"] || row["회원번호"] || row["Number"],
                right_number: row["권리증"] || row["권리증번호"] || row["권칙"] || row["No"] || row["증서"] || row["Right"],
                tier: row["구분"] || row["등급"] || row["Tier"] || "예비조합원",
                unit_group: row["그룹"] || row["동호수"] || row["Group"],
                address_legal: row["주소"] || row["Address"],
                memo: row["메모"] || row["특이사항"] || row["Memo"]
            })).filter(m => m.name) // name is required

            setParsedData(mapped)
        }
        reader.readAsBinaryString(file)
    }

    const handleSubmit = async () => {
        if (parsedData.length === 0) return
        setLoading(true)

        try {
            const res = await fetch("/api/members/bulk-upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ members: parsedData }),
            })

            const data = await res.json()
            if (data.success) {
                alert(`${data.count}명이 성공적으로 등록되었습니다.`)
                onOpenChange(false)
                router.refresh()
                setParsedData([])
                setFileName("")
            } else {
                alert(data.error || "등록 중 오류가 발생했습니다.")
            }
        } catch (error) {
            alert("등록 중 오류가 발생했습니다.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>엑셀/CSV 일괄 등록</DialogTitle>
                    <DialogDescription className="text-slate-400">
                        엑셀 파일을 업로드하여 여러 명을 한 번에 등록합니다. (필수 컬럼: 성명)
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col gap-4 py-4 overflow-hidden">
                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-slate-800/30 hover:bg-slate-800/50 transition-colors">
                        <MaterialIcon name="upload_file" size="lg" className="text-slate-500" />
                        <p className="text-sm text-slate-400">{fileName || "파일을 선택하거나 여기로 드래그하세요"}</p>
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="file-upload"
                        />
                        <Button asChild variant="secondary" size="sm" className="mt-2 text-white">
                            <label htmlFor="file-upload" className="cursor-pointer">파일 선택</label>
                        </Button>
                    </div>

                    {parsedData.length > 0 && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <p className="text-xs font-bold text-sky-400 mb-2">프리뷰 ({parsedData.length}명 대기 중)</p>
                            <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/50">
                                <ScrollArea className="h-[250px] w-full">
                                    <table className="w-full text-[11px] text-left">
                                        <thead className="sticky top-0 bg-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                                            <tr>
                                                <th className="px-3 py-2 border-b border-slate-700">성명</th>
                                                <th className="px-3 py-2 border-b border-slate-700">연락처</th>
                                                <th className="px-3 py-2 border-b border-slate-700">구분</th>
                                                <th className="px-3 py-2 border-b border-slate-700">그룹</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/50 text-slate-200">
                                            {parsedData.map((m, idx) => (
                                                <tr key={idx} className="hover:bg-slate-700/30">
                                                    <td className="px-3 py-1.5 text-white font-bold">{m.name}</td>
                                                    <td className="px-3 py-1.5 text-slate-400 font-mono">{m.phone || "-"}</td>
                                                    <td className="px-3 py-1.5 text-sky-200">{m.tier}</td>
                                                    <td className="px-3 py-1.5 text-slate-400 font-mono text-[10px]">{m.unit_group || "-"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-auto">
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || parsedData.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white w-full sm:w-auto"
                    >
                        {loading ? "등록 처리 중..." : `${parsedData.length}명 등록하기`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

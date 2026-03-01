"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { MaterialIcon } from "@/components/ui/icon"
import { MemberCreateDialog } from "./MemberCreateDialog"
import { MemberBulkUploadDialog } from "./MemberBulkUploadDialog"
import { exportToExcel } from "./MemberExportExcel"

interface MemberActionsProps {
    data: any[]
}

export function MemberActions({ data }: MemberActionsProps) {
    const [isAddOpen, setIsAddOpen] = React.useState(false)
    const [isBulkOpen, setIsBulkOpen] = React.useState(false)

    const handleExport = () => {
        exportToExcel(data)
    }

    return (
        <div className="flex items-center gap-2">
            <Button
                onClick={() => setIsAddOpen(true)}
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 bg-sky-600/10 border-sky-500/30 text-sky-400 hover:bg-sky-600 hover:text-white transition-all shadow-lg shadow-sky-900/10"
            >
                <MaterialIcon name="person_add" size="xs" />
                <span className="text-xs font-extrabold uppercase tracking-tight">인원 추가</span>
            </Button>

            <Button
                onClick={() => setIsBulkOpen(true)}
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
                <MaterialIcon name="upload_file" size="xs" />
                <span className="text-xs font-bold">일괄 등록</span>
            </Button>

            <Button
                onClick={handleExport}
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
            >
                <MaterialIcon name="download" size="xs" />
                <span className="text-xs font-bold">엑셀 저장</span>
            </Button>

            <MemberCreateDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
            <MemberBulkUploadDialog open={isBulkOpen} onOpenChange={setIsBulkOpen} />
        </div>
    )
}

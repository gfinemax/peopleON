import * as XLSX from "xlsx"

export function exportToExcel(data: any[]) {
    if (!data || data.length === 0) return

    // Map unified person data to a flat object for Excel
    const rows = data.map(p => ({
        "성명": p.name,
        "연락처": p.phone || "",
        "번호": p.member_number || "",
        "권리증번호": p.assetRights?.map((r: any) => r.right_number).filter(Boolean).join(", ") || "",
        "구분": p.tiers?.join(", ") || p.tier || "",
        "동호수": p.unit_group || "",
        "주소": p.address_legal || "",
        "메모": p.memo || p.notes || ""
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "인원 명단")

    // Generate filename with current date
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const filename = `peopleon_members_${date}.xlsx`

    // Trigger download
    XLSX.writeFile(workbook, filename)
}

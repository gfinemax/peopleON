import * as XLSX from "xlsx"
import type { MemberExportRow } from "./memberExportTypes"

export interface ExportColumn {
    id: string;
    label: string;
}

export function exportToExcel(data: MemberExportRow[], columns: ExportColumn[]) {
    if (!data || data.length === 0 || !columns || columns.length === 0) return

    // Map unified person data to a flat object for Excel based on selected columns
    const rows = data.map(p => {
        const row: Record<string, string | number> = {};
        
        columns.forEach(col => {
            switch (col.id) {
                case 'name':
                    row[col.label] = p.name || '';
                    break;
                case 'phone':
                    row[col.label] = p.phone || '';
                    break;
                case 'certificate_numbers':
                    // 권리증 번호는 축약 없이 배열 내용 전체를 콤마로 연결
                    row[col.label] = Array.isArray(p.certificate_numbers) && p.certificate_numbers.length > 0 
                        ? p.certificate_numbers.join(', ') 
                        : '';
                    break;
                case 'tier':
                    row[col.label] = Array.isArray(p.tiers) && p.tiers.length > 0 
                        ? p.tiers.join(', ') 
                        : (p.tier || '');
                    break;
                case 'unit_group':
                    row[col.label] = p.unit_group || '';
                    break;
                case 'address':
                    row[col.label] = p.address_legal || '';
                    break;
                case 'status':
                    row[col.label] = p.status || '';
                    break;
                case 'memo':
                    row[col.label] = p.notes || '';
                    break;
                case 'roles':
                    row[col.label] = p.role_types?.join(', ') || '';
                    break;
                default:
                    row[col.label] = '';
            }
        });
        
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "인원 명단")

    // Generate filename with current date
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "")
    const filename = `peopleon_members_${date}.xlsx`

    // Trigger download
    XLSX.writeFile(workbook, filename)
}

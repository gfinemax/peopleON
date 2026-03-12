import * as XLSX from "xlsx"
import { UnifiedPerson } from "@/services/memberAggregation"

export interface ExportColumn {
    id: string;
    label: string;
}

export function exportToExcel(data: UnifiedPerson[], columns: ExportColumn[]) {
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
                    // In UnifiedPerson, maybe meta.address_legal exists, or just address
                    row[col.label] = (p as any).address_legal || (p.meta?.address_legal as string) || '';
                    break;
                case 'status':
                    row[col.label] = p.status || '';
                    break;
                case 'memo':
                    row[col.label] = p.notes || (p as any).memo || '';
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

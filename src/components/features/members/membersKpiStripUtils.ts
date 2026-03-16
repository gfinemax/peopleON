'use client';

import * as XLSX from 'xlsx';

export type SummaryBlock = {
    total: number;
    members: number;
    recruitmentTarget: number;
};

export type CertificateBlock = {
    total: number;
    memberHeld: number;
    externalHeld: number;
    refundEligible: number;
    duplicateExcluded: number;
    registeredInternalDistinct: number;
};

export type RelationBlock = {
    total: number;
    agents: number;
    others: number;
};

export type AnalysisExportRow = Record<string, string | number>;

export type Segment = {
    label: string;
    value: number;
    colorClass: string;
    stroke: string;
    interactive?: boolean;
};

export type AnalysisMode =
    | 'all'
    | 'registered_global'
    | 'registered_internal'
    | 'refund'
    | 'duplicates';

export type AnalysisView = 'person' | 'number';

export type AnalysisNumberDetail = {
    number: string;
    owners: {
        id: string;
        name: string;
        rightsFlow: string;
        phone?: string | null;
        address?: string | null;
    }[];
};

export function ratio(value: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((value / total) * 1000) / 10;
}

export function formatCount(value: number, unit: string) {
    return `${value.toLocaleString()}${unit}`;
}

export function normalizeDisplayNumber(value: string) {
    return value.replace(/\s+/g, '').toLowerCase();
}

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function sortAnalysisRows(
    rows: AnalysisExportRow[],
    sortBy: string,
    sortOrder: 'asc' | 'desc',
) {
    if (!sortBy) return rows;

    return [...rows].sort((left, right) => {
        const leftValue = left[sortBy] ?? '';
        const rightValue = right[sortBy] ?? '';

        const leftText = String(leftValue).trim();
        const rightText = String(rightValue).trim();
        const leftNumber = Number(leftText);
        const rightNumber = Number(rightText);

        let compare = 0;
        if (
            leftText !== '' &&
            rightText !== '' &&
            Number.isFinite(leftNumber) &&
            Number.isFinite(rightNumber)
        ) {
            compare = leftNumber - rightNumber;
        } else {
            compare = leftText.localeCompare(rightText, 'ko-KR', {
                numeric: true,
                sensitivity: 'base',
            });
        }

        return sortOrder === 'asc' ? compare : -compare;
    });
}

export function exportAnalysisRows(
    rows: AnalysisExportRow[],
    selectedColumns: string[],
    filename: string,
) {
    if (rows.length === 0 || selectedColumns.length === 0) return;

    const excelRows = rows.map((row) => {
        const nextRow: AnalysisExportRow = {};
        for (const column of selectedColumns) {
            nextRow[column] = row[column] ?? '';
        }
        return nextRow;
    });

    const sheet = XLSX.utils.json_to_sheet(excelRows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, '권리증분석');
    XLSX.writeFile(book, filename);
}

export function openAnalysisPrintWindow(args: {
    title: string;
    rows: AnalysisExportRow[];
    selectedColumns: string[];
    orientation: 'portrait' | 'landscape';
    pageSize: 'A4' | 'A3' | 'Letter';
    resultLabel: string;
}) {
    const { title, rows, selectedColumns, orientation, pageSize, resultLabel } = args;
    if (rows.length === 0 || selectedColumns.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;

    const rowsHtml = rows
        .map(
            (row, index) =>
                `<tr>${selectedColumns
                    .map((column) => {
                        const classes = [
                            column === '이름' || column === '성명' ? 'name-column' : '',
                            column === '번호' ? 'index-column' : '',
                        ]
                            .filter(Boolean)
                            .join(' ');
                        const cellClass = classes ? ` class="${classes}"` : '';
                        const value = column === '번호' ? index + 1 : row[column];
                        return `<td${cellClass}>${escapeHtml(String(value ?? ''))}</td>`;
                    })
                    .join('')}</tr>`,
        )
        .join('');

    printWindow.document.write(`
        <!doctype html>
        <html lang="ko">
        <head>
            <meta charset="utf-8" />
            <title>${escapeHtml(title)}</title>
            <style>
                @page { size: ${pageSize} ${orientation}; margin: 10mm 8mm; }
                body { font-family: Arial, sans-serif; padding: 12px; color: #0f172a; }
                h1 { font-size: 20px; margin: 0 0 6px; }
                p { margin: 0 0 10px; color: #475569; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; font-size: 11px; line-height: 1.35; }
                th { background: #f8fafc; font-weight: 700; }
                th.name-column, td.name-column { white-space: nowrap; width: 1%; }
                th.index-column, td.index-column { white-space: nowrap; width: 52px; text-align: center; }
                @media print { body { padding: 0; } }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(resultLabel)}</p>
            <table>
                <thead>
                    <tr>${selectedColumns
                        .map((column) => {
                            const classes = [
                                column === '이름' || column === '성명' ? 'name-column' : '',
                                column === '번호' ? 'index-column' : '',
                            ]
                                .filter(Boolean)
                                .join(' ');
                            const cellClass = classes ? ` class="${classes}"` : '';
                            return `<th${cellClass}>${escapeHtml(column)}</th>`;
                        })
                        .join('')}</tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

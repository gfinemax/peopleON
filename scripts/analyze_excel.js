const XLSX = require('xlsx');
const fs = require('fs');
const path = 'c:/workspace/antigravity/peopleon/data/조합원 명단 및 세부내역(프로그램용).xlsx';
const wb = XLSX.readFile(path);
const ws = wb.Sheets[wb.SheetNames[0]];

const output = [];
output.push(`Sheet: ${wb.SheetNames[0]}`);
output.push(`Range: ${ws['!ref']}`);
output.push(`Merges: ${JSON.stringify(ws['!merges'] || [])}`);
output.push('');

// Read first 8 rows cell by cell
for (let r = 0; r < 8; r++) {
    const cells = [];
    for (let c = 0; c < 25; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
            const col = XLSX.utils.encode_col(c);
            cells.push(`${col}${r + 1}=${JSON.stringify(cell.v).substring(0, 80)}`);
        }
    }
    output.push(`--- Row ${r + 1} ---`);
    output.push(cells.join('\n'));
}

// Also output all column headers for row 3 (often the real header in Korean excels)
output.push('\n--- All cells in rows 3-4 (likely headers) ---');
for (let r = 2; r < 4; r++) {
    for (let c = 0; c < 25; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
            const col = XLSX.utils.encode_col(c);
            output.push(`  ${col}${r + 1}: ${JSON.stringify(cell.v).substring(0, 120)}`);
        }
    }
}

// Sample data rows
output.push('\n--- Sample data rows 5-10 ---');
for (let r = 4; r < 10; r++) {
    const cells = [];
    for (let c = 0; c < 25; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (cell) {
            const col = XLSX.utils.encode_col(c);
            cells.push(`${col}: ${JSON.stringify(cell.v).substring(0, 100)}`);
        }
    }
    output.push(`\n  Row ${r + 1}:`);
    output.push('  ' + cells.join('\n  '));
}

fs.writeFileSync('c:/workspace/antigravity/peopleon/data/excel_analysis.txt', output.join('\n'), 'utf8');
console.log('Done! Written to data/excel_analysis.txt');

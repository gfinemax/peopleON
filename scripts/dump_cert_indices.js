const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\권리증(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Headers (Row 1):', JSON.stringify(data[1]));
for (let i = 2; i < 15; i++) {
    const row = data[i];
    if (row) {
        // Log column index and value for checking
        const indexedRow = row.slice(0, 20).map((val, idx) => `[${idx}] ${val}`);
        console.log(`Row ${i}:`, indexedRow.join(' | '));
    }
}

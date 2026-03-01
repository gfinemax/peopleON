const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\권리증(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- Column Index Table (Row 1 Headers) ---');
const headers = data[1] || [];
headers.forEach((h, i) => console.log(`[${i}] ${h}`));

console.log('\n--- Data Rows (Row 3-10) ---');
for (let i = 2; i < 10; i++) {
    const row = data[i];
    if (row) {
        console.log(`Row ${i}:`, row.slice(0, 15).map((v, idx) => `[${idx}]${v}`).join(' | '));
    }
}

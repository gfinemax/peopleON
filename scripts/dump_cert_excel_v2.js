const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\권리증(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Row 0:', JSON.stringify(data[0]));
console.log('Row 1:', JSON.stringify(data[1]));
console.log('Row 2:', JSON.stringify(data[2]));
for (let i = 3; i < 8; i++) {
    const row = data[i];
    if (row) {
        console.log(`Row ${i} (Name: ${row[0]}, CertNo: ${row[10]}):`, JSON.stringify(row.slice(0, 15)));
    }
}

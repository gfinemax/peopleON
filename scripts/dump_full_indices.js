const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\권리증(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- ALL Headers (Row 1) ---');
const headers = data[1] || [];
for (let i = 0; i < 40; i++) {
    if (headers[i] || data[2]?.[i]) {
        console.log(`[${i}] Header: "${headers[i] || ''}" | Sample(Row2): "${data[2]?.[i] || ''}"`);
    }
}

console.log('\n--- Row 3 Detailed ---');
const row3 = data[2] || [];
row3.forEach((val, idx) => {
    console.log(`[${idx}] ${val}`);
});

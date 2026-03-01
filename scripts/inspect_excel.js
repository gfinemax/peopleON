const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\조합원 명단 및 세부내역(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Convert to JSON to see the structure
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Sheet Name:', sheetName);
console.log('Total Rows:', data.length);

// Find first non-empty row (likely headers)
let headerRowIndex = -1;
for (let i = 0; i < data.length; i++) {
    if (data[i] && data[i].length > 0 && data[i].some(cell => cell !== null && cell !== '')) {
        headerRowIndex = i;
        break;
    }
}

if (headerRowIndex !== -1) {
    console.log('Header Row Index:', headerRowIndex);
    console.log('Header Row Content:', data[headerRowIndex]);
    console.log('Sample Data Row 1:', data[headerRowIndex + 1]);
    console.log('Sample Data Row 2:', data[headerRowIndex + 2]);
} else {
    console.log('No data found in sheet.');
}

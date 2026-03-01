const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\권리증(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Columns:', data[2]); // Likely header row
for (let i = 3; i < 13; i++) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
}

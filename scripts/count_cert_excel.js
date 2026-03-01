const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\workspace\\antigravity\\peopleon\\data\\권리증(프로그램용).xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('Sheet Name:', sheetName);
console.log('Total Rows:', data.length);

// Skip headers and empty rows
const records = data.slice(3).filter(row => row[0]); // name is in first column
console.log('Valid Records:', records.length);
console.log('Sample Row:', records[0]);

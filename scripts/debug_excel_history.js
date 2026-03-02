const XLSX = require('xlsx');
const path = require('path');

function analyzeExcel() {
    const filePath = path.resolve(__dirname, '../data/권리증(프로그램용).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Read raw data to see exact counts
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });

    console.log(`Total rows in Excel (excluding headers): ${data.length}`);

    let rowsWithHistory = 0;
    let emptyHistory = 0;
    let missingName = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        if (!row || !row[0]) {
            missingName++;
            continue;
        }

        const historyText = row[21]; // V column (index 21)

        if (historyText !== undefined && historyText !== null && String(historyText).trim() !== '') {
            rowsWithHistory++;
        } else {
            emptyHistory++;
        }
    }

    console.log(`- Rows with '활동이력' (Column V) data: ${rowsWithHistory}`);
    console.log(`- Rows with empty/no '활동이력': ${emptyHistory}`);
    console.log(`- Rows missing Name (Column A): ${missingName}`);
}

analyzeExcel();

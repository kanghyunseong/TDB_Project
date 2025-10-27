const fs = require('fs');
const Papa = require('papaparse');

// CSV 파일 경로
const csvFilePath = './medicine.csv'; // 실제 medicine.csv 경로로 수정
const jsonFilePath = './medicine.json';

const csvString = fs.readFileSync(csvFilePath, 'utf8');
const result = Papa.parse(csvString, { header: true });

fs.writeFileSync(jsonFilePath, JSON.stringify(result.data, null, 2), 'utf8');
console.log('변환 완료! medicine.json 생성됨');
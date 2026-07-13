const fs = require('fs');
const path = require('path');

function renameToAscii() {
  const dir = path.join(__dirname, 'public');
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fileUpper = file.toUpperCase();
    if (fileUpper.endsWith('.XLSX')) {
      let targetName = "";
      if (fileUpper.includes('MUTLUKAL') && !fileUpper.includes('ORMAN')) {
        targetName = 'MUTLUKAL_IS_EMRI_01062026.xlsx';
      } else if (fileUpper.includes('MUTLU') && fileUpper.includes('ORMAN')) {
        targetName = 'MUTLU_ORMAN_YENI_IS_EMRI_01062026.xlsx';
      }

      if (targetName && file !== targetName) {
        const oldPath = path.join(dir, file);
        const newPath = path.join(dir, targetName);
        try {
          fs.renameSync(oldPath, newPath);
          console.log(`Renamed: "${file}" -> "${targetName}"`);
        } catch (e) {
          console.log(`Failed to rename "${file}":`, e.message);
        }
      }
    }
  });
}

renameToAscii();

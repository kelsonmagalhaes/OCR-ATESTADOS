const fs = require('fs');
const path = require('path');

const workerSrc = path.resolve(
  __dirname,
  '../node_modules/pdfjs-dist/build/pdf.worker.min.mjs'
);
const workerDest = path.resolve(__dirname, '../public/pdf.worker.min.mjs');

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (fs.existsSync(workerSrc)) {
  fs.copyFileSync(workerSrc, workerDest);
  console.log('pdf.worker.min.mjs copied to public/');
} else {
  // Try alternate filenames
  const alt = path.resolve(
    __dirname,
    '../node_modules/pdfjs-dist/build/pdf.worker.min.js'
  );
  const altDest = path.resolve(__dirname, '../public/pdf.worker.min.js');
  if (fs.existsSync(alt)) {
    fs.copyFileSync(alt, altDest);
    console.log('pdf.worker.min.js copied to public/');
  } else {
    console.warn('pdf.js worker not found — PDF support may not work.');
  }
}

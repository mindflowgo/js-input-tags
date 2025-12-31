// Helper file for the npm run build
// For the classic usage, removes 'export' and attaches wrapper for windows/module/commonjs
import { readFileSync, writeFileSync } from 'fs';
import { argv } from 'process';

// class name we're working
const Class = 'Input2Tags'

const input = argv[2];
const output = argv[3] || input;
let code = readFileSync(input, 'utf8');
// replace & append
code = code.replace(`export default ${Class}`, '');
const appendCode = `if (typeof window !== 'undefined') window.${Class} = ${Class}; else if (typeof module !== 'undefined' && module.exports) module.exports = ${Class}; else if (typeof define === 'function' && define.amd) define(() => ${Class});`;

writeFileSync(output, code + appendCode, 'utf8');
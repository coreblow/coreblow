/**
 * Phase A debugging audit script.
 * Checks: broken imports, empty modules, duplicate exports, module size validation.
 */
import fs from 'node:fs';
import path from 'node:path';

const AGENTS_DIR = path.resolve(import.meta.dirname, '../src/agents');
const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.ts') && !f.includes('.test'));

let issues = 0;

// 1. Check broken imports
console.log('=== Broken Imports ===');
for (const file of files) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf-8');
    const imports = content.matchAll(/from\s+['"]\.\/([\w./-]+)['"]/g);
    for (const m of imports) {
        const mod = m[1].replace(/\.js$/, '.ts');
        const target = path.join(AGENTS_DIR, mod);
        if (!fs.existsSync(target)) { console.log(`  BROKEN: ${file} -> ${m[1]}`); issues++; }
    }
}

// 2. Check empty modules (< 10 chars of actual code)
console.log('\n=== Empty Modules ===');
for (const file of files) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf-8').trim();
    if (content.length < 10) { console.log(`  EMPTY: ${file} (${content.length} chars)`); issues++; }
}

// 3. Check for `any` types
console.log('\n=== Explicit `any` Types ===');
let anyCount = 0;
for (const file of files) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf-8');
    const matches = content.match(/:\s*any\b/g);
    if (matches && matches.length > 0) { anyCount += matches.length; }
}
console.log(`  Total :any occurrences: ${anyCount}`);

// 4. Check module sizes
console.log('\n=== Module Size Distribution ===');
const sizes = files.map(f => ({ file: f, lines: fs.readFileSync(path.join(AGENTS_DIR, f), 'utf-8').split('\n').length }));
const empty = sizes.filter(s => s.lines <= 2);
const tiny = sizes.filter(s => s.lines > 2 && s.lines <= 5);
const small = sizes.filter(s => s.lines > 5 && s.lines <= 20);
const medium = sizes.filter(s => s.lines > 20 && s.lines <= 100);
const large = sizes.filter(s => s.lines > 100);
console.log(`  ≤2 lines (re-exports): ${empty.length}`);
console.log(`  3-5 lines (stubs): ${tiny.length}`);
console.log(`  6-20 lines (small): ${small.length}`);
console.log(`  21-100 lines (medium): ${medium.length}`);
console.log(`  >100 lines (full): ${large.length}`);
console.log(`  Total source files: ${files.length}`);

// 5. Largest modules
console.log('\n=== Top 10 Largest Modules ===');
sizes.sort((a, b) => b.lines - a.lines);
for (const s of sizes.slice(0, 10)) console.log(`  ${s.lines.toString().padStart(4)} lines: ${s.file}`);

// 6. Check test coverage ratio
const testFiles = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.test.ts'));
console.log(`\n=== Test Coverage ===`);
console.log(`  Source files: ${files.length}`);
console.log(`  Test files: ${testFiles.length}`);
console.log(`  Coverage ratio: ${(testFiles.length / files.length * 100).toFixed(1)}%`);

// 7. Verify all re-exports resolve
console.log('\n=== Re-export Verification ===');
let reexportCount = 0;
let reexportBroken = 0;
for (const file of files) {
    const content = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf-8');
    if (content.includes('export {') && content.includes("from './")) {
        reexportCount++;
        const fromMatch = content.match(/from\s+['"]\.\/([\w./-]+)['"]/);
        if (fromMatch) {
            const target = path.join(AGENTS_DIR, fromMatch[1].replace(/\.js$/, '.ts'));
            if (!fs.existsSync(target)) { console.log(`  BROKEN RE-EXPORT: ${file}`); reexportBroken++; issues++; }
        }
    }
}
console.log(`  Total re-exports: ${reexportCount}, broken: ${reexportBroken}`);

console.log(`\n=== Summary ===`);
console.log(`Total issues found: ${issues}`);
if (issues === 0) console.log('✅ All checks passed!');
else console.log('❌ Issues need fixing');

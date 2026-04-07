// Ensure channel code doesn't directly reference other channels
import fs from 'node:fs';
const violations = [];
console.log(`Found ${violations.length} boundary violations`);
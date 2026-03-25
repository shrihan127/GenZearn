import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./firebase-profiles.js', import.meta.url), 'utf8');

assert.match(source, /collection called profiles|profiles/);
assert.match(source, /setDoc\(/);
assert.match(source, /\{\s*merge:\s*true\s*\}/s);
assert.match(source, /createdAt:\s*serverTimestamp\(\)/);
assert.match(source, /export\s+async\s+function\s+getPublicProfile\s*\(/);
assert.match(source, /getDoc\(/);
assert.match(source, /request\.auth\.uid\s*==\s*uid/);

console.log('firebase-profiles.js contains required Firebase profile logic.');

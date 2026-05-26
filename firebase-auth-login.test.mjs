import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./firebase-auth-login.js', import.meta.url), 'utf8');

assert.match(source, /import\s*\{\s*signInWithEmailAndPassword\s*\}\s*from\s*'https:\/\/www\.gstatic\.com\/firebasejs\/10\.12\.5\/firebase-auth\.js'/);
assert.match(source, /import\s*\{\s*auth\s*\}\s*from\s*'\.\/firebase\.js'/);
assert.match(source, /export\s+async\s+function\s+login\s*\(email,\s*password\)/);
assert.match(source, /return\s+await\s+signInWithEmailAndPassword\(auth,\s*email,\s*password\);/);

console.log('firebase-auth-login.js contains the expected email login flow.');

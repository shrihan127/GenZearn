import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./firebase-auth-login.js', import.meta.url), 'utf8');

assert.match(source, /import\s*\{\s*auth\s*\}\s*from\s*'\.\/firebase\.js'/);
assert.match(source, /import\s*\{\s*signInUnified\s*\}\s*from\s*'\.\/src\/auth\/resolveAuth\.js'/);
assert.match(source, /export\s+async\s+function\s+login\s*\(email,\s*password\)/);
assert.match(source, /return\s+await\s+signInUnified\(auth,\s*email,\s*password\);/);

console.log('firebase-auth-login.js contains the expected unified email login flow.');

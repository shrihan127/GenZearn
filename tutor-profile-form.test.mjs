import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./tutor-profile-form.js', import.meta.url), 'utf8');

assert.match(source, /export\s+async\s+function\s+saveTutorProfile\s*\(/);
assert.match(source, /setDoc\(userRef,\s*\{/s);
assert.match(source, /name:\s*user\.displayName\s*\|\|\s*''/);
assert.match(source, /email:\s*user\.email\s*\|\|\s*''/);
assert.match(source, /roles:\s*\['student',\s*'tutor'\]/);
assert.match(source, /createdAt:\s*serverTimestamp\(\)/);
assert.match(source, /updatedAt:\s*serverTimestamp\(\)/);
assert.doesNotMatch(source, /tutorProfile:\s*\{/);
assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /catch\s*\(error\)/);

console.log('tutor-profile-form.js contains single user document account update logic.');

assert.match(source, /doc\(db,\s*'users',\s*user\.uid\)/);
assert.doesNotMatch(source, /doc\(db,\s*'users',\s*[^)]*email/);

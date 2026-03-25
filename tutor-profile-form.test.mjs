import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./tutor-profile-form.js', import.meta.url), 'utf8');

assert.match(source, /export\s+async\s+function\s+createTutorProfile\s*\(/);
assert.match(source, /addDoc\(collection\(db,\s*['\"]tutors['\"]\),\s*data\)/);
assert.match(source, /createdAt:\s*serverTimestamp\(\)/);
assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /requiredFields\s*=\s*\[[^\]]+\]/s);
assert.match(source, /catch\s*\(error\)/);

console.log('tutor-profile-form.js contains required Firestore tutor form logic.');

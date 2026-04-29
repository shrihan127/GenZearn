import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./tutor-profile-form.js', import.meta.url), 'utf8');

assert.match(source, /export\s+async\s+function\s+saveTutorProfile\s*\(/);
assert.match(source, /setDoc\(userRef,\s*\{/s);
assert.match(source, /roles:\s*\['student',\s*'tutor'\]/);
assert.match(source, /tutorProfile:\s*\{/);
assert.match(source, /createdAt|updatedAt:\s*serverTimestamp\(\)/);
assert.match(source, /event\.preventDefault\(\)/);
assert.match(source, /requiredFields\s*=\s*\[[^\]]+\]/s);
assert.match(source, /catch\s*\(error\)/);

console.log('tutor-profile-form.js contains required Firestore tutor profile logic.');

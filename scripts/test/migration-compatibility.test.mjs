import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { isMigrationCompatible } from '../lib/migration-compatibility.mjs';

const cases = [
  [
    '20260906000000-create-key-management-targets.sql',
    'aa8f4fb4b08155e707aed1d0de554cdd15ad863e8ce2ecd1d2ba8a66e7a478ad',
  ],
  [
    '20260906010000-create-user-key-management-targets.sql',
    'f2298620b9a574ff028523b6125961265e1ac70a080a6c31116ee4ee8987bf6d',
  ],
];

for (const [id, previous] of cases) {
  test(`${id}: 기존 적용분은 재실행 없이 호환되며 새 내용 변조는 거절한다`, () => {
    const source = readFileSync(
      new URL(`../../apps/backend/migrations/${id}`, import.meta.url),
    );
    const current = createHash('sha256').update(source).digest('hex');
    assert.equal(isMigrationCompatible(id, previous, current), true);
    assert.equal(isMigrationCompatible(id, current, current), true);
    assert.equal(isMigrationCompatible(id, current, previous), false);
    assert.equal(isMigrationCompatible(id, previous, 'modified'), false);
    assert.equal(
      isMigrationCompatible('unknown.sql', previous, current),
      false,
    );
    assert.doesNotMatch(source.toString(), /\bINSERT\s+INTO\b/i);
  });
}

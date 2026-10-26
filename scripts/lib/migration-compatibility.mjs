// 설치별 INSERT만 제거한 두 변경을 허용한다. 기존 DB 행은 재실행하거나 지우지 않고,
// 그 밖의 체크섬 불일치는 기존 정책대로 중단한다.
const seedRedactions = {
  '20260906000000-create-key-management-targets.sql': [
    'aa8f4fb4b08155e707aed1d0de554cdd15ad863e8ce2ecd1d2ba8a66e7a478ad',
    '43190fe4c126d017948d0cade64c6bf5cb6f23554cccd7289ba861f5725f0685',
  ],
  '20260906010000-create-user-key-management-targets.sql': [
    'f2298620b9a574ff028523b6125961265e1ac70a080a6c31116ee4ee8987bf6d',
    '2cdb29ca05048e963038bf36e0eb5b9832d3a0365c9ff7e60428eba4a3e581ca',
  ],
};

export function isMigrationCompatible(id, applied, current) {
  if (applied === current) return true;
  const allowed = seedRedactions[id];
  return Boolean(allowed && allowed[0] === applied && allowed[1] === current);
}

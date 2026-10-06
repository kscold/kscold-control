import {
  backupTargetAssociatedData,
  isValidBackupTargetName,
  isValidDumpImage,
  isValidMongodbUri,
  isValidRetentionDays,
  summarizeMongodbUri,
  usesLoopbackHost,
} from '@/backup/domain/policies/backup-target.policy';

describe('백업 대상 입력 규칙', () => {
  it.each(['my-app-prod', 'app_1.db', 'A'])(
    '대상 이름 %s 은 허용한다',
    (name) => {
      expect(isValidBackupTargetName(name)).toBe(true);
    },
  );

  it.each(['', '../unsafe', '.hidden', 'a/b', 'a b', '-flag', 'a'.repeat(65)])(
    '대상 이름 %p 은 거부한다',
    (name) => {
      expect(isValidBackupTargetName(name)).toBe(false);
    },
  );

  it.each([
    'mongodb://localhost:27017/app',
    'mongodb://user:pass@db.example.net:27017/app?authSource=admin',
    'mongodb+srv://backup:p%40ss%2Fword@cluster.example.net/prod',
    'mongodb://user:pass@a.example.net:27017,b.example.net:27017/app?replicaSet=rs0',
    'mongodb+srv://cluster.example.net',
  ])('접속 URI %s 은 허용한다', (uri) => {
    expect(isValidMongodbUri(uri)).toBe(true);
  });

  it.each([
    ['스킴이 다름', 'postgres://user:pass@db.example.net/app'],
    ['공백 포함', 'mongodb://user:pa ss@db.example.net/app'],
    ['따옴표 포함', 'mongodb://user:pa"ss@db.example.net/app'],
    ['역슬래시 포함', 'mongodb://user:pa\\ss@db.example.net/app'],
    ['호스트 없음', 'mongodb://user:pass@'],
    ['인코딩하지 않은 @', 'mongodb://user:p@ss@db.example.net/app'],
    ['인코딩하지 않은 /', 'mongodb://user:pa/ss@db.example.net/app'],
    ['너무 김', `mongodb://db.example.net/${'a'.repeat(2048)}`],
  ])('접속 URI 는 %s 이면 거부한다', (_reason, uri) => {
    expect(isValidMongodbUri(uri)).toBe(false);
  });

  it.each([
    [
      'mongodb+srv://backup:secret-pass@cluster.example.net/prod?retryWrites=true',
      'mongodb+srv://cluster.example.net/prod',
    ],
    [
      'mongodb://user:pass@a.example.net:27017,b.example.net:27017/app?replicaSet=rs0',
      'mongodb://a.example.net:27017,b.example.net:27017/app',
    ],
    ['mongodb://localhost:27017/app', 'mongodb://localhost:27017/app'],
    [
      'mongodb+srv://user:pass@cluster.example.net',
      'mongodb+srv://cluster.example.net',
    ],
    [
      'mongodb://user:pass@db.example.net/?tls=true',
      'mongodb://db.example.net',
    ],
  ])('접속 위치 요약에서 자격증명과 옵션을 뺀다: %s', (uri, summary) => {
    expect(summarizeMongodbUri(uri)).toBe(summary);
  });

  it('요약에는 사용자 이름도 비밀번호도 남지 않는다', () => {
    const summary = summarizeMongodbUri(
      'mongodb+srv://backup-user:p%40ss%2Fword@cluster.example.net/prod',
    );

    expect(summary).not.toContain('backup-user');
    expect(summary).not.toContain('p%40ss');
  });

  it.each([
    'mongodb://localhost:27017/app',
    'mongodb://user:pass@127.0.0.1:27019/app?authSource=admin',
    'mongodb://LOCALHOST/app',
    'mongodb://[::1]:27017/app',
    'mongodb://0.0.0.0:27017/app',
    'mongodb://db.example.net:27017,127.0.0.1:27018/app',
  ])('덤프 컨테이너 자신을 가리키는 주소로 본다: %s', (uri) => {
    expect(usesLoopbackHost(uri)).toBe(true);
  });

  it.each([
    'mongodb://host.docker.internal:27019/app',
    'mongodb+srv://user:pass@cluster.example.net/prod',
    'mongodb://user:pass@10.0.0.5:27017/app',
    'mongodb://localhost.example.net:27017/app',
    // 비밀번호나 DB 이름에 들어간 글자는 호스트로 보지 않는다
    'mongodb://localhost:127.0.0.1@db.example.net/localhost',
  ])('이 서버 밖(또는 호스트 별칭) 주소는 통과시킨다: %s', (uri) => {
    expect(usesLoopbackHost(uri)).toBe(false);
  });

  it.each(['mongo:7', 'mongo', 'registry.example.com/tools/mongo:7.0.14'])(
    '덤프 이미지 %s 은 허용한다',
    (image) => {
      expect(isValidDumpImage(image)).toBe(true);
    },
  );

  it.each(['', '--privileged', 'mongo 7', 'mongo;rm'])(
    '덤프 이미지 %p 은 거부한다',
    (image) => {
      expect(isValidDumpImage(image)).toBe(false);
    },
  );

  it('보관 기간은 1 이상 3650 이하의 정수만 허용한다', () => {
    expect(isValidRetentionDays(1)).toBe(true);
    expect(isValidRetentionDays(3650)).toBe(true);
    expect(isValidRetentionDays(0)).toBe(false);
    expect(isValidRetentionDays(3651)).toBe(false);
    expect(isValidRetentionDays(1.5)).toBe(false);
  });

  it('암호문을 묶는 값은 대상마다 다르다', () => {
    expect(backupTargetAssociatedData('app-prod')).not.toBe(
      backupTargetAssociatedData('other-prod'),
    );
  });
});

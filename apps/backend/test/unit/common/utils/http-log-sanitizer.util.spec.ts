import {
  sanitizeHttpRequestBody,
  sanitizeHttpRequestUrl,
} from '@/common/utils/http-log-sanitizer.util';

describe('sanitizeHttpRequestBody', () => {
  it('대용량 업로드 매니페스트는 통계만 남기고 경로와 해시를 생략한다', () => {
    const result = sanitizeHttpRequestBody(
      {
        protocolVersion: 2,
        replace: true,
        totalFiles: 2,
        totalBytes: 30,
        filteredCount: 4,
        manifestDigest: `sha256:${'a'.repeat(64)}`,
        batches: [
          {
            index: 0,
            files: [
              {
                relativePath: 'private/customer-list.csv',
                size: 30,
                sha256: 'b'.repeat(64),
              },
            ],
          },
        ],
      },
      'POST',
      '/api/repository/projects/project-a/upload-sessions',
    );

    expect(result).toEqual({
      protocolVersion: 2,
      replace: true,
      totalFiles: 2,
      totalBytes: 30,
      filteredCount: 4,
      batchCount: 1,
      manifestDigest: `sha256:${'a'.repeat(64)}`,
      manifestFiles: '[file paths and hashes omitted]',
    });
    expect(JSON.stringify(result)).not.toContain('customer-list.csv');
    expect(JSON.stringify(result)).not.toContain('b'.repeat(64));
  });

  it('멀티파트 배치는 파일 경로와 바이너리 대신 개수만 남긴다', () => {
    expect(
      sanitizeHttpRequestBody(
        { relativePaths: ['src/a.ts', 'src/b.ts'] },
        'POST',
        '/api/repository/projects/project-a/upload-sessions/session-a/batches/0',
      ),
    ).toEqual({
      multipart: true,
      relativePathCount: 2,
      relativePaths: '[file paths omitted]',
      files: '[binary payload omitted]',
    });
  });

  it('일반 요청의 중첩 민감값과 바이너리를 마스킹한다', () => {
    const result = sanitizeHttpRequestBody(
      {
        email: 'developer@example.com',
        newPassword: 'never-log-this',
        nested: {
          clientSecret: 'also-secret',
          payload: Buffer.from('binary'),
        },
      },
      'PATCH',
      '/api/users/me',
    );

    expect(result).toEqual({
      email: 'developer@example.com',
      newPassword: '***REDACTED***',
      nested: {
        clientSecret: '***REDACTED***',
        payload: '[binary 6 bytes omitted]',
      },
    });
  });

  it('큰 배열과 문자열을 제한해 로그 한 건의 크기를 통제한다', () => {
    const result = sanitizeHttpRequestBody(
      {
        items: Array.from({ length: 30 }, (_, index) => index),
        text: 'x'.repeat(3_000),
      },
      'POST',
      '/api/example',
    ) as { items: unknown[]; text: string };

    expect(result.items).toHaveLength(26);
    expect(result.items.at(-1)).toBe('[5 items omitted]');
    expect(result.text.length).toBeLessThan(3_000);
    expect(result.text).toContain('chars omitted');
  });

  it('URL의 인증 관련 쿼리 값은 에러 로그에서도 노출하지 않는다', () => {
    const result = sanitizeHttpRequestUrl(
      '/api/callback?limit=20&access_token=raw-token&client_secret=raw-secret&signature=raw-signature',
    );

    expect(result).toContain('limit=20');
    expect(result).not.toContain('raw-token');
    expect(result).not.toContain('raw-secret');
    expect(result).not.toContain('raw-signature');
    expect(result.match(/REDACTED/g)).toHaveLength(3);
  });
});

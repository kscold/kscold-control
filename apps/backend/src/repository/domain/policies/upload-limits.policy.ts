const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

/**
 * 소스 저장소 업로드 정책. 화면은 GET /repository/upload-limits 로 이 값을 받아 그대로 쓴다.
 *
 * 큰 파일은 chunkBytes 조각으로 나눠 디스크에 바로 이어 쓰므로 파일 하나에 따로 상한을 두지 않는다
 * (세션 전체 한도와 같음). 실제로 막는 것은 세션을 만들 때 확인하는 서버 디스크 여유 공간이다.
 */
export const REPOSITORY_UPLOAD_LIMITS = Object.freeze({
  maxFiles: 100_000,
  maxTotalBytes: 200 * GIB,
  maxFileBytes: 200 * GIB,
  maxBatches: 20_000,
  /** 작은 파일을 한 요청(multipart)으로 묶을 때의 파일 수와 크기 */
  maxBatchFiles: 50,
  batchBytes: 8 * MIB,
  /** 서버가 받는 multipart 요청 하나의 상한 (메모리로 받으므로 작게 둔다) */
  maxMultipartBytes: 100 * MIB,
  /** 이보다 큰 파일은 혼자 한 배치가 되어 조각으로 올라온다 (nginx 본문 한도 100MB 안) */
  chunkBytes: 16 * MIB,
  /** 업로드가 끝난 뒤에도 서버 디스크에 남겨 둘 여유 공간 */
  reservedFreeBytes: 5 * GIB,
});

import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_IMPERSONATION_KEY = Symbol(
  'allow-during-impersonation',
);

/** 읽기 전용 미리보기에서도 허용할 비-GET 조회 핸들러를 표시한다. */
export const AllowDuringImpersonation = () =>
  SetMetadata(ALLOW_DURING_IMPERSONATION_KEY, true);

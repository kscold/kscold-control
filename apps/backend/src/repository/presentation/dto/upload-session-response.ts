import type { RepositoryUploadSession } from '../../domain/types/upload-session.type';

// The server keeps hashes for integrity checks; progress polling does not need them.
export function uploadSessionResponse(
  session: RepositoryUploadSession,
  summary?: string,
) {
  if (summary !== 'true') return session;
  return {
    ...session,
    batches: session.batches.map(({ files: _files, ...batch }) => batch),
  };
}

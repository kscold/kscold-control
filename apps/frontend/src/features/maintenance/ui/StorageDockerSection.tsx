import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatSize } from '../lib/format';
import type { StorageOverview } from '../model/maintenance.types';

type DockerUsage = NonNullable<StorageOverview['docker']>;

const STATE_LABEL: Record<string, string> = {
  running: '실행 중',
  exited: '꺼짐',
  created: '만들어짐',
  paused: '일시 정지',
  restarting: '다시 시작 중',
};

function Panel({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-800 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {summary && <p className="text-xs text-gray-500">{summary}</p>}
      </div>
      {children}
    </section>
  );
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** 도커 안 사용량 — 커진 컨테이너, 쓰지 않는 이미지와 볼륨 */
export function StorageDockerSection({ docker }: { docker: DockerUsage }) {
  const oversized = docker.containers.filter(
    (container) => container.oversized,
  );

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-white">도커 안</h2>

      <Panel
        title="컨테이너별 크기"
        summary={
          oversized.length > 0
            ? `${oversized.length}개가 5 GiB를 넘었습니다`
            : '이미지 위에 컨테이너가 따로 쌓은 파일 크기'
        }
      >
        <ul className="divide-y divide-gray-800">
          {docker.containers.map((container) => (
            <li
              key={container.name}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5 ${container.oversized ? 'bg-amber-950/20' : ''}`}
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="break-all font-mono text-sm text-gray-100">
                    {container.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${container.state === 'running' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-gray-800 text-gray-400'}`}
                  >
                    {STATE_LABEL[container.state] ?? container.state}
                  </span>
                  {container.oversized && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200">
                      커짐
                    </span>
                  )}
                </p>
                <p className="mt-0.5 break-all text-xs text-gray-500">
                  {container.image}
                  {container.oversized &&
                    ' · 컨테이너 안에 패키지 캐시나 로그가 쌓였는지 확인해 보세요'}
                </p>
              </div>
              <span
                className={`shrink-0 text-sm tabular-nums ${container.oversized ? 'font-semibold text-amber-200' : 'text-gray-300'}`}
              >
                {formatSize(container.writableBytes)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="쓰는 컨테이너가 없는 이미지"
          summary={`${docker.unusedImages.length}개 · ${formatSize(sum(docker.unusedImages.map((image) => image.uniqueBytes)))}`}
        >
          {docker.unusedImages.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-gray-500">
              없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {docker.unusedImages.map((image) => (
                <li
                  key={image.id}
                  className="flex items-center justify-between gap-4 px-4 py-2 sm:px-5"
                >
                  <span className="min-w-0 break-all font-mono text-xs text-gray-200">
                    {image.reference ?? `이름 없는 이미지 ${image.id}`}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">
                    {formatSize(image.uniqueBytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-gray-800 px-4 py-2.5 text-xs leading-5 text-gray-500 sm:px-5">
            인증서 갱신처럼 가끔만 쓰는 이미지도 여기에 보일 수 있습니다. 지울
            때는{' '}
            <Link to="/docker" className="text-sky-300 hover:underline">
              Docker 화면의 정리
            </Link>
            를 쓰세요.
          </p>
        </Panel>

        <Panel
          title="연결된 컨테이너가 없는 볼륨"
          summary={`${docker.unreferencedVolumes.length}개 · ${formatSize(sum(docker.unreferencedVolumes.map((volume) => volume.sizeBytes)))}`}
        >
          {docker.unreferencedVolumes.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-gray-500">
              없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {docker.unreferencedVolumes.map((volume) => (
                <li
                  key={volume.name}
                  className="flex items-center justify-between gap-4 px-4 py-2 sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-xs text-gray-200">
                      {volume.name}
                    </span>
                    {volume.project && (
                      <span className="text-[11px] text-gray-500">
                        {volume.project} 프로젝트
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-400">
                    {formatSize(volume.sizeBytes)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-gray-800 px-4 py-2.5 text-xs leading-5 text-gray-500 sm:px-5">
            되돌리기용으로 일부러 남겨 둔 DB 볼륨일 수 있습니다. 지우기 전에
            무엇인지 꼭 확인하세요.
          </p>
        </Panel>
      </div>

      {docker.buildCacheBytes > 0 && (
        <p className="text-xs text-gray-500">
          빌드 캐시 {formatSize(docker.buildCacheBytes)}
        </p>
      )}
    </div>
  );
}

import type {
  AuditEventDomain,
  AuditFeedItem,
  AuditFeedPeriod,
} from '../model/audit.types';

export const AUDIT_DOMAIN_LABEL: Record<AuditEventDomain, string> = {
  security: '보안',
  secrets: '비밀값',
  rbac: '계정·권한',
  docker: '컨테이너',
  nginx: '사이트',
  repository: '소스 저장소',
  backup: '백업',
  maintenance: '유지보수',
};

export const AUDIT_PERIOD_LABEL: Record<AuditFeedPeriod, string> = {
  today: '오늘',
  week: '7일',
  month: '30일',
  all: '전체',
};

const DAY_MS = 24 * 60 * 60_000;

/** 기간 칩을 API 의 from 값으로 바꾼다. 오늘은 자정부터 센다. */
export function periodStart(period: AuditFeedPeriod, now = new Date()) {
  if (period === 'all') return undefined;
  if (period === 'today') {
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    return midnight.toISOString();
  }
  const days = period === 'week' ? 7 : 30;
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

/** "방금", "5분 전", "3시간 전", 그 뒤로는 "오후 3:20" 처럼 시각만 쓴다(날짜는 묶음 제목에 있다). */
export function formatFeedTime(value: string, now = new Date()) {
  const time = new Date(value);
  const diff = now.getTime() - time.getTime();
  if (diff < 60_000) return '방금';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 6 * 60 * 60_000)
    return `${Math.floor(diff / (60 * 60_000))}시간 전`;
  return time.toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** 목록을 날짜별로 나눌 제목: 오늘 · 어제 · 11월 20일 (목) */
export function formatDayHeading(value: string, now = new Date()) {
  const day = new Date(value);
  const startOf = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const daysAgo = Math.round((startOf(now) - startOf(day)) / DAY_MS);
  if (daysAgo === 0) return '오늘';
  if (daysAgo === 1) return '어제';
  return day.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    ...(day.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
}

export interface AuditFeedDay {
  heading: string;
  items: AuditFeedItem[];
}

/** 최신순 목록을 날짜 묶음으로 나눈다. */
export function groupFeedByDay(items: AuditFeedItem[], now = new Date()) {
  const days: AuditFeedDay[] = [];
  for (const item of items) {
    const heading = formatDayHeading(item.event.createdAt, now);
    const last = days.at(-1);
    if (last?.heading === heading) last.items.push(item);
    else days.push({ heading, items: [item] });
  }
  return days;
}

/** 누가 했는지: 사람은 메일 앞부분, 자동은 "자동" */
export function formatActor(item: AuditFeedItem) {
  if (item.kind === 'system') return '자동';
  const email = item.event.actorEmail;
  return email ? email.split('@')[0] : (item.event.actorId ?? '알 수 없음');
}

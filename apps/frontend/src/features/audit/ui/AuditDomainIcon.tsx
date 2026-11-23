import {
  Box,
  DatabaseBackup,
  FolderGit2,
  Globe,
  KeyRound,
  Shield,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AuditEventDomain } from '../model/audit.types';

const ICON: Record<AuditEventDomain, { icon: LucideIcon; tone: string }> = {
  security: { icon: Shield, tone: 'bg-rose-500/15 text-rose-300' },
  secrets: { icon: KeyRound, tone: 'bg-amber-500/15 text-amber-300' },
  rbac: { icon: Users, tone: 'bg-violet-500/15 text-violet-300' },
  docker: { icon: Box, tone: 'bg-sky-500/15 text-sky-300' },
  nginx: { icon: Globe, tone: 'bg-teal-500/15 text-teal-300' },
  repository: { icon: FolderGit2, tone: 'bg-emerald-500/15 text-emerald-300' },
  backup: { icon: DatabaseBackup, tone: 'bg-indigo-500/15 text-indigo-300' },
  maintenance: { icon: Wrench, tone: 'bg-gray-500/15 text-gray-300' },
};

/** 분류마다 같은 모양·색을 쓰는 동그란 아이콘 */
export function AuditDomainIcon({
  domain,
  size = 'md',
}: {
  domain: AuditEventDomain;
  size?: 'md' | 'lg';
}) {
  const { icon: Icon, tone } = ICON[domain] ?? ICON.maintenance;
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full ${box} ${tone}`}
    >
      <Icon size={size === 'lg' ? 20 : 17} />
    </span>
  );
}

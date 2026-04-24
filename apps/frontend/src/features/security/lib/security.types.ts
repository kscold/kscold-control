export type IpBanSource = 'manual' | 'auto-nginx' | 'auto-ssh';

export interface IpBan {
  id: string;
  ip: string;
  reason: string | null;
  source: IpBanSource;
  active: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIpBanInput {
  ip: string;
  reason?: string;
  ttlMinutes?: number;
}

export const TTL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: '영구' },
  { value: 60, label: '1시간' },
  { value: 6 * 60, label: '6시간' },
  { value: 24 * 60, label: '24시간' },
  { value: 7 * 24 * 60, label: '7일' },
  { value: 30 * 24 * 60, label: '30일' },
];

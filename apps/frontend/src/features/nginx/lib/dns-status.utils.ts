import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export function getDnsStatusIcon(status: string) {
  switch (status) {
    case 'ok':
      return CheckCircle;
    case 'mismatch':
      return AlertTriangle;
    case 'missing':
      return XCircle;
    default:
      return null;
  }
}

export function getDnsStatusIconColor(status: string): string {
  switch (status) {
    case 'ok':
      return 'text-green-400';
    case 'mismatch':
      return 'text-yellow-400';
    case 'missing':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function getDnsStatusText(status: string): string {
  switch (status) {
    case 'ok':
      return '정상';
    case 'mismatch':
      return '불일치';
    case 'missing':
      return '미등록';
    default:
      return status;
  }
}

export function getDnsStatusColor(status: string): string {
  switch (status) {
    case 'ok':
      return 'text-green-400 bg-green-950';
    case 'mismatch':
      return 'text-yellow-400 bg-yellow-950';
    case 'missing':
      return 'text-red-400 bg-red-950';
    default:
      return 'text-gray-400 bg-gray-800';
  }
}

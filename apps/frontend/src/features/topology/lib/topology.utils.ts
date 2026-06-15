import type { StackMeta } from './topology.types';

export function getStackMeta(image: string, containerName: string): StackMeta {
  const img = image.toLowerCase();
  const name = containerName.toLowerCase();

  if (img.includes('ubuntu-congbang') || name.includes('congbang')) {
    return {
      label: 'CongBang App',
      type: 'app',
      color: 'border-blue-500',
      shadowColor: 'shadow-blue-500/20',
      headerBg: 'bg-blue-950',
      stacks: [
        {
          name: 'Spring Boot 3.4',
          badge: 'Java 21',
          color: 'bg-orange-900 text-orange-300',
        },
        {
          name: 'Next.js 16',
          badge: 'Node 20',
          color: 'bg-green-900 text-green-300',
        },
        {
          name: 'PM2',
          badge: 'Process Mgr',
          color: 'bg-indigo-900 text-indigo-300',
        },
      ],
      knownServices: [
        { name: 'PostgreSQL 16', port: 5432, icon: '🐘' },
        { name: 'Redis', port: 6379, icon: '🟥' },
        { name: 'MongoDB 7', port: 27017, icon: '🍃' },
      ],
    };
  }

  if (img.includes('ubuntu-galjido') || name.includes('galjido')) {
    return {
      label: 'Galjido App',
      type: 'app',
      color: 'border-purple-500',
      shadowColor: 'shadow-purple-500/20',
      headerBg: 'bg-purple-950',
      stacks: [
        {
          name: 'Ubuntu 22.04',
          badge: 'Linux',
          color: 'bg-orange-900 text-orange-300',
        },
        {
          name: 'OpenSSH',
          badge: ':22→2223',
          color: 'bg-gray-700 text-gray-300',
        },
      ],
      knownServices: [{ name: 'PostgreSQL', port: 5433, icon: '🐘' }],
    };
  }

  if (
    img.includes('postgres') ||
    name.includes('infra-db') ||
    name.includes('postgres')
  ) {
    return {
      label: 'PostgreSQL',
      type: 'db',
      color: 'border-sky-500',
      shadowColor: 'shadow-sky-500/20',
      headerBg: 'bg-sky-950',
      stacks: [
        {
          name: 'PostgreSQL 15',
          badge: 'Alpine',
          color: 'bg-sky-900 text-sky-300',
        },
      ],
      knownServices: [{ name: 'PostgreSQL', port: 5432, icon: '🐘' }],
    };
  }

  if (img.includes('nginx') || name.includes('nginx')) {
    return {
      label: 'Nginx Proxy',
      type: 'proxy',
      color: 'border-amber-500',
      shadowColor: 'shadow-amber-500/20',
      headerBg: 'bg-amber-950',
      stacks: [
        {
          name: 'Nginx',
          badge: 'Reverse Proxy',
          color: 'bg-amber-900 text-amber-300',
        },
        {
          name: 'SSL/TLS',
          badge: "Let's Encrypt",
          color: 'bg-green-900 text-green-300',
        },
      ],
      knownServices: [
        { name: 'HTTP', port: 80, icon: '🌐' },
        { name: 'HTTPS', port: 443, icon: '🔒' },
      ],
    };
  }

  if (img.includes('redis')) {
    return {
      label: 'Redis',
      type: 'cache',
      color: 'border-red-500',
      shadowColor: 'shadow-red-500/20',
      headerBg: 'bg-red-950',
      stacks: [
        { name: 'Redis', badge: 'Cache', color: 'bg-red-900 text-red-300' },
      ],
      knownServices: [{ name: 'Redis', port: 6379, icon: '🟥' }],
    };
  }

  if (img.includes('mongo')) {
    return {
      label: 'MongoDB',
      type: 'db',
      color: 'border-green-500',
      shadowColor: 'shadow-green-500/20',
      headerBg: 'bg-green-950',
      stacks: [
        {
          name: 'MongoDB',
          badge: 'NoSQL',
          color: 'bg-green-900 text-green-300',
        },
      ],
      knownServices: [{ name: 'MongoDB', port: 27017, icon: '🍃' }],
    };
  }

  return {
    label: containerName,
    type: 'app',
    color: 'border-gray-600',
    shadowColor: 'shadow-gray-500/10',
    headerBg: 'bg-gray-800',
    stacks: [],
    knownServices: [],
  };
}

export function formatMemory(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${mb.toFixed(0)}M`;
}

export function pm2Dot(status: string) {
  if (status === 'online') return 'bg-green-400 shadow-green-400/50 shadow-sm';
  if (status === 'stopped') return 'bg-gray-500';
  return 'bg-red-400 shadow-red-400/50 shadow-sm';
}

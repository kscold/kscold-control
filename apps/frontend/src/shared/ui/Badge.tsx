import { BadgeProps } from './types';

/**
 * 상태 표시와 라벨에 쓰이는 재사용 배지 컴포넌트
 */
export function Badge({
  variant = 'default',
  children,
  className = '',
}: BadgeProps) {
  const baseClasses =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  const variantClasses = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
  };

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${className}`;

  return <span className={combinedClasses}>{children}</span>;
}

/**
 * Docker 컨테이너 상태 전용 배지 컴포넌트
 */
export function StatusBadge({ status }: { status: string }) {
  const getVariant = (status: string): BadgeProps['variant'] => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'success';
      case 'exited':
      case 'stopped':
        return 'default';
      case 'error':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return <Badge variant={getVariant(status)}>{status}</Badge>;
}

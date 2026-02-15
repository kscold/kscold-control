import { CardProps } from '../../types';

/**
 * Reusable Card Component
 * Provides consistent card styling for content containers
 */
export function Card({
  title,
  subtitle,
  children,
  actions,
  className = '',
  onClick,
}: CardProps) {
  const baseClasses =
    'bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden';
  const interactiveClasses = onClick
    ? 'cursor-pointer hover:shadow-lg transition-shadow'
    : '';
  const combinedClasses = `${baseClasses} ${interactiveClasses} ${className}`;

  return (
    <div className={combinedClasses} onClick={onClick}>
      {(title || subtitle || actions) && (
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

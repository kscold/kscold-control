import { InputProps } from '../../types';

/**
 * Reusable Input Component
 * Provides consistent form input styling
 */
export function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  error,
  label,
  required = false,
  className = '',
}: InputProps) {
  const baseClasses =
    'w-full px-3 py-2 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';

  const errorClasses = error
    ? 'border-red-500 focus:ring-red-500 bg-red-50'
    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500';

  const disabledClasses = disabled
    ? 'bg-gray-100 cursor-not-allowed opacity-60'
    : 'bg-white';

  const combinedClasses = `${baseClasses} ${errorClasses} ${disabledClasses} ${className}`;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={combinedClasses}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

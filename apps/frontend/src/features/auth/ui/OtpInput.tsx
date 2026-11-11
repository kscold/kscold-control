import type { RefObject } from 'react';

interface OtpInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  className: string;
  inputRef?: RefObject<HTMLInputElement>;
}

export function OtpInput({
  id,
  value,
  onChange,
  className,
  inputRef,
}: OtpInputProps) {
  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      autoFocus
      required
      value={value}
      onChange={(event) =>
        onChange(event.target.value.replace(/\D/g, '').slice(0, 6))
      }
      placeholder="000000"
      className={className}
    />
  );
}

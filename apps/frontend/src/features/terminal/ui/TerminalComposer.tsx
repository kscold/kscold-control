import { useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import {
  ClipboardPaste,
  ImagePlus,
  Loader2,
  SendHorizontal,
} from 'lucide-react';

interface TerminalComposerProps {
  disabled: boolean;
  onSend: (text: string) => void;
  onUploadImage: (file: Blob) => Promise<string>;
}

/**
 * 휴대폰용 입력 줄.
 * xterm 의 숨은 입력칸은 휴대폰 한글 조합을 자모로 쪼개 보내고 입력할 때마다 키보드가 내려가서,
 * 일반 입력칸에서 글자를 다 조합한 뒤 한 번에 터미널로 보낸다.
 */
export function TerminalComposer({
  disabled,
  onSend,
  onUploadImage,
}: TerminalComposerProps) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = () => {
    onSend(text);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // 조합 중인 Enter 는 글자 확정용이라 보내지 않는다
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    if (event.shiftKey) return;
    event.preventDefault();
    send();
  };

  const upload = async (file: Blob) => {
    setUploading(true);
    setError(null);
    try {
      const path = await onUploadImage(file);
      setText(
        (current) =>
          `${current}${current && !current.endsWith(' ') ? ' ' : ''}${path} `,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지를 올리지 못했습니다.');
    } finally {
      setUploading(false);
      inputRef.current?.focus();
    }
  };

  // 휴대폰에서 길게 눌러 붙여넣기가 번거로워 버튼 하나로 클립보드 글자나 이미지를 넣는다
  const pasteClipboard = async () => {
    setError(null);
    try {
      if (navigator.clipboard.read) {
        for (const item of await navigator.clipboard.read()) {
          const type = item.types.find((t) => t.startsWith('image/'));
          if (type) {
            await upload(await item.getType(type));
            return;
          }
        }
      }
      const clip = await navigator.clipboard.readText();
      setText((current) => current + clip);
    } catch {
      setError(
        '클립보드를 읽지 못했습니다. 입력칸을 길게 눌러 붙여 넣어 주세요.',
      );
    }
    inputRef.current?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const image = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile();
    if (!image) return;
    event.preventDefault();
    void upload(image);
  };

  return (
    <div className="shrink-0 border-t border-gray-800 bg-gray-900 px-2 py-1.5 md:hidden">
      {error && <p className="pb-1 text-xs text-red-400">{error}</p>}
      <div className="flex items-end gap-1.5">
        <button
          type="button"
          aria-label="이미지 올리기"
          disabled={disabled || uploading}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-800 text-gray-200 active:bg-gray-700 disabled:opacity-40"
        >
          {uploading ? (
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
          ) : (
            <ImagePlus size={18} aria-hidden="true" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          aria-label="붙여넣기"
          disabled={disabled || uploading}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => void pasteClipboard()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-800 text-gray-200 active:bg-gray-700 disabled:opacity-40"
        >
          <ClipboardPaste size={18} aria-hidden="true" />
        </button>
        <textarea
          ref={inputRef}
          value={text}
          rows={1}
          disabled={disabled}
          enterKeyHint="send"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="여기에 입력 (빈 칸으로 보내면 Enter)"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="max-h-28 min-h-9 flex-1 resize-none rounded-md bg-gray-800 px-2.5 py-2 text-base leading-5 text-gray-100 placeholder:text-gray-500 focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          aria-label="보내기"
          disabled={disabled}
          // 버튼이 포커스를 가져가면 휴대폰 키보드가 내려가므로 입력칸에 포커스를 남긴다
          onPointerDown={(event) => event.preventDefault()}
          onClick={send}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sky-600 text-white active:bg-sky-700 disabled:opacity-40"
        >
          <SendHorizontal size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

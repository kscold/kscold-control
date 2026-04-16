import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace('language-', '') || '';
  const code = String(children).replace(/\n$/, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-3">
      {lang && (
        <div className="flex items-center justify-between rounded-t-2xl border border-white/8 border-b-0 bg-slate-800 px-3 py-2 text-xs text-slate-300">
          <span>{lang}</span>
          <button
            onClick={handleCopy}
            className="text-slate-400 transition-colors hover:text-white"
          >
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
      )}
      <pre
        className={`overflow-x-auto border border-white/8 bg-slate-950 p-4 text-sm ${lang ? 'rounded-b-2xl' : 'rounded-2xl'}`}
      >
        <code className="text-slate-200">{code}</code>
      </pre>
      {!lang && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-400 opacity-0 transition-all group-hover:opacity-100 hover:text-white"
        >
          {copied ? '복사됨' : '복사'}
        </button>
      )}
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const isInline = !className && !String(children).includes('\n');
          if (isInline) {
            return (
              <code
                className="rounded bg-slate-800 px-1.5 py-0.5 text-sm text-orange-300"
                {...props}
              >
                {children}
              </code>
            );
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
        p({ children }) {
          return <p className="mb-3 last:mb-0 leading-7">{children}</p>;
        },
        ul({ children }) {
          return (
            <ul className="mb-3 list-inside list-disc space-y-1">{children}</ul>
          );
        },
        ol({ children }) {
          return (
            <ol className="mb-3 list-inside list-decimal space-y-1">
              {children}
            </ol>
          );
        },
        h1({ children }) {
          return (
            <h1 className="mb-3 mt-5 text-xl font-bold text-white">
              {children}
            </h1>
          );
        },
        h2({ children }) {
          return (
            <h2 className="mb-3 mt-5 text-lg font-bold text-white">
              {children}
            </h2>
          );
        },
        h3({ children }) {
          return (
            <h3 className="mb-2 mt-4 text-base font-bold text-white">
              {children}
            </h3>
          );
        },
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border border-white/8 text-sm">
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th className="border border-white/8 bg-slate-800 px-3 py-2 text-left">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="border border-white/8 px-3 py-2">{children}</td>
          );
        },
        blockquote({ children }) {
          return (
            <blockquote className="my-3 border-l-4 border-orange-400/40 pl-4 italic text-slate-400">
              {children}
            </blockquote>
          );
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-300 hover:underline"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

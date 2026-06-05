import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFlexibleMarkers from "remark-flexible-markers";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import "highlight.js/styles/github-dark.min.css";

function normalizeMarkdown(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

/** Plain-text preview for line-clamped cards (strips common markdown syntax). */
export function stripMarkdown(content: string): string {
  return normalizeMarkdown(content)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-lg font-bold text-foreground mt-5 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold text-primary mt-4 mb-2 border-b border-border/40 pb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-[var(--neuro-cyan)] mt-3 mb-1.5">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--neuro-amber)] mt-3 mb-1.5">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-foreground/85 mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  mark: ({ children }) => (
    <mark className="rounded bg-[var(--neuro-amber)]/25 px-1 text-[var(--neuro-amber)]">{children}</mark>
  ),
  del: ({ children }) => <del className="text-muted-foreground">{children}</del>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-foreground/85">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-foreground/85">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className?.includes("language-"));
    if (isBlock) {
      return (
        <code className={cn("font-mono text-xs", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-[var(--neuro-cyan)]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-lg border border-border/40 bg-muted/30 p-3 text-xs">{children}</pre>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-4 border-border/40" />,
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/40">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border/40 px-2 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border/40 px-2 py-1.5">{children}</td>,
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content?.trim()) return null;

  return (
    <div className={cn("markdown-content break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkFlexibleMarkers]}
        rehypePlugins={[rehypeHighlight]}
        components={markdownComponents}
      >
        {normalizeMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}

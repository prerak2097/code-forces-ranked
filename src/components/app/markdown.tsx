"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export function Markdown({ children }: { children: string }) {
  if (!children.trim()) {
    return <p className="text-sm text-muted-foreground">Nothing written yet.</p>;
  }
  return (
    <div className="prose-notes text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

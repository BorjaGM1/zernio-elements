import { highlight, type Lang } from "@/lib/highlight";
import { CopyButton } from "./copy-button";

export async function CodeBlock({ code, lang = "tsx", title }: { code: string; lang?: Lang; title?: string }) {
  const html = await highlight(code, lang);
  return (
    <figure className="group relative overflow-hidden rounded-lg border border-line bg-code">
      {title && (
        <figcaption className="flex h-10 items-center border-b border-line px-4 font-mono text-[12px] text-muted">{title}</figcaption>
      )}
      <div className={`absolute right-2.5 ${title ? "top-1.5" : "top-2.5"}`}>
        <CopyButton text={code.trimEnd()} />
      </div>
      <div className={title ? "" : "pr-16"} dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}

import type { ReactNode } from "react";

export function StaticPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <div className="prose-xtools space-y-5 leading-relaxed">{children}</div>
    </article>
  );
}

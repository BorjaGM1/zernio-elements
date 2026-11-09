import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewHost } from "@/components/preview-host";
import { COMPONENTS, EXTRA_PREVIEWS } from "@/lib/catalog";

export const metadata: Metadata = { robots: { index: false } };

export function generateStaticParams() {
  return [...COMPONENTS.map((c) => c.slug), ...EXTRA_PREVIEWS].map((slug) => ({ slug }));
}

export const dynamicParams = false;

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!COMPONENTS.some((c) => c.slug === slug) && !(EXTRA_PREVIEWS as readonly string[]).includes(slug)) notFound();
  return <PreviewHost slug={slug} initialTheme="default" />;
}

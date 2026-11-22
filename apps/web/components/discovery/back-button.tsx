"use client";

import { useRouter } from "next/navigation";

export function BackButton({ fallback, label = "Voltar" }: { fallback: string; label?: string }) {
  const router = useRouter();
  return <button type="button" onClick={() => { if (window.history.length > 1) router.back(); else router.replace(fallback); }} className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">← {label}</button>;
}

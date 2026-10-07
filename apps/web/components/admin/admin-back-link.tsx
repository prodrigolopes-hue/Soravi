import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function AdminBackLink() {
  return (
    <Link
      href="/admin"
      className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Painel administrativo
    </Link>
  );
}

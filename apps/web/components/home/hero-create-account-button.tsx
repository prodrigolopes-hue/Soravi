"use client";

import Link from "next/link";

import { useAuth } from "../auth/auth-provider";

export function HeroCreateAccountButton() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || isAuthenticated) {
    return null;
  }

  return (
    <Link
      href="/cadastro"
      className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 sm:w-auto sm:px-7"
    >
      Criar conta
    </Link>
  );
}

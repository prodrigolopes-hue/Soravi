"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-provider";
import { phoneVerificationGuardDecision } from "./phone-verification-routing";

interface PhoneVerificationGuardProps {
  children: ReactNode;
}

export function PhoneVerificationGuard({
  children,
}: PhoneVerificationGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, user } = useAuth();
  const decision = phoneVerificationGuardDecision({
    isLoading,
    pathname,
    user,
  });
  const redirectDestination =
    decision.type === "redirect" ? decision.destination : null;

  useEffect(() => {
    if (redirectDestination) {
      router.replace(redirectDestination);
    }
  }, [redirectDestination, router]);

  if (decision.type !== "allow") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div
          className="flex items-center gap-3 text-slate-600"
          role="status"
          aria-live="polite"
        >
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          <span>Carregando sua conta...</span>
        </div>
      </main>
    );
  }

  return children;
}

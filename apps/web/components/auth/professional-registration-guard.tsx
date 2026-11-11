"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "./auth-provider";
import { phoneVerificationDestination } from "./phone-verification-routing";

interface ProfessionalRegistrationGuardProps {
  children: ReactNode;
}

export function ProfessionalRegistrationGuard({
  children,
}: ProfessionalRegistrationGuardProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const redirectDestination = user
    ? phoneVerificationDestination(user.roles)
    : null;

  useEffect(() => {
    if (isAuthenticated && redirectDestination) {
      router.replace(redirectDestination);
    }
  }, [isAuthenticated, redirectDestination, router]);

  if (isLoading || isAuthenticated) {
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

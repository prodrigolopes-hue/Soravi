"use client";

import { useEffect, useRef, useState } from "react";

interface ProfessionalAvatarProps {
  name: string;
  photo: { url: string; expiresAt: string } | null;
  className?: string;
  onRefresh?: (reason: "expired" | "error") => void;
}

export function ProfessionalAvatar({
  name,
  photo,
  className = "size-16",
  onRefresh,
}: ProfessionalAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const errorRefreshAttemptedRef = useRef(false);
  const expiredUrlRef = useRef<string | null>(null);
  const expiresAt = photo ? Date.parse(photo.expiresAt) : Number.NaN;
  const canShowPhoto = Boolean(photo && failedUrl !== photo.url && expiresAt > Date.now());

  useEffect(() => {
    setFailedUrl(null);
  }, [photo?.url]);

  useEffect(() => {
    if (!photo) return;
    const delay = Date.parse(photo.expiresAt) - Date.now();
    if (!Number.isFinite(delay)) return;
    if (delay <= 0 && expiredUrlRef.current === photo.url) return;
    const timer = window.setTimeout(() => {
      if (expiredUrlRef.current === photo.url) return;
      expiredUrlRef.current = photo.url;
      onRefresh?.("expired");
    }, Math.max(0, delay));
    return () => window.clearTimeout(timer);
  }, [onRefresh, photo]);

  function handleImageError(): void {
    if (!photo) return;
    setFailedUrl(photo.url);
    if (!errorRefreshAttemptedRef.current) {
      errorRefreshAttemptedRef.current = true;
      onRefresh?.("error");
    }
  }

  if (canShowPhoto && photo) {
    return <img src={photo.url} alt={`Foto de ${name}`} onError={handleImageError} className={`${className} shrink-0 rounded-full border border-slate-200 bg-slate-100 object-cover`} />;
  }

  return <div aria-label={`Iniciais de ${name}`} className={`${className} flex shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800`}>
    {initialsFor(name)}
  </div>;
}

function initialsFor(name: string): string {
  const values = name.trim().split(/\s+/u).filter(Boolean);
  return (values[0]?.[0] ?? "P") + (values.length > 1 ? values.at(-1)?.[0] ?? "" : "");
}

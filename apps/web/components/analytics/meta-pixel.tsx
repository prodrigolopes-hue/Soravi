"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCookieConsent } from "../cookies/cookie-consent";
import { canLoadMetaPixel } from "./meta-pixel-policy";
import { META_REGISTRATION_EVENT, type MetaRegistrationDetail } from "./meta-registration";

// The third-party script runs in an opaque sandbox, never in the page containing
// the registration form. Do not add allow-same-origin to this iframe.
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

export function MetaPixel() {
  const { preference } = useCookieConsent();
  const pathname = usePathname();
  const iframe = useRef<HTMLIFrameElement>(null);
  const frameReady = useRef(false);
  const pendingRegistration = useRef(false);
  const registrationDone = useRef<(() => void) | null>(null);
  const enabled = canLoadMetaPixel(pixelId, preference?.advertising, pathname);

  useEffect(() => {
    if (!enabled) return;
    frameReady.current = false;
    pendingRegistration.current = false;
    const sendRegistration = () => iframe.current?.contentWindow?.postMessage({ type: "registration" }, "*");
    const onRegistration = (event: Event) => {
      const detail = (event as CustomEvent<MetaRegistrationDetail>).detail;
      if (!detail || typeof detail.complete !== "function") return;
      detail.handled = true;
      registrationDone.current = detail.complete;
      pendingRegistration.current = true;
      if (frameReady.current) sendRegistration();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type === "registration-dispatched") {
        pendingRegistration.current = false;
        const complete = registrationDone.current;
        registrationDone.current = null;
        if (complete) window.setTimeout(complete, 150);
        return;
      }
      if (event.data?.type !== "pixel-ready") return;
      frameReady.current = true;
      if (pendingRegistration.current) sendRegistration();
    };
    window.addEventListener(META_REGISTRATION_EVENT, onRegistration);
    window.addEventListener("message", onMessage);
    return () => { window.removeEventListener(META_REGISTRATION_EVENT, onRegistration); window.removeEventListener("message", onMessage); registrationDone.current?.(); registrationDone.current = null; };
  }, [enabled, pathname]);

  if (!enabled) return null;
  return <iframe key={pathname} ref={iframe} title="Medição de publicidade" hidden sandbox="allow-scripts" referrerPolicy="no-referrer" src="/meta-pixel-frame" onLoad={() => iframe.current?.contentWindow?.postMessage({ type: "initialize" }, "*")} />;
}

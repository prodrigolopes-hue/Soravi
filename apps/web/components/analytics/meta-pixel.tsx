"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCookieConsent } from "../cookies/cookie-consent";
import { canLoadMetaPixel } from "./meta-pixel-policy";

// The third-party script runs in an opaque sandbox, never in the page containing
// the registration form. Do not add allow-same-origin to this iframe.
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

export function MetaPixel() {
  const { preference } = useCookieConsent();
  const pathname = usePathname();
  const iframe = useRef<HTMLIFrameElement>(null);
  const frameReady = useRef(false);
  const pendingRegistration = useRef(false);
  const enabled = canLoadMetaPixel(pixelId, preference?.advertising, pathname);

  useEffect(() => {
    if (!enabled) return;
    frameReady.current = false;
    pendingRegistration.current = false;
    const sendRegistration = () => iframe.current?.contentWindow?.postMessage({ type: "registration" }, "*");
    const onRegistration = () => {
      pendingRegistration.current = true;
      if (frameReady.current) sendRegistration();
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || event.data?.type !== "pixel-ready") return;
      frameReady.current = true;
      if (pendingRegistration.current) sendRegistration();
    };
    window.addEventListener("soravi:professional-registration", onRegistration);
    window.addEventListener("message", onMessage);
    return () => { window.removeEventListener("soravi:professional-registration", onRegistration); window.removeEventListener("message", onMessage); };
  }, [enabled, pathname]);

  if (!enabled) return null;
  return <iframe key={pathname} ref={iframe} title="Medição de publicidade" hidden sandbox="allow-scripts" referrerPolicy="no-referrer" src="/meta-pixel-frame" onLoad={() => iframe.current?.contentWindow?.postMessage({ type: "initialize" }, "*")} />;
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useCookieConsent } from "../cookies/cookie-consent";
import { canLoadMetaPixel } from "./meta-pixel-policy";

// The third-party script runs in an opaque sandbox, never in the page containing
// the registration form. Do not add allow-same-origin to this iframe.
const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

export function MetaPixel({ nonce }: { nonce?: string }) {
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
  // Only fixed code and a validated numeric ID are interpolated. The frame has
  // no access to the parent DOM, URL, storage or form data.
  const source = `<!doctype html><html><head><meta name="referrer" content="no-referrer"></head><body><script nonce="${nonce ?? ""}">
    (function(){
      var q=window.fbq=function(){q.callMethod?q.callMethod.apply(q,arguments):q.queue.push(arguments)};
      q.queue=[];q.loaded=true;q.version='2.0';q.push=q;window._fbq=q;
      q('set','autoConfig',false,'${pixelId}');q('init','${pixelId}');q('trackSingle','${pixelId}','PageView');
      var sent=false;window.addEventListener('message',function(e){if(e.source!==parent||!e.data||e.data.type!=='registration'||sent)return;sent=true;q('trackSingle','${pixelId}','CompleteRegistration')});
      var s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';s.onload=function(){parent.postMessage({type:'pixel-ready'},'*')};document.head.appendChild(s);
    })();<\/script></body></html>`;
  return <iframe key={pathname} ref={iframe} title="Medição de publicidade" hidden sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={source} />;
}

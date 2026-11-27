import { NextRequest, NextResponse } from "next/server";

// This document contains no user data. It is hosted at a fixed URL so the
// isolated Pixel has a usable page address without seeing the parent page.
export function GET(request: NextRequest) {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  const nonce = request.headers.get("x-nonce") ?? "";
  if (request.nextUrl.search || !/^\d{5,25}$/.test(id) || !/^[A-Za-z0-9+/=]+$/.test(nonce)) {
    return new NextResponse(null, { status: 404 });
  }
  const html = `<!doctype html><html><head><meta name="referrer" content="no-referrer"></head><body><script nonce="${nonce}">
    (function(){
      var initialized=false,sent=false;
      window.addEventListener('message',function(e){
        if(e.source!==parent||parent===window||!e.data)return;
        if(e.data.type==='initialize'&&!initialized){
          initialized=true;
          var q=window.fbq=function(){q.callMethod?q.callMethod.apply(q,arguments):q.queue.push(arguments)};
          q.queue=[];q.loaded=true;q.version='2.0';q.push=q;window._fbq=q;
          q('set','autoConfig',false,'${id}');q('init','${id}');q('trackSingle','${id}','PageView');
          var s=document.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';
          s.onload=function(){parent.postMessage({type:'pixel-ready'},'*')};document.head.appendChild(s);
        } else if(e.data.type==='registration'&&initialized&&!sent){
          sent=true;window.fbq('trackSingle','${id}','CompleteRegistration');parent.postMessage({type:'registration-dispatched'},'*');
        }
      });
    })();<\/script></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Frame-Options": "SAMEORIGIN" } });
}

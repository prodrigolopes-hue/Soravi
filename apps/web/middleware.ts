import { NextResponse, type NextRequest } from "next/server";

const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
);

const websocketUrl = new URL(apiUrl.origin);
websocketUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";

function createContentSecurityPolicy(nonce: string): string {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://www.googletagmanager.com",
  ];

  if (process.env.NODE_ENV === "development") {
    scriptSources.push("'unsafe-eval'");
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com",
    "font-src 'self' data:",
    `connect-src 'self' ${apiUrl.origin} ${websocketUrl.origin} https://viacep.com.br https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com`,
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set(
    "Content-Security-Policy-Report-Only",
    contentSecurityPolicy,
  );

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};

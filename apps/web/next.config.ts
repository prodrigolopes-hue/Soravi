import type { NextConfig } from "next";

type ContentSecurityPolicy = Record<string, readonly string[]>;

const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
);

const apiOrigin = apiUrl.origin;

const websocketUrl = new URL(apiOrigin);
websocketUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";

const contentSecurityPolicy: ContentSecurityPolicy = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],

  // Temporário no modo report-only para compatibilidade com o Next.js e o
  // bootstrap inline atual do Google Analytics. Nonces virão em hardening posterior.
  "script-src": [
    "'self'",
    "'unsafe-inline'",
    "https://www.googletagmanager.com",
  ],

  // Estilos inline serão endurecidos em uma etapa posterior.
  "style-src": ["'self'", "'unsafe-inline'"],

  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://soravi-service-requests.42c0679b95af0c1fb21f9f188ffa732e.r2.cloudflarestorage.com",
  ],

  "font-src": ["'self'", "data:"],

  "connect-src": [
    "'self'",
    apiOrigin,
    websocketUrl.origin,
    "https://viacep.com.br",
    "https://www.google-analytics.com",
    "https://region1.google-analytics.com",
    "https://www.googletagmanager.com",
  ],
};

const contentSecurityPolicyValue = Object.entries(contentSecurityPolicy)
  .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
  .join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: contentSecurityPolicyValue,
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production"

// NOTE on 'unsafe-inline' in script-src: the App Router ships inline hydration
// scripts, and the whole UI uses inline style={{...}} attributes. Removing it
// requires nonce-based CSP via middleware. Kept for now so the CSP can ship
// today — it still restricts which *origins* may load scripts and where the
// page may connect to or be framed by, which is the bulk of the value.
//
// 'unsafe-eval' is added in DEVELOPMENT ONLY. Next's dev server uses
// react-refresh, which evaluates strings as JavaScript; without it the app dies
// on load with "Uncaught EvalError". It must never reach production.
//
// fonts.googleapis.com / fonts.gstatic.com are required by the <link> in
// src/app/layout.tsx (Space Grotesk + Montserrat).
//
// cdnjs.cloudflare.com is required only because src/app/pipeline/page.tsx and
// src/app/dashboard/page.tsx inject Chart.js from the CDN at runtime. chart.js
// is already a dependency — import it instead and this entry can be dropped.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdnjs.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src 'self' https://login.microsoftonline.com${isDev ? " ws: wss:" : ""}`,
  "form-action 'self' https://login.microsoftonline.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ")

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy",   value: CSP },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        // Never let a proxy or browser cache an API response — they are
        // per-user authorised now, so a shared cache entry would leak
        // one country's data to another.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "Vary",          value: "Cookie, Authorization" },
        ],
      },
    ]
  },
}

module.exports = nextConfig

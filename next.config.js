/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.11"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/BabuEiEi/images/obec.png",
      },
    ],
  },
  // @napi-rs/canvas ships prebuilt native (.node) binaries that must be
  // loaded via require() at runtime, not bundled by webpack.
  // pdfjs-dist resolves its worker script (pdf.worker.mjs) as a file next to
  // its own module at runtime; bundling it rewrites that path and the worker
  // file never gets emitted, so PDF templates fail with "Setting up fake
  // worker failed" in a production build (this doesn't show up under `next
  // dev`, only in the actual build App Hosting deploys).
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // render.js loads the Thai font from a runtime-built path
  // (path.join(process.cwd(), "src/lib/certificate/fonts/...")), which
  // Next's file tracer can't follow statically -- it never showed up in any
  // .next/**/*.nft.json trace manifest, so it was silently missing from the
  // deployed container. Text drawn with that font (recipient name,
  // certificate number) rendered as nothing in production while the same
  // build worked fine locally, where the full repo is already on disk.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/certificate/fonts/**"],
  },
  experimental: {
    serverActions: {
      // Signature files (2 MB) and certificate templates (5 MB) are validated
      // again in their Server Actions. The extra room covers multipart form
      // metadata plus the JSON-encoded template placements payload.
      bodySizeLimit: "6mb",
    },
  },
};

module.exports = nextConfig;

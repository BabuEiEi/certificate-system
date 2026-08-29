/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.11"],
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

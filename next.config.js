/** @type {import("next").NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["192.168.1.11"],
  experimental: {
    serverActions: {
      // Signature files are validated again at 2 MB in the Server Action.
      // The extra room covers multipart form metadata.
      bodySizeLimit: "3mb",
    },
  },
};

module.exports = nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These pull in native binaries or ship their own worker bundles; bundling them breaks at runtime.
  serverExternalPackages: [
    "@napi-rs/canvas",
    "sharp",
    "pdfjs-dist",
    "tesseract.js",
    "puppeteer",
    "archiver",
    "exceljs",
    "@jspawn/qpdf-wasm",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;

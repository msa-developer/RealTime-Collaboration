/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Dev server must whitelist tunnel origins (ngrok) or it blocks cross-origin
     requests / HMR websocket. Change URL when ngrok hostname changes. */
  allowedDevOrigins: ["https://rephrase-triage-hurled.ngrok-free.dev"],
};

export default nextConfig;

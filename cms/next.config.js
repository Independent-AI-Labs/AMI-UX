/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {
    appDir: true
  },
  async redirects() {
    return [
      { source: '/', destination: '/index.html', permanent: false }
    ]
  }
}

module.exports = nextConfig


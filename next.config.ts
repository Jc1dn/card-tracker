const nextConfig = {
  // Add this to allow network access
  devIndicators: {
    appIsrStatus: false,
  },
  experimental: {
    // Newer Next.js versions handle this via allowedDevOrigins
  },
};

// Add this directly to the module.exports
module.exports = {
  ...nextConfig,
  allowedDevOrigins: ['192.168.0.182'],
};
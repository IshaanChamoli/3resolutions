/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static generation for dynamic routes if needed
  generateStaticParams: async () => {
    // You could pre-generate some common paths here if needed
    return [];
  }
};

export default nextConfig;

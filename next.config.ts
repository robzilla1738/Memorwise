import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', '@lancedb/lancedb', 'apache-arrow', 'tesseract.js', '@huggingface/transformers'],
  outputFileTracingRoot: path.join(import.meta.dirname),
};

export default nextConfig;

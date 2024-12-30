import sharp from 'sharp';
import fetch from 'node-fetch';

async function addWatermark(imageBuffer) {
  try {
    // Create a buffer with the watermark text with gradient and enhanced background
    const watermarkSvg = `
      <svg width="900" height="100">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#9333EA;stop-opacity:1" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
          </filter>
        </defs>
        <style>
          .background {
            fill: rgba(255, 255, 255, 0.85);
            filter: url(#shadow);
            rx: 16;
            ry: 16;
          }
          .text { 
            fill: url(#gradient);
            font-size: 52px;
            font-weight: 700; 
            font-family: Arial, Helvetica, sans-serif;
            letter-spacing: 1px;
            word-spacing: 2px;
            text-decoration: underline;
            text-decoration-thickness: 3px;
            text-underline-offset: 8px;
          }
        </style>
        <rect class="background" x="10" y="10" width="880" height="80" />
        <text x="40" y="50%" text-anchor="start" class="text" dy=".35em">
          3resolutions.com      
        </text>
      </svg>
    `;

    // First get the image dimensions
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    // Add watermark to the bottom right corner - shifted more right
    const watermarkedImage = await image
      .composite([{
        input: Buffer.from(watermarkSvg),
        top: metadata.height - 100 - 40,
        left: metadata.width - 530,  // Changed from 800 to 600 to shift right
      }])
      .jpeg({ quality: 100 })
      .toBuffer();

    return watermarkedImage;
  } catch (error) {
    console.error('Error adding watermark:', error);
    throw error;
  }
}

export async function GET(request) {
  try {
    // Fetch the test image
    const imageUrl = 'https://storage.googleapis.com/3resolutions-dalle-images/resolutions/ishaan-shaurya-chamoli-6s5y1y-1735593750187.jpg';
    const response = await fetch(imageUrl);
    const imageBuffer = await response.arrayBuffer();

    // Add watermark to the image
    const watermarkedImageBuffer = await addWatermark(Buffer.from(imageBuffer));

    // Return the watermarked image
    return new Response(watermarkedImageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store'
      }
    });

  } catch (error) {
    console.error('Error in test-watermark route:', error);
    return Response.json({ 
      error: 'Failed to add watermark',
      details: error.message 
    }, { status: 500 });
  }
} 
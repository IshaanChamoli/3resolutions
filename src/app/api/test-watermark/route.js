import sharp from 'sharp';
import path from 'path';

export async function GET(request) {
  try {
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png');

    // Create a dark background to see the watermark clearly
    const image = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 20, g: 20, b: 20, alpha: 1 }
      }
    })
    .composite([{
      input: watermarkPath,
      top: 1024 - 100 - 80,     // Current bottom gap is good
      left: 1024 - 650,         // Changed from 480 to 430 to move more left
      gravity: 'southeast'
    }])
    .png()
    .toBuffer();

    return new Response(image, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Error generating test watermark:', error);
    return Response.json({ 
      error: 'Failed to generate test watermark',
      details: error.message 
    }, { status: 500 });
  }
} 
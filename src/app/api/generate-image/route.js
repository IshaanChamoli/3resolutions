import OpenAI from 'openai';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
});

const bucket = storage.bucket(process.env.GOOGLE_CLOUD_BUCKET_NAME);

// Helper function to sanitize name for URL
function sanitizeNameForUrl(name) {
  // Add a random string to make it unique but still readable
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')}-${randomStr}`;
}

async function deleteUserPreviousImages(userId, userName) {
  try {
    const sanitizedName = sanitizeNameForUrl(userName);
    console.log(`Deleting previous images for user: ${sanitizedName}`);
    const [files] = await bucket.getFiles({
      prefix: `resolutions/${sanitizedName}`
    });
    
    await Promise.all(files.map(file => file.delete()));
    console.log(`Successfully deleted ${files.length} previous images`);
  } catch (error) {
    console.error('Error deleting previous images:', error);
  }
}

async function addWatermark(imageBuffer) {
  try {
    console.log('Starting watermark process with image size:', imageBuffer.length);
    
    // Get image dimensions first
    const metadata = await sharp(imageBuffer).metadata();
    console.log('Image metadata:', {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format
    });

    const watermarkedImage = await sharp(imageBuffer)
      .composite([{
        input: Buffer.from(watermarkSvg),
        top: metadata.height - 100 - 40,
        left: metadata.width - 530,
      }])
      .jpeg({ quality: 100 })
      .toBuffer();

    console.log('Watermark added successfully, new size:', watermarkedImage.length);
    return watermarkedImage;
  } catch (error) {
    console.error('Detailed watermark error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    throw new Error(`Watermark Error: ${error.message}`);
  }
}

// Add this SVG definition before the uploadImageToGCS function
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

async function uploadImageToGCS(imageUrl, userId, userName) {
  try {
    console.log('Starting GCS upload process...');
    
    // Download DALL-E image
    console.log('Fetching DALL-E image from URL:', imageUrl);
    const response = await fetch(imageUrl, {
      timeout: 15000 // 15 second timeout
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch DALL-E image: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    
    // Process image with optimized Sharp settings
    const watermarkedBuffer = await sharp(Buffer.from(buffer))
      .jpeg({ quality: 80, progressive: true }) // Reduced quality, progressive loading
      .composite([{
        input: Buffer.from(watermarkSvg),
        top: (await sharp(Buffer.from(buffer)).metadata()).height - 100 - 40,
        left: (await sharp(Buffer.from(buffer)).metadata()).width - 530,
      }])
      .toBuffer();

    // Upload to GCS with optimized settings
    const timestamp = Date.now();
    const filename = `resolutions/${sanitizeNameForUrl(userName)}-${timestamp}.jpg`;
    const file = bucket.file(filename);
    
    await file.save(watermarkedBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      },
      resumable: false // Disable resumable uploads for faster processing
    });

    const publicUrl = `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET_NAME}/${filename}`;
    return publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

export async function POST(request) {
  try {
    const { prompt, userId, userName } = await request.json();
    
    // Set a timeout for the entire operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out')), 50000)
    );

    const operationPromise = (async () => {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural",
      });

      if (!response?.data?.[0]?.url) {
        throw new Error('Invalid response from DALL-E API');
      }

      return await uploadImageToGCS(response.data[0].url, userId, userName);
    })();

    const permanentUrl = await Promise.race([operationPromise, timeoutPromise]);
    return Response.json({ imageUrl: permanentUrl });
    
  } catch (error) {
    console.error('Operation failed:', error);
    return Response.json({ 
      error: 'Failed to generate image',
      details: error.message
    }, { status: error.message.includes('timed out') ? 504 : 500 });
  }
} 
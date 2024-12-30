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

    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const watermarkedImage = await image
      .composite([{
        input: Buffer.from(watermarkSvg),
        top: metadata.height - 100 - 40,
        left: metadata.width - 530,
      }])
      .jpeg({ quality: 100 })
      .toBuffer();

    return watermarkedImage;
  } catch (error) {
    console.error('Error adding watermark:', error);
    throw error;
  }
}

async function uploadImageToGCS(imageUrl, userId, userName) {
  try {
    const sanitizedName = sanitizeNameForUrl(userName);
    await deleteUserPreviousImages(userId, userName);

    console.log('Downloading DALL-E image...');
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();

    // Add watermark before uploading
    console.log('Adding watermark...');
    const watermarkedBuffer = await addWatermark(Buffer.from(buffer));
    console.log('Watermark added successfully');

    // Create filename without user-specific folder
    const timestamp = Date.now();
    const filename = `resolutions/${sanitizedName}-${timestamp}.jpg`;
    console.log('Uploading to path:', filename);
    
    // Create write stream with metadata
    const file = bucket.file(filename);
    const writeStream = file.createWriteStream({
      metadata: {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      }
    });

    // Upload watermarked file
    await new Promise((resolve, reject) => {
      writeStream.end(watermarkedBuffer);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log('File uploaded successfully');
    
    const publicUrl = `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET_NAME}/${filename}`;
    console.log('Generated public URL:', publicUrl);
    
    return publicUrl;
  } catch (error) {
    console.error('Error uploading to Google Cloud Storage:', error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const { prompt, userId, userName } = await request.json();
    console.log('Starting image generation for user:', userName);

    // Generate with DALL-E
    console.log('Calling DALL-E API...');
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    console.log('DALL-E image generated successfully');
    const temporaryUrl = response.data[0].url;
    
    // Upload to Google Cloud Storage
    console.log('Uploading to Google Cloud Storage...');
    const permanentUrl = await uploadImageToGCS(temporaryUrl, userId, userName);
    console.log('Final permanent URL:', permanentUrl);

    return Response.json({ imageUrl: permanentUrl });
  } catch (error) {
    console.error('Detailed error:', error);
    return Response.json({ 
      error: 'Failed to generate image',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 
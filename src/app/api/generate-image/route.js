import OpenAI from 'openai';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';
import path from 'path';

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
    const watermarkPath = path.join(process.cwd(), 'public', 'watermark.png');
    
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const watermarkedImage = await image
      .composite([{
        input: watermarkPath,
        top: metadata.height - 100 - 80,     // Updated to match test endpoint
        left: metadata.width - 650,          // Updated to match test endpoint
        gravity: 'southeast',
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
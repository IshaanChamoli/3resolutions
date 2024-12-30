import OpenAI from 'openai';
import { Storage } from '@google-cloud/storage';

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

async function uploadImageToGCS(imageUrl, userId, userName) {
  try {
    const sanitizedName = sanitizeNameForUrl(userName);
    await deleteUserPreviousImages(userId, userName);

    console.log('Downloading DALL-E image...');
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();

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

    // Upload file
    await new Promise((resolve, reject) => {
      writeStream.end(Buffer.from(buffer));
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
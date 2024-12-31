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

async function uploadImageToGCS(imageUrl, userId, userName) {
  try {
    console.log('Starting GCS upload process...');
    console.log('GCS Credentials check:', {
      projectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
      clientEmail: !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
      privateKeyExists: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY,
      bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME
    });

    const sanitizedName = sanitizeNameForUrl(userName);
    console.log('Sanitized name:', sanitizedName);
    
    // Download DALL-E image
    console.log('Fetching DALL-E image from URL:', imageUrl);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch DALL-E image: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    console.log('DALL-E image downloaded, size:', buffer.byteLength);

    try {
      // Add watermark
      console.log('Starting watermark process...');
      const watermarkedBuffer = await addWatermark(Buffer.from(buffer));
      console.log('Watermark added successfully, new size:', watermarkedBuffer.length);

      // Upload to GCS
      const timestamp = Date.now();
      const filename = `resolutions/${sanitizedName}-${timestamp}.jpg`;
      console.log('Attempting upload to GCS path:', filename);
      
      const file = bucket.file(filename);
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: 'image/jpeg',
          cacheControl: 'public, max-age=31536000',
        }
      });

      // Upload with more detailed error handling
      await new Promise((resolve, reject) => {
        writeStream.on('error', (error) => {
          console.error('GCS write stream error:', error);
          reject(error);
        });
        writeStream.on('finish', () => {
          console.log('GCS write stream finished successfully');
          resolve();
        });
        writeStream.end(watermarkedBuffer);
      });

      const publicUrl = `https://storage.googleapis.com/${process.env.GOOGLE_CLOUD_BUCKET_NAME}/${filename}`;
      console.log('Generated public URL:', publicUrl);
      
      // Verify the uploaded file is accessible
      try {
        const verifyResponse = await fetch(publicUrl);
        if (!verifyResponse.ok) {
          console.warn('Warning: Uploaded file verification failed:', verifyResponse.status);
        }
      } catch (verifyError) {
        console.warn('Warning: Could not verify uploaded file:', verifyError);
      }

      return publicUrl;
    } catch (watermarkError) {
      console.error('Error in watermark/upload process:', watermarkError);
      throw watermarkError;
    }
  } catch (error) {
    console.error('Detailed GCS upload error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      errors: error.errors
    });
    throw new Error(`GCS Upload Error: ${error.message}`);
  }
}

export async function POST(request) {
  try {
    const { prompt, userId, userName } = await request.json();
    console.log('Starting image generation for user:', userName);
    console.log('API Key format check:', {
      exists: !!process.env.OPENAI_API_KEY,
      prefix: process.env.OPENAI_API_KEY?.substring(0, 8),
      length: process.env.OPENAI_API_KEY?.length
    });

    // Generate with DALL-E
    console.log('Calling DALL-E API with prompt:', prompt);
    try {
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural",
      });

      if (!response?.data?.[0]?.url) {
        console.error('Unexpected DALL-E response structure:', response);
        throw new Error('Invalid response from DALL-E API');
      }

      console.log('DALL-E image generated successfully');
      const temporaryUrl = response.data[0].url;
      
      // Upload to Google Cloud Storage
      console.log('Uploading to Google Cloud Storage...');
      const permanentUrl = await uploadImageToGCS(temporaryUrl, userId, userName);
      console.log('Final permanent URL:', permanentUrl);

      return Response.json({ imageUrl: permanentUrl });
    } catch (error) {
      console.error('OpenAI API Error Details:', {
        message: error.message,
        type: error.type,
        code: error.code,
        param: error.param,
        stack: error.stack,
        response: error.response?.data
      });

      throw new Error(`DALL-E Error: ${error.message}`);
    }
  } catch (error) {
    console.error('Full error object:', JSON.stringify(error, null, 2));
    return Response.json({ 
      error: 'Failed to generate image',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageUrl } = await request.json();
    
    // First download the image
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to Twitter media endpoint
    const mediaUpload = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'multipart/form-data',
      },
      body: imageBuffer
    });

    const mediaData = await mediaUpload.json();
    return NextResponse.json({ mediaId: mediaData.media_id_string });
  } catch (error) {
    console.error('Error uploading to Twitter:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
} 
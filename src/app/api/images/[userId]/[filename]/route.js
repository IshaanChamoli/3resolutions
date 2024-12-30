import { storage } from '@/lib/firebase';
import { ref, getDownloadURL } from 'firebase/storage';

export async function GET(request, { params }) {
  try {
    const { userId, filename } = params;
    const storageRef = ref(storage, `user-images/${userId}/${filename}`);
    const firebaseUrl = await getDownloadURL(storageRef);
    
    // Fetch the image
    const imageResponse = await fetch(firebaseUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    // Return the image directly with proper headers
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': imageBuffer.byteLength,
        'Cache-Control': 'public, max-age=31536000',
        'Content-Disposition': 'inline'
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return Response.error();
  }
} 
'use client';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

function SharePageContent() {
  const params = useParams();
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(null);
  const [creatorName, setCreatorName] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      if (!params.name) {
        router.push('/');
        return;
      }

      try {
        // Convert URL-friendly name back to proper format for search
        const searchName = params.name.split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        // Query Firestore for user by name
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("name", "==", searchName));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          setImageUrl(userData.lastGeneratedImage);
          setCreatorName(userData.name);
        } else {
          router.push('/');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserData();
  }, [params.name, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-3">✨</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3resolutions
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Can you guess what {creatorName ? (
              <span className="font-bold">{creatorName.split(' ')[0]}'s</span>
            ) : "their"} 2025 resolutions are? 🤔
          </p>
        </div>

        {/* Image Display */}
        <div className="aspect-square w-full max-w-[500px] mx-auto rounded-xl overflow-hidden shadow-lg">
          <img 
            src={imageUrl} 
            alt="AI-generated visualization of resolutions" 
            className="w-full h-full object-contain bg-white"
          />
        </div>

        {/* CTA Button */}
        <div className="text-center space-y-4">
          <p className="text-gray-600">
            Want to be held accountable for YOUR 2025 goals?
          </p>
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30 animate-pulse"></div>
            <button
              onClick={() => window.location.href = window.location.origin}
              className="relative px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold 
              hover:scale-105 transition-all duration-300 ease-out"
            >
              Set your Resolutions ✨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-3">✨</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SharePageContent />
    </Suspense>
  );
} 
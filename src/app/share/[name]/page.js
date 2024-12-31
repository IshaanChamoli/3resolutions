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

  // ... rest of the component remains the same ...
}

// Main page component with Suspense
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
import { Suspense } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default async function SharePage({ params }) {
  let imageUrl = null;
  let creatorName = null;

  try {
    const searchName = params.name.split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const usersRef = collection(db, "users");
    const q = query(usersRef, where("name", "==", searchName));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      imageUrl = userData.lastGeneratedImage;
      creatorName = userData.name;
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
  }

  if (!imageUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Content not found</p>
        </div>
      </div>
    );
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
            <a
              href="/"
              className="relative px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold 
              hover:scale-105 transition-all duration-300 ease-out inline-block"
            >
              Set your Resolutions ✨
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 
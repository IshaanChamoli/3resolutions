'use client';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

export default function SharePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const imageUrl = searchParams.get('image');
  const creatorName = searchParams.get('creator');

  if (!imageUrl) {
    router.push('/');
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
            Can you guess what {creatorName ? <span className="font-bold">{creatorName}'s</span> : "their"} 2025 resolutions are? 🤔
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
            Want to create your own AI-generated resolution image?
          </p>
          <div className="relative inline-block">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-30 animate-pulse"></div>
            <button
              onClick={() => window.location.href = 'https://3resolutions.com'}
              className="relative px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold 
              hover:scale-105 transition-all duration-300 ease-out"
            >
              Create Your Own ✨
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 
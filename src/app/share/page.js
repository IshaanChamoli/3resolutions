import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import Head from 'next/head';
import { formatNameForUrl } from '@/app/utils/nameUtils';

export async function generateMetadata({ searchParams }) {
  const { name } = searchParams;
  if (!name) return { title: 'Content Not Found' };

  try {
    const formattedSearchName = name.toLowerCase();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("formattedName", "==", formattedSearchName));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      const shareUrl = `https://3resolutions.com/share?name=${formattedSearchName}`;
      
      return {
        title: `${userData.name}'s 2025 Goals | 3resolutions`,
        description: "Can you guess their New Year resolutions from this AI-generated image?",
        openGraph: {
          title: `${userData.name}'s 2025 Goals | 3resolutions`,
          description: "Can you guess their New Year resolutions from this AI-generated image?",
          images: [userData.lastGeneratedImage],
          url: shareUrl,
        },
        twitter: {
          card: 'summary_large_image',
          title: `${userData.name}'s 2025 Goals | 3resolutions`,
          description: "Can you guess their New Year resolutions from this AI-generated image?",
          images: [userData.lastGeneratedImage],
        },
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return { title: 'Content Not Found' };
}

export default async function SharePage({ searchParams }) {
  const { name } = searchParams;
  if (!name) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Content not found</p>
        </div>
      </div>
    );
  }

  let imageUrl = null;
  let creatorName = null;

  try {
    const formattedSearchName = name.toLowerCase();
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("formattedName", "==", formattedSearchName));
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

  const shareUrl = `https://3resolutions.com/share?name=${name.toLowerCase()}`;

  return (
    <>
      <Head>
        <title>{`${creatorName}'s 2025 Goals | 3resolutions`}</title>
        <meta name="description" content="Can you guess their New Year resolutions from this AI-generated image?" />
        
        {/* OpenGraph Meta Tags */}
        <meta property="og:title" content={`${creatorName}'s 2025 Goals | 3resolutions`} />
        <meta property="og:description" content="Can you guess their New Year resolutions from this AI-generated image?" />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        
        {/* Canonical URL */}
        <link rel="canonical" href={shareUrl} />
      </Head>

      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 relative">
        <div className="fixed bottom-4 right-4 text-xs text-gray-400">
          Made with ❤️ by{' '}
          <a 
            href="https://www.linkedin.com/in/ishaanchamoli/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            Ishaan
          </a>
          {' & '}
          <a 
            href="https://www.linkedin.com/in/sangeetranjan/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sangeet
          </a>
        </div>

        <div className="max-w-2xl w-full space-y-8">
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

          <div className="aspect-square w-full max-w-[500px] mx-auto rounded-xl overflow-hidden shadow-lg">
            <img 
              src={imageUrl} 
              alt="AI-generated visualization of resolutions" 
              className="w-full h-full object-contain bg-white"
            />
          </div>

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
    </>
  );
} 
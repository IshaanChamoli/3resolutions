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
        <title>{`Guess ${creatorName}'s resolutions!`}</title>
        <meta name="description" content="Can you guess their New Year resolutions from this AI-generated image?" />
        
        {/* OpenGraph Meta Tags */}
        <meta property="og:title" content={`Guess ${creatorName}'s resolutions!`} />
        <meta property="og:description" content="Can you guess their New Year resolutions from this AI-generated image?" />
        <meta property="og:image" content={imageUrl} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="website" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`Guess ${creatorName}'s resolutions!`} />
        <meta name="twitter:description" content="Can you guess their New Year resolutions from this AI-generated image?" />
        <meta name="twitter:image" content={imageUrl} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={shareUrl} />
      </Head>

      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <h1 className="text-2xl font-bold text-center mb-6">
            Can you guess {creatorName}'s resolutions? 🤔
          </h1>
          <div className="aspect-square w-full relative rounded-xl overflow-hidden shadow-lg">
            <Image
              src={imageUrl}
              alt="AI-generated visualization of resolutions"
              fill
              className="object-contain"
              priority
            />
          </div>
          <p className="text-center mt-6 text-gray-600">
            Create your own resolutions at{' '}
            <a 
              href="https://3resolutions.com" 
              className="text-blue-600 hover:underline"
            >
              3resolutions.com
            </a>
          </p>
        </div>
      </div>
    </>
  );
} 
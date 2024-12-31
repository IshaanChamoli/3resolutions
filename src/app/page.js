'use client';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';

export default function Home() {
  const { data: session, status } = useSession();
  const [resolutions, setResolutions] = useState(['', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isOptedIn, setIsOptedIn] = useState(true);
  const [commitCount, setCommitCount] = useState(0);
  const [isCommitCountLoading, setIsCommitCountLoading] = useState(true);

  useEffect(() => {
    if (session) {
      try {
        const savedResolutions = localStorage.getItem(`resolutions-${session.user.email}`);
        if (savedResolutions) {
          setResolutions(JSON.parse(savedResolutions));
        }
      } catch (error) {
        console.error('Error loading resolutions:', error);
      }
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem(`resolutions-${session.user.email}`, JSON.stringify(resolutions));
      } catch (error) {
        console.error('Error saving resolutions:', error);
      }
    }
  }, [resolutions, session]);

  const handleResolutionChange = (index, value) => {
    const newResolutions = [...resolutions];
    newResolutions[index] = value;
    setResolutions(newResolutions);
  };

  const generatePrompt = (resolutions) => {
    return `Create a single unified illustration that represents these three resolutions: "${resolutions[0]}", "${resolutions[1]}", "${resolutions[2]}"`;
  };

  const handleGenerate = async () => {
    if (resolutions.some(r => !r.trim())) {
      alert('Please fill in all three resolutions!');
      return;
    }

    // Check image count limit before proceeding
    try {
      const userRef = doc(db, "users", session.user.email);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const imageCount = userData?.imageCount || 0;

      if (imageCount >= 3) {
        alert('Unable to generate more images. Max limit reached for your account!');
        return;
      }
    } catch (error) {
      console.error('Error checking image count:', error);
      alert('Something went wrong. Please try again.');
      return;
    }
    
    setIsEditing(false);
    setIsGenerating(true);
    try {
      // Save resolutions and current isOptedIn status to Firestore
      if (session?.user?.email) {
        const userRef = doc(db, "users", session.user.email);
        await setDoc(userRef, {
          resolutions: resolutions.join(','),
          lastUpdated: new Date().toISOString(),
          imageCount: increment(1),
          lockedIn: isOptedIn, // We just use the current state value
        }, { merge: true });
      }

      console.log('Calling generate-image API...');
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: generatePrompt(resolutions),
          userId: session?.user?.email,
          userName: session?.user?.name || 'anonymous-user'
        }),
      });

      const data = await response.json();
      console.log('API response:', data);

      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to generate image');
      }

      setGeneratedImage(data.imageUrl);

      // Save the permanent Firebase Storage URL to Firestore
      if (session?.user?.email) {
        const userRef = doc(db, "users", session.user.email);
        await setDoc(userRef, {
          lastGeneratedImage: data.imageUrl,
        }, { merge: true });
        console.log('Permanent image URL saved to Firestore');
      }
    } catch (error) {
      console.error('Detailed error in handleGenerate:', error);
      alert(`Failed to generate image: ${error.message}`);
      setIsEditing(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLinkedInShare = () => {
    if (generatedImage) {
      const shareText = `🌟 Guess My 2025 Resolutions! 🌟

The attached image (link) hints at what my top 3 resolutions are. Can you guess them? 🤔

Drop your guesses in the comments below!!!

Want to create an AI image of your own resolutions and challenge your network? 🎯 
Visit http://3resolutions.com and let the guessing games begin!


P.S. If 500+ people commit to their resolutions, the developers have committed to build additional tech to keep each of us personally accountable to the resolutions we list and share! 💪
So go and commit to your New Year's resolutions now!

#NewYearResolutions #2025Goals #NetworkingFun #GuessTheResolutions #ShareYourJourney #GrowthMindset #3resolutions`;
      const imageUrl = generatedImage; // This is already the Firebase Storage URL
      
      const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?mini=true&text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(imageUrl)}`;
      
      window.open(linkedInUrl, '_blank', 'width=600,height=600');
    }
  };

  useEffect(() => {
    if (session?.user?.email) {
      const loadUserData = async () => {
        try {
          const userRef = doc(db, "users", session.user.email);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.resolutions) {
              const loadedResolutions = userData.resolutions.split(',');
              setResolutions(loadedResolutions);
              console.log('Loaded resolutions from Firestore:', loadedResolutions);
            }
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };
      loadUserData();
    }
  }, [session]);

  useEffect(() => {
    const fetchCommitCount = async () => {
      setIsCommitCountLoading(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("lockedIn", "==", true));
        const querySnapshot = await getDocs(q);
        setCommitCount(querySnapshot.size);
      } catch (error) {
        console.error('Error fetching commit count:', error);
      } finally {
        setIsCommitCountLoading(false);
      }
    };

    fetchCommitCount();

    const unsubscribe = onSnapshot(
      query(collection(db, "users"), where("lockedIn", "==", true)),
      (snapshot) => {
        setCommitCount(snapshot.size);
        setIsCommitCountLoading(false);
      },
      (error) => {
        console.error('Error in commit count listener:', error);
        setIsCommitCountLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (status === "loading" || isCommitCountLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-2xl mb-3">✨</div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative">
      {session && (
        <button
          onClick={() => signOut()}
          className="fixed top-4 right-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sign out
        </button>
      )}

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

      <div className="max-w-2xl mx-auto px-4 min-h-screen flex flex-col">
        {/* Header Section */}
        <div className="text-center pt-12 pb-6 mb-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3resolutions &nbsp;</h1>
          <span className="inline-block animate-party text-4xl md:text-5xl bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">🎉</span>
          <div className="text-gray-600 text-sm md:text-base space-y-2 max-w-xl mx-auto text-center">
            <p className="flex items-center justify-center gap-2 hover:text-gray-700 transition-colors">
              <span className="text-purple-600 font-bold">1.</span>
              <span>Share your top 3 resolutions for 2025</span>
            </p>
            <p className="flex items-center justify-center gap-2 hover:text-gray-700 transition-colors">
              <span className="text-purple-600 font-bold">2.</span>
              <span>Get a unique AI image that hints at them</span>
            </p>
            <p className="flex items-center justify-center gap-2 hover:text-gray-700 transition-colors">
              <span className="text-purple-600 font-bold">3.</span>
              <span>Challenge your LinkedIn network to guess</span>
            </p>
            <div className="flex flex-col items-center gap-2 hover:text-gray-700 transition-colors">
              <div className="flex items-center justify-center gap-2">
                <span className="text-purple-600 font-bold">4.</span>
                <span>If 500+ people lock in, we'll add tech to help you stay accountable!</span>
              </div>
              <div className="flex items-center justify-center gap-4 pt-1">
                <label className={`flex items-center gap-2 text-purple-600 whitespace-nowrap cursor-${isEditing ? 'pointer' : 'not-allowed'} ${!isEditing && 'opacity-75'}`}>
                  <input
                    type="checkbox"
                    checked={isOptedIn}
                    onChange={(e) => setIsOptedIn(e.target.checked)}
                    disabled={!isEditing}
                    className={`h-4 w-4 rounded border-purple-400 text-purple-600 focus:ring-purple-500 
                      ${!isEditing && 'cursor-not-allowed opacity-75'}`}
                  />
                  <span className={`text-sm font-medium ${!isEditing && 'opacity-75'}`}>
                    {isEditing ? 'Lock in!' : (isOptedIn ? 'Locked in! : )' : 'Not locked in :(')}
                  </span>
                </label>
                <div className="flex items-center gap-2 w-[140px]">
                  <div className="text-sm font-medium text-purple-600 min-w-[45px]">
                    {commitCount}/500
                  </div>
                  <div className="flex-grow h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min((commitCount / 500) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-grow ${!isEditing ? 'mb-4' : ''}`}>
          {!session ? (
            // Sign In View
            <div className="h-full flex flex-col justify-center">
              <div className="space-y-8 mb-12 pt-8">
                <div className="flex items-center justify-center">
                  <button
                    onClick={() => signIn('google', { callbackUrl: '/' })}
                    className="px-8 py-3 rounded-full bg-white border border-gray-300 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3"
                  >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Sign in with Google
                  </button>
                </div>
              </div>
            </div>
          ) : isEditing ? (
            // Resolution Input Form - Only shown when signed in
            <div className="h-full flex flex-col justify-center">
              <div className="space-y-8 mb-12">
                {[1, 2, 3].map((num, index) => (
                  <div 
                    key={num}
                    className="p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {num}
                      </div>
                      <input
                        type="text"
                        value={resolutions[index]}
                        onChange={(e) => handleResolutionChange(index, e.target.value)}
                        placeholder="Enter resolution..."
                        maxLength={50}
                        className="w-full p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>
                ))}
                <br />
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full mt-16 px-8 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isGenerating ? 'Generating an image with your goals ✨' : 'Generate AI Art 🎨'}
                </button>
              </div>
            </div>
          ) : (
            // Generated Image View - remains the same
            <div className="flex flex-col items-center">
              <div className="aspect-square w-full max-w-[360px] rounded-xl overflow-hidden shadow-lg">
                {isGenerating ? (
                  <div className="w-full h-full flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="animate-pulse text-2xl mb-3">🎨</div>
                      <p className="text-gray-600">Merging your resolutions together...</p>
                    </div>
                  </div>
                ) : generatedImage ? (
                  <img 
                    src={generatedImage} 
                    alt="AI-generated visualization of your resolutions" 
                    className="w-full h-full object-contain bg-white"
                  />
                ) : null}
              </div>
              
              {!isEditing && (
                <>
                  <p className="text-sm text-gray-500 mt-4 text-center mb-9">
                  Can people guess what your resolutions are? Let's find out! 🤔
                  </p>
                  <div className="space-y-3 w-full">
                    {generatedImage && (
                      <button 
                        className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity text-lg"
                        onClick={handleLinkedInShare}
                      >
                        Share on LinkedIn &nbsp;🚀
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

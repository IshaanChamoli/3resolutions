'use client';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment, collection, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';

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
    return `Generate one image that represents these three New Year's resolutions: ${resolutions.join(', ')}.`;
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

      // Save the resolutions array and update lockedIn status
      await setDoc(userRef, {
        resolutions: resolutions,
        lastUpdated: serverTimestamp(),
        lockedIn: isOptedIn  // This will update lockedIn based on checkbox state
      }, { merge: true });
      
      setIsEditing(false);
      setIsGenerating(true);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: generatePrompt(resolutions),
          userId: session?.user?.email,
          userName: session?.user?.name || 'anonymous-user'
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to generate image');
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);

      // Update the image URL and increment count
      await setDoc(userRef, {
        lastGeneratedImage: data.imageUrl,
        imageCount: increment(1)
      }, { merge: true });
      console.log('Image URL saved and count incremented');

    } catch (error) {
      console.error('Error:', error);
      alert(error.message === 'The user aborted a request.' 
        ? 'The request took too long. Please try again.'
        : `Failed to generate image: ${error.message}`);
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
Visit https://3resolutions.vercel.app and let the guessing games begin!


P.S. If 500+ people commit to their resolutions, the developers have promised to build more tech to help keep each of us accountable in reaching our goals! 💪
So go and lock in to your New Year's resolutions now! Happy New Year!

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
            if (userData.resolutions && Array.isArray(userData.resolutions)) {
              setResolutions(userData.resolutions);
              console.log('Loaded resolutions from Firestore:', userData.resolutions);
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
    <div className="min-h-screen bg-white relative pt-6 sm:pt-0">
      {session && (
        <button
          onClick={() => signOut()}
          className="fixed top-6 sm:top-4 right-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
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

      <div className="max-w-2xl mx-auto px-3 sm:px-4 min-h-screen flex flex-col">
        {/* Header Section */}
        <div className="text-center pt-6 sm:pt-12 pb-4 sm:pb-6 mb-4 sm:mb-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3resolutions &nbsp;</h1>
          <span className="inline-block animate-party text-3xl sm:text-4xl md:text-5xl bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">🎉</span>
          <div className="text-gray-600 text-sm space-y-1.5 sm:space-y-2 max-w-xl mx-auto text-center px-2 sm:px-4">
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
                <div className="flex items-center gap-2 w-[120px] sm:w-[140px]">
                  <div className="text-sm font-medium text-purple-600 min-w-[40px] sm:min-w-[45px]">
                    {commitCount}/500
                  </div>
                  <div className="flex-grow h-1.5 sm:h-2 bg-gray-200 rounded-full overflow-hidden">
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
                    className="p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                        {num}
                      </div>
                      <input
                        type="text"
                        value={resolutions[index]}
                        onChange={(e) => handleResolutionChange(index, e.target.value)}
                        placeholder="Enter resolution..."
                        maxLength={50}
                        className="w-full p-1.5 sm:p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base"
                      />
                    </div>
                  </div>
                ))}
                <br />
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full mt-8 sm:mt-12 px-6 sm:px-8 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isGenerating ? 'Generating an image with your goals ✨' : 'Generate AI Art 🎨'}
                </button>
              </div>
            </div>
          ) : (
            // Generated Image View - remains the same
            <div className="flex flex-col items-center">
              <div className="aspect-square w-full max-w-[300px] sm:max-w-[360px] mx-auto rounded-xl overflow-hidden shadow-lg">
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
                        className="w-full px-6 sm:px-8 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity text-base"
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

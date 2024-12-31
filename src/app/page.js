'use client';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, increment, collection, query, where, getDocs, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { formatNameForUrl } from '@/app/utils/nameUtils';

export default function Home() {
  const { data: session, status } = useSession();
  const [resolutions, setResolutions] = useState(['', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isOptedIn, setIsOptedIn] = useState(true);
  const [commitCount, setCommitCount] = useState(0);

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
    return `Generate one image that makes it easy and fun to guess these three New Year's resolutions. Use clear, obvious visuals that make each resolution easily identifiable:

1. ${resolutions[0]}
2. ${resolutions[1]}
3. ${resolutions[2]}

Make the representation of each resolution very clear and guessable, like a visual puzzle that's fun but very easy to solve.`;
  };

  const handleGenerate = async () => {
    if (resolutions.some(r => !r.trim())) {
      alert('Please fill in all three resolutions!');
      return;
    }

    try {
      const userRef = doc(db, "users", session.user.email);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      const imageCount = userData?.imageCount || 0;

      if (imageCount >= 3) {
        alert('Unable to generate more images. Max limit reached for your account!');
        return;
      }

      // Format the name for the URL - no spaces, all lowercase
      const formattedName = formatNameForUrl(session.user.name);
      // Use the formatted name in the URL - no need for encodeURIComponent since it's already URL safe
      const shareUrl = `https://3resolutions.com/share?name=${formattedName}`;

      await setDoc(userRef, {
        resolutions: resolutions,
        lastUpdated: serverTimestamp(),
        lockedIn: isOptedIn,
        shareUrl: shareUrl,
        formattedName: formattedName,
        name: session.user.name
      }, { merge: true });
      
      setIsEditing(false);
      setIsGenerating(true);

      const prompt = generatePrompt(resolutions);
      console.log('DALL-E Prompt:', prompt);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
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
      const formattedName = formatNameForUrl(session.user.name);
      const shareUrl = `https://3resolutions.com/share?name=${formattedName}`;

      const shareText = `🌟 Guess My 2025 Resolutions! 🌟

This attached image (link) hints at what my top 3 resolutions are! - 
${shareUrl}

Can you guess them? 🤔 Comment below!!

Want to create your own?
Share your AI image on Linkedin too... or don't! 
Just submit your resolutions to get help in staying accountable ; )

✨✨ If 500+ people commit to their resolutions, the developers have promised to build more tech to help keep each of us accountable in reaching our goals! 💪 
So go and lock in to your New Year's resolutions now! Happy New Year!

#NewYearResolutions #2025Goals #NetworkingFun #GuessTheResolutions #ShareYourJourney #GrowthMindset #3resolutions`;

      // Check if user is on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // Mobile LinkedIn app deep link
        const encodedText = encodeURIComponent(shareText);
        const linkedInAppUrl = `linkedin://shareArticle?mini=true&text=${encodedText}`;
        
        // Fallback URL for if app isn't installed
        const linkedInMobileUrl = `https://www.linkedin.com/sharing/share-offsite/?mini=true&text=${encodedText}`;
        
        // Try to open LinkedIn app first, fall back to mobile web if app isn't installed
        window.location.href = linkedInAppUrl;
        
        // Set a timeout to redirect to mobile web version if app doesn't open
        setTimeout(() => {
          window.location.href = linkedInMobileUrl;
        }, 1000);
      } else {
        // Desktop behavior remains unchanged
        const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?mini=true&text=${encodeURIComponent(shareText)}`;
        window.open(linkedInUrl, '_blank', 'width=600,height=600');
      }
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
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("lockedIn", "==", true));
        const querySnapshot = await getDocs(q);
        setCommitCount(querySnapshot.size);
      } catch (error) {
        console.error('Error fetching commit count:', error);
      }
    };

    fetchCommitCount();

    const unsubscribe = onSnapshot(
      query(collection(db, "users"), where("lockedIn", "==", true)),
      (snapshot) => {
        setCommitCount(snapshot.size);
      },
      (error) => {
        console.error('Error in commit count listener:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  if (status === "loading") {
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
      <div className="max-w-2xl mx-auto px-3 sm:px-4 min-h-screen flex flex-col">
        {/* Header Section */}
        <div className="text-center pt-6 sm:pt-12 pb-4 sm:pb-6 mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3resolutions &nbsp;</h1>
          <span className="inline-block animate-party text-2xl sm:text-4xl md:text-5xl bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">🎉</span>
          <div className="text-gray-600 text-xs sm:text-sm space-y-1 sm:space-y-2 max-w-xl mx-auto text-center px-2 sm:px-4">
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
                    {commitCount === 0 ? '-' : commitCount}/500
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
                    className="p-3 sm:p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 sm:gap-4">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm sm:text-base">
                        {num}
                      </div>
                      <input
                        type="text"
                        value={resolutions[index]}
                        onChange={(e) => handleResolutionChange(index, e.target.value)}
                        placeholder="Enter resolution..."
                        maxLength={50}
                        className="w-full p-1 sm:p-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm sm:text-base"
                        style={{
                          fontSize: '14px',
                          WebkitTextSizeAdjust: '100%',
                          WebkitTapHighlightColor: 'transparent'
                        }}
                      />
                    </div>
                  </div>
                ))}
                <br />
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full mt-6 sm:mt-12 px-4 sm:px-8 py-3 sm:py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm sm:text-base"
                >
                  {isGenerating ? 'Generating an image with your goals ✨' : 'Generate AI Art 🎨'}
                </button>
              </div>
            </div>
          ) : (
            // Generated Image View - remains the same
            <div className="flex flex-col items-center">
              <div className="aspect-square w-full max-w-[280px] sm:max-w-[360px] mx-auto rounded-xl overflow-hidden shadow-lg">
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
                      <>
                        <button 
                          className="w-full px-6 sm:px-8 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity text-base"
                          onClick={handleLinkedInShare}
                        >
                          Go to LinkedIn &nbsp;🚀
                        </button>
                        <p className="text-xs text-gray-400 text-center mt-2">
                          {`https://3resolutions.com/share?name=${formatNameForUrl(session.user.name)}`}
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Desktop corner elements */}
        <div className="hidden sm:block">
          {session && (
            <button
              onClick={() => signOut()}
              className="fixed top-4 right-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          )}
          <div className="fixed bottom-3 right-4 text-xs text-gray-400">
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
        </div>

        {/* Mobile bottom elements */}
        <div className="sm:hidden flex flex-col items-center gap-2 mt-8 mb-8 text-center">
          {session && (
            <button
              onClick={() => signOut()}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          )}
          <div className="text-xs text-gray-400">
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
        </div>
      </div>
    </div>
  );
}

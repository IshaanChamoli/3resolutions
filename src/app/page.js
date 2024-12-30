'use client';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from "next-auth/react";
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function Home() {
  const { data: session, status } = useSession();
  const [resolutions, setResolutions] = useState(['', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isEditing, setIsEditing] = useState(true);

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
    return `Create a single unified 2D illustration that cleverly combines these three New Year's resolutions into one cohesive image: "${resolutions[0]}", "${resolutions[1]}", and "${resolutions[2]}".

    Art Style:
    - Clean, modern 2D illustration
    - Warm, optimistic colors
    - Simple shapes and clear symbols
    - Minimal but meaningful details
    - Think modern minimalist illustration

    Key Requirements:
    - Blend all three resolutions into ONE seamless image (not separate sections)
    - Use objects and symbols that naturally interact with each other
    - Keep it simple and easy to understand
    - Add subtle decorative elements that tie everything together
    - Create a natural flow between all elements

    Mood: Optimistic and clean, making viewers enjoy discovering how the resolutions connect in unexpected ways.

    The final image should look like a single, cohesive illustration where all elements work together to tell one story.`;
  };

  const handleGenerate = async () => {
    if (resolutions.some(r => !r.trim())) {
      alert('Please fill in all three resolutions!');
      return;
    }
    
    setIsEditing(false);
    setIsGenerating(true);
    try {
      // First save resolutions to Firestore
      if (session?.user?.email) {
        const userRef = doc(db, "users", session.user.email);
        await setDoc(userRef, {
          resolutions: resolutions.join(','),
          lastUpdated: new Date().toISOString(),
        }, { merge: true });
        console.log('Resolutions saved to Firestore');
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
      // Create the share URL with the encoded image URL
      const shareUrl = `${window.location.origin}/share/${encodeURIComponent(generatedImage)}`;
      
      const shareText = `🎯 Can you guess my 3 New Year's resolutions from this AI-generated image?\n\n🤔 Take a guess in the comments!\n\n#NewYearResolutions #AI #3Resolutions`;
      
      const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
      
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
    <div className="min-h-screen bg-white relative">
      {session && (
        <button
          onClick={() => signOut()}
          className="fixed bottom-4 right-4 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>Sign out</span>
          <span className="text-xs">({session.user.email})</span>
        </button>
      )}

      <div className="max-w-2xl mx-auto px-4 min-h-screen flex flex-col">
        {/* Header Section - Same for both signed in and signed out states */}
        <div className="text-center pt-16 mb-12">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3Resolutions 🎉
          </h1>
          <p className="text-gray-600 text-xl mb-6">
            Set your resolutions & make your friends guess!<br/>
            We'll help you stick to them <span className="text-purple-600 font-semibold">💪</span>
          </p>
        </div>

        {/* Main Content */}
        <div className={`flex-grow ${!isEditing ? 'mb-8' : ''}`}>
          {!session ? (
            // Sign In View
            <div className="h-full flex flex-col justify-center">
              <div className="space-y-8 mb-12">
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
                        placeholder="Enter your resolution... (keep it short!)"
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
              <div className="aspect-square w-full max-w-[400px] rounded-xl overflow-hidden shadow-lg">
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

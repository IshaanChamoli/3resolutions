'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [resolutions, setResolutions] = useState(['', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userCount, setUserCount] = useState(127);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    const savedState = localStorage.getItem('3resolutions');
    if (savedState) {
      const { resolutions, generatedImage, isEditing } = JSON.parse(savedState);
      setResolutions(resolutions);
      setGeneratedImage(generatedImage);
      setIsEditing(isEditing);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('3resolutions', JSON.stringify({
      resolutions,
      generatedImage,
      isEditing
    }));
  }, [resolutions, generatedImage, isEditing]);

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
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: generatePrompt(resolutions)
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      setGeneratedImage(data.imageUrl);
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
      setIsEditing(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLinkedInShare = () => {
    const shareText = 'Visit 3resolutions.com';
    
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?mini=true&text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(window.location.href)}`;
    
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto py-16 px-4">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3Resolutions 🎉
          </h1>
          <p className="text-gray-600 text-lg mb-6">
            Set your resolutions & make your friends guess!<br/>
            We'll help you stick to them <span className="text-purple-600 font-semibold">💪</span>
          </p>
          {/* Only LinkedIn Share Button */}
          <button 
            className="px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity"
            onClick={handleLinkedInShare}
          >
            Share on LinkedIn 🚀
          </button>
        </div>

        {/* Main Content - Remove max-height and overflow constraints */}
        <div className="mb-12">
          {isEditing ? (
            /* Resolution Input Form */
            <div className="space-y-6">
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
              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full mt-6 px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isGenerating ? 'Creating Your Puzzle... 🎨' : 'Generate AI Art 🎨'}
              </button>
            </div>
          ) : (
            /* Generated Image View */
            <div className="flex flex-col items-center">
              {isGenerating ? (
                <>
                  {/* Square loading placeholder */}
                  <div className="aspect-square w-full max-w-[448px] flex items-center justify-center bg-gray-50 rounded-xl mb-6">
                    <div className="text-center">
                      <div className="animate-pulse text-2xl mb-4">🎨</div>
                      <p className="text-gray-600">Creating your resolution puzzle...</p>
                    </div>
                  </div>
                </>
              ) : generatedImage ? (
                <>
                  {/* Square image container */}
                  <div className="aspect-square w-full max-w-[448px] rounded-xl overflow-hidden shadow-lg">
                    <img 
                      src={generatedImage} 
                      alt="AI-generated visualization of your resolutions" 
                      className="w-full h-full object-contain bg-white"
                    />
                  </div>
                </>
              ) : null}
              
              {/* Buttons section after image */}
              {!isEditing && (
                <>
                  <p className="text-sm text-gray-500 mt-4 text-center mb-6">
                    Can your friends guess your resolutions from this image? 🤔
                  </p>
                  <div className="flex flex-col w-full gap-4">
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="w-full px-8 py-3 rounded-full border-2 border-gray-300 text-gray-600 font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Edit ✏️
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-2 bg-purple-50 rounded-full">
            <span className="text-purple-600 font-semibold">{userCount}/500 Resolvers</span>
            <div className="w-full bg-purple-100 h-2 rounded-full mt-1">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(userCount/500)*100}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Help us reach 500 users to unlock goal tracking! ✨
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';

export default function Home() {
  const [resolutions, setResolutions] = useState(['', '', '']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [userCount, setUserCount] = useState(127);
  const [generatedImage, setGeneratedImage] = useState(null);

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
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto pt-16 px-4">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 inline-block text-transparent bg-clip-text">
            3Resolutions 🎉
          </h1>
          <p className="text-gray-600 text-lg mb-4">
            Set your resolutions & make your friends guess!<br/>
            We'll help you stick to them <span className="text-purple-600 font-semibold">💪</span>
          </p>
          <div className="inline-block px-4 py-2 bg-purple-50 rounded-full">
            <span className="text-purple-600 font-semibold">{userCount}/500 Resolvers</span>
            <div className="w-full bg-purple-100 h-2 rounded-full mt-1">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${(userCount/500)*100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Resolution Cards */}
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
        </div>

        {/* Generated Image Display */}
        {generatedImage && (
          <div className="mt-8">
            <div className="rounded-xl overflow-hidden shadow-lg">
              <img 
                src={generatedImage} 
                alt="AI-generated visualization of your resolutions" 
                className="w-full h-auto"
              />
            </div>
            <p className="text-sm text-gray-500 mt-2 text-center">
              Can your friends guess your resolutions from this image? 🤔
            </p>
          </div>
        )}

        {/* Generate/Share Buttons */}
        <div className="mt-12 text-center space-y-4">
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-8 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isGenerating ? 'Creating Your Puzzle... 🎨' : 'Generate AI Art 🎨'}
          </button>
          
          {generatedImage && (
            <button 
              className="w-full px-8 py-3 rounded-full border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition-colors"
              onClick={() => {
                // TODO: Add LinkedIn sharing logic
                alert('LinkedIn sharing coming soon!');
              }}
            >
              Share on LinkedIn 🚀
            </button>
          )}
        </div>

        {/* Footer Note */}
        <div className="text-center text-gray-400 mt-12 space-y-2">
          <p className="text-sm">
            Help us reach 500 users to unlock goal tracking! ✨
          </p>
          <p className="text-xs">
            We promise no spam, just accountability! 🤝
          </p>
        </div>
      </div>
    </div>
  );
}

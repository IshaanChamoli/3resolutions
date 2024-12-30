'use client';
import { useEffect } from 'react';

export default function LinkedInShareButton({ url }) {
  useEffect(() => {
    // Reload LinkedIn widgets after component mounts
    if (window.IN && window.IN.parse) {
      window.IN.parse();
    }
  }, [url]);

  return (
    <div className="linkedin-share-button w-full">
      <script 
        type="IN/Share" 
        data-url={url}
        data-width="100%"
      />
    </div>
  );
} 
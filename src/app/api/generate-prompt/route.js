import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request) {
  try {
    const { resolutions } = await request.json();
    console.log('Generating prompt for resolutions:', resolutions);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a creative prompt engineer, skilled at converting ideas into clear, imaginative DALL-E prompts. Your prompts should create cohesive scenes that make it easy to guess the original concepts."
        },
        {
          role: "user",
          content: generatePrompt(resolutions)
        }
      ],
      temperature: 0.8,
      max_tokens: 150
    });

    const generatedPrompt = completion.choices[0].message.content.trim();
    console.log('GPT generated raw prompt:', generatedPrompt);

    // Add some standard DALL-E optimization suffixes if they're not already present
    let finalPrompt = generatedPrompt;
    if (!finalPrompt.toLowerCase().includes('digital art') && 
        !finalPrompt.toLowerCase().includes('illustration')) {
      finalPrompt += ', digital art style, vibrant colors';
    }
    console.log('Final prompt with suffixes:', finalPrompt);

    return Response.json({ prompt: finalPrompt });
  } catch (error) {
    console.error('Error generating prompt:', error);
    return Response.json({ 
      error: 'Failed to generate prompt',
      details: error.message 
    }, { status: 500 });
  }
}

function generatePrompt(resolutions) {
  return `Create a short DALL-E prompt that combines these resolutions using common, recognizable symbols in one scene.

Important guidelines:
- Use iconic symbols that instantly represent each resolution
- Keep the prompt short and clear
- Combine the symbols naturally in one scene
- Avoid unnecessary descriptive details

Here are examples of good prompts:

Example 1:
Resolutions: "Make more money", "Get fit", "Start content creation"
Output: "Dollar bills and coins scattered around dumbbells and a YouTube play button"

Example 2:
Resolutions: "Learn piano", "Cook healthy", "Travel more"
Output: "Grand piano next to a fruit bowl and passport, with airplane in window"

Based on these three resolutions, create one clear scene:
1. ${resolutions[0]}
2. ${resolutions[1]}
3. ${resolutions[2]}

Remember:
- Use the most recognizable symbol for each resolution
- Keep the prompt short and direct
- Make each element easily identifiable

Create the prompt for Dall-e now!`;
} 
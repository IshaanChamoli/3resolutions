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
  return `Create a fun, game-like DALL-E prompt that turns these three resolutions into an easy-to-guess visual puzzle.

Important guidelines:
- Make it like a fun guessing game where each resolution is clearly represented
- Use obvious visual symbols and metaphors that people can easily decode
- Focus on inanimate objects and cartoonish representations
- Avoid human figures; instead use recognizable objects and symbols
- Keep the style playful and cartoonish
- Combine elements in a clever but easily understandable way

Here are examples of good prompts:

Example 1:
Resolutions: "Make more money", "Get fit", "Start content creation"
Output: "A giant piggy bank wearing a sporty sweatband, doing jumping jacks on a YouTube play button, with dumbbells made of gold coins scattered around, digital art style, clear iconic symbols"

Example 2:
Resolutions: "Learn piano", "Cook healthy", "Travel more"
Output: "A cartoon piano with its lid open revealing a salad bowl inside, with floating carrots as piano keys, and a passport, plane tickets, and travel stickers decorating its side like bumper stickers, playful illustration style"

Based on these three resolutions, create a creative, easily guessable DALL-E prompt:
1. ${resolutions[0]}
2. ${resolutions[1]}
3. ${resolutions[2]}

Remember:
- Use clear, recognizable symbols for each resolution
- Make it fun but obvious enough that people can guess the resolutions
- Keep it cartoonish and playful
- Think of it as creating a visual riddle that's enjoyable but not too hard to solve`;
} 
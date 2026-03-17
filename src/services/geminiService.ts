import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export async function getMovieRecommendation(prompt: string, currentMovies: any[]) {
  const model = "gemini-3-flash-preview";
  const systemInstruction = `You are Tefiles AI, a movie expert. 
  You have access to the current movie catalog: ${JSON.stringify(currentMovies.map(m => ({ title: m.title, genre: m.genre, description: m.description })))}.
  Help the user find something to watch, explain movie endings, or suggest hidden gems. 
  Be concise, friendly, and cinematic. 
  If a movie is in the catalog, prioritize recommending it. 
  If not, suggest popular movies and explain why they are great.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I'm having trouble connecting to my movie brain right now. Please try again later!";
  }
}

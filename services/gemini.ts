
import { GoogleGenAI, Type } from "@google/genai";
import { WeaveInput } from '../types';

// Fix: Removed global 'ai' instance initialization to comply with guidelines (instantiate right before call)
// const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Using gemini-3-flash-preview as recommended for text tasks
const modelName = 'gemini-3-flash-preview';

const weaveSchema = {
  type: Type.OBJECT,
  properties: {
    explanation: { type: Type.STRING, description: "A brief explanation of the weave structure generated." },
    warpPattern: { type: Type.STRING, description: "The warp color pattern string (e.g., '4A4B'). Use letters A-H." },
    weftPattern: { type: Type.STRING, description: "The weft color pattern string (e.g., '4A4B'). Use letters A-H." },
    draft: {
      type: Type.ARRAY,
      items: { type: Type.ARRAY, items: { type: Type.INTEGER } }, // Using 0/1 for boolean
      description: "The draft grid (harnesses x warpThreads). 1 for active, 0 for inactive."
    },
    pegPlan: {
      type: Type.ARRAY,
      items: { type: Type.ARRAY, items: { type: Type.INTEGER } }, // Using 0/1 for boolean
      description: "The peg plan grid (weftPicks x harnesses). 1 for active, 0 for inactive."
    }
  },
  required: ["explanation", "warpPattern", "weftPattern", "draft", "pegPlan"]
};

export const generateWeaveFromPrompt = async (
  prompt: string, 
  settings: { harnesses: number, warp: number, weft: number }
) => {
  // Fix: Create new GoogleGenAI instance right before the API call as per strict coding guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const fullPrompt = `Create a weaving pattern based on this description: "${prompt}".
  Constraints:
  - Harnesses: ${settings.harnesses}
  - Warp Threads: ${settings.warp}
  - Weft Picks: ${settings.weft}
  - Colors: Use letters A through H to represent colors in the pattern strings.
  - Return the draft and peg plan as 2D arrays of 0s and 1s.
  - Ensure the Draft matrix dimensions match [${settings.harnesses} rows x ${settings.warp} cols].
  - Ensure the Peg Plan matrix dimensions match [${settings.weft} rows x ${settings.harnesses} cols].`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: fullPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: weaveSchema,
      systemInstruction: "You are an expert textile designer. You understand weave structures like Plain, Twill, Satin, and complex Dobbies.",
    }
  });

  return JSON.parse(response.text || "{}");
};

export const analyzeWeaveStructure = async (input: WeaveInput) => {
    // Fix: Create new GoogleGenAI instance right before the API call as per strict coding guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // We convert grids to simplified strings to save tokens and make it readable for the model
    const draftSummary = input.draft.map(row => row.map(b => b ? 1 : 0).join('')).join('\n');
    const pegPlanSummary = input.pegPlan.map(row => row.map(b => b ? 1 : 0).join('')).join('\n');

    const prompt = `Analyze this weave structure:
    
    Warp Pattern: ${input.warpPattern.join('')} (Visual Color Ref)
    Weft Pattern: ${input.weftPattern.join('')} (Visual Color Ref)
    
    Draft (Harnesses x Warp):
    ${draftSummary}

    Peg Plan (Picks x Harnesses):
    ${pegPlanSummary}

    Provide a technical analysis. Identify:
    1. The type of weave (e.g., Balanced Plain Weave, 2/2 Twill, Satin, irregular).
    2. The longest float (important for durability).
    3. Suggested applications (e.g., heavy coat, light scarf, upholstery).
    `;

    const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
            systemInstruction: "You are a master weaver. Analyze the structural integrity and classification of the provided textile data. Keep it concise.",
        }
    });

    return response.text;
};

export const analyzeFabricImage = async (base64Image: string) => {
    // Fix: Create new GoogleGenAI instance right before the API call as per strict coding guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = "Analyze this fabric swatch. Identify the visible weave structure (e.g., Plain, Twill 2/2, Satin, etc.) and estimate the yarn count (coarse, medium, fine). Provide a brief technical summary suitable for a textile engineer.";
    
    const response = await ai.models.generateContent({
        // Fix: Changed model to 'gemini-2.5-flash-image' for visual analysis tasks
        model: 'gemini-2.5-flash-image',
        // Fix: contents must follow { parts: [...] } structure for multi-modal input
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "image/png",
                        data: base64Image
                    }
                },
                { text: prompt }
            ]
        },
        config: {
            systemInstruction: "You are an expert textile engineer specializing in fabric analysis. Be precise about weave structures.",
        }
    });

    return response.text;
};

// functions/src/index.ts
import * as functions from 'firebase-functions';
// Import the Google Gen AI SDK
import { GoogleGenAI } from '@google/genai';

// Initialize the AI client using the securely stored key
const GEMINI_API_KEY = functions.config().ai_config.gemini_key;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// The structure that the function will force the AI to output
const JSON_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string", description: "Concise task name." },
      type: { type: "string", enum: ["Backend", "Frontend", "QA", "Design"] },
      // ... other task properties
    },
    required: ["id", "name", "type"],
  },
};

/**
 * HTTP Callable function to convert a vague brief into structured tasks.
 */
export const generateTasks = functions.https.onCall(async (data, context) => {
  const brief = data.text;
  
  if (!brief) {
    throw new functions.https.HttpsError('invalid-argument', 'Brief text is required.');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: "user", parts: [{ text: `Analyze the following PM brief and convert it into a list of structured engineering tasks. Brief: "${brief}"` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: JSON_SCHEMA,
      },
    });

    const jsonText = response.text.trim();
    // Your doc mentions sanitization. We parse the text into a real object:
    const structuredTasks = JSON.parse(jsonText);
    
    // TODO: BATCH WRITE TO FIRESTORE HERE
    // Return the tasks to the client for immediate display
    return { tasks: structuredTasks }; 

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new functions.https.HttpsError('internal', 'AI processing failed.');
  }
});
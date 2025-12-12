import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onInit } from "firebase-functions/v2/core"; // <--- The Magic Hook
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Global variables (Empty at first)
let genAI: GoogleGenerativeAI;
let model: any;

// THE EFFICIENCY FIX:
// This runs ONLY when the server starts, NOT during 'firebase deploy'
onInit(() => {
  console.log("Initializing AI Engine...");
  
  // 1. Initialize the Client
  genAI = new GoogleGenerativeAI(geminiApiKey.value());

  // 2. Pre-configure the Model
  model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            name: { type: SchemaType.STRING },
            type: { type: SchemaType.STRING, enum: ["Backend", "Frontend", "QA", "Design"] },
            priority: { type: SchemaType.STRING, enum: ["High", "Medium", "Low"] },
          },
          required: ["name", "type", "priority"],
        },
      } as any, 
    },
  });
  console.log("AI Engine Ready.");
});

// THE FUNCTION
export const generateTasks = onCall(
  { 
    secrets: [geminiApiKey], 
    region: "asia-southeast2",
    timeoutSeconds: 60, 
    maxInstances: 10
  },
  async (request) => {
    // 3. Use the pre-loaded model directly!
    const brief = (request.data as { text: string }).text;
    if (!brief) throw new HttpsError("invalid-argument", "Brief is required");

    try {
      const result = await model.generateContent(
        `You are a Technical PM. Convert this brief into technical tasks: "${brief}"`
      );

      const jsonText = result.response.text();
      // ... (Rest of your parsing logic remains the same)
      let structuredTasks;
      try {
        structuredTasks = JSON.parse(jsonText);
      } catch (e) {
        structuredTasks = [];
      }
      return { tasks: structuredTasks };

    } catch (error) {
      console.error("AI Error:", error);
      throw new HttpsError("internal", "AI processing failed.");
    }
  }
);
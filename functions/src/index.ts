// functions/src/index.ts
// --- BACKEND AI ENGINE ---

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onInit } from "firebase-functions/v2/core"; 
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"; 

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Global variables for Fast Startup
let genAI: GoogleGenerativeAI;
let model: any;

// Initialize the AI *before* the request comes in
onInit(() => {
  genAI = new GoogleGenerativeAI(geminiApiKey.value());
  model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      // 'as any' fixes the TypeScript strict error
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
});

export const generateTasks = onCall(
  { 
    secrets: [geminiApiKey], 
    region: "asia-southeast2", // Jakarta
    timeoutSeconds: 60,        // Prevent timeout
    maxInstances: 10
  },
  async (request) => {
    const brief = (request.data as { text: string }).text;
    if (!brief) throw new HttpsError("invalid-argument", "Brief is required");

    try {
      // Use the pre-loaded model
      const result = await model.generateContent(
        `You are a Technical PM. Convert this brief into technical tasks: "${brief}"`
      );

      const jsonText = result.response.text();
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
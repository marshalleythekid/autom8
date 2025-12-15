// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onInit } from "firebase-functions/v2/core"; // <--- The Fix
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai"; 

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 1. Global variables (Empty at first)
let genAI: GoogleGenerativeAI;
let model: any;

// 2. THE FIX: Initialize AI only when the server starts
onInit(() => {
  console.log("Initializing Gemini AI...");
  genAI = new GoogleGenerativeAI(geminiApiKey.value());
  
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
  console.log("Gemini AI Ready.");
});

// 3. The Function
export const generateTasks = onCall(
  { 
    cors: true,                // <--- Keeps the "Allow Localhost" fix
    secrets: [geminiApiKey], 
    region: "asia-southeast2", 
    timeoutSeconds: 60,        
    maxInstances: 10
  },
  async (request) => {
    const brief = (request.data as { text: string }).text;
    if (!brief) throw new HttpsError("invalid-argument", "Brief is required");

    try {
      // The 'model' is already ready because onInit ran first
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
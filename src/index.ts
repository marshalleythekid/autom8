// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { onInit } from "firebase-functions/v2/core"; // Timeout Fix
import { GoogleGenAI } from "@google/genai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Global AI Client (Lazy Loaded)
let ai: GoogleGenAI;

// 1. INITIALIZE ON SERVER START (Prevents Timeout)
onInit(() => {
  console.log("🔥 Cold Start: Connecting to Gemini...");
  ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });
});

// 2. SCHEMA (Strict JSON)
const taskSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      name: { type: "STRING" },
      taskType: { type: "STRING", enum: ["Backend", "Frontend", "QA", "Design"] },
      priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
    },
    required: ["name", "taskType", "priority"],
  },
};

export const generateTasks = onCall(
  { 
    cors: true,                 // <--- Fixes CORS Error
    secrets: [geminiApiKey], 
    region: "asia-southeast2",  // <--- Fixes Region Mismatch
    timeoutSeconds: 60,         // <--- Gives AI time to think
  },
  async (request) => {
    const brief = (request.data as { text: string }).text;
    if (!brief) throw new HttpsError("invalid-argument", "Brief is required");

    try {
      // 3. GENERATE (Using the global 'ai' instance)
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `Convert to tasks: "${brief}"` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: taskSchema,
        },
      });

      // 4. SAFE PARSING
      const jsonText = response.text ? response.text.trim() : "[]";
      let structuredTasks = [];
      try {
        structuredTasks = JSON.parse(jsonText);
      } catch (e) {
        console.error("JSON Parse Error", e);
      }

      return { tasks: structuredTasks };

    } catch (error: any) {
      console.error("AI Error:", error);
      throw new HttpsError("internal", "AI processing failed.");
    }
  }
);
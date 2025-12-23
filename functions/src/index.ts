// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// Define Schema for stricter output
const taskSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      name: { type: "STRING" },
      // Using 'taskType' to avoid keyword conflicts
      taskType: { type: "STRING", enum: ["Backend", "Frontend", "QA", "Design"] },
      priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
    },
    required: ["name", "taskType", "priority"],
  },
};

export const generateTasks = onCall(
  { 
    cors: true,                // <--- 1. FIX CORS
    secrets: [geminiApiKey], 
    region: "asia-southeast2", // <--- 2. FIX REGION (Jakarta)
    timeoutSeconds: 60,
  },
  async (request) => {
    const brief = (request.data as { text: string }).text;
    if (!brief) throw new HttpsError("invalid-argument", "Brief is required");

    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: `Convert to tasks: "${brief}"` }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: taskSchema,
        },
      });

      // Handle response safely
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
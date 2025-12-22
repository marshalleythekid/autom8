// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";

// 1. SECURE KEY MANAGEMENT
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 2. SCHEMA DEFINITION
// FIX: Using string literals instead of importing 'Type' or 'SchemaType'
// The new SDK accepts "ARRAY", "OBJECT", "STRING" directly.
const taskSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      name: { type: "STRING" },
      type: { type: "STRING", enum: ["Backend", "Frontend", "QA", "Design"] },
      priority: { type: "STRING", enum: ["High", "Medium", "Low"] },
    },
    required: ["name", "type", "priority"],
  },
};

export const generateTasks = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const brief = (request.data as { text: string }).text;

    if (!brief) {
      throw new HttpsError("invalid-argument", "Brief text is required.");
    }

    // FIX: Constructor expects an object, not a string
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    try {
      // FIX: Use 'ai.models.generateContent' (New SDK Syntax)
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `You are a Technical PM. Convert this brief into technical tasks: "${brief}"`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: taskSchema,
        },
      });

      // FIX: 'text' is a property, NOT a function in the new SDK
      // We also handle null/undefined safely
      const jsonText = response.text ? response.text.trim() : "[]";
      
      let structuredTasks;
      try {
        structuredTasks = JSON.parse(jsonText);
      } catch (e) {
        console.error("JSON Parse Error:", jsonText);
        // Fallback: Return empty list rather than crashing
        structuredTasks = [];
      }

      return { tasks: structuredTasks };

    } catch (error) {
      console.error("AI Error:", error);
      throw new HttpsError("internal", "AI processing failed.");
    }
  }
);
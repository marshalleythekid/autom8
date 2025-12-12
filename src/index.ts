// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenAI } from "@google/genai";

// 1. SECURE KEY MANAGEMENT
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 2. SCHEMA DEFINITION
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

// 3. THE FUNCTION
export const generateTasks = onCall(
  { secrets: [geminiApiKey], region: "asia-southeast2" }, // Inject the secret here
  async (request) => {
    // Extract the text from the request
    const brief = (request.data as { text: string }).text;

    if (!brief) {
      throw new HttpsError("invalid-argument", "Brief text is required.");
    }

    // Initialize AI with the secret key
    const ai = new GoogleGenAI({ apiKey: geminiApiKey.value() });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
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

      const jsonText = response.text ? response.text.trim() : "[]";
      
      let structuredTasks;
      try {
        structuredTasks = JSON.parse(jsonText);
      } catch (e) {
        console.error("JSON Parse Error:", jsonText);
        structuredTasks = [];
      }

      return { tasks: structuredTasks };

    } catch (error) {
      console.error("AI Error:", error);
      throw new HttpsError("internal", "AI processing failed.");
    }
  }
);
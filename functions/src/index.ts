// functions/src/index.ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { GoogleGenerativeAI } from "@google/generative-ai"; 

const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 1. GLOBAL VARIABLE (Lazy Cache)
// We keep this outside the function so it stays alive between requests.
let cachedModel: any = null;

export const generateTasks = onCall(
  { 
    cors: true, 
    secrets: [geminiApiKey], 
    region: "asia-southeast2", 
    timeoutSeconds: 60,
  },
  async (request) => {
    const brief = (request.data as { text: string }).text;
    console.log("Received Brief:", brief);

    if (!brief) throw new HttpsError("invalid-argument", "Brief is required");

    try {
      // 2. SAFETY CHECK: Initialize AI only if it's missing
      if (!cachedModel) {
        console.log("⚠️ Cold Start: Loading Gemini Model...");
        const genAI = new GoogleGenerativeAI(geminiApiKey.value());
        // Bare Metal Mode (No Schema)
        cachedModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      } else {
        console.log("⚡ Warm Start: Reusing existing Gemini Model.");
      }

      // 3. Generate Content
      const result = await cachedModel.generateContent(
        `You are a Technical PM. Convert this brief into technical tasks.
         RETURN ONLY RAW JSON. No markdown blocks.
         Array of objects with: id, name, priority, and taskType (Frontend, Backend, Design, or QA).
         Brief: "${brief}"`
      );

      // Clean and Parse
      let jsonText = result.response.text();
      jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

      return { tasks: JSON.parse(jsonText) };

    } catch (error: any) {
      console.error("AI Error:", error);
      throw new HttpsError("internal", error.message || "Unknown AI Error");
    }
  }
);
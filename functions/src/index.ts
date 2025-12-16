// functions/src/index.ts
import { onCall } from "firebase-functions/v2/https";

// Simple "Hello World" function to test connection
export const generateTasks = onCall(
  { 
    cors: true, 
    region: "asia-southeast2" 
  },
  async (request) => {
    console.log("Health Check: Request received!");
    return { 
      tasks: [
        { 
            id: "test-1", 
            name: "Connection Successful!", 
            type: "Backend", 
            priority: "High", 
            status: "Done", 
            assignee: "System",
            dueDate: "Today"
        }
      ] 
    };
  }
);
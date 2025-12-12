// src/main.ts (Frontend - The Dashboard)

// 1. IMPORT ONLY CLIENT-SIDE SDKs
// (Notice: No 'firebase-functions' or '@google/genai' here!)
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions"; 
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc 
} from "firebase/firestore";

// 2. CONFIGURATION (Public Safe)
const firebaseConfig = {
  apiKey: "AIzaSyAUVHQfDg-ya9w6zOJ8auKi6AxFuNLVEV4", 
  authDomain: "autom8-mvp-ab323.firebaseapp.com",
  projectId: "autom8-mvp-ab323",
  storageBucket: "autom8-mvp-ab323.firebasestorage.app",
  messagingSenderId: "885313214172",
  appId: "1:885313214172:web:a0f6ada8d44c115da9c619"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "autom8db"); 
// Explicitly tell the app to look in Jakarta
const functions = getFunctions(app, "asia-southeast2"); // Client SDK for calling functions

// 3. TYPES (Frontend Only)
interface Task {
  id: string;
  name: string;
  type: 'Backend' | 'Frontend' | 'QA' | 'Design';
  assignee: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Unassigned';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: 'Frontend' | 'Backend' | 'QA' | 'Design' | 'DevOps';
  load: number;
}

// Global State
let teamMembers: TeamMember[] = [];

// 4. CORE LOGIC: CALLING THE BACKEND
// This replaces the "AI Logic" that was causing the error.
async function generateTasksFromBrief(text: string): Promise<Task[]> {
  console.log("Sending brief to AI Engine...");

  try {
    // Call the Cloud Function we created in 'functions/src/index.ts'
    const generateTasksFn = httpsCallable(functions, 'generateTasks');
    
    // Send the data
    const result = await generateTasksFn({ text: text });
    
    // Receive the sanitized JSON from the backend
    const data = result.data as { tasks: any[] };

    // Map AI result to our UI format
    const aiTasks: Task[] = data.tasks.map((t, index) => ({
        id: t.id || `AI-${Date.now()}-${index}`,
        name: t.name,
        type: t.type || 'Backend',
        assignee: 'Unassigned',
        status: 'Pending',
        priority: t.priority || 'Medium',
        dueDate: "2025-12-25"
    }));

    return aiTasks;

  } catch (error) {
    console.error("Cloud Function Error:", error);
    alert("Failed to connect to AI Engine. Check console.");
    return []; 
  }
}

// 5. DOM ELEMENTS & RENDERING
const briefInput = document.getElementById('briefInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const tasksSection = document.getElementById('tasksSection') as HTMLElement;
const statsSection = document.getElementById('statsSection') as HTMLElement;
const tableBody = document.getElementById('taskTableBody') as HTMLElement;
const loader = document.querySelector('.loader') as HTMLElement;
const btnText = document.querySelector('.btn-text') as HTMLElement;
const teamTableBody = document.getElementById('teamTableBody') as HTMLElement;
const addTeamForm = document.getElementById('addTeamForm') as HTMLFormElement;
const memberNameInput = document.getElementById('memberName') as HTMLInputElement;
const memberRoleSelect = document.getElementById('memberRole') as HTMLSelectElement;
const navLinks = document.querySelectorAll('.sidebar nav a');
const views = document.querySelectorAll('.content-view');

// 6. DB FUNCTIONS (Client Side)
async function loadTeamFromDB() {
  const querySnapshot = await getDocs(collection(db, "team_members"));
  teamMembers = []; 
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Omit<TeamMember, 'id'>;
    teamMembers.push({ id: docSnap.id, ...data });
  });
  renderTeamTable(); 
}

async function addTeamMemberToDB(name: string, role: TeamMember['role']) {
  try {
    await addDoc(collection(db, "team_members"), { name, role, load: 0 });
    await loadTeamFromDB(); 
  } catch (e) {
    console.error("Error adding member: ", e);
  }
}

async function removeTeamMemberFromDB(id: string) {
  if (confirm("Remove this member?")) {
    try {
      await deleteDoc(doc(db, "team_members", id));
      await loadTeamFromDB(); 
    } catch (e) { console.error(e); }
  }
}

// 7. RENDER FUNCTIONS
function renderTaskTable(tasks: Task[]) {
  if (!tableBody) return;
  tableBody.innerHTML = ''; 

  tasks.forEach(task => {
    const row = document.createElement('tr');
    // Simple rendering logic
    row.innerHTML = `
      <td><strong>${task.name}</strong></td>
      <td>${task.type}</td>
      <td>${task.priority}</td>
      <td>${task.status}</td>
    `;
    tableBody.appendChild(row);
  });
}

function renderTeamTable() {
    if(!teamTableBody) return;
    teamTableBody.innerHTML = ''; 
    teamMembers.forEach(member => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${member.name}</td>
            <td>${member.role}</td>
            <td>${member.load} Tasks</td>
            <td><button class="btn-delete" data-member-id="${member.id}">Remove</button></td>
        `;
        teamTableBody.appendChild(row);
    });
    
    // Re-attach listeners
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).getAttribute('data-member-id');
        if(id) removeTeamMemberFromDB(id);
      });
    });
}

// 8. EVENT LISTENERS
generateBtn?.addEventListener('click', async () => {
  const text = briefInput.value;
  if (!text) { alert("Please enter a brief!"); return; }

  generateBtn.disabled = true;
  if(btnText) btnText.textContent = "Processing...";
  if(loader) loader.style.display = "inline-block";

  try {
    const tasks = await generateTasksFromBrief(text);
    renderTaskTable(tasks);
    if(tasksSection) tasksSection.style.display = "block";
    if(statsSection) statsSection.style.display = "block";
    tasksSection.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    generateBtn.disabled = false;
    if(btnText) btnText.textContent = "Automate Tasks";
    if(loader) loader.style.display = "none";
  }
});

addTeamForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = memberNameInput.value.trim();
    const role = memberRoleSelect.value as TeamMember['role'];
    if (name) {
        await addTeamMemberToDB(name, role); 
        memberNameInput.value = ''; 
    }
});

// Init
loadTeamFromDB();
//backend
// --- FIREBASE IMPORTS ---
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

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAUVHQfDg-ya9w6zOJ8auKi6AxFuNLVEV4",
  authDomain: "autom8-mvp-ab323.firebaseapp.com",
  projectId: "autom8-mvp-ab323",
  storageBucket: "autom8-mvp-ab323.firebasestorage.app",
  messagingSenderId: "885313214172",
  appId: "1:885313214172:web:a0f6ada8d44c115da9c619"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "autom8db"); 

// --- TYPES ---
interface Task {
  id: string;
  name: string;
  type: 'Backend' | 'Frontend' | 'QA' | 'Design';
  assignee: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Unassigned'; // Added 'Unassigned'
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: 'Frontend' | 'Backend' | 'QA' | 'Design' | 'DevOps';
  load: number;
}

// Global State for Team Members
let teamMembers: TeamMember[] = [];


// --- SMART MOCK GENERATOR (The "Brain") ---


const TASK_TEMPLATES = [
  { name: "Design UI Mockups & User Flow", type: "Design" as const, priority: "Medium" as const },
  { name: "Develop Core API Endpoints", type: "Backend" as const, priority: "High" as const },
  { name: "Implement Responsive Components", type: "Frontend" as const, priority: "High" as const },
  { name: "Database Schema Design", type: "Backend" as const, priority: "High" as const },
  { name: "Unit & Integration Testing", type: "QA" as const, priority: "Low" as const },
  { name: "Final Polish & Copywriting", type: "Design" as const, priority: "Low" as const }
];

/**
 * Finds the best team member for a specific role
 */
function assignTaskToExpert(taskType: string): string {
    // Filter the REAL team list from Firestore for matching roles
    const candidates = teamMembers.filter(m => m.role === taskType);

    if (candidates.length === 0) {
        return "Unassigned"; // No one found with this skill
    }

    // Smart Move: Pick the person with the lowest load, or just random for now
    const randomExpert = candidates[Math.floor(Math.random() * candidates.length)];
    return randomExpert.name;
}


// --- CORE LOGIC ---

async function generateTasksFromBrief(text: string): Promise<Task[]> {
  console.log("Analyzing brief against current team roster...");

  // Mocking the AI processing time
  return new Promise((resolve) => {
    setTimeout(() => {
      
      // GENERATE DYNAMIC TASKS
      const dynamicTasks: Task[] = TASK_TEMPLATES.map((template, index) => {
        return {
            id: `TSK-${Date.now()}-${index}`,
            name: template.name,
            type: template.type,
            // HERE IS THE MAGIC: We ask our helper function to find a real person
            assignee: assignTaskToExpert(template.type), 
            status: "Pending",
            priority: template.priority,
            dueDate: "2025-12-20"
        };
      });

      resolve(dynamicTasks);
    }, 1500);
  });
}


// --- DOM ELEMENTS ---
const briefInput = document.getElementById('briefInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const tasksSection = document.getElementById('tasksSection') as HTMLElement;
const statsSection = document.getElementById('statsSection') as HTMLElement;
const tableBody = document.getElementById('taskTableBody') as HTMLElement;
const loader = document.querySelector('.loader') as HTMLElement;
const btnText = document.querySelector('.btn-text') as HTMLElement;

// Team Elements
const teamTableBody = document.getElementById('teamTableBody') as HTMLElement;
const addTeamForm = document.getElementById('addTeamForm') as HTMLFormElement;
const memberNameInput = document.getElementById('memberName') as HTMLInputElement;
const memberRoleSelect = document.getElementById('memberRole') as HTMLSelectElement;
const navLinks = document.querySelectorAll('.sidebar nav a');
const views = document.querySelectorAll('.content-view');


// --- DATABASE FUNCTIONS (REAL) ---

async function loadTeamFromDB() {
  const querySnapshot = await getDocs(collection(db, "team_members"));
  teamMembers = []; 
  
  querySnapshot.forEach((doc) => {
    const data = doc.data() as Omit<TeamMember, 'id'>;
    teamMembers.push({ id: doc.id, ...data });
  });
  
  renderTeamTable(); 
}

async function addTeamMemberToDB(name: string, role: TeamMember['role']) {
  try {
    await addDoc(collection(db, "team_members"), {
      name: name,
      role: role,
      load: 0 
    });
    await loadTeamFromDB(); 
  } catch (e) {
    console.error("Error adding document: ", e);
    alert("Failed to save to database");
  }
}

async function removeTeamMemberFromDB(id: string) {
  if (confirm("Remove this member permanently?")) {
    try {
      await deleteDoc(doc(db, "team_members", id));
      await loadTeamFromDB(); 
    } catch (e) {
      console.error("Error removing document: ", e);
    }
  }
}


// --- RENDER FUNCTIONS ---

function renderTaskTable(tasks: Task[]) {
  tableBody.innerHTML = ''; 

  tasks.forEach(task => {
    const row = document.createElement('tr');
    
    // Logic to handle "Unassigned" styling
    const avatar = task.assignee === "Unassigned" 
        ? `<div style="width:24px; height:24px; background:#EE5D50; border-radius:50%; color:white; text-align:center; line-height:24px; font-size:14px;">?</div>` 
        : `<div style="width:24px; height:24px; background:#EEE; border-radius:50%; text-align:center; line-height:24px; font-size:10px;">${task.assignee.charAt(0)}</div>`;

    row.innerHTML = `
      <td>
        <div style="font-weight: 600;">${task.name}</div>
        <div style="font-size: 12px; color: #A3AED0;">ID: ${task.id}</div>
      </td>
      <td>${task.type}</td>
      <td>
        <span style="display:flex; align-items:center; gap:5px;">
           ${avatar}
           <span style="${task.assignee === 'Unassigned' ? 'color:#EE5D50; font-style:italic;' : ''}">${task.assignee}</span>
        </span>
      </td>
      <td><span class="badge" style="background:${getStatusColor(task.status)}; color: white;">${task.status}</span></td>
      <td><span class="badge ${getPriorityClass(task.priority)}">${task.priority}</span></td>
      <td>${task.dueDate}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

function renderTeamTable() {
    teamTableBody.innerHTML = ''; 
    
    teamMembers.forEach(member => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <span style="display:flex; align-items:center; gap:8px;">
                    <div style="width:30px; height:30px; background:#E0E5F2; border-radius:50%; text-align:center; line-height:30px; font-weight: 700; font-size:12px; color: #2B3674;">${member.name.charAt(0)}</div>
                    <div style="font-weight: 600;">${member.name}</div>
                </span>
            </td>
            <td><span class="badge priority-med">${member.role}</span></td>
            <td><div style="font-weight: 600;">${member.load} Tasks</div></td>
            <td><button class="btn-delete" data-member-id="${member.id}" style="color: #EE5D50; border: none; background: transparent; cursor: pointer;">Remove</button></td>
        `;
        teamTableBody.appendChild(row);
    });

    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = (e.target as HTMLElement).getAttribute('data-member-id');
            if (id) removeTeamMemberFromDB(id); 
        });
    });
}


// --- HELPERS ---
function getPriorityClass(priority: string) {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-med';
  return 'priority-low';
}

function getStatusColor(status: string) {
  if (status === 'Done') return '#05CD99';
  if (status === 'In Progress') return '#FFB547';
  if (status === 'Unassigned') return '#EE5D50'; // Red for warning
  return '#A3AED0';
}


// --- EVENT LISTENERS ---

generateBtn.addEventListener('click', async () => {
  const text = briefInput.value;
  if (!text) { alert("Please enter a brief first!"); return; }

  generateBtn.disabled = true;
  btnText.textContent = "Processing...";
  loader.style.display = "inline-block";

  try {
    const tasks = await generateTasksFromBrief(text);
    renderTaskTable(tasks);
    tasksSection.style.display = "block";
    statsSection.style.display = "block";
    tasksSection.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    console.error("Error:", error);
    alert("AI Engine failed to respond.");
  } finally {
    generateBtn.disabled = false;
    btnText.textContent = "Automate Tasks";
    loader.style.display = "none";
  }
});

addTeamForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = memberNameInput.value.trim();
    const role = memberRoleSelect.value as TeamMember['role'];
    if (name) {
        await addTeamMemberToDB(name, role); 
        memberNameInput.value = ''; 
        memberNameInput.focus();
    }
});

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetSection = (e.target as HTMLElement).getAttribute('data-section');
        views.forEach(view => (view as HTMLElement).style.display = 'none');
        navLinks.forEach(l => l.classList.remove('active'));
        if (targetSection) {
            document.getElementById(targetSection + 'Section')!.style.display = 'block';
            (e.target as HTMLElement).classList.add('active');
            if (targetSection === 'team') renderTeamTable();
        }
    });
});

// INIT
document.getElementById('dashboardSection')!.style.display = 'block';
loadTeamFromDB(); // Fetch real team data on start
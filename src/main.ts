// --- FIREBASE IMPORTS (Browser-compatible only) ---
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
const db = getFirestore(app); 

// These are for the future LIVE AI integration. Keep them commented for now.
const functions = getFunctions(app); 
// const generateTasksCloudFunction = httpsCallable(functions, 'generateTasks'); 


// --- TYPES ---
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

// Global State for Team Members (updated by loadTeamFromDB)
let teamMembers: TeamMember[] = [];


// --- SMART MOCK GENERATOR (The "Brain") ---

function assignTaskToExpert(taskType: string): string {
    const candidates = teamMembers.filter(m => m.role === taskType);
    if (candidates.length === 0) {
        return "Unassigned"; 
    }
    const randomExpert = candidates[Math.floor(Math.random() * candidates.length)];
    return randomExpert.name;
}


// --- CORE LOGIC (Simulates AI Call) ---

// --- CORE LOGIC (Real AI Call) ---

async function generateTasksFromBrief(text: string): Promise<Task[]> {
  console.log("Sending brief to AI Engine...", text);

  try {
    // 1. Call the Cloud Function
    const generateTasksFn = httpsCallable(functions, 'generateTasks');
    const result = await generateTasksFn({ text: text });

    // 2. Get the Real Data from Gemini
    const data = result.data as { tasks: any[] };

    // 3. Convert it to your App's format
    const aiTasks: Task[] = data.tasks.map((t, index) => ({
        id: t.id || `AI-${Date.now()}-${index}`,
        name: t.name,
        type: t.type || 'Backend',
        // Smart Assignment: Find a real team member!
        assignee: assignTaskToExpert(t.type || 'Backend'), 
        status: 'Pending',
        priority: t.priority || 'Medium',
        dueDate: "2025-12-25"
    }));

    return aiTasks;

  } catch (error) {
    console.error("Cloud Function Error:", error);
    alert("Failed to connect to AI. Check console for details.");
    return []; 
  }
}

// --- DOM ELEMENTS (Your existing DOM variables) ---
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


// --- DATABASE FUNCTIONS (Your existing Firestore calls) ---

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


// --- RENDER FUNCTIONS & EVENT LISTENERS ---

function renderTaskTable(tasks: Task[]) {
  tableBody.innerHTML = ''; 
  tasks.forEach(task => {
    const row = document.createElement('tr');
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

function getPriorityClass(priority: string) {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-med';
  return 'priority-low';
}

function getStatusColor(status: string) {
  if (status === 'Done') return '#05CD99';
  if (status === 'In Progress') return '#FFB547';
  if (status === 'Unassigned') return '#EE5D50'; 
  return '#A3AED0';
}

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
loadTeamFromDB();
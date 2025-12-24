// src/main.ts (Frontend - The Dashboard)

import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc,
  updateDoc // <--- Add this!
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

// 1. DATABASE
const db = getFirestore(app, "autom8db"); 

// 2. FUNCTIONS (Connects to Jakarta)
const functions = getFunctions(app, "asia-southeast2");


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

// Global State
let teamMembers: TeamMember[] = [];
let currentGeneratedTasks: Task[] = []; 


// --- HELPER: Finds the best team member ---
function assignTaskToExpert(taskType: string): string {
    const candidates = teamMembers.filter(m => m.role === taskType);
    if (candidates.length === 0) return "Unassigned";
    const randomExpert = candidates[Math.floor(Math.random() * candidates.length)];
    return randomExpert.name;
}


// --- PROJECT MANAGEMENT FUNCTIONS ---
async function loadProjectsFromDB() {
    const grid = document.getElementById('projectGrid');
    if (!grid) return;
    
    grid.innerHTML = '<p>Loading projects...</p>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "projects"));
        grid.innerHTML = ''; 

        if (querySnapshot.empty) {
            grid.innerHTML = '<p style="color: #A3AED0;">No projects yet. Go to Dashboard to create one!</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Create a "Folder" Card
            const card = document.createElement('div');
            card.className = 'card project-card';
            card.style.cursor = 'pointer';
            card.style.transition = 'transform 0.2s';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:10px;">
                    <div style="width:40px; height:40px; background:#E0E5F2; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:20px;">
                        📁
                    </div>
                    <span class="badge priority-med">${data.status || 'Active'}</span>
                </div>
                <h4 style="margin:0; font-size:16px;">${data.name}</h4>
                <p style="color:#A3AED0; font-size:12px; margin-top:5px;">${data.taskCount || 0} Tasks</p>
                <div style="font-size:10px; color:#A3AED0; margin-top:15px;">
                    Created: ${new Date(data.createdAt).toLocaleDateString()}
                </div>
            `;

            // Click to Open Folder
            card.addEventListener('click', () => openProject(doc.id, data.name));
            
            card.onmouseenter = () => card.style.transform = 'translateY(-5px)';
            card.onmouseleave = () => card.style.transform = 'translateY(0)';
            
            grid.appendChild(card);
        });

    } catch (e) {
        console.error("Error loading projects:", e);
    }
}

// --- UPDATED: OPEN PROJECT (With Real-Time Progress) ---
// --- UPDATED: OPEN PROJECT WITH LIVE PROGRESS ---
async function openProject(projectId: string, projectName: string) {
    // 1. Switch UI
    document.getElementById('projectGrid')!.style.display = 'none';
    const detailView = document.getElementById('projectDetailView')!;
    detailView.style.display = 'block';
    
    document.getElementById('currentProjectTitle')!.textContent = projectName;
    const tbody = document.getElementById('projectTasksBody')!;
    tbody.innerHTML = '<tr><td colspan="5">Loading tasks...</td></tr>';

    // 2. Fetch Tasks
    try {
        const querySnapshot = await getDocs(collection(db, "projects", projectId, "tasks"));
        
        const tasks: Task[] = [];
        querySnapshot.forEach(doc => {
            const data = doc.data() as any;
            // Store the ID so we can update the specific task later
            tasks.push({ id: doc.id, ...data });
        });

        // 3. Render and Calculate
        renderProjectTasks(projectId, tasks);
        updateProgressBar(tasks);

    } catch (e) {
        console.error("Error opening project:", e);
    }
}
// --- RENDER TASKS WITH DROPDOWNS ---
function renderProjectTasks(projectId: string, tasks: Task[]) {
    const tbody = document.getElementById('projectTasksBody')!;
    tbody.innerHTML = '';

    tasks.forEach(task => {
        const row = document.createElement('tr');
        
        // Create Dropdown Options
        const statusOptions = ['Pending', 'In Progress', 'Done', 'Unassigned'];
        const optionsHtml = statusOptions.map(opt => 
            `<option value="${opt}" ${task.status === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');

        row.innerHTML = `
            <td style="font-weight:600;">${task.name}</td>
            <td>${task.type}</td>
            <td>${task.assignee}</td>
            <td>
                <select class="status-select" data-task-id="${task.id}" 
                    style="background: ${getStatusColor(task.status)}; color: white;">
                    ${optionsHtml}
                </select>
            </td>
            <td><span class="badge ${getPriorityClass(task.priority)}">${task.priority}</span></td>
        `;
        tbody.appendChild(row);
    });

   // --- ATTACH LISTENERS FOR UPDATES ---
    document.querySelectorAll('.status-select').forEach((select) => {
        select.addEventListener('change', async (e) => {
            const target = e.target as HTMLSelectElement;
            const newStatus = target.value;
            const taskId = target.getAttribute('data-task-id');

            if (taskId) {
                // 1. Visual Feedback (Instant)
                target.style.background = getStatusColor(newStatus);
                
                // 2. Update Database
                try {
                    const taskRef = doc(db, "projects", projectId, "tasks", taskId);
                    await updateDoc(taskRef, { status: newStatus });
                } catch(err) {
                    console.error("Failed to update DB", err);
                }

                // 3. Update Progress Bar Math
                const taskIndex = tasks.findIndex(t => t.id === taskId);
                if (taskIndex > -1) tasks[taskIndex].status = newStatus as any;
                
                updateProgressBar(tasks);
            }
        });
    });
}

// --- MATH: CALCULATE PROGRESS ---
// src/main.ts

// --- MATH: CALCULATE PROGRESS ---
// src/main.ts

// --- UPDATED: 3-WAY PROGRESS CALCULATION ---
function updateProgressBar(tasks: Task[]) {
    // 1. Helper to calculate % for a specific type
    const calculateTypeProgress = (types: string[]) => {
        const typeTasks = tasks.filter(t => types.includes(t.type));
        if (typeTasks.length === 0) return 0;
        const done = typeTasks.filter(t => t.status === 'Done').length;
        return Math.round((done / typeTasks.length) * 100);
    };

    // 2. Calculate Segments
    const designProg = calculateTypeProgress(['Design', 'QA']);
    const backendProg = calculateTypeProgress(['Backend', 'DevOps']);
    const frontendProg = calculateTypeProgress(['Frontend']);
    
    // 3. Calculate Overall
    const totalDone = tasks.filter(t => t.status === 'Done').length;
    const totalProg = tasks.length ? Math.round((totalDone / tasks.length) * 100) : 0;

    // 4. Update UI - DESIGN
    updateBarUI('bar-design', 'text-design', designProg, '#05CD99'); // Green

    // 5. Update UI - BACKEND
    updateBarUI('bar-backend', 'text-backend', backendProg, '#FFB547'); // Orange

    // 6. Update UI - FRONTEND
    updateBarUI('bar-frontend', 'text-frontend', frontendProg, '#4318FF'); // Blue

    // 7. Update Overall Text
    const totalText = document.getElementById('totalProjectText');
    if (totalText) totalText.textContent = `${totalProg}% Overall`;
}

// Helper to animate the bars
function updateBarUI(barId: string, textId: string, percentage: number, color: string) {
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    
    if (bar) {
        bar.style.width = `${percentage}%`;
        bar.style.backgroundColor = percentage === 100 ? '#05CD99' : color;
    }
    if (text) {
        text.textContent = `${percentage}%`;
    }
}
// Back Button Logic
document.getElementById('backToProjectsBtn')?.addEventListener('click', () => {
    document.getElementById('projectDetailView')!.style.display = 'none';
    document.getElementById('projectGrid')!.style.display = 'grid';
});


// --- CORE LOGIC (AI CONNECTION) ---
async function generateTasksFromBrief(text: string): Promise<Task[]> {
  console.log("Sending brief to AI Engine...", text);

  try {
    const generateTasksFn = httpsCallable(functions, 'generateTasks');
    const result = await generateTasksFn({ text: text });
    
    const data = result.data as { tasks: any[] };

    const aiTasks: Task[] = data.tasks.map((t, index) => ({
        id: t.id || `AI-${Date.now()}-${index}`,
        name: t.name,
        type: t.taskType || 'Backend', 
        assignee: assignTaskToExpert(t.taskType || 'Backend'), 
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


// --- DATABASE FUNCTIONS ---
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
    await addDoc(collection(db, "team_members"), { name, role, load: 0 });
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
  if (status === 'Unassigned') return '#EE5D50'; 
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
    
    currentGeneratedTasks = tasks;

    renderTaskTable(tasks);
    tasksSection.style.display = "block";
    statsSection.style.display = "block";
    
    // Reveal the "Save" button
    const saveBtn = document.getElementById('saveTasksBtn') as HTMLButtonElement;
    if (saveBtn) {
        saveBtn.style.display = "block";
        saveBtn.textContent = "Save to Project";
        saveBtn.disabled = false;
    }

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

// --- UPDATED SAVE LISTENER (PROJECT FOLDER LOGIC) ---
const saveTasksBtn = document.getElementById('saveTasksBtn');

if (saveTasksBtn) {
    saveTasksBtn.addEventListener('click', async () => {
        if (currentGeneratedTasks.length === 0) return;
        
        // 1. THE FOLDER NAME: Ask user for a project name
        const projectName = prompt("Enter a name for this project (e.g., 'Login Feature'):");
        if (!projectName) return; // Cancelled

        const btn = saveTasksBtn as HTMLButtonElement;
        btn.textContent = "Saving...";
        btn.disabled = true;

        try {
            // 2. CREATE THE FOLDER (Project Document)
            const projectRef = await addDoc(collection(db, "projects"), {
                name: projectName,
                createdAt: new Date().toISOString(),
                taskCount: currentGeneratedTasks.length,
                status: 'Active'
            });

            // 3. PUT TASKS INSIDE THE FOLDER (Sub-collection)
            const savePromises = currentGeneratedTasks.map(task => {
                const { id, ...taskData } = task; 
                // Notice the path: projects -> [ID] -> tasks
                return addDoc(collection(db, "projects", projectRef.id, "tasks"), {
                    ...taskData
                });
            });

            await Promise.all(savePromises);
            
            alert(`Project "${projectName}" saved successfully!`);
            btn.textContent = "Saved ✓";
            
            // If we are on the projects page, refresh it
            loadProjectsFromDB();

        } catch (error) {
            console.error("Error saving project:", error);
            alert("Failed to save project.");
            btn.textContent = "Save to Project";
            btn.disabled = false;
        }
    });
}


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
            const sectionEl = document.getElementById(targetSection + 'Section');
            if (sectionEl) sectionEl.style.display = 'block';
            
            (e.target as HTMLElement).classList.add('active');
            
            if (targetSection === 'team') renderTeamTable();
            if (targetSection === 'projects') loadProjectsFromDB(); 
        }
    });
});

// INIT
document.getElementById('dashboardSection')!.style.display = 'block';
loadTeamFromDB();
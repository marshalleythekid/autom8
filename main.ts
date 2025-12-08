// --- TYPES & INTERFACES ---
// This ensures our data structure matches the JSON output described in the PDF [cite: 12, 22]

interface Task {
  id: string;
  name: string;
  type: 'Backend' | 'Frontend' | 'QA' | 'Design';
  assignee: string;
  status: 'Done' | 'In Progress' | 'Pending';
  priority: 'High' | 'Medium' | 'Low';
  dueDate: string;
}

// --- MOCK DATA (Simulating Gemini AI Output) ---
// Based on the example in the PDF: "We need a new login page..." [cite: 10]
const MOCK_RESPONSE_DATA: Task[] = [
  {
    id: "TSK-001",
    name: "Design Login UI Components (Figma)",
    type: "Design",
    assignee: "Sarah K.",
    status: "Done",
    priority: "Medium",
    dueDate: "2025-12-05"
  },
  {
    id: "TSK-002",
    name: "Setup Firebase Auth Controller",
    type: "Backend",
    assignee: "Javier M.",
    status: "In Progress",
    priority: "High",
    dueDate: "2025-12-06"
  },
  {
    id: "TSK-003",
    name: "Implement Google OAuth on Client",
    type: "Frontend",
    assignee: "Luthfi",
    status: "Pending",
    priority: "High",
    dueDate: "2025-12-07"
  },
  {
    id: "TSK-004",
    name: "Write Unit Tests for Auth Flow",
    type: "QA",
    assignee: "Pending",
    status: "Pending",
    priority: "Low",
    dueDate: "2025-12-09"
  }
];

// --- APP LOGIC ---

const briefInput = document.getElementById('briefInput') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
const tasksSection = document.getElementById('tasksSection') as HTMLElement;
const statsSection = document.getElementById('statsSection') as HTMLElement;
const tableBody = document.getElementById('taskTableBody') as HTMLElement;
const loader = document.querySelector('.loader') as HTMLElement;
const btnText = document.querySelector('.btn-text') as HTMLElement;

/**
 * Simulates the AI Engine analyzing the brief
 * In the future, this will be replaced by a Firebase Cloud Function call
 */
async function generateTasksFromBrief(text: string): Promise<Task[]> {
  console.log("Analyzing brief:", text);
  
  // TODO: FIREBASE INTEGRATION HERE
  // const functions = getFunctions();
  // const generateTasks = httpsCallable(functions, 'generateTasks');
  // const result = await generateTasks({ text: text });
  
  return new Promise((resolve) => {
    // Simulate network delay (1.5 seconds)
    setTimeout(() => {
      resolve(MOCK_RESPONSE_DATA);
    }, 1500);
  });
}

/**
 * Renders the rows into the HTML Table
 */
function renderTable(tasks: Task[]) {
  tableBody.innerHTML = ''; // Clear existing

  tasks.forEach(task => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>
        <div style="font-weight: 600;">${task.name}</div>
        <div style="font-size: 12px; color: #A3AED0;">ID: ${task.id}</div>
      </td>
      <td>${task.type}</td>
      <td>
        <span style="display:flex; align-items:center; gap:5px;">
           <div style="width:24px; height:24px; background:#EEE; border-radius:50%; text-align:center; line-height:24px; font-size:10px;">${task.assignee.charAt(0)}</div>
           ${task.assignee}
        </span>
      </td>
      <td><span class="badge" style="background:${getStatusColor(task.status)}; color: white;">${task.status}</span></td>
      <td><span class="badge ${getPriorityClass(task.priority)}">${task.priority}</span></td>
      <td>${task.dueDate}</td>
    `;
    
    tableBody.appendChild(row);
  });
}

// Helpers for styling
function getPriorityClass(priority: string) {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-med';
  return 'priority-low';
}

function getStatusColor(status: string) {
  if (status === 'Done') return '#05CD99';
  if (status === 'In Progress') return '#FFB547';
  return '#A3AED0';
}

// --- EVENT LISTENERS ---

generateBtn.addEventListener('click', async () => {
  const text = briefInput.value;
  
  if (!text) {
    alert("Please enter a brief first!");
    return;
  }

  // UI Loading State
  generateBtn.disabled = true;
  btnText.textContent = "Processing...";
  loader.style.display = "inline-block";

  try {
    const tasks = await generateTasksFromBrief(text);
    
    renderTable(tasks);
    
    // Reveal the sections
    tasksSection.style.display = "block";
    statsSection.style.display = "block";
    
    // Smooth scroll to results
    tasksSection.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    console.error("Error:", error);
    alert("AI Engine failed to respond.");
  } finally {
    // Reset UI
    generateBtn.disabled = false;
    btnText.textContent = "Automate Tasks";
    loader.style.display = "none";
  }
});
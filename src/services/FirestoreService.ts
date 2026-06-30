import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  addDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, auth } from "./firebase";
import { Task, AgentLog, KeepNote } from "../types/index";
import { UserMemoryProfile, ReflectionSummary } from "../types/agents";
import { api } from "./api";

// Helper to unwrap standard backend JSON envelope: { success: true, data: T }
function unwrapResponse<T>(res: any): T {
  if (res && res.data && typeof res.data === "object" && "success" in res.data && "data" in res.data) {
    return res.data.data as T;
  }
  return res.data as T;
}

// === TASKS ===

export async function getAllTasks(userId: string): Promise<Task[]> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), query backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.get<any>("/api/v1/tasks");
      return unwrapResponse<Task[]>(res);
    } catch (apiErr) {
      return [];
    }
  }

  try {
    const colRef = collection(db, "tasks");
    const q = query(colRef, where("ownerId", "==", userId), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const tasks: Task[] = [];
    querySnapshot.forEach((docSnap) => {
      tasks.push({ ...docSnap.data() as Task, id: docSnap.id });
    });
    return tasks;
  } catch (err) {
    console.warn("Firestore fetch failed, falling back to local server API:", err);
    try {
      const res = await api.get<any>("/api/v1/tasks");
      return unwrapResponse<Task[]>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.LIST, "tasks");
      return [];
    }
  }
}

export async function getTaskById(taskId: string): Promise<Task | null> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), query backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.get<any>(`/api/v1/tasks/${taskId}`);
      return unwrapResponse<Task>(res);
    } catch (apiErr) {
      return null;
    }
  }

  try {
    const docRef = doc(db, "tasks", taskId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...docSnap.data() as Task, id: docSnap.id };
    }
    return null;
  } catch (err) {
    console.warn("Firestore getTaskById failed, falling back to local server API:", err);
    try {
      const res = await api.get<any>(`/api/v1/tasks/${taskId}`);
      return unwrapResponse<Task>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.GET, `tasks/${taskId}`);
      return null;
    }
  }
}

export async function createTask(task: Partial<Task>, userId: string): Promise<Task> {
  const colRef = collection(db, "tasks");
  const docRef = doc(colRef); // Pre-generate ID
  const newTask: Task = {
    ...task,
    id: docRef.id,
    ownerId: userId,
    createdAt: new Date().toISOString(),
    title: task.title || "Untitled Task",
    deadline: task.deadline || new Date().toISOString(),
    complexity: task.complexity || "Medium",
    status: task.status || "Pending",
    urgencyScore: task.urgencyScore || 0,
    description: task.description || "",
    starterTask: task.starterTask || "",
    subtasks: task.subtasks || [],
    calendarSchedule: task.calendarSchedule || [],
    paceState: task.paceState || "On Track",
    isRescueActive: task.isRescueActive || false,
    color: task.color || "default",
    isRecurring: task.isRecurring || false,
    recurrence: task.recurrence || "none"
  } as Task;
  
  // If not authenticated in Firebase (Bypass/Sandbox mode), write to backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.post<any>("/api/v1/tasks", newTask);
      return unwrapResponse<Task>(res);
    } catch (apiErr: any) {
      handleFirestoreError(apiErr, OperationType.CREATE, `tasks/${docRef.id}`);
      throw apiErr;
    }
  }

  try {
    await setDoc(docRef, newTask);
    return newTask;
  } catch (err) {
    console.warn("Firestore createTask failed, falling back to local server API:", err);
    try {
      const res = await api.post<any>("/api/v1/tasks", newTask);
      return unwrapResponse<Task>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.CREATE, `tasks/${docRef.id}`);
      throw err;
    }
  }
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), write to backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.patch<any>(`/api/v1/tasks/${taskId}`, updates);
      return unwrapResponse<Task>(res);
    } catch (apiErr: any) {
      handleFirestoreError(apiErr, OperationType.UPDATE, `tasks/${taskId}`);
      throw apiErr;
    }
  }

  try {
    const docRef = doc(db, "tasks", taskId);
    await setDoc(docRef, updates, { merge: true });
    const updatedDoc = await getDoc(docRef);
    return { ...updatedDoc.data() as Task, id: taskId };
  } catch (err) {
    console.warn("Firestore updateTask failed, falling back to local server API:", err);
    try {
      const res = await api.patch<any>(`/api/v1/tasks/${taskId}`, updates);
      return unwrapResponse<Task>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      throw err;
    }
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), write to backend local DB directly
  if (!auth.currentUser) {
    try {
      await api.delete(`/api/v1/tasks/${taskId}`);
      return;
    } catch (apiErr: any) {
      handleFirestoreError(apiErr, OperationType.DELETE, `tasks/${taskId}`);
      throw apiErr;
    }
  }

  try {
    const docRef = doc(db, "tasks", taskId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Firestore deleteTask failed, falling back to local server API:", err);
    try {
      await api.delete(`/api/v1/tasks/${taskId}`);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
    }
  }
}

// === AGENT LOGS ===

export async function addAgentLog(log: { agent: string; type: string; message: string }, userId: string): Promise<void> {
  if (!auth.currentUser) {
    // Agent logs fallback silently on sandbox mode
    return;
  }

  const colRef = collection(db, "agentLogs");
  const newLog = {
    ...log,
    ownerId: userId,
    timestamp: new Date().toISOString(),
  };
  try {
    await addDoc(colRef, newLog);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "agentLogs");
  }
}

export async function getAgentLogs(userId: string, limitVal?: number): Promise<AgentLog[]> {
  // If not authenticated in Firebase, pull logs from backend local DB fallback
  if (!auth.currentUser) {
    try {
      const res = await api.get<any>("/api/logs");
      return res.data || [];
    } catch (err) {
      return [];
    }
  }

  try {
    const colRef = collection(db, "agentLogs");
    let q = query(colRef, where("ownerId", "==", userId), orderBy("timestamp", "desc"));
    if (limitVal) {
      q = query(q, limit(limitVal));
    }
    const querySnapshot = await getDocs(q);
    const logs: AgentLog[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      logs.push({
        timestamp: data.timestamp,
        agent: data.agent,
        type: data.type,
        message: data.message,
      });
    });
    return logs.reverse();
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "agentLogs");
    return [];
  }
}

// === USER MEMORY ===

export async function getUserMemory(userId: string): Promise<UserMemoryProfile | null> {
  if (!auth.currentUser) return null;

  try {
    const docRef = doc(db, "userMemory", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserMemoryProfile;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `userMemory/${userId}`);
    return null;
  }
}

export async function updateUserMemory(userId: string, data: Partial<UserMemoryProfile>): Promise<void> {
  if (!auth.currentUser) return;

  try {
    const docRef = doc(db, "userMemory", userId);
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `userMemory/${userId}`);
  }
}

// === REFLECTIONS ===

export async function getReflections(userId: string): Promise<ReflectionSummary[]> {
  if (!auth.currentUser) return [];

  try {
    const colRef = collection(db, "reflections");
    const q = query(colRef, where("ownerId", "==", userId), orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    const reflections: ReflectionSummary[] = [];
    querySnapshot.forEach((docSnap) => {
      reflections.push({ ...docSnap.data() as ReflectionSummary, id: docSnap.id });
    });
    return reflections;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "reflections");
    return [];
  }
}

export async function addReflection(reflection: Partial<ReflectionSummary>, userId: string): Promise<void> {
  if (!auth.currentUser) return;

  const colRef = collection(db, "reflections");
  const docRef = doc(colRef);
  const newReflection = {
    ...reflection,
    id: docRef.id,
    ownerId: userId,
    date: reflection.date || new Date().toISOString().split('T')[0]
  };
  try {
    await setDoc(docRef, newReflection);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reflections/${docRef.id}`);
  }
}

// === KEEP NOTES ===

export async function getKeepNotes(userId: string): Promise<KeepNote[]> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), query backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.get<any>("/api/v1/keepNotes");
      return unwrapResponse<KeepNote[]>(res);
    } catch (apiErr) {
      return [];
    }
  }

  try {
    const colRef = collection(db, "keepNotes");
    const q = query(colRef, where("ownerId", "==", userId), orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    const notes: KeepNote[] = [];
    querySnapshot.forEach((docSnap) => {
      notes.push({ ...docSnap.data() as KeepNote, id: docSnap.id });
    });
    return notes;
  } catch (err) {
    console.warn("Firestore getKeepNotes failed, falling back to local server API:", err);
    try {
      const res = await api.get<any>("/api/v1/keepNotes");
      return unwrapResponse<KeepNote[]>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.LIST, "keepNotes");
      return [];
    }
  }
}

export async function saveKeepNote(note: Partial<KeepNote>, userId: string): Promise<KeepNote> {
  const colRef = collection(db, "keepNotes");
  const docRef = note.id ? doc(db, "keepNotes", note.id) : doc(colRef);
  const id = docRef.id;
  
  const newNote: KeepNote = {
    id,
    ownerId: userId,
    title: note.title || "",
    content: note.content || "",
    color: note.color || "default",
    pinned: note.pinned || false,
    isChecklist: note.isChecklist || false,
    checklistItems: note.checklistItems || [],
    labels: note.labels || [],
    updatedAt: new Date().toISOString()
  };
  
  // If not authenticated in Firebase (Bypass/Sandbox mode), write to backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.post<any>("/api/v1/keepNotes", newNote);
      return unwrapResponse<KeepNote>(res);
    } catch (apiErr: any) {
      handleFirestoreError(apiErr, OperationType.WRITE, `keepNotes/${id}`);
      throw apiErr;
    }
  }

  try {
    await setDoc(docRef, newNote, { merge: true });
    return newNote;
  } catch (err) {
    console.warn("Firestore saveKeepNote failed, falling back to local server API:", err);
    try {
      const res = await api.post<any>("/api/v1/keepNotes", newNote);
      return unwrapResponse<KeepNote>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.WRITE, `keepNotes/${id}`);
      throw err;
    }
  }
}

export async function updateKeepNote(noteId: string, updates: Partial<KeepNote>): Promise<KeepNote> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), write to backend local DB directly
  if (!auth.currentUser) {
    try {
      const res = await api.put<any>(`/api/v1/keepNotes/${noteId}`, updates);
      return unwrapResponse<KeepNote>(res);
    } catch (apiErr: any) {
      handleFirestoreError(apiErr, OperationType.UPDATE, `keepNotes/${noteId}`);
      throw apiErr;
    }
  }

  const docRef = doc(db, "keepNotes", noteId);
  const updatedData = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  try {
    await setDoc(docRef, updatedData, { merge: true });
    const updatedDoc = await getDoc(docRef);
    return { ...updatedDoc.data() as KeepNote, id: noteId };
  } catch (err) {
    console.warn("Firestore updateKeepNote failed, falling back to local server API:", err);
    try {
      const res = await api.put<any>(`/api/v1/keepNotes/${noteId}`, updatedData);
      return unwrapResponse<KeepNote>(res);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.UPDATE, `keepNotes/${noteId}`);
      throw err;
    }
  }
}

export async function deleteKeepNote(noteId: string): Promise<void> {
  // If not authenticated in Firebase (Bypass/Sandbox mode), write to backend local DB directly
  if (!auth.currentUser) {
    try {
      await api.delete(`/api/v1/keepNotes/${noteId}`);
      return;
    } catch (apiErr: any) {
      handleFirestoreError(apiErr, OperationType.DELETE, `keepNotes/${noteId}`);
      throw apiErr;
    }
  }

  try {
    const docRef = doc(db, "keepNotes", noteId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Firestore deleteKeepNote failed, falling back to local server API:", err);
    try {
      await api.delete(`/api/v1/keepNotes/${noteId}`);
    } catch (apiErr) {
      handleFirestoreError(err, OperationType.DELETE, `keepNotes/${noteId}`);
    }
  }
}

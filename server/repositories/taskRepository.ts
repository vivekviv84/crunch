import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { logger } from "../services/loggerService";

const firebaseConfig = {
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "snappy-bot-3jkjx",
  firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-491d1046-16b4-4a78-aac7-60219fa287e9"
};

// Initialize Firebase Admin SDK
let isFirebaseOnline = false;
try {
  if (getApps().length === 0) {
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const localServiceAccountPath = path.join(process.cwd(), "firebase-service-account.json");

    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      initializeApp({
        credential: cert(serviceAccountPath),
        projectId: firebaseConfig.projectId
      });
      logger.info("🟢 Firebase Admin initialized via GOOGLE_APPLICATION_CREDENTIALS.");
      isFirebaseOnline = true;
    } else if (fs.existsSync(localServiceAccountPath)) {
      initializeApp({
        credential: cert(localServiceAccountPath),
        projectId: firebaseConfig.projectId
      });
      logger.info("🟢 Firebase Admin initialized via local firebase-service-account.json.");
      isFirebaseOnline = true;
    } else {
      // Falls back to Application Default Credentials
      initializeApp({
        projectId: firebaseConfig.projectId
      });
      logger.info("ℹ️ Firebase Admin initialized via Application Default Credentials.");
      isFirebaseOnline = true;
    }
  } else {
    isFirebaseOnline = true;
  }
} catch (initErr) {
  logger.warn("⚠️ Firebase Admin initialization failed. Entering local sandbox mode.");
}

let dbInstance: any = null;
if (isFirebaseOnline) {
  try {
    const rawDb = getFirestore();
    dbInstance = firebaseConfig.firestoreDatabaseId 
      ? rawDb.databaseId === firebaseConfig.firestoreDatabaseId 
        ? rawDb 
        : getFirestore(firebaseConfig.firestoreDatabaseId)
      : rawDb;
  } catch (dbErr) {
    logger.warn("⚠️ Could not retrieve Firestore client instance. Entering local sandbox mode.");
    isFirebaseOnline = false;
  }
}

// Local In-Memory Fallback Database
const localDb = {
  users: new Map<string, any>(),
  tasks: new Map<string, any>(),
  keepNotes: new Map<string, any>(),
  agentLogs: new Map<string, any[]>(),
  reflections: new Map<string, any>(),
  userMemory: new Map<string, any>(),
  rescueHistory: new Map<string, any>()
};

function checkAuthError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("credential") || msg.includes("auth") || msg.includes("key") || msg.includes("token") || msg.includes("service account") || msg.includes("could not load");
}

function handleDbError(methodName: string, err: any) {
  if (checkAuthError(err)) {
    logger.warn(`⚠️ [Database Fallback] Firestore auth failed on ${methodName}. Redirecting operation to local sandbox memory.`);
    isFirebaseOnline = false; // Gracefully downgrade for subsequent operations
  } else {
    logger.error(`[Database Error] in ${methodName}: ${err.message || err}`);
    throw err;
  }
}

// User Operations
export async function dbUpsertUser(user: { id: string; email: string; fullName: string; avatarUrl: string }) {
  if (isFirebaseOnline && dbInstance) {
    try {
      await dbInstance.collection("users").doc(user.id).set(user, { merge: true });
      return user;
    } catch (err) {
      handleDbError("dbUpsertUser", err);
    }
  }
  
  // Fallback to local store
  localDb.users.set(user.id, user);
  return user;
}

// Task Operations
export async function dbGetTasks(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const snapshot = await dbInstance.collection("tasks")
        .where("ownerId", "in", [ownerId, "usr-default"])
        .get();
      
      const tasks: any[] = [];
      snapshot.forEach((docSnap: any) => {
        tasks.push({ ...docSnap.data(), id: docSnap.id });
      });
      return tasks;
    } catch (err) {
      handleDbError("dbGetTasks", err);
    }
  }

  // Fallback to local store
  return Array.from(localDb.tasks.values()).filter(t => t.ownerId === ownerId || t.ownerId === "usr-default");
}

export async function dbGetTaskById(id: string, ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const docRef = dbInstance.collection("tasks").doc(id);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data && (data.ownerId === ownerId || data.ownerId === "usr-default")) {
          return { ...data, id: docSnap.id };
        }
      }
      return null;
    } catch (err) {
      handleDbError("dbGetTaskById", err);
    }
  }

  // Fallback to local store
  const task = localDb.tasks.get(id);
  if (task && (task.ownerId === ownerId || task.ownerId === "usr-default")) {
    return task;
  }
  return null;
}

export async function dbSaveTask(task: any) {
  const taskId = task.id || `task-${Date.now()}`;
  const taskToSave = { ...task, id: taskId };

  if (isFirebaseOnline && dbInstance) {
    try {
      await dbInstance.collection("tasks").doc(taskId).set(taskToSave, { merge: true });
      return taskToSave;
    } catch (err) {
      handleDbError("dbSaveTask", err);
    }
  }

  // Fallback to local store
  localDb.tasks.set(taskId, taskToSave);
  return taskToSave;
}

export async function dbDeleteTask(id: string, ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const docRef = dbInstance.collection("tasks").doc(id);
      const docSnap = await docRef.get();
      if (docSnap.exists && docSnap.data()?.ownerId === ownerId) {
        await docRef.delete();
        return true;
      }
      return false;
    } catch (err) {
      handleDbError("dbDeleteTask", err);
    }
  }

  // Fallback to local store
  const task = localDb.tasks.get(id);
  if (task && task.ownerId === ownerId) {
    localDb.tasks.delete(id);
    return true;
  }
  return false;
}

// Keep Notes Operations
export async function dbGetKeepNotes(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const snapshot = await dbInstance.collection("keepNotes")
        .where("ownerId", "in", [ownerId, "usr-default"])
        .get();
      
      const notes: any[] = [];
      snapshot.forEach((docSnap: any) => {
        notes.push({ ...docSnap.data(), id: docSnap.id });
      });
      return notes;
    } catch (err) {
      handleDbError("dbGetKeepNotes", err);
    }
  }

  // Fallback to local store
  return Array.from(localDb.keepNotes.values()).filter(n => n.ownerId === ownerId || n.ownerId === "usr-default");
}

export async function dbSaveKeepNote(note: any) {
  const noteId = note.id || `note-${Date.now()}`;
  const noteToSave = { ...note, id: noteId };

  if (isFirebaseOnline && dbInstance) {
    try {
      await dbInstance.collection("keepNotes").doc(noteId).set(noteToSave, { merge: true });
      return noteToSave;
    } catch (err) {
      handleDbError("dbSaveKeepNote", err);
    }
  }

  // Fallback to local store
  localDb.keepNotes.set(noteId, noteToSave);
  return noteToSave;
}

export async function dbDeleteKeepNote(id: string, ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const docRef = dbInstance.collection("keepNotes").doc(id);
      const docSnap = await docRef.get();
      if (docSnap.exists && docSnap.data()?.ownerId === ownerId) {
        await docRef.delete();
        return true;
      }
      return false;
    } catch (err) {
      handleDbError("dbDeleteKeepNote", err);
    }
  }

  // Fallback to local store
  const note = localDb.keepNotes.get(id);
  if (note && note.ownerId === ownerId) {
    localDb.keepNotes.delete(id);
    return true;
  }
  return false;
}

// Agent Logs Operations
export async function addAgentLog(agent: string, type: "REASON" | "ACT" | "OBSERVE", message: string, ownerId: string = "usr-default") {
  const logEntry = {
    timestamp: new Date().toISOString(),
    agent,
    type,
    message,
    ownerId
  };

  if (isFirebaseOnline && dbInstance) {
    try {
      await dbInstance.collection("agentLogs").add(logEntry);
      return logEntry;
    } catch (err) {
      handleDbError("addAgentLog", err);
    }
  }

  // Fallback to local store
  if (!localDb.agentLogs.has(ownerId)) {
    localDb.agentLogs.set(ownerId, []);
  }
  localDb.agentLogs.get(ownerId)!.push(logEntry);
  return logEntry;
}

export async function dbGetAgentLogs(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const snapshot = await dbInstance.collection("agentLogs")
        .where("ownerId", "==", ownerId)
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
      
      const logs: any[] = [];
      snapshot.forEach((docSnap: any) => {
        logs.push({ ...docSnap.data() });
      });
      return logs;
    } catch (err) {
      handleDbError("dbGetAgentLogs", err);
    }
  }

  // Fallback to local store
  const logs = localDb.agentLogs.get(ownerId) || [];
  return [...logs].reverse().slice(0, 100);
}

export async function dbClearAgentLogs(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const snapshot = await dbInstance.collection("agentLogs")
        .where("ownerId", "==", ownerId)
        .get();
      
      const batch = dbInstance.batch();
      snapshot.forEach((docSnap: any) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      return true;
    } catch (err) {
      handleDbError("dbClearAgentLogs", err);
    }
  }

  // Fallback to local store
  localDb.agentLogs.set(ownerId, []);
  return true;
}

// User Memory Operations
export async function dbGetUserMemory(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const docRef = dbInstance.collection("userMemory").doc(ownerId);
      const docSnap = await docRef.get();
      return docSnap.exists ? docSnap.data() : {};
    } catch (err) {
      handleDbError("dbGetUserMemory", err);
    }
  }

  // Fallback to local store
  return localDb.userMemory.get(ownerId) || {};
}

export async function dbUpdateUserMemory(ownerId: string, memoryData: any) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const docRef = dbInstance.collection("userMemory").doc(ownerId);
      await docRef.set(memoryData, { merge: true });
      return memoryData;
    } catch (err) {
      handleDbError("dbUpdateUserMemory", err);
    }
  }

  // Fallback to local store
  const current = localDb.userMemory.get(ownerId) || {};
  const updated = { ...current, ...memoryData };
  localDb.userMemory.set(ownerId, updated);
  return updated;
}

// Reflections Operations
export async function dbGetReflections(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const snapshot = await dbInstance.collection("reflections")
        .where("ownerId", "==", ownerId)
        .orderBy("timestamp", "desc")
        .get();
      
      const reflections: any[] = [];
      snapshot.forEach((docSnap: any) => {
        reflections.push({ ...docSnap.data(), id: docSnap.id });
      });
      return reflections;
    } catch (err) {
      handleDbError("dbGetReflections", err);
    }
  }

  // Fallback to local store
  return Array.from(localDb.reflections.values())
    .filter(r => r.ownerId === ownerId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function dbSaveReflection(reflection: any) {
  const refId = reflection.id || `ref-${Date.now()}`;
  const refToSave = { 
    ...reflection, 
    id: refId, 
    timestamp: reflection.timestamp || new Date().toISOString() 
  };

  if (isFirebaseOnline && dbInstance) {
    try {
      await dbInstance.collection("reflections").doc(refId).set(refToSave, { merge: true });
      return refToSave;
    } catch (err) {
      handleDbError("dbSaveReflection", err);
    }
  }

  // Fallback to local store
  localDb.reflections.set(refId, refToSave);
  return refToSave;
}

// Rescue History Operations
export async function dbGetRescueHistory(ownerId: string) {
  if (isFirebaseOnline && dbInstance) {
    try {
      const snapshot = await dbInstance.collection("rescueHistory")
        .where("ownerId", "==", ownerId)
        .orderBy("timestamp", "desc")
        .get();
      
      const history: any[] = [];
      snapshot.forEach((docSnap: any) => {
        history.push({ ...docSnap.data(), id: docSnap.id });
      });
      return history;
    } catch (err) {
      handleDbError("dbGetRescueHistory", err);
    }
  }

  // Fallback to local store
  return Array.from(localDb.rescueHistory.values())
    .filter(h => h.ownerId === ownerId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function dbSaveRescueHistoryItem(item: any) {
  const histId = item.id || `hist-${Date.now()}`;
  const itemToSave = { 
    ...item, 
    id: histId, 
    timestamp: item.timestamp || new Date().toISOString() 
  };

  if (isFirebaseOnline && dbInstance) {
    try {
      await dbInstance.collection("rescueHistory").doc(histId).set(itemToSave, { merge: true });
      return itemToSave;
    } catch (err) {
      handleDbError("dbSaveRescueHistoryItem", err);
    }
  }

  // Fallback to local store
  localDb.rescueHistory.set(histId, itemToSave);
  return itemToSave;
}

// Legacy placeholders for compatibility
export function getDB() {
  logger.warn("⚠️ Legacy getDB() called. Operating directly on live/sandbox database.");
  return { tasks: [], keepNotes: [], agentLogs: [], microtasks: [] };
}

export function saveDB(data: any) {
  logger.warn("⚠️ Legacy saveDB() called. Operating directly on live/sandbox database.");
  return true;
}

export { dbInstance as db };

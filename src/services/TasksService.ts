import { getGoogleAccessToken } from "./CalendarService.ts";

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: "needsAction" | "completed";
  due?: string; // ISO format
  completed?: string; // ISO format
}

export const TasksService = {
  /**
   * Lists tasks from the user's default Google Tasks list
   */
  async getTasks(): Promise<GoogleTask[]> {
    const token = getGoogleAccessToken();
    if (!token) {
      console.log("ℹ️ Google Tasks credentials missing.");
      return [];
    }

    try {
      const response = await fetch(
        "https://tasks.googleapis.com/v1/lists/@default/tasks",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch Google Tasks: ${response.statusText}`);
      }

      const data = await response.json();
      return data.items || [];
    } catch (err) {
      console.error("⚠️ Error fetching Google Tasks:", err);
      return [];
    }
  },

  /**
   * Creates a new task in the user's default Google Tasks list
   */
  async createTask(title: string, notes?: string, due?: string): Promise<GoogleTask> {
    const token = getGoogleAccessToken();
    if (!token) {
      throw new Error("Google access token is missing.");
    }

    try {
      const response = await fetch(
        "https://tasks.googleapis.com/v1/lists/@default/tasks",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            notes,
            due, // Must be RFC 3339 formatted timestamp, e.g. yyyy-mm-ddThh:mm:ssZ
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to create Google Task: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error("⚠️ Error creating Google Task:", err);
      throw err;
    }
  },

  /**
   * Updates an existing Google Task (e.g., toggling completion)
   */
  async updateTask(taskId: string, updates: Partial<GoogleTask>): Promise<GoogleTask> {
    const token = getGoogleAccessToken();
    if (!token) {
      throw new Error("Google access token is missing.");
    }

    try {
      const response = await fetch(
        `https://tasks.googleapis.com/v1/lists/@default/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update Google Task: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error("⚠️ Error updating Google Task:", err);
      throw err;
    }
  },

  /**
   * Deletes a task from the user's default list
   */
  async deleteTask(taskId: string): Promise<void> {
    const token = getGoogleAccessToken();
    if (!token) {
      throw new Error("Google access token is missing.");
    }

    try {
      const response = await fetch(
        `https://tasks.googleapis.com/v1/lists/@default/tasks/${taskId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete Google Task: ${response.statusText}`);
      }
    } catch (err) {
      console.error("⚠️ Error deleting Google Task:", err);
      throw err;
    }
  }
};

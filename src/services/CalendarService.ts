import { CalendarScheduleItem } from "../types/index";

export interface CalendarEvent {
  id: string;
  taskTitle: string;
  time: string; // Display time string, e.g. "07:00 PM - 07:25 PM"
  startTime: string; // ISO format
  endTime: string; // ISO format
  duration: number; // minutes
  taskId?: string;
}

// Memory token store
let googleAccessToken: string | null = null;

export const setGoogleAccessToken = (token: string | null) => {
  googleAccessToken = token;
  if (token) {
    localStorage.setItem("crunch_google_token", token);
  } else {
    localStorage.removeItem("crunch_google_token");
  }
};

export const getGoogleAccessToken = (): string | null => {
  if (!googleAccessToken) {
    googleAccessToken = localStorage.getItem("crunch_google_token");
  }
  return googleAccessToken;
};

// Simulated Local Storage Calendar Database key
const LOCAL_CALENDAR_KEY = "crunch_local_calendar_events";

const getLocalEvents = (): CalendarEvent[] => {
  const data = localStorage.getItem(LOCAL_CALENDAR_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_CALENDAR_KEY, JSON.stringify([]));
    return [];
  }
  return JSON.parse(data);
};

const saveLocalEvents = (events: CalendarEvent[]) => {
  localStorage.setItem(LOCAL_CALENDAR_KEY, JSON.stringify(events));
};

export const CalendarService = {
  /**
   * Reads availability and return current scheduled events
   */
  async getAvailability(startDate?: Date): Promise<CalendarEvent[]> {
    const token = getGoogleAccessToken();
    if (!token) {
      console.log("ℹ️ Google Calendar credentials missing. Using Suggested Schedule Mode.");
      return getLocalEvents();
    }

    try {
      const timeMin = (startDate || new Date()).toISOString();
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&singleEvents=true&orderBy=startTime`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch Google Calendar events");
      }

      const data = await response.json();
      return (data.items || []).map((item: any) => {
        const start = item.start?.dateTime || item.start?.date || "";
        const end = item.end?.dateTime || item.end?.date || "";
        const durationMin = start && end ? Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) : 30;
        
        // Format time string
        const startHour = new Date(start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const endHour = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return {
          id: item.id,
          taskTitle: item.summary || "Untitled Work Block",
          time: `${startHour} - ${endHour}`,
          startTime: start,
          endTime: end,
          duration: durationMin,
        };
      });
    } catch (err) {
      console.error("⚠️ Error with Google Calendar API, fallback to Suggested Schedule Mode:", err);
      return getLocalEvents();
    }
  },

  /**
   * Creates a calendar work block
   */
  async createWorkBlock(
    taskTitle: string,
    startTime: string,
    durationMin: number,
    taskId?: string
  ): Promise<CalendarEvent> {
    const token = getGoogleAccessToken();
    const end = new Date(new Date(startTime).getTime() + durationMin * 60000).toISOString();
    const startHour = new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endHour = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeStr = `${startHour} - ${endHour}`;

    if (!token) {
      // Local fallback
      const localEvents = getLocalEvents();
      const newEvent: CalendarEvent = {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        taskTitle,
        time: timeStr,
        startTime,
        endTime: end,
        duration: durationMin,
        taskId
      };
      localEvents.push(newEvent);
      saveLocalEvents(localEvents);
      return newEvent;
    }

    try {
      const eventBody = {
        summary: `[CRUNCH] ${taskTitle}`,
        description: `Dedicated work sprint for CRUNCH Task.\nTask ID: ${taskId || "N/A"}\nRescue active pacing protocol.`,
        start: { dateTime: startTime },
        end: { dateTime: end },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 5 }
          ]
        }
      };

      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody)
        }
      );

      if (!response.ok) {
        throw new Error("Failed to create Google Calendar event");
      }

      const item = await response.json();
      return {
        id: item.id,
        taskTitle: taskTitle,
        time: timeStr,
        startTime,
        endTime: end,
        duration: durationMin,
        taskId
      };
    } catch (err) {
      console.error("⚠️ Error creating Google Calendar event, fallback to local:", err);
      // Fallback
      const localEvents = getLocalEvents();
      const newEvent: CalendarEvent = {
        id: `local-${Date.now()}`,
        taskTitle,
        time: timeStr,
        startTime,
        endTime: end,
        duration: durationMin,
        taskId
      };
      localEvents.push(newEvent);
      saveLocalEvents(localEvents);
      return newEvent;
    }
  },

  /**
   * Updates an existing calendar work block
   */
  async updateWorkBlock(
    eventId: string,
    taskTitle: string,
    startTime: string,
    durationMin: number,
    taskId?: string
  ): Promise<CalendarEvent> {
    const token = getGoogleAccessToken();
    const end = new Date(new Date(startTime).getTime() + durationMin * 60000).toISOString();
    const startHour = new Date(startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endHour = new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeStr = `${startHour} - ${endHour}`;

    if (!token || eventId.startsWith("local-") || eventId.startsWith("block-")) {
      const localEvents = getLocalEvents();
      const index = localEvents.findIndex((e) => e.id === eventId);
      if (index !== -1) {
        localEvents[index] = {
          ...localEvents[index],
          taskTitle,
          time: timeStr,
          startTime,
          endTime: end,
          duration: durationMin,
          taskId
        };
        saveLocalEvents(localEvents);
        return localEvents[index];
      }
      throw new Error("Local event not found for update");
    }

    try {
      const eventBody = {
        summary: `[CRUNCH] ${taskTitle}`,
        description: `Dedicated work sprint for CRUNCH Task.\nTask ID: ${taskId || "N/A"}\nRescue active pacing protocol.`,
        start: { dateTime: startTime },
        end: { dateTime: end },
      };

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventBody)
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update Google Calendar event");
      }

      const item = await response.json();
      return {
        id: item.id,
        taskTitle,
        time: timeStr,
        startTime,
        endTime: end,
        duration: durationMin,
        taskId
      };
    } catch (err) {
      console.error("⚠️ Error updating Google Calendar event, fallback to local:", err);
      const localEvents = getLocalEvents();
      const index = localEvents.findIndex((e) => e.id === eventId);
      if (index !== -1) {
        localEvents[index] = {
          ...localEvents[index],
          taskTitle,
          time: timeStr,
          startTime,
          endTime: end,
          duration: durationMin,
          taskId
        };
        saveLocalEvents(localEvents);
        return localEvents[index];
      }
      throw new Error("Event not found for update fallback");
    }
  },

  /**
   * Deletes an existing work block
   */
  async deleteWorkBlock(eventId: string): Promise<void> {
    const token = getGoogleAccessToken();

    if (!token || eventId.startsWith("local-") || eventId.startsWith("block-")) {
      const localEvents = getLocalEvents();
      const filtered = localEvents.filter((e) => e.id !== eventId);
      saveLocalEvents(filtered);
      return;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          }
        }
      );

      if (!response.ok && response.status !== 404) {
        throw new Error("Failed to delete Google Calendar event");
      }
    } catch (err) {
      console.error("⚠️ Error deleting Google Calendar event, fallback to local:", err);
      const localEvents = getLocalEvents();
      const filtered = localEvents.filter((e) => e.id !== eventId);
      saveLocalEvents(filtered);
    }
  },

  /**
   * Automatically schedule bulk crunch events on the Google Calendar or local fallback
   */
  async createCrunchEvents(schedule: CalendarScheduleItem[], taskTitle: string, taskDeadline?: string): Promise<void> {
    const token = getGoogleAccessToken();

    for (const item of schedule) {
      // Parse time string e.g. "02:00 PM"
      const match = item.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      let hours = 12;
      let minutes = 0;
      if (match) {
        hours = parseInt(match[1]);
        minutes = parseInt(match[2]);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hours < 12) hours += 12;
        if (ampm === "AM" && hours === 12) hours = 0;
      }

      const eventStart = taskDeadline ? new Date(taskDeadline) : new Date();
      eventStart.setHours(hours, minutes, 0, 0);
      const isoStart = eventStart.toISOString();

      const eventEnd = new Date(eventStart.getTime() + (item.duration || 25) * 60 * 1000);
      const isoEnd = eventEnd.toISOString();

      if (!token) {
        console.log(`ℹ️ Google token missing. Scheduling block locally: "${item.taskTitle}"`);
        await this.createWorkBlock(`CRUNCH: ${item.taskTitle}`, isoStart, item.duration || 25);
        continue;
      }

      try {
        const body = {
          summary: "CRUNCH: " + item.taskTitle,
          start: { dateTime: isoStart, timeZone: "Asia/Kolkata" },
          end: { dateTime: isoEnd, timeZone: "Asia/Kolkata" },
          description: "Auto-scheduled by CRUNCH for: " + taskTitle,
          colorId: "11"
        };

        const response = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
          }
        );

        if (!response.ok) {
          throw new Error(`Google Calendar API responded with status ${response.status}`);
        }
      } catch (err) {
        console.error(`⚠️ Failed to create Google Calendar event for "${item.taskTitle}", using local fallback:`, err);
        await this.createWorkBlock(`CRUNCH: ${item.taskTitle}`, isoStart, item.duration || 25);
      }
    }
  }
};

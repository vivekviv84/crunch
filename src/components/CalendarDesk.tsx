import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Plus, Trash2, X, Bell } from "lucide-react";
import { CalendarService, CalendarEvent } from "../services/CalendarService";
import { motion, AnimatePresence } from "motion/react";
import { useTaskStore } from "../store/useTaskStore";

export default function CalendarDesk() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Create Event Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("10:00");
  const [newDuration, setNewDuration] = useState("25");
  const { tasks } = useTaskStore();

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await CalendarService.getAvailability();
      setEvents(data);
    } catch (e) {
      console.error("Failed to load calendar events", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAllEvents = async () => {
    if (confirm("Are you sure you want to clear all scheduled sprints on your calendar?")) {
      try {
        setLoading(true);
        for (const event of events) {
          await CalendarService.deleteWorkBlock(event.id);
        }
        await loadEvents();
      } catch (err) {
        console.error("Failed to clear events", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const deleteTask = useTaskStore((state) => state.deleteTask);

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this task?")) {
      try {
        await deleteTask(taskId);
        if (selectedEvent?.id === `task-${taskId}`) {
          setSelectedEvent(null);
        }
      } catch (err) {
        console.error("Failed to delete task:", err);
      }
    }
  };

  useEffect(() => {
    // Clear out any preloaded mock events starting with "CRUNCH:" from local storage
    const local = localStorage.getItem("crunch_local_calendar_events");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        const filtered = parsed.filter((e: any) => !e.taskTitle.startsWith("CRUNCH:"));
        localStorage.setItem("crunch_local_calendar_events", JSON.stringify(filtered));
      } catch (err) {
        console.error("Failed to filter out preloaded local events:", err);
      }
    }
    loadEvents();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const startDateTime = new Date(selectedDate);
      const [hours, minutes] = newTime.split(":");
      startDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await CalendarService.createWorkBlock(
        newTitle,
        startDateTime.toISOString(),
        parseInt(newDuration)
      );
      
      setNewTitle("");
      setShowAddForm(false);
      await loadEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this calendar event?")) {
      try {
        await CalendarService.deleteWorkBlock(eventId);
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(null);
        }
        await loadEvents();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Calendar Grid Calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  // Days array for the calendar grid
  const days: { date: Date; isCurrentMonth: boolean; isToday: boolean }[] = [];

  // Previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthTotalDays - i);
    days.push({ date: d, isCurrentMonth: false, isToday: false });
  }

  // Current month days
  const today = new Date();
  for (let i = 1; i <= totalDays; i++) {
    const d = new Date(year, month, i);
    const isToday = d.getDate() === today.getDate() &&
                    d.getMonth() === today.getMonth() &&
                    d.getFullYear() === today.getFullYear();
    days.push({ date: d, isCurrentMonth: true, isToday });
  }

  // Next month padding days to make grid complete (multiple of 7, total 42 cells)
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, isCurrentMonth: false, isToday: false });
  }

  // Helper to match events and tasks with a specific date
  const getEventsForDate = (date: Date) => {
    // 1. Availability work blocks
    const dayEvents = events.filter(e => {
      const eventDate = new Date(e.startTime);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });

    // 2. Active, completed or missed tasks
    const dayTasks = tasks.filter(t => {
      const taskDate = new Date(t.deadline);
      return taskDate.getDate() === date.getDate() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getFullYear() === date.getFullYear();
    }).map(t => {
      const isPast = new Date(t.deadline).getTime() < Date.now();
      const statusLabel = t.status === "Completed" 
        ? "COMPLETED" 
        : isPast 
          ? "MISSED" 
          : "ACTIVE";

      const startTime = new Date(t.deadline);
      const duration = t.estimatedHours ? Math.round(t.estimatedHours * 60) : 30;
      const endTime = new Date(startTime.getTime() + duration * 60000);

      const startHour = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const endHour = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return {
        id: `task-${t.id}`,
        taskId: t.id,
        taskTitle: `[${statusLabel}] ${t.title}`,
        time: `${startHour} - ${endHour}`,
        startTime: t.deadline,
        endTime: endTime.toISOString(),
        duration: duration,
        isTask: true,
        taskStatus: statusLabel
      };
    });

    return [...dayEvents, ...dayTasks];
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900 text-sm">
            Google Calendar
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-650 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-gray-700 px-2 min-w-[90px] text-center">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-650 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {daysOfWeek.map((day) => (
          <span key={day} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {day}
          </span>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDate(day.date);
          const isSelected = day.date.getDate() === selectedDate.getDate() &&
                             day.date.getMonth() === selectedDate.getMonth() &&
                             day.date.getFullYear() === selectedDate.getFullYear();
          
          return (
            <div
              key={idx}
              onClick={() => setSelectedDate(day.date)}
              className={`h-11 rounded-lg border p-1 relative flex flex-col items-center justify-between cursor-pointer transition-all hover:bg-indigo-50/50 ${
                !day.isCurrentMonth ? "text-gray-305 border-transparent" : "text-gray-700 border-gray-100"
              } ${day.isToday ? "bg-indigo-50/50 border-indigo-200 font-bold" : ""} ${
                isSelected ? "border-indigo-600 ring-1 ring-indigo-500/20" : ""
              }`}
            >
              <span className={`text-[11px] ${isSelected ? "text-indigo-600 font-bold" : ""}`}>
                {day.date.getDate()}
              </span>
              
              {/* Event indicators */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 justify-center w-full">
                  {dayEvents.slice(0, 3).map((e, eIdx) => {
                    let dotColor = "bg-indigo-600";
                    if (e.isTask) {
                      if (e.taskStatus === "COMPLETED") dotColor = "bg-emerald-500";
                      else if (e.taskStatus === "MISSED") dotColor = "bg-rose-500";
                      else dotColor = "bg-sky-500";
                    }
                    return (
                      <span
                        key={eIdx}
                        className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                        title={e.taskTitle}
                      />
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <span className="w-1 h-1 rounded-full bg-gray-400" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day Events & Actions pane */}
      <div className="pt-3 border-t border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Schedules — {selectedDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
          <div className="flex items-center gap-3">
            {events.length > 0 && (
              <button
                onClick={handleClearAllEvents}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition-colors cursor-pointer"
                title="Clear all events from calendar"
              >
                <Trash2 className="w-3 h-3 text-rose-500" />
                Clear All
              </button>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Sprint
            </button>
          </div>
        </div>

        {/* Add Event Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleAddEvent}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2.5 overflow-hidden"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Sprint Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Passport Submission"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 border border-gray-200 rounded-md focus:border-indigo-500 focus:outline-hidden bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Start Time</label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full text-xs px-2 py-1 border border-gray-200 rounded-md focus:border-indigo-500 focus:outline-hidden bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase">Duration (mins)</label>
                  <select
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-md focus:border-indigo-500 focus:outline-hidden bg-white"
                  >
                    <option value="15">15 mins</option>
                    <option value="25">25 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">1 hour</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-2.5 py-1 bg-white border border-gray-200 text-[10px] font-medium rounded text-gray-650 hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2.5 py-1 bg-indigo-600 text-white border border-indigo-700 text-[10px] font-semibold rounded hover:bg-indigo-700 cursor-pointer"
                >
                  Save Sprint
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Selected Date Events List */}
        <div className="space-y-2">
          {selectedDateEvents.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-1">No tasks scheduled for this day.</p>
          ) : (
            selectedDateEvents.map((event) => {
              let sidebarColor = "bg-indigo-600";
              let badgeColor = "bg-indigo-50 border-indigo-100 text-indigo-700";
              if (event.isTask) {
                if (event.taskStatus === "COMPLETED") {
                  sidebarColor = "bg-emerald-500";
                  badgeColor = "bg-emerald-50 border-emerald-100 text-emerald-700";
                } else if (event.taskStatus === "MISSED") {
                  sidebarColor = "bg-rose-500";
                  badgeColor = "bg-rose-50 border-rose-100 text-rose-700";
                } else {
                  sidebarColor = "bg-sky-500";
                  badgeColor = "bg-sky-50 border-sky-100 text-sky-700";
                }
              }
              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`flex items-center justify-between p-2.5 border rounded-lg hover:border-indigo-250 transition-colors cursor-pointer ${
                    selectedEvent?.id === event.id ? "bg-indigo-50/30 border-indigo-250" : "bg-white border-gray-100"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-1.5 h-8 rounded shrink-0 ${sidebarColor}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 truncate">{event.taskTitle}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1 font-mono mt-0.5">
                        <Clock className="w-3 h-3 text-gray-405" />
                        {event.time} ({event.duration}m)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {event.isTask && (
                      <span className={`px-2 py-0.5 border rounded-md text-[9px] font-bold uppercase tracking-wider shrink-0 ${badgeColor}`}>
                        {event.taskStatus}
                      </span>
                    )}
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (event.isTask) {
                          handleDeleteTask(event.taskId, e);
                        } else {
                          handleDeleteEvent(event.id, e);
                        }
                      }}
                      className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-650 rounded transition-colors cursor-pointer shrink-0"
                      title={event.isTask ? "Remove Task" : "Delete event"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Event Details Modal/Overlay */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-xs"
            onClick={() => setSelectedEvent(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white border border-gray-200 rounded-xl p-5 w-full max-w-sm shadow-xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${
                  selectedEvent.isTask 
                    ? selectedEvent.taskStatus === "COMPLETED" ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                      : selectedEvent.taskStatus === "MISSED" ? "bg-rose-50 border-rose-100 text-rose-700"
                      : "bg-sky-50 border-sky-100 text-sky-700"
                    : "bg-indigo-50 border-indigo-100 text-indigo-700"
                }`}>
                  {selectedEvent.isTask ? `${selectedEvent.taskStatus} Task` : "Work sprint"}
                </span>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-450 hover:text-gray-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <h4 className="font-bold text-gray-900 text-base leading-snug">
                  {selectedEvent.taskTitle}
                </h4>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 font-mono text-xs text-slate-650">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-indigo-600" />
                    <span>
                      Date: {new Date(selectedEvent.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Time: {selectedEvent.time}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Duration: {selectedEvent.duration} minutes</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full text-center py-2 bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close Details
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

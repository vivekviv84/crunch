// ─────────────────────────────────────────────────────────────────────────────
// MONTH MAP for named-month date parsing
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6
};

// ─────────────────────────────────────────────────────────────────────────────
// Parse a time expression like "4:00 pm", "7pm", "16:00" → Date (today)
// Returns null if no time found.
// ─────────────────────────────────────────────────────────────────────────────
function parseTime(s: string): Date | null {
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!m) return null;

  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  const ampm = (m[3] || "").toLowerCase();

  if (h > 23) return null; // not a valid hour

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  // No ampm — if hour < 8 or ambiguous small number, lean PM (e.g. "7" → 19:00)
  if (!ampm && h > 0 && h < 8) h += 12;

  const d = new Date();
  d.setHours(h, min, 0, 0);
  if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1); // roll to tomorrow if past
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse a date expression → Date with time set to end-of-day (23:59)
// unless a time is also present in the string (handled separately).
// Handles:
//   "7th july", "july 7", "7 july 2025", "tomorrow", "next friday", "friday"
// ─────────────────────────────────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  const lower = s.toLowerCase();

  // tomorrow
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); return d;
  }
  // today / tonight
  if (/\btonight\b|\btoday\b/.test(lower)) {
    const d = new Date(); d.setHours(23, 59, 0, 0); return d;
  }

  // next <weekday> or bare <weekday>
  const wdMatch = lower.match(/(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/);
  if (wdMatch) {
    const target = WEEKDAYS[wdMatch[1]];
    const d = new Date();
    let diff = target - d.getDay();
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    d.setHours(23, 59, 0, 0);
    return d;
  }

  // "7th july", "july 7th", "7 july", "7/7", "7-7"
  // Ordinal day + month name
  const namedDateMatch = lower.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i
  ) || lower.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?/i
  );

  if (namedDateMatch) {
    let day: number;
    let monthKey: string;
    // Check which group order matched
    if (/^\d/.test(namedDateMatch[1])) {
      // "7th july" → groups: day, month
      day = parseInt(namedDateMatch[1]);
      monthKey = namedDateMatch[2].toLowerCase().slice(0, 3);
    } else {
      // "july 7th" → groups: month, day
      monthKey = namedDateMatch[1].toLowerCase().slice(0, 3);
      day = parseInt(namedDateMatch[2]);
    }
    const month = MONTHS[monthKey];
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date();
      d.setMonth(month, day);
      d.setHours(23, 59, 0, 0);
      // If this date is in the past, assume next year
      if (d.getTime() < Date.now() - 60_000) d.setFullYear(d.getFullYear() + 1);
      return d;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined: parse both a date AND time from a single string
// ─────────────────────────────────────────────────────────────────────────────
function parseDateTime(s: string): Date | null {
  const dateOnly = parseDate(s);
  const timeOnly = parseTime(s);

  if (dateOnly && timeOnly) {
    // Merge: use the date from dateOnly, time from timeOnly
    dateOnly.setHours(timeOnly.getHours(), timeOnly.getMinutes(), 0, 0);
    return dateOnly;
  }
  if (timeOnly) return timeOnly;
  if (dateOnly) return dateOnly;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtask heuristics (unchanged logic)
// ─────────────────────────────────────────────────────────────────────────────
export function generateSubtasksHeuristically(title: string): any[] {
  const t = title.toLowerCase();

  if (t.includes("passport")) {
    return [
      { title: "Gather all required documents (photos, application form, ID proof)", durationMin: 20 },
      { title: "Check if all files are complete and correctly filled", durationMin: 15 },
      { title: "Locate the passport submission center and plan travel/route", durationMin: 20 }
    ];
  }
  if (t.match(/\b(ml|classifier|assignment|coding|homework|project|cnn|report|essay|paper|slides|presentation)\b/)) {
    return [
      { title: "Review requirements and understand scope", durationMin: 15 },
      { title: "Draft outline / baseline structure", durationMin: 25 },
      { title: "Complete core section and verify output", durationMin: 25 }
    ];
  }
  if (t.match(/\b(meeting|call|interview|seminar|lecture|class|briefing)\b/)) {
    return [
      { title: "Prepare agenda / talking points", durationMin: 10 },
      { title: "Review related materials beforehand", durationMin: 15 },
      { title: "Goal Completed", durationMin: 5 }
    ];
  }
  if (t.match(/\b(gym|workout|exercise|run|jog|training|session)\b/)) {
    return [
      { title: "Warm up (light stretching or walk)", durationMin: 10 },
      { title: "Main workout sets", durationMin: 40 },
      { title: "Cool down and log progress", durationMin: 10 }
    ];
  }

  return [{ title: "Goal Completed", durationMin: 30 }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalize common voice/typo errors in raw text
// ─────────────────────────────────────────────────────────────────────────────
function normalizeText(text: string): string {
  return text
    // common typos / voice-to-text errors that break splitting
    .replace(/\bnad\b/gi, " and ")
    .replace(/\ban d\b/gi, " and ")
    .replace(/\baan\b/gi, " and ")
    .replace(/\bnd\b/gi, " and ")
    .replace(/\bna\b/gi, " and ")
    // normalize ordinals
    .replace(/(\d+)\s*st\b/gi, "$1st")
    .replace(/(\d+)\s*nd\b/gi, "$1nd")
    .replace(/(\d+)\s*rd\b/gi, "$1rd")
    .replace(/(\d+)\s*th\b/gi, "$1th")
    // collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: parse raw brain-dump text into structured task array
// ─────────────────────────────────────────────────────────────────────────────
export function parseTasksHeuristically(text: string): any[] {
  const normalised = normalizeText(text);

  // ── Step 1: Split into clauses ─────────────────────────────────────────────
  // We split on sentence boundaries AND conjunctions, but we need to be careful
  // not to split inside a date like "7th july" or time like "4:00 pm".
  // Strategy: replace split tokens with ||| sentinel, then split on that.
  const clauses = normalised
    .replace(/[.;]\s+/g, "|||")                           // sentence end
    .replace(/,\s+(?=\w)/g, "|||")                        // comma + space before word
    .replace(/\s+and\s+(?=(?:i\s+have|i\s+need|i\s+am|i'm|a\s+|an\s+|\w+ing|\w+\s+at|\w+\s+on)\b)/gi, "|||")
    .replace(/\s+(?:also|but|then|plus)\s+/gi, "|||")
    .split("|||")
    .map(c => c.trim())
    .filter(c => c.length > 3);

  const TASK_KW = /\b(submit|submission|passport|assignment|project|work|study|exam|test|report|paper|document|slides|presentation|code|task|homework|briefing|lab|quiz|deliverable|essay|draft|meeting|call|class|gym|workout|session|lecture|seminar|interview|event|appointment)\b/i;
  const JUNK_KW = /\b(help\s+me|would\s+like|please|holiday|vacation|trip|travel|relax|chill|sleep|eat|want\s+to)\b/i;
  const FILLER_PREFIX = /^(?:i(?:'m|\s+have|\s+had|\s+am|\s+need\s+to|\s+have\s+a|\s+have\s+an)?|a|an|the)\s+/i;

  const tasks: any[] = [];

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];

    const hasTask = TASK_KW.test(clause);
    const isJunk  = JUNK_KW.test(clause) && !hasTask;

    if (!hasTask || isJunk) continue;

    // ── Parse deadline ───────────────────────────────────────────────────────
    // First try to parse date+time from this clause
    let deadline = parseDateTime(clause);

    // If no time in this clause, look at the immediately NEXT clause for a pure time
    if (!deadline || (!parseDate(clause) && !parseTime(clause))) {
      if (i + 1 < clauses.length) {
        const next = clauses[i + 1];
        if (!TASK_KW.test(next)) {
          const nextDT = parseDateTime(next);
          if (nextDT) deadline = nextDT;
        }
      }
    }

    // Default: end of today
    if (!deadline) {
      deadline = new Date();
      deadline.setHours(23, 59, 0, 0);
      if (deadline.getTime() < Date.now()) deadline.setDate(deadline.getDate() + 1);
    }

    // ── Clean title ──────────────────────────────────────────────────────────
    let title = clause
      // remove time expressions ("at 4:00 pm", "by 7pm" etc.)
      .replace(/\b(?:at|by|due|is|on)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
      // remove standalone am/pm leftovers
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
      // remove date phrases ("on 7th july", "7 july", "tomorrow", "next friday")
      .replace(/\bon\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi, "")
      .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi, "")
      .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi, "")
      .replace(/\b(?:tomorrow|tonight|today|next\s+\w+)\b/gi, "")
      // remove filler prefixes
      .replace(FILLER_PREFIX, "")
      .replace(/[,;.]+$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (title) title = title.charAt(0).toUpperCase() + title.slice(1);
    if (!title || title.length < 2) continue;

    const subtasks = generateSubtasksHeuristically(title);

    // Urgency: higher if deadline is soon (within 24h)
    const hoursLeft = (deadline.getTime() - Date.now()) / 3_600_000;
    const urgencyScore = hoursLeft < 4 ? 95
      : hoursLeft < 12 ? 85
      : hoursLeft < 24 ? 75
      : hoursLeft < 72 ? 60
      : 45;

    tasks.push({
      title,
      deadline: deadline.toISOString(),
      complexity: "Medium",
      urgencyScore,
      description: `Extracted from: "${clause}"`,
      starterTask: `Start working on ${title} (5 mins)`,
      subtasks
    });
  }

  // Fallback
  if (tasks.length === 0) {
    const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    tasks.push({
      title: "Urgent Task Plan",
      deadline: deadline.toISOString(),
      complexity: "Medium",
      urgencyScore: 70,
      description: `Extracted from prompt: "${text}"`,
      starterTask: "Open blank workspace and read instructions (5 mins)",
      subtasks: [{ title: "Goal Completed", durationMin: 30 }]
    });
  }

  return tasks;
}

export function getMockIntakeResponse(text: string) {
  return parseTasksHeuristically(text);
}

export function getMockPlanResponse(taskTitle: string, _deadline: string) {
  const generatedSubtasks = generateSubtasksHeuristically(taskTitle);

  const subtasks = generatedSubtasks.map((st, i) => ({
    id: `p-${i + 1}`,
    title: st.title,
    durationMin: st.durationMin,
    completed: false,
    implementationIntention: `If I begin working on ${taskTitle}, I will complete: ${st.title}`
  }));

  const calendarSchedule: any[] = [];
  let currentTime = new Date();
  currentTime.setHours(20, 0, 0, 0);

  subtasks.forEach((st, i) => {
    calendarSchedule.push({
      id: `c-${i + 1}`,
      time: currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      taskTitle: st.title,
      duration: st.durationMin
    });
    currentTime = new Date(currentTime.getTime() + st.durationMin * 60 * 1000);
  });

  return {
    starterTask: `Start working on ${taskTitle} (5 mins)`,
    subtasks,
    calendarSchedule,
    urgencyScore: 85,
    paceState: "Critical"
  };
}

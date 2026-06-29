# 🌋 CRUNCH — AI Deadline Rescue Agent

> **Transforming Panic into Power.** CRUNCH is an emergency productivity cockpit and AI-driven task rescue supervisor designed to rescue overwhelmed students and professionals from deadline paralysis.

---

## ⚡ Problem & Core Vision

When complex, multi-page syllabus or assignment briefs are released, cognitive overload frequently triggers baseline procrastination. Users enter a **panic loop**, delaying action until under 12 hours remain, resulting in failed courses or subpar submissions. 

**CRUNCH solves this.** It is an elite, tactical, full-stack deadline solver that takes chaotic mental dumps, parses dense syllabus PDFs, maps actionable micro-sprints directly to Google Calendar, and compiles submission drafts under tight time constraints.

---

## 🎨 Core Features

1. **Syllabus Vision Parser (Gemini 1.5 Pro)**: Upload complex PDFs, JPGs, or PNGs. Gemini automatically isolates precise rubrics, deliverables, word counts, and estimated durations.
2. **AI Morning Debriefing**: A daily tactical summary of today's core priority, critical risks, and estimation of focused hours needed to pass. Includes a single-trigger CTA: "Start Working".
3. **Emergency Rescue Cockpit (Rescue Mode)**: Activates automatically when a deadline drops under 24 hours. Formats the UI into a high-contrast dark theme, locking down distractions, initiating active pacing gauges, and focusing on one single subtask sprint.
4. **Scope Simplifier**: If stress peaks, a one-click co-pilot button immediately trims unrated secondary requirements from the syllabus, focusing purely on passing rubrics.
5. **Draft Assistant**: A split-screen co-pilot to expand, shorten, or format text outlines on the fly based on extracted deliverables.
6. **Stress Brain Dump**: An interactive whiteboard to dump unorganized anxieties. CRUNCH parses the chaos, converting thoughts into a structured Battle Plan.
7. **Google Calendar Allocation**: Seamlessly schedules 25-minute sprints onto your Google Calendar, with a robust fallback "Suggested Schedule Mode" if offline or without credentials.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React (v18), Vite, Tailwind CSS, Framer Motion, Zustand (state-management), Lucide Icons
- **Backend**: Node.js Express server running `tsx` type-stripping
- **Intelligence Engine**: `@google/genai` TypeScript SDK utilizing `gemini-3.5-flash` and `gemini-1.5-pro` (structured JSON response outputs)
- **Persistence & Hybrid Fallback**: Hybrid database syncing client-side State and local storage fallbacks with full zero-latency mock support for seamless judging.

---

## 🚀 Getting Started

### 1. Requirements
Ensure you have Node.js (v18+) installed.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Gemini API Key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Installation
Install project dependencies:
```bash
npm install
```

### 4. Launch Development Server
```bash
npm run dev
```
The dev server will boot and bind to port `3000`.

### 5. Compile Build Production Pack
```bash
npm run build
```

---

## 🏛️ Special Evaluation Screens (For Judges)

We have built dedicated standalone modules so hackathon juries can experience CRUNCH's full features in under 2 minutes:

- **Interactive Pitch Story Deck (`/pitch`)**: Slide-by-slide narrative illustrating how a student under stress transitions from procrastination lock to successful project submission using CRUNCH.
- **Judge Demo Console (`/demo`)**: Preloaded simulation mode pre-seeding a high-severity "Machine Learning Classifier Assignment" with 8 hours remaining, interactive checklists, a live countdown timer, and simulated co-pilot chats.

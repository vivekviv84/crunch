import React, { useState } from "react";
import { Zap, ShieldAlert, Cpu, CheckSquare, Sparkles, Terminal, Flame, ArrowRight, Clock, Star, Layers, Activity } from "lucide-react";
import { useUserStore } from "../store/useUserStore";
import { motion, AnimatePresence } from "motion/react";

export default function LandingPage() {
  const { loginWithGoogle, loginBypass, loading, error, clearError } = useUserStore();
  const [demoEmail, setDemoEmail] = useState("academic.warrior@gmail.com");
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthStatusMessage(null);
    clearError();
    try {
      setAuthStatusMessage("Connecting to Google Auth server...");
      await loginWithGoogle();
    } catch (err: any) {
      // Show the real Firebase error code so we know exactly what's failing
      const code = err?.code || err?.message || String(err);
      console.error("Google Sign-In failed:", code, err);
      setAuthStatusMessage(`Sign-in failed: ${code}`);
    }
  };


  const handleBypassSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    setAuthStatusMessage(null);
    clearError();
    try {
      setAuthStatusMessage("Opening local sandbox corridor...");
      await loginBypass(demoEmail, "Alex Mercer");
    } catch (err: any) {
      console.error("Bypass authentication failed:", err);
      setAuthStatusMessage(err.message || "Bypass authentication failed.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-amber-50 via-rose-50 to-indigo-50 text-slate-800 flex flex-col justify-between overflow-x-hidden relative font-sans select-none" id="landing-page">
      {/* Custom Styles for animated blobs */}
      <style>{`
        @keyframes blob-movement {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(40px, -60px) scale(1.15); }
          66% { transform: translate(-30px, 30px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob-1 {
          animation: blob-movement 12s infinite alternate ease-in-out;
        }
        .animate-blob-2 {
          animation: blob-movement 15s infinite alternate-reverse ease-in-out 3s;
        }
        .animate-blob-3 {
          animation: blob-movement 10s infinite alternate ease-in-out 5s;
        }
      `}</style>

      {/* Floating Background Blobs */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-rose-250/20 rounded-full filter blur-3xl pointer-events-none animate-blob-1" />
      <div className="absolute top-40 right-20 w-[450px] h-[450px] bg-indigo-200/25 rounded-full filter blur-3xl pointer-events-none animate-blob-2" />
      <div className="absolute bottom-10 left-1/3 w-[400px] h-[400px] bg-amber-200/20 rounded-full filter blur-3xl pointer-events-none animate-blob-3" />

      {/* Aesthetic grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none" />

      {/* Header bar */}
      <nav className="relative border-b border-white/40 bg-white/35 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-linear-to-r from-pink-500 via-rose-500 to-orange-400 p-2 rounded-xl shadow-md">
            <span className="font-display font-black text-xs text-white tracking-widest px-1">CRNCH</span>
          </div>
          <span className="text-base font-display font-black tracking-widest text-slate-800">CRUNCH</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 font-semibold hidden sm:inline">OFFLINE-FIRST CORE SYSTEM</span>
          <div className="h-4 w-px bg-slate-200 hidden sm:block" />
          <span className="text-xs text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
            <Flame className="w-3.5 h-3.5 text-rose-500 fill-rose-500 animate-bounce" />
            RESCUE PILOT 1.0
          </span>
        </div>
      </nav>

      {/* Main hero */}
      <main className="max-w-6xl w-full mx-auto px-6 py-10 md:py-16 relative z-10 flex-1 flex flex-col items-center justify-center">
        
        {/* Urgent Pilot HUD Alert Badge */}
        <div className="inline-flex items-center gap-2 bg-white/70 border border-white/60 rounded-full px-3.5 py-1.5 mb-8 shadow-xs">
          <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping shrink-0" />
          <span className="text-[10px] font-bold tracking-wider text-rose-600 uppercase">
            AI RESCUE PILOT ACTIVE & READY
          </span>
        </div>

        {/* Display Typography Header */}
        <div className="text-center max-w-3xl space-y-4 mb-10">
          <h1 className="text-5xl sm:text-7xl font-sans font-black tracking-tight text-slate-900 leading-none">
            PANIC LESS. <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-pink-500 via-rose-500 to-orange-400 drop-shadow-xs">
              SMILE MORE! ✨
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed font-sans font-medium">
            Your happy AI assistant that transforms late-night assignment chaos into clear, easy milestones, countdown timers, and instant drafts!
          </p>
        </div>

        {/* Google OAuth Access Box */}
        <div className="w-full max-w-md bg-white/65 border border-white/50 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_20px_50px_rgba(236,72,153,0.12)] relative mb-12" id="auth-box">
          <div className="absolute -top-3.5 left-6 px-3 py-1 bg-white border border-rose-100 rounded-full text-[9px] font-bold tracking-widest text-rose-500 uppercase shadow-xs">
            SECURE PORTAL INTERFACE
          </div>
          
          <div className="space-y-6">
            <div className="space-y-2 text-center sm:text-left">
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Deploy Your Pilot 🚀</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Connect your workspace via Google Account authorization below to begin generating rescue plans.
              </p>
            </div>

            {authStatusMessage && (
              <div className="bg-amber-50/80 border border-amber-200/50 rounded-xl p-3.5 text-xs font-semibold flex items-center gap-2.5 text-amber-700 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="flex-1 leading-normal">{authStatusMessage}</span>
              </div>
            )}

            {/* Custom Form for Demo Login */}
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Select Rescue Workspace Identity
                </label>
                <input
                  type="email"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  className="w-full bg-white/80 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-450 focus:border-transparent font-medium transition-all shadow-inner"
                  placeholder="name@gmail.com"
                  required
                />
              </div>

              {/* Real Google Auth Button */}
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-linear-to-r from-pink-500 via-rose-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2.5 cursor-pointer"
                id="google-signin-btn"
              >
                {loading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    SIGN IN WITH GOOGLE PROTOCOL
                  </>
                )}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleBypassSignIn}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                id="bypass-signin-btn"
              >
                BYPASS PROTOCOL (ENTER SANDBOX)
              </motion.button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-4">
              <span>SECURITY ALIGNED</span>
              <span>•</span>
              <span>NO CREDIT CARD REQUIRED</span>
              <span>•</span>
              <span>V1.0.0</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights lists */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left">
          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/40 border border-white/50 rounded-2xl p-5 space-y-2.5 backdrop-blur-md hover:shadow-lg transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-100">
              <Clock className="w-5 h-5 text-rose-500 fill-rose-100" />
            </div>
            <h4 className="text-sm font-black text-slate-800">Hyper-Paced Sprints ⏰</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Every rescue milestone is strictly bounded to 25 minutes or less, designed to break mental lock and prevent procrastination.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/40 border border-white/50 rounded-2xl p-5 space-y-2.5 backdrop-blur-md hover:shadow-lg transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100">
              <ShieldAlert className="w-5 h-5 text-amber-500 fill-amber-100" />
            </div>
            <h4 className="text-sm font-black text-slate-800">Emergency Simplification 🎈</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Completely overwhelmed? One-click "Emergency Simplify" trims specifications to the barest viable prototype to pass.
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -4 }}
            className="bg-white/40 border border-white/50 rounded-2xl p-5 space-y-2.5 backdrop-blur-md hover:shadow-lg transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Layers className="w-5 h-5 text-indigo-500 fill-indigo-100" />
            </div>
            <h4 className="text-sm font-black text-slate-800">Draft Assistant Co-Pilot ✨</h4>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Stream structured outlines, response drafts, and instructor extension request letters in real-time.
            </p>
          </motion.div>
        </div>
      </main>

      {/* Footer bar */}
      <footer className="relative border-t border-white/40 bg-white/35 backdrop-blur-md py-4 px-6 text-center text-[10px] text-slate-400 font-bold flex flex-col sm:flex-row items-center justify-between z-10">
        <span>© 2026 CRUNCH CO-PILOT. SECURE OFFLINE DISK DB LAYER RUNNING.</span>
        <span>PORT: 3000 | HOST: 0.0.0.0</span>
      </footer>
    </div>
  );
}

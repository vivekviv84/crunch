import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  deadline: string;
  id?: string;
  onAlertChange?: (colorClass: string) => void;
}

export default function CountdownTimer({ deadline, id = "countdown-timer", onAlertChange }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    totalSeconds: 0,
  });

  useEffect(() => {
    function calculateTime() {
      const msLeft = new Date(deadline).getTime() - Date.now();
      if (msLeft <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
      }

      const totalSeconds = Math.floor(msLeft / 1000);
      const days = Math.floor(totalSeconds / (3600 * 24));
      const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      return { days, hours, minutes, seconds, totalSeconds };
    }

    setTimeLeft(calculateTime());

    const interval = setInterval(() => {
      const calculated = calculateTime();
      setTimeLeft(calculated);
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  // Determine color and label based on total hours remaining
  const hoursRemaining = timeLeft.totalSeconds / 3600;

  let colorClass = "text-emerald-500 border-emerald-950/50 bg-emerald-950/10";
  let badgeLabel = "SAFE PACE";

  if (hoursRemaining <= 0) {
    colorClass = "text-rose-600 border-rose-950 bg-rose-950/20";
    badgeLabel = "OVERDUE";
  } else if (hoursRemaining < 12) {
    colorClass = "text-rose-500 border-rose-950 bg-rose-950/10 animate-pulse";
    badgeLabel = "CRITICAL RESCUE MODE";
  } else if (hoursRemaining < 24) {
    colorClass = "text-amber-500 border-amber-950 bg-amber-950/10";
    badgeLabel = "HIGH ALERT";
  } else if (hoursRemaining < 48) {
    colorClass = "text-yellow-500 border-yellow-950/50 bg-yellow-950/5";
    badgeLabel = "PACE WARNED";
  }

  // Notify parent component about color changes if callback provided
  useEffect(() => {
    if (onAlertChange) {
      onAlertChange(colorClass);
    }
  }, [colorClass, onAlertChange]);

  if (timeLeft.totalSeconds === 0) {
    return (
      <div className={`p-4 border rounded-xl flex items-center gap-3 font-mono text-sm justify-center ${colorClass}`} id={id}>
        <Clock className="w-5 h-5" />
        <span className="font-bold tracking-widest uppercase">DEADLINE ELAPSED</span>
      </div>
    );
  }

  return (
    <div className={`p-4 border rounded-xl flex flex-col items-center justify-center font-mono ${colorClass} transition-all duration-300 shadow-md`} id={id}>
      <span className="text-[10px] font-bold tracking-wider uppercase mb-2 flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        {badgeLabel} — TIME REMAINING
      </span>
      <div className="flex items-center gap-3 sm:gap-4 select-none">
        {timeLeft.days > 0 && (
          <div className="flex flex-col items-center">
            <span className="text-2xl sm:text-4xl font-black">{timeLeft.days}</span>
            <span className="text-[9px] text-slate-500 uppercase mt-1">Days</span>
          </div>
        )}
        {timeLeft.days > 0 && <span className="text-xl opacity-30">:</span>}

        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-4xl font-black">{String(timeLeft.hours).padStart(2, "0")}</span>
          <span className="text-[9px] text-slate-500 uppercase mt-1">Hrs</span>
        </div>
        <span className="text-xl opacity-30">:</span>

        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-4xl font-black">{String(timeLeft.minutes).padStart(2, "0")}</span>
          <span className="text-[9px] text-slate-500 uppercase mt-1">Min</span>
        </div>
        <span className="text-xl opacity-30">:</span>

        <div className="flex flex-col items-center">
          <span className="text-2xl sm:text-4xl font-black">{String(timeLeft.seconds).padStart(2, "0")}</span>
          <span className="text-[9px] text-slate-500 uppercase mt-1">Sec</span>
        </div>
      </div>
    </div>
  );
}

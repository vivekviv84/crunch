import { useState, useEffect } from "react";

export function useCountdown(targetDateString: string) {
  const [timeLeft, setTimeLeft] = useState({ hours: "00", minutes: "00", seconds: "00", isExpired: false });

  useEffect(() => {
    const calculateTime = () => {
      const msLeft = new Date(targetDateString).getTime() - Date.now();
      if (msLeft <= 0) {
        setTimeLeft({ hours: "00", minutes: "00", seconds: "00", isExpired: true });
        return;
      }

      const totalSecs = Math.floor(msLeft / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      setTimeLeft({
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
        isExpired: false
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [targetDateString]);

  return timeLeft;
}

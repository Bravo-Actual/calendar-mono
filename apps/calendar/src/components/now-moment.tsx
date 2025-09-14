"use client";

import React, { useState, useEffect } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { toZDT } from "./utils";

export interface NowMomentProps {
  dayStartMs: number;
  tz: string;
  localMsToY: (msInDay: number) => number;
}

export function NowMoment({ dayStartMs, tz, localMsToY }: NowMomentProps) {
  const [currentTime, setCurrentTime] = useState(() => Temporal.Now.zonedDateTimeISO(tz));

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Temporal.Now.zonedDateTimeISO(tz));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [tz]);

  const dayStart = toZDT(dayStartMs, tz).toPlainDate();
  const isToday = currentTime.toPlainDate().equals(dayStart);

  if (!isToday) return null;

  const currentTimeY = localMsToY(currentTime.epochMilliseconds - dayStartMs);

  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top: currentTimeY }}
    >
      {/* Dot at left edge */}
      <div
        className="absolute w-2 h-2 rounded-full -left-1"
        style={{
          background: "var(--primary)",
          top: "-4px" // Center the dot on the line
        }}
      />
      {/* Horizontal line */}
      <div
        className="w-full"
        style={{
          height: "3px",
          background: "var(--primary)"
        }}
      />
    </div>
  );
}
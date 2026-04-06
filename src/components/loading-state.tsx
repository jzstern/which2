"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Scanning 10,000 years of famous faces...",
  "Cross-referencing your jawline...",
  "Consulting the celebrity database...",
  "Analyzing your vibe...",
  "Running facial geometry algorithms...",
  "Comparing eyebrow arches...",
  "Almost there...",
];

export function LoadingState() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="h-16 w-16 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <p className="animate-pulse text-lg font-medium text-muted-foreground">
        {MESSAGES[index]}
      </p>
    </div>
  );
}

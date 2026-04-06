"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import { LoadingState } from "@/components/loading-state";
import { ResultsCard } from "@/components/results-card";
import { RateLimitBanner } from "@/components/rate-limit-banner";
import type { AnalyzeResponse } from "@/lib/types";

type AppState = "upload" | "loading" | "results" | "rate-limited" | "error";

export default function Home() {
  const [state, setState] = useState<AppState>("upload");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [userImage, setUserImage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const reset = () => {
    setState("upload");
    setResult(null);
    setUserImage("");
    setErrorMessage("");
  };

  const handleImageReady = async (base64: string) => {
    setUserImage(base64);
    setState("loading");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      if (res.status === 429) {
        setState("rate-limited");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error ?? "Something went wrong.");
        setState("error");
        return;
      }

      const data: AnalyzeResponse = await res.json();
      setResult(data);
      setState("results");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setState("error");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center px-4 py-12">
      <h1 className="mb-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
        which<span className="text-primary">2</span>
      </h1>
      <p className="mb-10 text-center text-lg text-muted-foreground">
        Find out which 2 famous faces you&apos;re a mashup of
      </p>

      {state === "upload" && <UploadZone onImageReady={handleImageReady} />}
      {state === "loading" && <LoadingState />}
      {state === "results" && result && (
        <ResultsCard
          celebrities={result.celebrities}
          explanation={result.explanation}
          remaining={result.remaining}
          userImage={userImage}
          onTryAgain={reset}
        />
      )}
      {state === "rate-limited" && <RateLimitBanner onTryAgain={reset} />}
      {state === "error" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="text-lg text-destructive">{errorMessage}</p>
          <Button onClick={reset}>Try again</Button>
        </div>
      )}
    </main>
  );
}

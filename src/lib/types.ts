export interface Celebrity {
  name: string;
  description: string;
  imageUrl: string;
}

export interface AnalyzeResponse {
  celebrities: [Celebrity, Celebrity];
  explanation: string;
  remaining: number;
}

export interface AnalyzeError {
  error: string;
  remaining?: number;
}

export interface GeminiResult {
  celebrities: [
    { name: string; description: string },
    { name: string; description: string },
  ];
  explanation: string;
}

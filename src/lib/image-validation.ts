const MAX_BASE64_LENGTH = 2_796_203; // ~2MB decoded

const MAGIC_BYTES: Record<string, string> = {
  "/9j/": "image/jpeg",
  iVBORw0KGgo: "image/png",
  UklGR: "image/webp",
};

interface ValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  rawBase64?: string;
}

export function validateImage(input: string): ValidationResult {
  if (!input) {
    return { valid: false, error: "No image provided" };
  }

  const base64 = input.replace(/^data:image\/\w+;base64,/, "");

  if (base64.length > MAX_BASE64_LENGTH) {
    return { valid: false, error: "Image too large (max 2MB)" };
  }

  for (const [prefix, mime] of Object.entries(MAGIC_BYTES)) {
    if (base64.startsWith(prefix)) {
      return { valid: true, mimeType: mime, rawBase64: base64 };
    }
  }

  return { valid: false, error: "Unsupported image format. Use JPEG, PNG, or WebP" };
}

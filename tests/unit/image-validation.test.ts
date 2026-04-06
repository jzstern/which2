import { describe, it, expect } from "vitest";
import { validateImage } from "@/lib/image-validation";

describe("validateImage", () => {
  it("accepts a valid JPEG base64 string", () => {
    // #given
    const base64 = "/9j/4AAQSkZJRgABAQ==";
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(true);
  });

  it("accepts a valid PNG base64 string", () => {
    // #given
    const base64 = "iVBORw0KGgo=";
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(true);
  });

  it("accepts a valid WebP base64 string", () => {
    // #given
    const base64 = "UklGRiYAAABXRUJQ";
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(true);
  });

  it("rejects an unrecognized image format", () => {
    // #given
    const base64 = "SGVsbG8gV29ybGQ=";
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported image format");
  });

  it("rejects base64 that exceeds 2MB", () => {
    // #given
    const base64 = "/9j/4AAQSkZJRgABAQ==" + "A".repeat(2_800_000);
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("rejects empty input", () => {
    // #given
    const base64 = "";
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(false);
    expect(result.error).toContain("No image");
  });

  it("strips data URI prefix before validating", () => {
    // #given
    const base64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";
    // #when
    const result = validateImage(base64);
    // #then
    expect(result.valid).toBe(true);
  });
});

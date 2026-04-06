import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCelebrityImage } from "@/lib/wikimedia";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("fetchCelebrityImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns thumbnail URL on successful lookup", async () => {
    // #given
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        thumbnail: { source: "https://upload.wikimedia.org/photo.jpg" },
      }),
    });
    // #when
    const result = await fetchCelebrityImage("Frida Kahlo");
    // #then
    expect(result).toBe("https://upload.wikimedia.org/photo.jpg");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://en.wikipedia.org/api/rest_v1/page/summary/Frida_Kahlo",
    );
  });

  it("returns placeholder on 404", async () => {
    // #given
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    // #when
    const result = await fetchCelebrityImage("Unknown Person");
    // #then
    expect(result).toBe("/placeholder-silhouette.svg");
  });

  it("returns placeholder when thumbnail is missing", async () => {
    // #given
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Some Page" }),
    });
    // #when
    const result = await fetchCelebrityImage("Some Person");
    // #then
    expect(result).toBe("/placeholder-silhouette.svg");
  });

  it("returns placeholder on network error", async () => {
    // #given
    mockFetch.mockRejectedValue(new Error("Network error"));
    // #when
    const result = await fetchCelebrityImage("Anyone");
    // #then
    expect(result).toBe("/placeholder-silhouette.svg");
  });
});

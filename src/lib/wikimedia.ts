const PLACEHOLDER_URL = "/placeholder-silhouette.svg";

export async function fetchCelebrityImage(name: string): Promise<string> {
  try {
    const encoded = encodeURIComponent(name.replace(/ /g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const response = await fetch(url);

    if (!response.ok) return PLACEHOLDER_URL;

    const data = await response.json();
    return data.thumbnail?.source ?? PLACEHOLDER_URL;
  } catch {
    return PLACEHOLDER_URL;
  }
}

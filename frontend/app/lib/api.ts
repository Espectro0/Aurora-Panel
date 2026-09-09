import { GraphData } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export async function fetchGraph(threshold?: number): Promise<GraphData> {
  const url = new URL("/api/graph", API_URL);
  if (threshold) {
    url.searchParams.set("threshold", String(threshold));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`backend responded ${res.status}`);
  }

  return res.json();
}

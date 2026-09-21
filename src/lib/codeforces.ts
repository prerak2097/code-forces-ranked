import "server-only";

const API = "https://codeforces.com/api";

interface CfEnvelope<T> {
  status: "OK" | "FAILED";
  result?: T;
  comment?: string;
}

export interface CfProblem {
  contestId?: number;
  problemsetName?: string;
  index: string;
  name: string;
  type: string;
  points?: number;
  rating?: number;
  tags: string[];
}

export interface CfProblemStatistics {
  contestId?: number;
  index: string;
  solvedCount: number;
}

export interface CfSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  problem: CfProblem;
  verdict?: string;
}

async function cfFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    headers: { "User-Agent": "cf-ranked-local/1.0" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Codeforces API returned HTTP ${res.status} for ${path}`);
  }
  const body = (await res.json()) as CfEnvelope<T>;
  if (body.status !== "OK" || body.result === undefined) {
    throw new Error(body.comment ?? "Codeforces API call failed");
  }
  return body.result;
}

export const problemKey = (contestId: number, index: string) => `${contestId}-${index}`;

export async function fetchProblemset(): Promise<{
  problems: CfProblem[];
  problemStatistics: CfProblemStatistics[];
}> {
  return cfFetch("problemset.problems");
}

export async function fetchUserSubmissions(handle: string): Promise<CfSubmission[]> {
  return cfFetch(`user.status?handle=${encodeURIComponent(handle)}&from=1&count=100000`);
}

export async function fetchUserRating(handle: string): Promise<number | null> {
  const users = await cfFetch<Array<{ rating?: number }>>(
    `user.info?handles=${encodeURIComponent(handle)}`,
  );
  return users[0]?.rating ?? null;
}

export const problemUrl = (contestId: number, index: string) =>
  contestId >= 100000
    ? `https://codeforces.com/problemset/gymProblem/${contestId}/${index}`
    : `https://codeforces.com/problemset/problem/${contestId}/${index}`;

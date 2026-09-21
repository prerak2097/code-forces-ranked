/** Client-safe Codeforces problem URL builder (the API client is server-only). */
export const problemUrlClient = (contestId: number, index: string) =>
  contestId >= 100000
    ? `https://codeforces.com/problemset/gymProblem/${contestId}/${index}`
    : `https://codeforces.com/problemset/problem/${contestId}/${index}`;

/**
 * CLI equivalent of the Settings page sync buttons.
 *   npm run sync              — cache the problemset, and sync the saved handle if there is one
 *   npm run sync -- <handle>  — use (and save) this handle instead
 *
 * Runs as part of `npm run setup`, so a network or API failure is reported and
 * skipped rather than thrown — a bad connection must never stop the app booting.
 */
import postgres from "postgres";

const url =
  process.env.DATABASE_URL ?? "postgresql://cfranked:cfranked@localhost:5433/cfranked";
const sql = postgres(url, { max: 1 });

const API = "https://codeforces.com/api";

async function cf<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`);
  const body = (await res.json()) as { status: string; result?: T; comment?: string };
  if (body.status !== "OK" || !body.result) throw new Error(body.comment ?? "CF API failed");
  return body.result;
}

const key = (contestId: number, index: string) => `${contestId}-${index}`;

async function syncProblemset() {
  type P = { contestId?: number; index: string; name: string; rating?: number; tags: string[] };
  type S = { contestId?: number; index: string; solvedCount: number };
  const { problems, problemStatistics } = await cf<{
    problems: P[];
    problemStatistics: S[];
  }>("problemset.problems");

  const counts = new Map<string, number>();
  for (const s of problemStatistics) {
    if (s.contestId != null) counts.set(key(s.contestId, s.index), s.solvedCount);
  }

  const rows = problems
    .filter((p) => p.contestId != null && p.rating != null)
    .map((p) => ({
      id: key(p.contestId!, p.index),
      contest_id: p.contestId!,
      index: p.index,
      name: p.name,
      rating: p.rating!,
      tags: p.tags,
      solved_count: counts.get(key(p.contestId!, p.index)) ?? null,
      updated_at: new Date(),
    }));

  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await sql`
      insert into problems ${sql(chunk)}
      on conflict (id) do update set
        name = excluded.name,
        rating = excluded.rating,
        tags = excluded.tags,
        solved_count = excluded.solved_count,
        updated_at = excluded.updated_at
    `;
  }

  await sql`update settings set last_problem_sync = now() where id = 1`;
  console.log(`✓ cached ${rows.length.toLocaleString()} rated problems`);
}

async function syncSubmissions(handle: string) {
  type Sub = {
    contestId?: number;
    problem: { contestId?: number; index: string };
    verdict?: string;
  };
  const subs = await cf<Sub[]>(
    `user.status?handle=${encodeURIComponent(handle)}&from=1&count=100000`,
  );

  const solved = new Set<string>();
  const attempted = new Set<string>();
  for (const s of subs) {
    const cid = s.problem.contestId ?? s.contestId;
    if (cid == null) continue;
    const k = key(cid, s.problem.index);
    attempted.add(k);
    if (s.verdict === "OK") solved.add(k);
  }

  await sql`update problems set solved_on_cf = false, attempted_on_cf = false`;
  if (attempted.size) {
    await sql`update problems set attempted_on_cf = true where id in ${sql([...attempted])}`;
  }
  if (solved.size) {
    await sql`update problems set solved_on_cf = true where id in ${sql([...solved])}`;
  }

  await sql`update settings set cf_handle = ${handle}, last_submission_sync = now() where id = 1`;
  console.log(
    `✓ ${handle}: ${subs.length.toLocaleString()} submissions, ${solved.size.toLocaleString()} solved problems excluded`,
  );
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e));

await sql`insert into settings (id) values (1) on conflict do nothing`;

// An explicit argument wins; otherwise reuse whatever handle is already saved.
const [saved] = await sql`select cf_handle from settings where id = 1`;
const handle = process.argv[2]?.trim() || (saved?.cf_handle as string | null);

try {
  await syncProblemset();
} catch (e) {
  console.warn(`! problemset sync skipped: ${reason(e)}`);
}

if (handle) {
  try {
    await syncSubmissions(handle);
  } catch (e) {
    console.warn(`! submission sync skipped for ${handle}: ${reason(e)}`);
  }
} else {
  console.log("· no Codeforces handle saved — run `npm run sync -- <handle>` to link one");
}

await sql.end();

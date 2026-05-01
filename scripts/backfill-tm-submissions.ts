/**
 * One-shot backfill: feed the 4 already-submitted TM-Cethos test jobs into
 * the vendor portal via cvp-record-tm-submission. Concatenated segments
 * are pulled from the cethos-tms project via service-role REST. This is
 * what the new finalizeDelivery callback would have done if it had been
 * wired before these submissions landed.
 *
 * Usage:
 *   PORTAL_URL=https://lmzoyezvsjgsxveoakdr.supabase.co \
 *   PORTAL_TM_INBOUND_KEY=<key> \
 *   TMS_URL=https://idzwtssftpxrsprzjael.supabase.co \
 *   TMS_SERVICE_KEY=<sb_secret_*> \
 *   npx tsx scripts/backfill-tm-submissions.ts
 */

interface JobBackfill {
  reference: string;
  jobId: string;
  submissionId: string;
}

const JOBS: JobBackfill[] = [
  { reference: "TEST-204C8606", jobId: "9d1fcdf3-4221-4b28-89f4-2b60a6352636", submissionId: "204c8606-4d27-4e1e-9205-fe229e601137" },
  { reference: "TEST-867F0802", jobId: "cc7ec61e-1ddc-48c7-aec8-a2f1d237b634", submissionId: "867f0802-0414-454b-8012-4a564e002ae8" },
  { reference: "TEST-A18C66F8", jobId: "95e5e617-fb8d-4392-82c0-8500cf020709", submissionId: "a18c66f8-7152-425f-b35b-61800f133f11" },
  { reference: "TEST-CA2D8E27", jobId: "fc8ec298-a002-4f20-909e-a09deb5c85ea", submissionId: "ca2d8e27-c843-43d9-881f-e7996d3445fc" },
];

interface Segment {
  seq: number;
  target_text: string | null;
}

async function fetchSegments(tmsUrl: string, tmsKey: string, jobId: string): Promise<Segment[]> {
  const url = `${tmsUrl.replace(/\/$/, "")}/rest/v1/segments?job_id=eq.${jobId}&select=seq,target_text&order=seq.asc`;
  const resp = await fetch(url, {
    headers: { apikey: tmsKey, Authorization: `Bearer ${tmsKey}` },
  });
  if (!resp.ok) {
    throw new Error(`segments fetch failed ${resp.status}: ${await resp.text()}`);
  }
  return (await resp.json()) as Segment[];
}

function concatSegments(segs: Segment[]): string {
  return segs
    .map((s) => (s.target_text ?? "").trim())
    .filter((t) => t.length > 0)
    .join("\n\n");
}

async function recordSubmission(
  portalUrl: string,
  inboundKey: string,
  args: { submissionId: string; submittedContent: string; tmJobId: string },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const resp = await fetch(`${portalUrl.replace(/\/$/, "")}/functions/v1/cvp-record-tm-submission`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${inboundKey}`,
    },
    body: JSON.stringify({
      submissionId: args.submissionId,
      submittedContent: args.submittedContent,
      tmJobId: args.tmJobId,
      skipApplicantEmail: true,
    }),
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, body };
}

async function main() {
  const portalUrl = process.env.PORTAL_URL;
  const inboundKey = process.env.PORTAL_TM_INBOUND_KEY;
  const tmsUrl = process.env.TMS_URL;
  const tmsKey = process.env.TMS_SERVICE_KEY;
  if (!portalUrl || !inboundKey || !tmsUrl || !tmsKey) {
    console.error("Missing env: PORTAL_URL, PORTAL_TM_INBOUND_KEY, TMS_URL, TMS_SERVICE_KEY");
    process.exit(1);
  }

  for (const j of JOBS) {
    console.log(`[${j.reference}] fetching segments…`);
    const segs = await fetchSegments(tmsUrl, tmsKey, j.jobId);
    const content = concatSegments(segs);
    if (!content) {
      console.warn(`[${j.reference}] no translated segments — skipping`);
      continue;
    }
    console.log(`[${j.reference}] ${segs.length} segs, ${content.length} chars → posting…`);
    const res = await recordSubmission(portalUrl, inboundKey, {
      submissionId: j.submissionId,
      submittedContent: content,
      tmJobId: j.jobId,
    });
    console.log(`[${j.reference}] status=${res.status} body=${JSON.stringify(res.body)}`);
  }
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});

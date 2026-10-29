import { inspectMacroSubmission } from "./inspect";

/**
 * `POST /api/submissions/macro` (AD-6): the Finish macro posts the workbook's
 * bytes as `application/octet-stream` with header `X-Attempt-Token`. No session:
 * the token authenticates. Spike S3 only reads the file and logs what it found;
 * nothing is written to the database or Storage.
 */
export async function POST(request: Request): Promise<Response> {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const inspection = await inspectMacroSubmission(bytes, request.headers.get("x-attempt-token"));
  console.log(JSON.stringify(inspection.log));
  return Response.json(inspection.body, { status: inspection.status });
}

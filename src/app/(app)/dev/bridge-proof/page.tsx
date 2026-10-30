import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { listBridgeProofs, type BridgeProof } from "@/adapters/supabase/bridge-proofs";
import { createClient } from "@/adapters/supabase/server";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { shellMessages } from "@/messages/id";
import { ANSWER_REF, ANSWER_SHEET } from "./sample";

export const metadata: Metadata = { title: surfaceTitle("Bridge proof"), robots: { index: false } };

const PATH = "/dev/bridge-proof";
const CARD = "flex flex-col gap-4 rounded-lg border border-border bg-card p-4";
const SECTION_LABEL = "font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-muted-foreground uppercase";

/**
 * Developer page for the end-to-end bridge proof (epic fondasi, Done when 5),
 * inside the shell but not in the menu: download a patched exam workbook,
 * Finish it in Excel, reload, and see what the server recorded.
 */
export default function BridgeProofPage() {
  return (
    <div className="page-enter flex max-w-4xl flex-col gap-6">
      <PageTitle>Bridge proof</PageTitle>

      <section aria-labelledby="bridge-proof-steps" className={CARD}>
        <h2 id="bridge-proof-steps" className={SECTION_LABEL}>
          Steps
        </h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          <li>Download the workbook below (each download gets a new token).</li>
          <li>
            In Windows Explorer: right-click the file → <span className="font-bold">Properties</span> → tick{" "}
            <span className="font-bold">Unblock</span> → OK.
          </li>
          <li>
            Open it in Excel, enable content, type a <span className="font-mono">SUMIFS</span> formula in{" "}
            <span className="font-mono">
              {ANSWER_SHEET}!{ANSWER_REF}
            </span>
            , then click <span className="font-bold">Finish</span>.
          </li>
          <li>Reload this page.</li>
        </ol>
        <a
          href={`${PATH}/download`}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-[18px] font-bold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto sm:self-start"
        >
          Download .xlsm
        </a>
      </section>

      <section aria-labelledby="bridge-proof-rows" className={CARD}>
        <h2 id="bridge-proof-rows" className={SECTION_LABEL}>
          Latest proofs
        </h2>
        <Suspense fallback={<div aria-hidden="true" className="h-24 rounded-sm bg-muted" />}>
          <ProofTable />
        </Suspense>
      </section>
    </div>
  );
}

async function ProofTable() {
  const user = await getSessionUser();
  if (!user) redirect(loginRedirectPath(PATH, ""));
  const proofs = await listBridgeProofs(await createClient(), user.id);

  if (proofs === null) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        <a href={PATH} className="font-bold text-primary underline-offset-4 hover:underline">
          Try again
        </a>
      </div>
    );
  }
  if (proofs.length === 0) return <p className="text-muted-foreground">No downloads yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-4 font-bold">Token SHA-256</th>
            <th scope="col" className="py-2 pr-4 font-bold">Created</th>
            <th scope="col" className="py-2 pr-4 font-bold">Received</th>
            <th scope="col" className="py-2 pr-4 font-bold">Posts</th>
            <th scope="col" className="py-2 pr-4 font-bold">Token match</th>
            <th scope="col" className="py-2 pr-4 font-bold">Fingerprint match</th>
            <th scope="col" className="py-2 font-bold">Formulas</th>
          </tr>
        </thead>
        <tbody>
          {proofs.map((proof) => (
            <ProofRow key={proof.tokenSha256Prefix + proof.createdAt} proof={proof} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProofRow({ proof }: { proof: BridgeProof }) {
  return (
    <tr className="border-b border-border align-top last:border-b-0">
      <td className="py-2 pr-4 font-mono">{proof.tokenSha256Prefix}</td>
      <td className="py-2 pr-4 font-mono whitespace-nowrap">{timestamp(proof.createdAt)}</td>
      <td className="py-2 pr-4 font-mono whitespace-nowrap">{proof.receivedAt ? timestamp(proof.receivedAt) : "—"}</td>
      <td className="py-2 pr-4 font-mono">{proof.receiveCount}</td>
      <td className="py-2 pr-4">{yesNo(proof.tokenMatches)}</td>
      <td className="py-2 pr-4">{yesNo(proof.fingerprintMatches)}</td>
      <td className="py-2">
        {proof.formulas.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {proof.formulas.map((cell) => (
              <li key={`${cell.sheet}!${cell.ref}`} className="font-mono break-all">
                {cell.sheet}!{cell.ref}: ={cell.formula}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

/** ISO 8601 in UTC, to the second: server time (AD-8), no device zone. */
function timestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

function yesNo(value: boolean | null): string {
  return value === null ? "—" : value ? "Yes" : "No";
}

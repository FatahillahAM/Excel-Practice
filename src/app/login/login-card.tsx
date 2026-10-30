"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AUTH_MESSAGE_TYPE,
  callbackFallbackUrl,
  googleSignInPath,
  loginErrorFromParam,
  safeNext,
  type AuthMessage,
} from "@/adapters/supabase/auth-rules";
import { loginMessages, type LoginError } from "@/messages/id";

const POPUP_NAME = "whe-google-sign-in";
const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 640;
const POPUP_POLL_MS = 500;

function isAuthMessage(data: unknown): data is AuthMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Partial<AuthMessage>;
  return message.type === AUTH_MESSAGE_TYPE && typeof message.status === "string";
}

/**
 * Login Card (EXPERIENCE.md › Component Patterns, State Patterns › Login):
 * one "Sign in with Google" button that opens the Google popup; the popup's
 * `/auth/callback` reports back with a same-origin `postMessage`. Every
 * failure lands in the one inline slot under the button.
 */
export function LoginCard() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<LoginError | null>(() => loginErrorFromParam(params.get("error")));
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  function stopPolling() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // The `?error=` reason is shown once: drop it from the URL so a reload or retry does not bring it back.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error")) return;
    url.searchParams.delete("error");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isAuthMessage(event.data)) return;
      if (popupRef.current !== null && event.source !== popupRef.current) return;
      settledRef.current = true;
      stopPolling();
      popupRef.current = null;
      switch (event.data.status) {
        case "success":
          // Full navigation so the server renders with the new session cookie; stay pending meanwhile.
          window.location.assign(safeNext(event.data.next));
          return;
        case "not_allowed":
          setPending(false);
          setError("notAllowed");
          return;
        case "cancelled":
          setPending(false);
          return;
        default:
          setPending(false);
          setError("network");
      }
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      stopPolling();
    };
  }, []);

  function signIn(event: React.MouseEvent | React.KeyboardEvent) {
    // The link is the no-JS fallback (tab flow); with JS the popup takes over.
    event.preventDefault();
    if (pending) return;
    setError(null);

    let timeZone = "";
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      // The server leaves the profile for a later sign-in when no zone arrives.
    }
    const url = googleSignInPath(next, timeZone);
    const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);

    // Called synchronously in the click handler so the browser allows the popup.
    const popup = window.open(
      url,
      POPUP_NAME,
      `popup,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top}`,
    );
    if (!popup || popup.closed) {
      setError("popupBlocked");
      return;
    }

    popupRef.current = popup;
    settledRef.current = false;
    setPending(true);
    stopPolling();
    pollRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      stopPolling();
      popupRef.current = null;
      if (settledRef.current) return;
      // Closed without a result: a cancel, or a sign-in whose popup lost its
      // opener (COOP). Reload Login: with a session the proxy sends it on to
      // `next`; without one it comes back idle, with no error.
      window.location.replace(callbackFallbackUrl("cancelled", next));
    }, POPUP_POLL_MS);
  }

  return <SignInBlock href={googleSignInPath(next)} pending={pending} error={error} onSignIn={signIn} />;
}

/**
 * The control and its inline error slot; also the static fallback before
 * hydration. It is a link to `/auth/google` (tab flow without JS) that the
 * click handler turns into the popup.
 */
export function SignInBlock({
  href = googleSignInPath("/"),
  pending = false,
  error = null,
  onSignIn,
}: {
  href?: string;
  pending?: boolean;
  error?: LoginError | null;
  onSignIn?: (event: React.MouseEvent | React.KeyboardEvent) => void;
}) {
  const className =
    "flex h-11 w-full items-center justify-center gap-2.5 rounded-md border-b-4 border-primary-edge bg-primary px-4 text-sm font-bold text-primary-foreground transition-[box-shadow,transform,border-width] duration-150 hover:shadow-[0_0_0_4px_var(--glow-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:border-b-0 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none sm:w-64";
  return (
    <div className="flex flex-col items-center gap-3">
      {pending ? (
        <button type="button" disabled aria-busy="true" className={className}>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span>Connecting…</span>
        </button>
      ) : (
        <a
          href={href}
          role="button"
          onClick={onSignIn}
          onKeyDown={(event) => {
            // Links activate on Enter natively; Space must work too (button role).
            if (event.key === " " && onSignIn) onSignIn(event);
          }}
          className={className}
        >
          <GoogleMark />
          <span>Sign in with Google</span>
        </a>
      )}
      <p role="alert" lang="id" className="min-h-5 max-w-sm text-center text-sm text-destructive">
        {error ? loginMessages[error] : ""}
      </p>
    </div>
  );
}

/** Google "G" mark on a white disc so its colors hold on the green button. */
function GoogleMark() {
  return (
    <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="size-3.5">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    </span>
  );
}

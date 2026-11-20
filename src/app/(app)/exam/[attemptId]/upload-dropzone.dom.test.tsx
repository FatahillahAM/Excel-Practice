// @vitest-environment jsdom
import "@/test/dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_SUBMISSION_BYTES } from "@/core/submission";
import { uploadMessages } from "@/messages/id";
import { UPLOAD_ENDPOINT } from "./upload";
import { UploadDropzone } from "./upload-dropzone";

type FetchAnswer = { status: number; json: () => Promise<unknown> };
const answer = (status: number, body: unknown): FetchAnswer => ({ status, json: async () => body });
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<FetchAnswer>>();

const onReceived = vi.fn();
const onSessionLost = vi.fn();
const file = (name = "attempt.xlsm", size = 10) => new File([new Uint8Array(size)], name);
const input = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const label = () => input().closest("label")!;
const show = () => render(<UploadDropzone onReceived={onReceived} onSessionLost={onSessionLost} />);

/** A drag event carrying `files` (jsdom has no DataTransfer). */
function drag(type: "dragOver" | "dragLeave" | "drop", target: Element, files: File[] = [], relatedTarget: Element | null = null) {
  fireEvent[type](target, { dataTransfer: { files, dropEffect: "none" }, relatedTarget });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  onReceived.mockReset();
  onSessionLost.mockReset();
});

describe("Upload Dropzone in the DOM", () => {
  it("keyboard: the real file input is reachable by Tab, inside its label", async () => {
    const user = userEvent.setup();
    show();
    await user.tab();
    expect(document.activeElement).toBe(input());
    expect(input().getAttribute("accept")).toBe(".xlsm,.xlsx");
    expect(label().textContent).toContain("Upload file (.xlsm)");
  });

  it("uploading: a polite status with Uploading…, input disabled; accepted → onReceived(status)", async () => {
    let resolve!: (a: FetchAnswer) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    show();
    await user.upload(input(), file());
    expect(screen.getByRole("status").textContent).toContain("Uploading…");
    expect(input().disabled).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(UPLOAD_ENDPOINT);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/octet-stream");

    await act(async () => resolve(answer(200, { ok: true, data: { status: "received" } })));
    expect(onReceived).toHaveBeenCalledWith("received");
    expect(input().disabled).toBe(false);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("rejected: the reason in an alert, focus back on the input to pick again", async () => {
    fetchMock.mockResolvedValue(answer(422, { ok: false, code: "NOT_THIS_ATTEMPT" }));
    const user = userEvent.setup();
    show();
    await user.upload(input(), file());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(uploadMessages.NOT_THIS_ATTEMPT);
    expect(alert.getAttribute("lang")).toBe("id");
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input().disabled).toBe(false);
    expect(onReceived).not.toHaveBeenCalled();
  });

  it("a failed request: the connection message in the alert, focus back", async () => {
    fetchMock.mockRejectedValue(new TypeError("network"));
    const user = userEvent.setup();
    show();
    await user.upload(input(), file());
    expect((await screen.findByRole("alert")).textContent).toContain(uploadMessages.failed);
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  it("too large: refused before sending, with the size message", async () => {
    const user = userEvent.setup();
    show();
    await user.upload(input(), file("big.xlsm", MAX_SUBMISSION_BYTES + 1));
    expect(screen.getByRole("alert").textContent).toContain(uploadMessages.FILE_TOO_LARGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("401: onSessionLost, no alert", async () => {
    fetchMock.mockResolvedValue(answer(401, { ok: false }));
    const user = userEvent.setup();
    show();
    await user.upload(input(), file());
    await waitFor(() => expect(onSessionLost).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("drag-over: Drop to upload and the highlighted border; leaving restores; a drop sends the first file once", async () => {
    fetchMock.mockResolvedValue(answer(200, { ok: true, data: { status: "received" } }));
    const { container } = show();
    const zone = container.firstElementChild!;
    drag("dragOver", zone);
    expect(label().textContent).toContain("Drop to upload");
    expect(label().className).toContain("border-primary");
    expect(label().className).toContain("bg-glow-soft");
    drag("dragLeave", zone, [], null);
    expect(label().textContent).toContain("Upload file (.xlsm)");

    drag("dragOver", zone);
    await act(async () => drag("drop", zone, [file("a.xlsm"), file("b.xlsm")]));
    await waitFor(() => expect(onReceived).toHaveBeenCalledWith("received"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1]?.body as File).name).toBe("a.xlsm");
    expect(label().textContent).toContain("Upload file (.xlsm)");
  });

  it("a second drop while uploading is not sent", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const { container } = show();
    const zone = container.firstElementChild!;
    await act(async () => drag("drop", zone, [file()]));
    await act(async () => drag("drop", zone, [file()]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

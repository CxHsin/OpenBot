import { expect, test } from "bun:test";
import type { AuditEventInput } from "../audit";
import { botSeat } from "./computer-key";
import { createComputerGateway } from "./gateway";
import { createHeadlessComputerTools } from "./headless-tools";

function fixture(refusal: Record<string, unknown>, deny: string[] = []) {
  const paths: string[] = [];
  const audit: AuditEventInput[] = [];
  const gateway = createComputerGateway({
    provider: {
      name: "test",
      isolation: "per-person",
      locate: async () => "http://127.0.0.1:4100",
      status: async (seat) => ({ botId: seat.botId, state: "ready" }),
      list: async () => [],
      stop: async () => ({ wasRunning: false }),
      reset: async () => ({ cleared: false }),
    },
    auditStore: {
      insert: async (event) => {
        audit.push(event);
      },
    },
    policy: () => ({ mode: "enforce", allow: ["true"], deny }),
    fetchImpl: Object.assign(
      async (url: Parameters<typeof fetch>[0]) => {
        const path = new URL(String(url)).pathname;
        paths.push(path);
        if (path === "/navigate")
          return Response.json(refusal, { status: 409 });
        if (path === "/snapshot")
          return Response.json({
            snapshotId: 8,
            url: "about:blank",
            title: "",
            truncated: false,
            elements: [],
          });
        throw new Error(`Unexpected request: ${path}`);
      },
      { preconnect: () => {} },
    ),
  });
  const tool = createHeadlessComputerTools({
    gateway,
    seat: botSeat("bot"),
    actor: { id: "owner", userId: "owner", initiator: { kind: "person" } },
  }).find((tool) => tool.definition.name === "computer_navigate")!;
  return {
    paths,
    audit,
    invoke: () =>
      tool.execute(
        { url: "https://example.com" },
        { toolCallId: "navigate", signal: new AbortController().signal },
      ),
  };
}

test("handback refusal returns the required snapshot without another model tool request or automatic navigation retry", async () => {
  const f = fixture({
    error: "Take a fresh browser snapshot after handback before acting.",
    stale: true,
    snapshotRequired: true,
  });
  expect(await f.invoke()).toMatchObject({
    ok: false,
    notPerformed: true,
    snapshot: {
      snapshotId: 8,
      url: "about:blank",
      untrusted: expect.stringContaining("untrusted"),
    },
  });
  expect(f.paths).toEqual(["/navigate", "/snapshot"]);
  expect(f.audit.map((event) => event.eventType)).toContain(
    "computer.action_failed",
  );
});

test("human control suspends rather than reading around it; other stale errors remain errors", async () => {
  const human = fixture({
    error: "A person has control",
    humanHasControl: true,
  });
  await expect(human.invoke()).rejects.toMatchObject({
    name: "HeadlessToolSuspension",
  });
  expect(human.paths).toEqual(["/navigate"]);
  const stale = fixture({ error: "Stale ref", stale: true });
  await expect(stale.invoke()).rejects.toMatchObject({
    name: "StaleSnapshotError",
  });
  expect(stale.paths).toEqual(["/navigate"]);
});

test("denied navigation still stops at policy before any computer request", async () => {
  const f = fixture({}, ["true"]);
  await expect(f.invoke()).rejects.toMatchObject({
    name: "ActionRefusedError",
  });
  expect(f.paths).toHaveLength(0);
});

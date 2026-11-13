import { z } from "zod";
import type { RoutineStore } from "../routines/store";
import type { ResponsibilityEngine } from "./engine";
import { responsibilityTools } from "./tools";
import {
  type ResponsibilityStore,
  responsibilityInputSchema,
  responsibilityPatchSchema,
} from "./types";

type Dependencies = {
  store: ResponsibilityStore;
  scheduleRoutine?: RoutineStore["create"];
  engine: Pick<ResponsibilityEngine, "ingest">;
  conversationFor: (
    ownerUserId: string,
    agentId: string,
    channelId?: string,
  ) => Promise<string>;
};

let installed: Dependencies | null = null;
export function useResponsibilityChatTools(deps: Dependencies | null) {
  installed = deps;
}

const identity = z.object({ id: z.string().trim().min(1).max(128) });
const createSchema = responsibilityInputSchema
  .omit({ agentId: true, channelId: true })
  .extend({ channelId: z.string().optional() });
const scheduleSchema = identity.extend({
  cron: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
});
const definitions = [
  {
    name: "create_responsibility",
    description:
      "Create a durable delegation with measurable success criteria. It runs when requested or triggered by an event; it has no schedule of its own. For periodic work use a routine. Omit channelId for the one channel you share; if there are several, ask which one. Identity comes from this run.",
    schema: createSchema,
  },
  {
    name: "list_responsibilities",
    description:
      "List this person's durable delegations carried out by this Bot, including progress.",
    schema: z.object({}).strict(),
  },
  {
    name: "update_responsibility",
    description:
      "Change the instruction, criteria, title or subscriptions of an owned delegation.",
    schema: identity.extend({ patch: responsibilityPatchSchema }),
  },
  ...(["run", "pause", "resume", "complete"] as const).map((action) => ({
    name: `${action}_responsibility`,
    description: `${action} this Bot's delegation for this person, by id from list_responsibilities. Complete only when its criteria are met or the person asks to end it.`,
    schema: identity,
  })),
  {
    name: "schedule_responsibility",
    description:
      "Wake an existing active delegation on a routine schedule. Give its id from list_responsibilities, five-field cron (at most every 15 minutes) and the person's IANA timezone. Uses its existing reporting channel. Returns a routine id; list_routines and update_routine can inspect or pause that schedule. Pausing/completing the delegation also prevents execution. Missed clock windows are not replayed.",
    schema: scheduleSchema,
  },
];

export const RESPONSIBILITY_CHAT_TOOLS = definitions.map(
  ({ name, description, schema }) => ({
    name,
    description,
    inputSchema: z.toJSONSchema(schema),
  }),
);

export const isResponsibilityChatTool = (name: string) =>
  definitions.some((tool) => tool.name === name);

/** Called only through the granted builtin transport, with connection-derived identity. */
export async function callResponsibilityChatTool(
  ownerUserId: string,
  agentId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (!installed)
    return "Refused. Durable delegations are unavailable in this deployment.";
  const definition = definitions.find((tool) => tool.name === name);
  if (!definition) return "Refused. Unknown delegation tool.";
  const parsed = definition.schema.safeParse(args);
  if (!parsed.success) return `Refused. ${parsed.error.issues[0]?.message}`;
  if (name === "schedule_responsibility") {
    if (!installed.scheduleRoutine)
      return "Refused. Delegation scheduling is unavailable.";
    const { id, cron, timezone } = scheduleSchema.parse(args);
    const goal = await installed.store.get(ownerUserId, id);
    if (goal.agentId !== agentId || goal.status !== "active")
      return "Refused. Choose this Bot's active delegation.";
    const routine = await installed.scheduleRoutine({
      ownerUserId,
      agentId,
      channelId: goal.channelId,
      responsibilityId: goal.id,
      instruction: `Run delegation: ${goal.title}`,
      cron,
      timezone,
    });
    return JSON.stringify({
      routineId: routine.id,
      responsibilityId: goal.id,
      cron: routine.cron,
      timezone: routine.timezone,
      nextRunAt: routine.nextRunAt,
    });
  }
  let channelId = "";
  let input: unknown = parsed.data;
  if (name === "create_responsibility") {
    const { channelId: requested, ...rest } = createSchema.parse(args);
    channelId = await installed.conversationFor(
      ownerUserId,
      agentId,
      requested?.trim() || undefined,
    );
    input = rest;
  }
  const tool = responsibilityTools({
    store: installed.store,
    engine: installed.engine,
    ownerUserId,
    agentId,
    channelId,
  }).find((candidate) => candidate.name === name);
  if (!tool) return "Refused. Unknown delegation tool.";
  const answer = String(await tool.execute(input));
  return name === "create_responsibility" && !answer.startsWith("Refused.")
    ? `Delegation saved. It runs when requested or triggered, with no schedule of its own.\n${answer}`
    : answer;
}

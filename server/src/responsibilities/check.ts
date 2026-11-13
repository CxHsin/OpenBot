import type { GrantedTool } from "@openbot/toolkit/granted-tool";
import { z } from "zod";

/** A draft is local to one turn. Only engine/store success settlement makes it durable. */
export function createResponsibilityCheck(responsibilityId: string) {
  let result: { summary: string; notify: boolean } | undefined;
  const parameters = z
    .object({
      summary: z.string().trim().min(1).max(6000),
      notify: z.boolean(),
    })
    .strict();
  const tool: GrantedTool = {
    name: "finish_responsibility_check",
    ref: "responsibility/finish_responsibility_check",
    description: `Finish the current check for responsibility ${responsibilityId}. Supply durable progress including the exact successfully processed source cursor and evidence. Set notify=false only for a verified no-change or no-actionable-change result. Missing materials and failures are not no-change. This stages a checkpoint; it saves only if this turn succeeds. Do not use report_responsibility_progress to advance this check's cursor. Finish your final reply after this call.`,
    parameters,
    async execute(args) {
      const parsed = parameters.safeParse(args);
      if (!parsed.success)
        return "Refused. Supply nonempty progress and an explicit notify boolean.";
      result = parsed.data;
      return JSON.stringify({
        staged: true,
        responsibilityId,
        notify: result.notify,
      });
    },
  };
  return { tool, result: () => result };
}

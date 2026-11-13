import { expect, test } from "bun:test";
import { createResponsibilityCheck } from "../src/responsibilities/check";

test("a check stages bounded progress for its own turn without writing to a store", async () => {
  const first = createResponsibilityCheck("goal-a");
  const second = createResponsibilityCheck("goal-b");
  expect(await first.tool.execute({ summary: "", notify: false })).toContain(
    "Refused",
  );
  expect(first.result()).toBeUndefined();
  await first.tool.execute({
    summary: "cursor: abc; checked snapshot",
    notify: false,
  });
  expect(first.result()).toEqual({
    summary: "cursor: abc; checked snapshot",
    notify: false,
  });
  expect(second.result()).toBeUndefined();
});

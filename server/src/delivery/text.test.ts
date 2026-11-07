import { expect, test } from "bun:test";
import { replyForText } from "./text";

test("chart fallback preserves labels, zero values, targets and provenance", () => {
  const result = replyForText({
    replyText: "结果",
    components: [
      {
        name: "showProgress",
        args: {
          title: "进度",
          points: [{ label: "完成", value: 0, target: 10 }],
          basis: "read",
          sources: [{ title: "原始数据", url: "https://example.com" }],
          asOf: "2026-11-07",
        },
      },
    ],
  });
  for (const expected of [
    "完成: 0 / 10",
    "原始数据",
    "https://example.com",
    "截至：2026-11-07",
  ])
    expect(result).toContain(expected);
});

test("line chart fallback keeps the correspondence between series and labels", () => {
  expect(
    replyForText({
      replyText: "",
      components: [
        {
          name: "showLineChart",
          args: {
            title: "趋势",
            labels: ["一月", "二月"],
            series: [{ name: "销量", values: [0, 5] }],
            basis: "own-knowledge",
          },
        },
      ],
    }),
  ).toContain("销量\n一月: 0\n二月: 5\n数据来自模型已有知识，未经核实。");
});

test("plain text stays unchanged and web-only report data is not invented", () => {
  expect(replyForText({ replyText: "原始回答" })).toBe("原始回答");
  expect(
    replyForText({
      replyText: "",
      components: [
        { name: "showActivityReport", args: { report: "activity" } },
      ],
    }),
  ).toContain("本条消息不含报告数据");
});

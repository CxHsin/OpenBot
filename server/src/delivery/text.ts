import type { DrawnComponent } from "@openbot/toolkit/run-turn";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
const lines = (values: unknown[]) =>
  values.map(text).filter(Boolean).join("\n");

/** Allowed display results need an equivalent on surfaces without a gallery renderer. */
export function replyForText(result: {
  replyText: string;
  components?: DrawnComponent[];
}): string {
  return [result.replyText, ...(result.components ?? []).map(componentText)]
    .filter(Boolean)
    .join("\n\n");
}

function componentText({ name, args }: DrawnComponent): string {
  const heading = lines([args.title, args.caption]);
  let body: string;
  switch (name) {
    case "showTable": {
      const columns = array(args.columns).map(text);
      body = array(args.rows)
        .map((row) =>
          array(record(row).cells)
            .map((cell, index) => `${columns[index] ?? ""}: ${text(cell)}`)
            .join("\n"),
        )
        .join("\n\n");
      break;
    }
    case "showRecord":
    case "showMetrics":
      body = lines([
        args.subtitle,
        args.status,
        ...array(args.fields ?? args.metrics).map((field) => {
          const item = record(field);
          return `${text(item.label)}: ${text(item.value)}${item.change ? ` (${text(item.change)})` : ""}`;
        }),
      ]);
      break;
    case "showChecklist":
      body = array(args.items)
        .map((value) => {
          const item = record(value);
          return `${item.done ? "[x]" : "[ ]"} ${text(item.text)}${item.note ? ` — ${text(item.note)}` : ""}`;
        })
        .join("\n");
      break;
    case "showNotice":
      body = lines([args.body, ...array(args.points)]);
      break;
    case "showQuote":
      body = lines([args.quote, args.attribution, args.context]);
      break;
    case "showBarChart":
    case "showPieChart":
    case "showProgress":
      body = array(args.points)
        .map((value) => {
          const point = record(value);
          return `${text(point.label)}: ${text(point.value)}${point.target !== undefined ? ` / ${text(point.target)}` : ""}`;
        })
        .join("\n");
      break;
    case "showAreaChart":
    case "showLineChart":
      body = array(args.series)
        .map((value) => {
          const series = record(value);
          return lines([
            series.name,
            ...array(series.values).map(
              (value, index) =>
                `${text(array(args.labels)[index])}: ${text(value)}`,
            ),
          ]);
        })
        .join("\n\n");
      break;
    case "showActivityReport":
      // Its data is read only when the Web renderer opens, never invent figures here.
      body = "OpenBot 会话中可查看活动报告；本条消息不含报告数据。";
      break;
    default:
      body = JSON.stringify(args);
  }
  const sources = array(args.sources).map((value) => {
    const source = record(value);
    return lines([source.title, source.url]);
  });
  return lines([
    heading,
    body,
    args.basis === "own-knowledge" ? "数据来自模型已有知识，未经核实。" : "",
    args.basis === "given" ? "数据由用户提供。" : "",
    args.asOf ? `截至：${text(args.asOf)}` : "",
    ...sources,
  ]);
}

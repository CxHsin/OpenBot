import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("Git collection catches up from the successful cursor, repeats quietly and rejects rewritten or missing history", async () => {
  const root = await mkdtemp(join(tmpdir(), "nailong-observer-"));
  const source = join(root, "source");
  function git(...args: string[]) {
    const child = Bun.spawnSync(["git", ...args], {
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "test",
        GIT_AUTHOR_EMAIL: "test@example.test",
        GIT_COMMITTER_NAME: "test",
        GIT_COMMITTER_EMAIL: "test@example.test",
      },
    });
    if (child.exitCode !== 0) throw new Error(child.stderr.toString());
    return child.stdout.toString().trim();
  }
  git("init", "-b", "main", source);
  async function commit(text: string) {
    await writeFile(join(source, "change.txt"), text);
    git("-C", source, "add", ".");
    git("-C", source, "commit", "-m", text.slice(0, 80));
    return git("-C", source, "rev-parse", "HEAD");
  }
  const baseline = await commit("baseline");
  const forkSource = join(root, "fork");
  git("clone", source, forkSource);
  await writeFile(join(forkSource, "fork-only.txt"), "personal agent change");
  git("-C", forkSource, "add", ".");
  git("-C", forkSource, "commit", "-m", "fork divergence");
  const forkTip = git("-C", forkSource, "rev-parse", "HEAD");
  await commit("offline one");
  const tip = await commit("offline two");
  async function collect(cursor: string, redirect = source) {
    const child = Bun.spawn(
      [
        "bun",
        resolve("examples/nailong/upstream-observer.ts"),
        "https://github.com/CopilotKit/openbot.git",
        "main",
        cursor,
        join(root, "cache"),
        "https://github.com/CxHsin/OpenBot.git",
        "main",
      ],
      {
        env: {
          ...process.env,
          GIT_CONFIG_COUNT: "2",
          GIT_CONFIG_KEY_0: `url.${redirect.replaceAll("\\", "/")}.insteadOf`,
          GIT_CONFIG_VALUE_0: "https://github.com/CopilotKit/openbot.git",
          GIT_CONFIG_KEY_1: `url.${forkSource.replaceAll("\\", "/")}.insteadOf`,
          GIT_CONFIG_VALUE_1: "https://github.com/CxHsin/OpenBot.git",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, code };
  }
  const caught = await collect(baseline);
  expect(caught.code).toBe(0);
  const evidence = JSON.parse(caught.stdout);
  expect(evidence.tip).toBe(tip);
  expect(evidence.commits).toContain("offline one");
  expect(evidence.commits).toContain("offline two");
  expect(evidence.fork.tip).toBe(forkTip);
  expect(evidence.fork.patch).toContain("personal agent change");
  const repeated = await collect(tip);
  expect(JSON.parse(repeated.stdout).unchanged).toBe(true);
  const missing = await collect("0".repeat(40));
  expect(missing.code).not.toBe(0);
  const unavailable = await collect(tip, join(root, "absent"));
  expect(unavailable.code).not.toBe(0);
  await writeFile(
    join(forkSource, "large-fork.txt"),
    `${"fork change\n".repeat(50000)}end of fork change`,
  );
  git("-C", forkSource, "add", ".");
  git("-C", forkSource, "commit", "-m", "large fork difference");
  const largeFork = await collect(tip);
  expect(largeFork.code).toBe(0);
  expect(JSON.parse(largeFork.stdout).unchanged).toBe(true);
  expect(JSON.parse(largeFork.stdout).fork.patch).toContain(
    "end of fork change",
  );
  await commit(`${"upstream change\n".repeat(50000)}end of upstream change`);
  const largeInterval = await collect(tip);
  expect(largeInterval.code).toBe(0);
  expect(JSON.parse(largeInterval.stdout).patch).toContain(
    "end of upstream change",
  );
  git("-C", source, "checkout", "--orphan", "rewritten");
  await commit("unrelated history");
  git("-C", source, "branch", "-f", "main", "HEAD");
  const rewritten = await collect(tip);
  expect(rewritten.code).not.toBe(0);
}, 30000);

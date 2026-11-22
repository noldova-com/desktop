/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import { CommandFakesFixture } from "./fixtures/command-fakes.fixture.ts";
import { SessionBusRun } from "./fixtures/session-bus-run.ts";

const IS_POSIX = process.platform !== "win32";
const LIVE_BUS = "trap 'echo stopped >> \"$FAKES/bus.log\"; exit 0' TERM; echo $$ > \"$FAKES/bus.pid\"; echo unix:path=/tmp/fake-bus >&3; while :; do sleep 0.1; done";
const SILENT_BUS = "echo $$ > \"$FAKES/bus.pid\"; while :; do sleep 0.1; done";
const DEAF_BUS = "trap '' TERM; echo $$ > \"$FAKES/bus.pid\"; echo unix:path=/tmp/fake-bus >&3; while :; do sleep 0.1; done";
const WATCHED_BUS = "trap 'exit 0' TERM; echo $$ > \"$FAKES/bus.pid\"; while [ ! -e \"$FAKES/watchdog\" ]; do /bin/sleep 0.1; done; echo unix:path=/tmp/fake-bus >&3; while :; do /bin/sleep 0.1; done";
const WATCHDOG_SLEEP = "if [ \"$1\" = 7 ]; then echo watchdog; echo watchdog >&2; : > \"$FAKES/watchdog\"; fi; exec /bin/sleep \"$@\"";

async function runAsync(bus: string, command: string, startSeconds?: string, commands: Readonly<Record<string, string>> = {}): Promise<SessionBusRun> {
  await using fakes = await CommandFakesFixture.createAsync({ ...commands, "dbus-daemon": bus });
  const child = spawn(Resources.uiWorkflowsCiSessionBus, [...Resources.uiWorkflowsCiSessionBusArguments, "sh", "-c", command], {
    env: { ...process.env, PATH: `${fakes.bin}${path.delimiter}${process.env["PATH"] ?? ""}`, FAKES: fakes.folder, ...(Object.isUndefined(startSeconds) ? {} : { NOLDOVA_SESSION_BUS_START_SECONDS: startSeconds }) }
  });
  let output = "";
  let errors = "";
  child.stdout.on("data", (t: Buffer) => output += t.toString());
  child.stderr.on("data", (t: Buffer) => errors += t.toString());
  const status = await new Promise<number | null>(resolve => child.once("close", resolve));
  const busProcess = await readFile(path.join(fakes.folder, "bus.pid"), "utf8").then(t => Number(t.trim()), () => null);
  const busLog = await readFile(path.join(fakes.folder, "bus.log"), "utf8").catch(() => "");
  return new SessionBusRun(status, output, errors, await fakes.readCallsAsync(), busProcess, busLog);
}

function isRunning(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  }
  catch {
    return false;
  }
}

describe("test:ui:ci's session bus", { skip: !IS_POSIX }, () => {
  it("runs the specs on a bus of their own and ends and waits for it before returning their exit code", async () => {
    const result = await runAsync(LIVE_BUS, "echo \"$DBUS_SESSION_BUS_ADDRESS\"; exit 3");

    assert.equal(result.status, 3);
    assert.equal(result.output, "unix:path=/tmp/fake-bus\n");
    assert.deepEqual(result.calls, ["dbus-daemon --session --nofork --print-address=3"]);
    assert.equal(result.busLog, "stopped\n");
    assert.notEqual(result.busProcess, null);
    assert.equal(isRunning(Number(result.busProcess)), false);
  });

  it("kills a bus that still runs five seconds after it was asked to stop", { timeout: 20_000 }, async () => {
    const result = await runAsync(DEAF_BUS, "exit 0");

    assert.equal(result.status, 0);
    assert.notEqual(result.busProcess, null);
    assert.equal(isRunning(Number(result.busProcess)), false);
  });

  it("fails without running the specs, and leaves no bus, when the bus prints no address within the start limit", { timeout: 5_000 }, async () => {
    const result = await runAsync(SILENT_BUS, "echo ran", "1");

    assert.equal(result.status, 1);
    assert.equal(result.output, "");
    assert.equal(result.errors, "The session bus did not start.\n");
    assert.notEqual(result.busProcess, null);
    assert.equal(isRunning(Number(result.busProcess)), false);
  });

  it("gives the start limit's watchdog none of the specs' output, so a watchdog stopped before its trap leaves nothing that holds the run open", async () => {
    const result = await runAsync(WATCHED_BUS, "exit 0", "7", { sleep: WATCHDOG_SLEEP });

    assert.equal(result.status, 0);
    assert.equal(result.output, "");
    assert.equal(result.errors, "");
  });

  it("fails without running the specs when the bus does not start", async () => {
    const result = await runAsync("exit 1", "echo ran");

    assert.equal(result.status, 1);
    assert.equal(result.output, "");
    assert.equal(result.errors, "The session bus did not start.\n");
  });
});

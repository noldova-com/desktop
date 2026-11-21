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

import { Resources } from "../resources.ts";
import { CommandFakesFixture } from "./fixtures/command-fakes.fixture.ts";

const IS_POSIX = process.platform !== "win32";
const LIVE_BUS = "echo unix:path=/tmp/fake-bus >&3; echo $$ > \"$FAKES/bus.pid\"; trap 'echo stopped >> \"$FAKES/bus.log\"; exit 0' TERM; while :; do sleep 0.1; done";
const DEAF_BUS = "echo unix:path=/tmp/fake-bus >&3; echo $$ > \"$FAKES/bus.pid\"; trap '' TERM; while :; do sleep 0.1; done";

async function runAsync(bus: string, command: string): Promise<{ status: number | null, output: string, errors: string, calls: readonly string[], busProcess: number | null, busLog: string }> {
  await using fakes = await CommandFakesFixture.createAsync({ "dbus-daemon": bus });
  const child = spawn(Resources.uiWorkflowsCiSessionBus, [...Resources.uiWorkflowsCiSessionBusArguments, "sh", "-c", command], {
    env: { ...process.env, PATH: `${fakes.bin}${path.delimiter}${process.env["PATH"] ?? ""}`, FAKES: fakes.folder }
  });
  let output = "";
  let errors = "";
  child.stdout.on("data", (t: Buffer) => output += t.toString());
  child.stderr.on("data", (t: Buffer) => errors += t.toString());
  const status = await new Promise<number | null>(resolve => child.once("close", resolve));
  const busProcess = await readFile(path.join(fakes.folder, "bus.pid"), "utf8").then(t => Number(t.trim()), () => null);
  const busLog = await readFile(path.join(fakes.folder, "bus.log"), "utf8").catch(() => "");
  return { status, output, errors, calls: await fakes.readCallsAsync(), busProcess, busLog };
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

  it("kills a bus that still runs five seconds after it was asked to stop", async () => {
    const result = await runAsync(DEAF_BUS, "exit 0");

    assert.equal(result.status, 0);
    assert.notEqual(result.busProcess, null);
    assert.equal(isRunning(Number(result.busProcess)), false);
  });

  it("fails without running the specs when the bus does not start", async () => {
    const result = await runAsync("exit 1", "echo ran");

    assert.equal(result.status, 1);
    assert.equal(result.output, "");
    assert.equal(result.errors, "The session bus did not start.\n");
  });
});

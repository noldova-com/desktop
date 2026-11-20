/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandLineRelay } from "@noldova/desktop.electron";

const MISSING = path.join(path.dirname(process.execPath), "noldova-desktop-missing-program");
const ENTRY = "process.stdout.write(JSON.stringify([process.argv.slice(2), process.env.ELECTRON_RUN_AS_NODE, process.env.RELAY_ANSWER])); process.stderr.write('warned'); process.exit(7);";

class RelayedRun {
  public options: SpawnSyncOptions | null = null;
  public programArguments: readonly string[] = [];
  public output: string = String.empty;
  public errorOutput: string = String.empty;
  public written: string = String.empty;

  public readonly error: Writable = new Writable({
    write: (chunk: Buffer, _encoding, callback): void => {
      this.written += chunk.toString();
      callback();
    }
  });

  public static end(status: number | null, signal: NodeJS.Signals | null): SpawnSyncReturns<string | Buffer> {
    return { pid: 0, output: [], stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), status, signal };
  }

  public run(program: string, programArguments: readonly string[], options: SpawnSyncOptions): SpawnSyncReturns<string | Buffer> {
    this.options = options;
    this.programArguments = programArguments;
    const result = spawnSync(program, [...programArguments], { ...options, stdio: "pipe" });
    this.output = result.stdout.toString();
    this.errorOutput = result.stderr.toString();
    return result;
  }
}

@TestClass
export class CommandLineRelayTests {
  @TestMethod
  public readsTheArgumentsAfterTheFirstCommandLineFlagOnly(): void {
    Assert.isNull(CommandLineRelay.readArguments(["/opt/Sample/sample", "--no-sandbox", "status"]));
    Assert.areEqual(JSON.stringify([]), JSON.stringify(CommandLineRelay.readArguments(["/opt/Sample/sample", "--command-line"])));
    Assert.areEqual(JSON.stringify(["status", "--json"]), JSON.stringify(CommandLineRelay.readArguments(["/tmp/.mount_Sample/sample", "--no-sandbox", "--command-line", "status", "--json"])));
    Assert.areEqual(JSON.stringify(["echo", "--command-line"]), JSON.stringify(CommandLineRelay.readArguments(["electron", "main.js", "--command-line", "echo", "--command-line"])));
  }

  @TestMethod
  public async runsTheEntryInNodeModeWithTheArgumentsAndReturnsItsExitCodeAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-command-line-relay-"));
    try {
      const entry = path.join(folder, "cli-entry.cjs");
      await writeFile(entry, ENTRY);
      const run = new RelayedRun();
      const relay = new CommandLineRelay((program, args, options) => run.run(program, args, options), process.execPath, entry,
        { ...process.env, RELAY_ANSWER: "kept", ELECTRON_RUN_AS_NODE: undefined }, run.error);

      const code = relay.relay(["status", "--json"]);

      Assert.areEqual(7, code);
      Assert.isTrue(run.options?.stdio === "inherit", String(run.options?.stdio));
      Assert.areEqual(false, run.options?.shell);
      Assert.areEqual(JSON.stringify([entry, "status", "--json"]), JSON.stringify(run.programArguments));
      Assert.areEqual(JSON.stringify([["status", "--json"], "1", "kept"]), run.output);
      Assert.areEqual("warned", run.errorOutput);
      Assert.areEqual(String.empty, run.written);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public returnsTheSignalsCodeWhenASignalEndsTheCommandLineAndOneWhenNothingSaysHowItEnded(): void {
    const run = new RelayedRun();
    const killed = new CommandLineRelay(() => RelayedRun.end(null, "SIGKILL"), process.execPath, "cli-entry.js", process.env, run.error);
    const unknown = new CommandLineRelay(() => RelayedRun.end(null, null), process.execPath, "cli-entry.js", process.env, run.error);

    Assert.areEqual(137, killed.relay([]));
    Assert.areEqual(1, unknown.relay([]));
    Assert.areEqual(String.empty, run.written);
  }

  @TestMethod
  public returnsOneAndSaysSoWhenTheProgramCannotStart(): void {
    const run = new RelayedRun();
    const relay = new CommandLineRelay((program, args, options) => spawnSync(program, [...args], { ...options, stdio: "ignore" }), MISSING, "cli-entry.js", process.env, run.error);

    const code = relay.relay(["status"]);

    Assert.areEqual(1, code);
    Assert.isTrue(run.written.startsWith(`The command line could not start through ${MISSING}: `), run.written);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessTree } from "../../../src/services/processes/process-tree.js";

@TestClass
export class ProcessTreeTests {
  @TestMethod
  public groupsAProcessTreeEverywhereButWindows(): void {
    const grouped = ["linux", "darwin", "win32"].map(t => new ProcessTree(t).isGrouped);

    Assert.areEqual(JSON.stringify([true, true, false]), JSON.stringify(grouped));
  }

  @TestMethod
  public killsTheProcessGroupOutsideWindowsAndIgnoresAGroupAlreadyGone(): void {
    const killed: (readonly [number, string])[] = [];
    const ran: string[] = [];
    let failure: Error | null = null;
    const tree = new ProcessTree("linux", (processId, signal) => {
      killed.push([processId, signal]);
      if (!Object.isNull(failure))
        throw failure;
    }, command => ran.push(command));

    tree.end({ pid: 4321 });
    failure = Object.assign(new Error("kill ESRCH"), { code: "ESRCH" });
    tree.end({ pid: 4322 });
    failure = Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    const refused = Assert.throws(() => tree.end({ pid: 4323 }), Error);
    failure = new Error("kill failed");
    const unexplained = Assert.throws(() => tree.end({ pid: 4324 }), Error);

    Assert.areEqual(JSON.stringify([[-4321, "SIGKILL"], [-4322, "SIGKILL"], [-4323, "SIGKILL"], [-4324, "SIGKILL"]]), JSON.stringify(killed));
    Assert.areEqual("kill EPERM", refused.message);
    Assert.areEqual("kill failed", unexplained.message);
    Assert.areEqual(0, ran.length);
  }

  @TestMethod
  public endsTheTreeWithTaskkillOnWindowsAndIgnoresItsAnswer(): void {
    const ran: string[] = [];
    let answered = 0;
    const tree = new ProcessTree("win32", () => {
      ran.push("kill");
    }, (command, commandArguments, options, callback) => {
      ran.push(JSON.stringify([command, commandArguments, options]));
      callback();
      answered += 1;
    });

    tree.end({ pid: 4321 });

    Assert.areEqual(JSON.stringify([JSON.stringify(["taskkill", ["/pid", "4321", "/T", "/F"], { windowsHide: true }])]), JSON.stringify(ran));
    Assert.areEqual(1, answered);
  }

  @TestMethod
  public endsNothingForAProcessThatNeverStarted(): void {
    const ran: string[] = [];
    const trees = ["linux", "win32"].map(t => new ProcessTree(t, () => {
      ran.push("kill");
    }, () => ran.push("taskkill")));

    for (const tree of trees)
      tree.end({ pid: undefined });

    Assert.areEqual(0, ran.length);
  }

  @TestMethod
  public async settlesAtOnceForAProcessThatHasEndedAndOnItsExitForOneThatRuns(): Promise<void> {
    const tree = new ProcessTree();
    const ended = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    await once(ended, "exit");
    const running = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    const settled: string[] = [];

    tree.whenEnded(ended, () => settled.push("ended"));
    tree.whenEnded(running, () => settled.push("running"));
    const before = [...settled];
    await once(running, "exit");

    Assert.areEqual(JSON.stringify(["ended"]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify(["ended", "running"]), JSON.stringify(settled));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShipItNotRemovedException, ShipItProcess, ShipItUnreadableException } from "@noldova/desktop.electron";
import { CommandFailedException, SystemCommand } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { WaitFixture } from "../fixtures/wait.fixture.js";

@TestClass
export class ShipItProcessTests {
  private static readonly BUNDLE: string = "com.noldova.desktop";
  private static readonly RUNNER_SESSION_WITHOUT_A_LOGIN_WINDOW: string = "Background";
  private static readonly LIST: string = [
    "PID\tStatus\tLabel",
    "811\t0\tcom.example.other.ShipIt",
    "-\t0\tcom.noldova.desktop.ShipItHelper",
    "4512\t0\tcom.noldova.desktop.ShipIt",
    "-\t78\tcom.apple.example",
    String.empty
  ].join("\n");

  @TestMethod
  public async findsTheProcessOfItsApplicationsShipItJob(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const shipIt = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));

    const processId = await shipIt.findAsync();

    Assert.areEqual(4512, processId);
    Assert.areEqual(JSON.stringify([["/bin/launchctl", ["list"]]]), JSON.stringify(calls));
  }

  @TestMethod
  public async findsNoProcessWhenTheJobIsNotRunningOrNotListed(): Promise<void> {
    const stopped = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand([], "PID\tStatus\tLabel\n-\t0\tcom.noldova.desktop.ShipIt\n"));
    const missing = new ShipItProcess("com.noldova.desktop.development", ShipItProcessTests.createCommand([], ShipItProcessTests.LIST));

    Assert.isNull(await stopped.findAsync());
    Assert.isNull(await missing.findAsync());
  }

  @TestMethod
  public async findsTheProcessOfAShipItJobInTheSystemDomainWhenTheUsersDomainHasNone(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const shipIt = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createDomainsCommand(calls, ShipItProcessTests.describeSystemJob("\tstate = running\n\tpid = 4600\n")));

    const processId = await shipIt.findAsync();

    Assert.areEqual(4600, processId);
    Assert.areEqual(JSON.stringify([["/bin/launchctl", ["list"]], ["/bin/launchctl", ["print", "system/com.noldova.desktop.ShipIt"]]]), JSON.stringify(calls));
  }

  @TestMethod
  public async findsNoProcessWhenTheSystemDomainsShipItJobIsNotRunningOrCannotBeRead(): Promise<void> {
    const stopped = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createDomainsCommand([], ShipItProcessTests.describeSystemJob("\tstate = not running\n")));
    const unread = new ShipItProcess(ShipItProcessTests.BUNDLE, {
      runAsync: (_file: string, commandArguments: readonly string[]) => commandArguments[0] === "list" ? Promise.resolve("PID\tStatus\tLabel\n")
        : Promise.reject(new CommandFailedException("/bin/launchctl", new Error("Could not find service \"com.noldova.desktop.ShipIt\" in domain for system")))
    });

    Assert.isNull(await stopped.findAsync());
    Assert.isNull(await unread.findAsync());
  }

  @TestMethod
  public async removesItsJobOnlyWhenItIsListed(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const listed = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));
    const unlisted = new ShipItProcess("com.noldova.desktop.development", ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));

    await listed.removeAsync();
    await unlisted.removeAsync();

    Assert.areEqual(JSON.stringify([["/bin/launchctl", ["list"]], ["/bin/launchctl", ["remove", "com.noldova.desktop.ShipIt"]], ["/bin/launchctl", ["list"]]]),
      JSON.stringify(calls));
  }

  @TestMethod
  public async removesOnlyAStoppedJobAtStart(): Promise<void> {
    const calls: [string, readonly string[]][] = [];
    const running = new ShipItProcess(ShipItProcessTests.BUNDLE, ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));
    const stopped = new ShipItProcess(ShipItProcessTests.BUNDLE,
      ShipItProcessTests.createCommand(calls, "PID\tStatus\tLabel\n-\t0\tcom.noldova.desktop.ShipIt\n"));
    const unlisted = new ShipItProcess("com.noldova.desktop.development", ShipItProcessTests.createCommand(calls, ShipItProcessTests.LIST));

    await running.removeStoppedAsync();
    await stopped.removeStoppedAsync();
    await unlisted.removeStoppedAsync();

    Assert.areEqual(JSON.stringify([
      ["/bin/launchctl", ["list"]], ["/bin/launchctl", ["list"]], ["/bin/launchctl", ["remove", "com.noldova.desktop.ShipIt"]], ["/bin/launchctl", ["list"]]
    ]), JSON.stringify(calls));
  }

  @TestMethod
  public async reportsJobsThatCannotBeListedOrAJobThatCannotBeRemoved(): Promise<void> {
    const cause = new CommandFailedException("/bin/launchctl", new Error("Bad request."));
    const unlisted = new ShipItProcess(ShipItProcessTests.BUNDLE, { runAsync: () => Promise.reject(cause) });
    const unremovable = new ShipItProcess(ShipItProcessTests.BUNDLE, {
      runAsync: (_file: string, commandArguments: readonly string[]) => commandArguments[0] === "list" ? Promise.resolve(ShipItProcessTests.LIST) : Promise.reject(cause)
    });

    const unread = await Assert.throwsAsync(() => unlisted.findAsync(), ShipItUnreadableException);
    const unremoved = await Assert.throwsAsync(() => unremovable.removeAsync(), ShipItNotRemovedException);

    Assert.areEqual(`The installer process of the staged update could not be looked up: ${String(cause)}`, unread.message);
    Assert.areEqual(cause, unread.cause);
    Assert.isTrue(unremoved.message.startsWith("The staged update could not be withdrawn, so it may install when "), unremoved.message);
    Assert.isTrue(unremoved.message.endsWith(` quits: ${String(cause)}`), unremoved.message);
    Assert.areEqual(cause, unremoved.cause);
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async findsAndRemovesARealLaunchdJobThatLoadsInTheBackgroundSessionOfARunnerWithNoOneLoggedIn(): Promise<void> {
    const bundle = `com.noldova.desktop.test-${randomUUID()}`;
    const command = new SystemCommand();
    const shipIt = new ShipItProcess(bundle, command);
    const folder = await mkdtemp(path.join(os.tmpdir(), "ship-it-process-"));
    const domain = `user/${process.getuid?.() ?? 0}`;
    try {
      await command.runAsync("/bin/launchctl", ["bootstrap", domain, await ShipItProcessTests.writeJobAsync(folder, `${bundle}.ShipIt`)]);
      let processId: number | null = null;
      await WaitFixture.untilAsync(async () => !Object.isNull(processId = await shipIt.findAsync()), "launchd to list the ShipIt job's process", 10_000, 100);
      Assert.isTrue(Number.isSafeInteger(processId));

      await shipIt.removeAsync();

      await WaitFixture.untilAsync(async () => !(await command.runAsync("/bin/launchctl", ["list"])).includes(`${bundle}.ShipIt`), "launchd to stop listing the removed ShipIt job", 10_000, 100);
      Assert.isNull(await shipIt.findAsync());
    }
    finally {
      await command.runAsync("/bin/launchctl", ["bootout", `${domain}/${bundle}.ShipIt`]).catch(() => undefined);
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async writeJobAsync(folder: string, label: string): Promise<string> {
    const file = path.join(folder, `${label}.plist`);
    await writeFile(file, [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">",
      "<plist version=\"1.0\">",
      "<dict>",
      `  <key>Label</key><string>${label}</string>`,
      "  <key>ProgramArguments</key><array><string>/bin/sleep</string><string>60</string></array>",
      "  <key>RunAtLoad</key><true/>",
      `  <key>LimitLoadToSessionType</key><string>${ShipItProcessTests.RUNNER_SESSION_WITHOUT_A_LOGIN_WINDOW}</string>`,
      "</dict>",
      "</plist>",
      String.empty
    ].join("\n"));
    return file;
  }

  private static describeSystemJob(state: string): string {
    return [
      "system/com.noldova.desktop.ShipIt = {",
      "\tactive count = 1",
      "\tpath = (submitted by smd[104])",
      "\ttype = Submitted",
      state,
      "\tprogram = /Applications/Noldova/Desktop.app/Contents/Frameworks/Squirrel.framework/Resources/ShipIt",
      "\tdomain = system",
      "\tendpoints = {",
      "\t\t\"com.noldova.desktop.ShipIt\" = {",
      "\t\t\tport = 0x12c183",
      "\t\t}",
      "\t}",
      "}",
      String.empty
    ].join("\n");
  }

  private static createDomainsCommand(calls: [string, readonly string[]][], system: string): Pick<SystemCommand, "runAsync"> {
    return {
      runAsync(file: string, commandArguments: readonly string[]): Promise<string> {
        calls.push([file, commandArguments]);
        return Promise.resolve(commandArguments[0] === "print" ? system : "PID\tStatus\tLabel\n811\t0\tcom.example.other.ShipIt\n");
      }
    };
  }

  private static createCommand(calls: [string, readonly string[]][], output: string): Pick<SystemCommand, "runAsync"> {
    return {
      runAsync(file: string, commandArguments: readonly string[]): Promise<string> {
        calls.push([file, commandArguments]);
        return Promise.resolve(output);
      }
    };
  }
}

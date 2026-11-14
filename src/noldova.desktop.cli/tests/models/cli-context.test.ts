/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";
import path from "node:path";
import { PassThrough } from "node:stream";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliContext, MainProcessOpener } from "@noldova/desktop.cli";
import { ChildProcessStarter, RuntimeBuild } from "@noldova/desktop.runtime";

@TestClass
export class CliContextTests {
  @TestMethod
  public startsTheRuntimeDirectlyAndTheMainProcessDetachedByDefault(): void {
    const streams = new PassThrough();
    const signals = new EventEmitter();

    const entry = path.join("/opt", "noldova-desktop", "node_modules", "@noldova", "desktop.runtime", "services", "runtime-entry.js");

    const context = new CliContext({ A: "1" }, "linux", "/home/person", "/opt/noldova-desktop/noldova-desktop", entry, RuntimeBuild.identity, streams, streams, streams, signals);

    Assert.isInstanceOf(context.runtimeStarter, ChildProcessStarter);
    Assert.isInstanceOf(context.mainProcessOpener, MainProcessOpener);
    Assert.areEqual("1", context.environment["A"]);
    Assert.areEqual(`linux/home/person/opt/noldova-desktop/noldova-desktop${entry}`, `${context.platform}${context.homeFolder}${context.executablePath}${context.runtimeEntryPath}`);
    Assert.areEqual(RuntimeBuild.identity, context.identity);
    Assert.areEqual(signals, context.signals);
    Assert.isTrue(context.output === streams && context.error === streams && context.input === streams);
  }
}

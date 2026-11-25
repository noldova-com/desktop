/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, Request, ShellMethods, WindowStateKey, WindowStateWrite } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { HeldOpenFixture } from "../../fixtures/held-open.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class MoveAsideMethodTests {
  @TestMethod
  public refusesUntilDataFromBeforeTheShellIsMovedAside(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const root = fixture.dataDirectory.root;
      using held = new HeldOpenFixture(path.join(root, "desktop.sqlite"));
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, "noldova-desktop.db"), "old data");
      await fixture.startAsync();
      const expected = `{"code":"PreShellData","message":"This data directory holds data from a Noldova Desktop Sample release that predates the shell; move it aside to continue.","details":{"location":${JSON.stringify(root)}}}`;

      const { connection: refused, response: answer } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      refused.sendMessages(
        new Request("main:1", new QualifiedName("notes", "open"), null),
        new Request("main:2", ShellMethods.moveAside, null),
        new Request("main:3", ShellMethods.moveAside, null));
      const responses = [await refused.readResponseAsync(), await refused.readResponseAsync(), await refused.readResponseAsync()];
      await refused.waitForCloseAsync();
      const { connection: admitted, response: admission } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      admitted.sendMessages(new Request("main:4", ShellMethods.moveAside, null));
      const again = await admitted.readResponseAsync();
      const settledAtAnswer = held.settled;

      Assert.areEqual(expected, JSON.stringify(answer.failure?.toJson()));
      Assert.areEqual(expected, JSON.stringify(responses[0]?.failure?.toJson()));
      Assert.areEqual("main:2,main:3", responses.slice(1).map(t => t.id).sort().join(","));
      Assert.isFalse(responses.slice(1).some(t => t.hasFailed));
      Assert.isFalse(admission.hasFailed);
      Assert.isFalse(again.hasFailed);
      Assert.areEqual(0, settledAtAnswer, "the runtime answered while the new database's flush was still held");
      const key = new WindowStateKey("device-1", "main");
      admitted.sendMessages(new Request("main:5", ShellMethods.readWindowBounds, key.toJson()));
      Assert.areEqual("{\"value\":null}", JSON.stringify((await admitted.readResponseAsync()).payload));
      admitted.sendMessages(new Request("main:6", ShellMethods.writeWindowBounds, new WindowStateWrite(key, { width: 900, height: 600 }).toJson()));
      Assert.isFalse((await admitted.readResponseAsync()).hasFailed);
      admitted.sendMessages(new Request("main:7", ShellMethods.readWindowBounds, key.toJson()));
      Assert.areEqual("{\"value\":{\"width\":900,\"height\":600}}", JSON.stringify((await admitted.readResponseAsync()).payload));
      Assert.areEqual(path.join(root, "desktop.sqlite"), held.held.join(","));
      Assert.isTrue(existsSync(path.join(root, "desktop.sqlite")));
      Assert.isFalse(existsSync(path.join(root, "noldova-desktop.db")));
      const moved = (await readdir(fixture.root)).filter(t => t.startsWith("data-before-shell-"));
      Assert.areEqual(1, moved.length);
      Assert.areEqual("noldova-desktop.db", (await readdir(path.join(fixture.root, String(moved[0])))).join(","));
    });
  }

  @TestMethod
  public movesAsideAgainAfterAFailedMove(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const root = fixture.dataDirectory.root;
      await mkdir(root, { recursive: true });
      await writeFile(path.join(root, "noldova-desktop.db"), "old data");
      const now = Date.now();
      const taken = Array.from({ length: 120 }, (_, index) => path.join(fixture.root, `data-before-shell-${new Date(now + (index - 1) * 1_000).toISOString().replace(/[-:]|\.\d+/gu, String.empty)}`));
      await Promise.all(taken.map(t => writeFile(t, String.empty)));
      await fixture.startAsync();

      const { connection: first } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      first.sendMessages(new Request("main:1", ShellMethods.moveAside, null));
      const failed = await first.readResponseAsync();
      await Promise.all(taken.map(t => rm(t)));
      const { connection: second } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      second.sendMessages(new Request("main:2", ShellMethods.moveAside, null));
      const retried = await second.readResponseAsync();

      Assert.isTrue(failed.hasFailed);
      Assert.isFalse(retried.hasFailed, JSON.stringify(retried.failure?.toJson()));
      Assert.isFalse(existsSync(path.join(root, "noldova-desktop.db")));
      const moved = (await readdir(fixture.root)).filter(t => t.startsWith("data-before-shell-"));
      Assert.areEqual(1, moved.length);
      Assert.areEqual("noldova-desktop.db", (await readdir(path.join(fixture.root, String(moved[0])))).join(","));
    });
  }
}

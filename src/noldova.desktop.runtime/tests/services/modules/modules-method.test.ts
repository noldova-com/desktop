/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleStatusList, QualifiedName, Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class ModulesMethodTests {
  @TestMethod
  public activatesItsModulesAndReportsThemToAClientThatAsks(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([new ModuleSourceFixture("notes", RuntimeHostFixture.PART), new ModuleSourceFixture("broken", null)]);
      const host = await fixture.startAsync(30_000, declarations);

      const { connection } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      connection.sendMessages(new Request("main:1", new QualifiedName("notes", "echo"), { text: "hi" }), new Request("main:2", ShellMethods.modules, null));
      const responses = [await connection.readResponseAsync(), await connection.readResponseAsync()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      connection.sendMessages(new Request("main:3", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson()));
      await host.waitForStopAsync();

      Assert.areEqual("{\"text\":\"hi\"}", JSON.stringify(responses[0]?.payload));
      Assert.areEqual(
        "notes notes Active null,broken broken Failed Its runtime part could not be loaded.",
        ModuleStatusList.fromJson(responses[1]?.payload).modules.map(t => `${t.id} ${t.description} ${t.state} ${t.cause}`).join(","));
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateModuleFolder("notes"), "deactivated")));
      Assert.isTrue(/^\S+Z The module broken 0\.0\.1: Its runtime part could not be loaded\.\nError \[ERR_MODULE_NOT_FOUND\]/.test(await readFile(fixture.dataDirectory.runtimeLog, "utf8")));
    });
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class QuitMethodTests {
  @TestMethod
  public answersNoMainProcessAtOnceWhenNoMainProcessIsConnected(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync();
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      const answer = await RuntimeHostFixture.callAsync(cli, "cli:1", ShellMethods.quit, null);

      Assert.areEqual("{\"outcome\":\"NoMainProcess\"}", JSON.stringify(answer.payload));
    });
  }
}

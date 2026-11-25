/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildIdentity, FailureCode, QualifiedName, Request, type Response, ShellMethods, WindowClosed } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class WindowClosedMethodTests {
  private static readonly ECHO: QualifiedName = new QualifiedName("watch", "echo");
  private static readonly OTHER: BuildIdentity = new BuildIdentity(RuntimeBuild.identity.productVersion, BuildIdentity.supportedProtocolVersion, "other-build");
  private static readonly PART: string = [
    "export class RuntimePart {",
    "  async activateAsync(context) {",
    "    const closed = [];",
    "    const waiters = [];",
    "    context.onClientClosed(t => {",
    "      closed.push(`${t.connection}:${t.window}`);",
    "      for (const resolve of waiters.splice(0))",
    "        resolve();",
    "    });",
    "    context.registerMethod(`${context.moduleId}.echo`, { handleAsync: async request => {",
    "      const closures = request.payload?.closures ?? 0;",
    "      while (closed.length < closures)",
    "        await new Promise(resolve => waiters.push(resolve));",
    "      return { connection: request.connection, window: request.window, client: request.client, closed: [...closed] };",
    "    } });",
    "  }",
    String.empty,
    "  async deactivateAsync() {",
    "  }",
    "}",
    String.empty
  ].join("\n");

  @TestMethod
  public givesPartsTheWindowAndReportsItsClosureAfterItsRequestsAndNoneOfItsRequestsAfter(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("watch", WindowClosedMethodTests.PART)]));
      const { connection: mainProcess } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      mainProcess.sendMessages(new Request("main:1", WindowClosedMethodTests.ECHO, null, undefined, 3));
      const first = await mainProcess.readResponseAsync();
      mainProcess.sendMessages(
        new Request("main:2", ShellMethods.windowClosed, new WindowClosed(3).toJson()),
        new Request("main:3", WindowClosedMethodTests.ECHO, null, undefined, 3),
        new Request("main:4", ShellMethods.windowClosed, new WindowClosed(3).toJson()),
        new Request("main:5", WindowClosedMethodTests.ECHO, null, undefined, 4),
        new Request("main:6", ShellMethods.windowClosed, { window: 0 }));
      const answers = await RuntimeHostFixture.readResponsesAsync(mainProcess, 5);
      const fromCli = await RuntimeHostFixture.callAsync(cli, "cli:1", WindowClosedMethodTests.ECHO, { closures: 1 });
      const main = JsonReader.fromValue(first.payload).readInteger("connection");
      const command = JsonReader.fromValue(fromCli.payload).readInteger("connection");

      Assert.areEqual(`{"connection":${main},"window":3,"client":"main","closed":[]}`, WindowClosedMethodTests.describe(first));
      Assert.areEqual("null|null", `${WindowClosedMethodTests.describe(answers.get("main:2"))}|${WindowClosedMethodTests.describe(answers.get("main:4"))}`);
      Assert.areEqual(
        "NotFound: Window 3 of this connection has closed, so the runtime takes no more requests from it.",
        `${answers.get("main:3")?.failure?.code}: ${answers.get("main:3")?.failure?.message}`);
      Assert.areEqual(`{"connection":${main},"window":4,"client":"main","closed":["${main}:3"]}`, WindowClosedMethodTests.describe(answers.get("main:5")));
      Assert.areEqual(FailureCode.InvalidParams, answers.get("main:6")?.failure?.code);
      Assert.areEqual(`{"connection":${command},"window":null,"client":"cli","closed":["${main}:3"]}`, WindowClosedMethodTests.describe(fromCli));
    });
  }

  @TestMethod
  public reportsAConnectionOnceWhenItEndsAndNoneOfAnotherBuild(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("watch", WindowClosedMethodTests.PART)]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const { connection: quitting } = await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const { connection: otherBuild } = await fixture.handshakeAsync("main", WindowClosedMethodTests.OTHER);
      const first = await RuntimeHostFixture.callAsync(quitting, "main:1", WindowClosedMethodTests.ECHO, null);

      otherBuild[Symbol.dispose]();
      await otherBuild.waitForCloseAsync();
      quitting[Symbol.dispose]();
      const afterQuit = await RuntimeHostFixture.callAsync(cli, "cli:1", WindowClosedMethodTests.ECHO, { closures: 1 });

      const quit = JsonReader.fromValue(first.payload).readInteger("connection");
      Assert.areEqual(`["${quit}:null"]`, JSON.stringify(JsonReader.fromValue(afterQuit.payload).readValue("closed")));
    });
  }

  private static describe(response: Response | undefined): string {
    return JSON.stringify(response?.payload ?? null);
  }
}

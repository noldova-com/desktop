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
import { type Event, SecretAction, SecretAnswered, SecretCommand, ShellClients, ShellEvents, ShellMethods } from "@noldova/desktop.protocol";
import { DataDirectory, DiscoveryReader, Endpoint, RuntimeBuild, RuntimeClient } from "@noldova/desktop.runtime";

import { CliFixture } from "../fixtures/cli.fixture.js";
import { ProbeBuildFixture } from "../fixtures/probe-build.fixture.js";

@TestClass
export class CliSecretsTests {
  @TestMethod
  public async sendsItsOwnModulesSecretsToTheRuntimeRefusesAnotherModulesAndNeverReadsOne(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);

    const result = await fixture.runModuleAsync(build, ["probe", "use-secrets", "--json"]);
    const answer = JsonReader.parse(result.output);
    const results = answer.readStringArray("results");

    Assert.areEqual(0, result.code, result.error);
    Assert.areEqual("The module probe may only use its own secrets, not needy.token. (Parameter 'name')", answer.readString("refusal"));
    Assert.areEqual(4, results.filter(t => t.startsWith("Open ") && t.includes(" to use secrets on this machine")).length, results.join("\n"));
    Assert.isFalse(answer.readBoolean("reads"));
  }

  @TestMethod
  public async savesChecksAndRemovesItsOwnSecretOnceTheMainProcessIsConnected(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    await using build = await ProbeBuildFixture.createAsync("1.0.0", true);
    await fixture.startHostAsync(build.declarationsFile);
    const actions: string[] = [];
    const mainProcess = await CliSecretsTests.connectMainProcessAsync(fixture, actions);

    const result = await fixture.runModuleAsync(build, ["probe", "use-secrets", "--json"]);
    mainProcess.close();

    Assert.areEqual(0, result.code, result.error);
    Assert.areEqual("[null,true,null,false]", JSON.stringify(JsonReader.parse(result.output).readValue("results")));
    Assert.areEqual("Device,Encrypt", actions.join(","));
  }

  private static async connectMainProcessAsync(fixture: CliFixture, actions: string[]): Promise<RuntimeClient> {
    const discovery = await DiscoveryReader.readAsync(new DataDirectory(fixture.dataDirectory));
    const connected = Promise.withResolvers<RuntimeClient>();
    const client = await RuntimeClient.connectAsync(Endpoint.parse(String(discovery?.endpoint)), String(discovery?.token), RuntimeBuild.identity, ShellClients.mainProcess, {
      onEvent: (event: Event) => {
        if (!event.name.equals(ShellEvents.secretCommand))
          return;
        const command = SecretCommand.fromJson(event.payload);
        actions.push(command.action);
        const value = command.action === SecretAction.Device ? "device-1" : "c2VhbGVk";
        void connected.promise.then(t => t.callAsync(ShellMethods.secretAnswered, new SecretAnswered(command.call, value).toJson()));
      },
      onDisconnected: () => undefined
    });
    connected.resolve(client);
    return client;
  }
}

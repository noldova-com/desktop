/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { type JsonValue, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  FailureCode, QualifiedName, Request, type Response, SecretAnswered, SecretFailureKind, SecretFailures, SecretReference, SecretValue, SettingKey, SettingValue, ShellEvents,
  ShellMethods
} from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { CliAndMainFixture } from "../../fixtures/cli-and-main.fixture.js";
import { ModuleSourceFixture } from "../../fixtures/module-source.fixture.js";
import type { RawConnectionFixture } from "../../fixtures/raw-connection.fixture.js";
import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";
import { UpdateBarrierFixture } from "../../fixtures/update-barrier.fixture.js";

@TestClass
export class MachineSecretBackendTests {
  private static readonly ECHO: QualifiedName = QualifiedName.parse("vault.echo");
  private static readonly KEY: QualifiedName = QualifiedName.parse("vault.key");
  private static readonly TOKEN: QualifiedName = QualifiedName.parse("vault.token");

  @TestMethod
  public refusesEveryCallWithUnavailableWhileTheAppsMainProcessHasNeverConnected(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const reference = new SecretReference(MachineSecretBackendTests.TOKEN).toJson();

      const answers = [
        await MachineSecretBackendTests.callAsync(cli, "cli:1", ShellMethods.saveSecret, new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson()),
        await MachineSecretBackendTests.callAsync(cli, "cli:2", ShellMethods.removeSecret, reference),
        await MachineSecretBackendTests.callAsync(cli, "cli:3", ShellMethods.secretStatus, reference)
      ];
      const read = await MachineSecretBackendTests.callAsync(cli, "cli:4", MachineSecretBackendTests.ECHO, { op: "read", name: "vault.token" });

      for (const answer of answers) {
        Assert.areEqual(FailureCode.Unavailable, answer.failure?.code);
        Assert.isTrue(answer.failure?.message.startsWith("Open ") === true);
      }
      Assert.areEqual("NotConnected,NotConnected,NotConnected", answers.map(t => MachineSecretBackendTests.reasonOf(t)).join(","));
      Assert.areEqual("Unavailable NotConnected", MachineSecretBackendTests.partFailureOf(read));
    });
  }

  @TestMethod
  public savesReadsReplacesAndRemovesThroughTheMainProcessAndKeepsOnlyTheCiphertextForItsDevice(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const { connection: main } = await fixture.handshakeAsync("main", RuntimeBuild.identity, false);
      const reference = new SecretReference(MachineSecretBackendTests.TOKEN).toJson();
      const device: JsonValue[] = [];

      const before = await MachineSecretBackendTests.answerAsync(cli, main, device, new Request("cli:1", ShellMethods.secretStatus, reference), new SecretAnswered(1, "device-1"));
      const commands: JsonValue[] = [];
      const saved = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:2", ShellMethods.saveSecret,
        new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson()), new SecretAnswered(2, "c2VhbGVkLTE="));
      const set = await MachineSecretBackendTests.callAsync(cli, "cli:3", ShellMethods.secretStatus, reference);
      const read = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:4", MachineSecretBackendTests.ECHO,
        { op: "read", name: "vault.token" }), new SecretAnswered(3, "s3cret"));
      await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:5", MachineSecretBackendTests.ECHO,
        { op: "save", name: "vault.token", value: "n3w-s3cret" }), new SecretAnswered(4, "c2VhbGVkLTI="));
      const replaced = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:6", MachineSecretBackendTests.ECHO,
        { op: "read", name: "vault.token" }), new SecretAnswered(5, "n3w-s3cret"));
      const removed = await MachineSecretBackendTests.callAsync(cli, "cli:7", ShellMethods.removeSecret, reference);
      const after = await MachineSecretBackendTests.callAsync(cli, "cli:8", ShellMethods.secretStatus, reference);
      const gone = await MachineSecretBackendTests.callAsync(cli, "cli:9", MachineSecretBackendTests.ECHO, { op: "read", name: "vault.token" });
      fixture.host.requestStop("test");
      await fixture.host.waitForStopAsync();
      const files = await MachineSecretBackendTests.readFilesAsync(fixture.dataDirectory.root);

      Assert.areEqual("[{\"call\":1,\"action\":\"Device\"}]", JSON.stringify(device));
      Assert.areEqual([
        "{\"call\":2,\"action\":\"Encrypt\",\"value\":\"s3cret\"}", "{\"call\":3,\"action\":\"Decrypt\",\"value\":\"c2VhbGVkLTE=\"}",
        "{\"call\":4,\"action\":\"Encrypt\",\"value\":\"n3w-s3cret\"}", "{\"call\":5,\"action\":\"Decrypt\",\"value\":\"c2VhbGVkLTI=\"}"
      ].join("\n"), commands.map(t => JSON.stringify(t)).join("\n"));
      Assert.areEqual("false,null,true,{\"value\":\"s3cret\"},{\"value\":\"n3w-s3cret\"},null,false,{\"value\":null}",
        [before, saved, set, read, replaced, removed, after, gone].map(t => JSON.stringify(t.payload)).join(","));
      Assert.isTrue(files.length > 0);
      Assert.isFalse(files.some(t => t.includes("s3cret")));
    });
  }

  @TestMethod
  public takesAnswersOnlyFromTheMainProcessItAskedAndKeepsItsDeviceForRemovingAndStatusOnceItGoes(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const { connection: main } = await fixture.handshakeAsync("main", RuntimeBuild.identity, false);
      const reference = new SecretReference(MachineSecretBackendTests.TOKEN).toJson();
      await MachineSecretBackendTests.answerAsync(cli, main, [], new Request("cli:0", ShellMethods.secretStatus, reference), new SecretAnswered(1, "device-1"));

      cli.sendMessages(new Request("cli:1", ShellMethods.saveSecret, new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson()));
      const encrypt = await UpdateBarrierFixture.readEventAsync(main, ShellEvents.secretCommand);
      cli.sendMessages(new Request("cli:2", ShellMethods.secretAnswered, new SecretAnswered(2, "Zm9yZ2Vk").toJson()));
      const first = await RuntimeHostFixture.readAnswerAsync(cli);
      const second = await MachineSecretBackendTests.callAsync(main, "main:2", ShellMethods.secretAnswered, new SecretAnswered(99, "Zm9yZ2Vk").toJson());
      cli.sendMessages(new Request("cli:3", ShellMethods.saveSecret, new SecretValue(MachineSecretBackendTests.KEY, "k3y").toJson()));
      await UpdateBarrierFixture.readEventAsync(main, ShellEvents.secretCommand);
      main[Symbol.dispose]();
      const answers = [await RuntimeHostFixture.readAnswerAsync(cli), await RuntimeHostFixture.readAnswerAsync(cli)];
      const status = await MachineSecretBackendTests.callAsync(cli, "cli:4", ShellMethods.secretStatus, reference);
      const removed = await MachineSecretBackendTests.callAsync(cli, "cli:5", ShellMethods.removeSecret, reference);
      const saved = await MachineSecretBackendTests.callAsync(cli, "cli:6", ShellMethods.saveSecret, new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson());

      Assert.areEqual("{\"call\":2,\"action\":\"Encrypt\",\"value\":\"s3cret\"}", JSON.stringify(encrypt.payload));
      Assert.areEqual("cli:2,main:2", [first, second].map(t => t.id).join(","));
      Assert.areEqual("cli:1,cli:3", answers.map(t => t.id).sort().join(","));
      Assert.isTrue(answers.every(t => t.failure?.code === FailureCode.Unavailable));
      Assert.areEqual("false,null", [status, removed].map(t => JSON.stringify(t.payload)).join(","));
      Assert.areEqual(FailureCode.Unavailable, saved.failure?.code);
      Assert.areEqual("NotConnected,NotConnected,NotConnected", [...answers, saved].map(t => MachineSecretBackendTests.reasonOf(t)).join(","));
    });
  }

  @TestMethod
  public turnsTheMainProcesssFailuresIntoReasonsAModuleCanShowNamingNoValue(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const { connection: main } = await fixture.handshakeAsync("main", RuntimeBuild.identity, false);
      const reference = new SecretReference(MachineSecretBackendTests.TOKEN).toJson();
      const value = new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson();
      const commands: JsonValue[] = [];

      const noDevice = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:1", ShellMethods.secretStatus, reference),
        new SecretAnswered(1, null, SecretFailureKind.NoDevice));
      await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:2", ShellMethods.secretStatus, reference), new SecretAnswered(2, "device-1"));
      const unprotected = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:3", ShellMethods.saveSecret, value),
        new SecretAnswered(3, null, SecretFailureKind.Unprotected));
      const unset = await MachineSecretBackendTests.callAsync(cli, "cli:4", ShellMethods.secretStatus, reference);
      await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:5", ShellMethods.saveSecret, value), new SecretAnswered(4, "c2VhbGVk"));
      const undecryptable = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:6", MachineSecretBackendTests.ECHO,
        { op: "read", name: "vault.token" }), new SecretAnswered(5, null, SecretFailureKind.Undecryptable));
      const unreadable = await MachineSecretBackendTests.answerAsync(cli, main, commands, new Request("cli:7", MachineSecretBackendTests.ECHO,
        { op: "read", name: "vault.token" }), new SecretAnswered(6, null, SecretFailureKind.Unprotected));
      const other = await MachineSecretBackendTests.callAsync(cli, "cli:8", MachineSecretBackendTests.ECHO, { op: "read", name: "clock.token" });

      Assert.areEqual(FailureCode.Unavailable, noDevice.failure?.code);
      Assert.isTrue(noDevice.failure?.message.includes("no device identity") === true);
      Assert.areEqual(FailureCode.Unavailable, unprotected.failure?.code);
      Assert.isTrue(unprotected.failure?.message.includes("nothing was saved") === true);
      Assert.areEqual("false", JSON.stringify(unset.payload));
      Assert.areEqual("NoDevice,Unprotected", [noDevice, unprotected].map(t => MachineSecretBackendTests.reasonOf(t)).join(","));
      Assert.areEqual("{\"error\":\"MethodFailureException\",\"code\":\"Unavailable\",\"message\":\"This machine's secret store can't decrypt the secret vault.token; save it again.\",\"reason\":\"Undecryptable\"}",
        JSON.stringify(undecryptable.payload));
      const unreadableMessage = JsonReader.fromValue(unreadable.payload).readString("message");
      Assert.areEqual("Unavailable Unprotected", MachineSecretBackendTests.partFailureOf(unreadable));
      Assert.isTrue(unreadableMessage.includes("can read the secret vault.token from safely") && !unreadableMessage.includes("saved"), unreadableMessage);
      Assert.areEqual("{\"error\":\"SecretNotOwnedException\",\"code\":null,\"message\":\"The module vault may only use its own secrets, not clock.token.\",\"reason\":null}", JSON.stringify(other.payload));
      Assert.isFalse([noDevice, unprotected, undecryptable, unreadable].some(t => JSON.stringify(t).includes("s3cret")));
    });
  }

  @TestMethod
  public appliesASaveStillWaitingForItsCiphertextBeforeARemoveAskedAfterItSoTheRemoveStands(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      await fixture.startAsync(30_000, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const { connection: main } = await fixture.handshakeAsync("main", RuntimeBuild.identity, false);
      const reference = new SecretReference(MachineSecretBackendTests.TOKEN).toJson();
      await MachineSecretBackendTests.answerAsync(cli, main, [], new Request("cli:1", ShellMethods.secretStatus, reference), new SecretAnswered(1, "device-1"));

      cli.sendMessages(new Request("cli:2", ShellMethods.saveSecret, new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson()));
      const encrypt = await UpdateBarrierFixture.readEventAsync(main, ShellEvents.secretCommand);
      cli.sendMessages(new Request("cli:3", ShellMethods.removeSecret, reference), new Request("cli:4", ShellMethods.secretStatus, reference));
      const waiting = await RuntimeHostFixture.readAnswerAsync(cli);
      await MachineSecretBackendTests.callAsync(main, "main:2", ShellMethods.secretAnswered, new SecretAnswered(2, "c2VhbGVk").toJson());
      const answers = [await RuntimeHostFixture.readAnswerAsync(cli), await RuntimeHostFixture.readAnswerAsync(cli)];
      const after = await MachineSecretBackendTests.callAsync(cli, "cli:5", ShellMethods.secretStatus, reference);

      Assert.areEqual("{\"call\":2,\"action\":\"Encrypt\",\"value\":\"s3cret\"}", JSON.stringify(encrypt.payload));
      Assert.areEqual("cli:4 false", `${waiting.id} ${JSON.stringify(waiting.payload)}`);
      Assert.areEqual("cli:2 null,cli:3 null", answers.map(t => `${t.id} ${JSON.stringify(t.payload)}`).sort().join(","));
      Assert.areEqual("false", JSON.stringify(after.payload));
    });
  }

  @TestMethod
  public keepsEachDevicesSecretsApartSoAnotherDeviceNeitherSeesReadsNorRemovesThem(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const declarations = await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]);
      const reference = new SecretReference(MachineSecretBackendTests.TOKEN).toJson();

      const { cli, main } = await MachineSecretBackendTests.startWithMainAsync(fixture, declarations);
      await MachineSecretBackendTests.answerAsync(cli, main, [], new Request("cli:1", ShellMethods.secretStatus, reference), new SecretAnswered(1, "device-1"));
      await MachineSecretBackendTests.answerAsync(cli, main, [], new Request("cli:2", ShellMethods.saveSecret,
        new SecretValue(MachineSecretBackendTests.TOKEN, "s3cret").toJson()), new SecretAnswered(2, "c2VhbGVk"));
      await MachineSecretBackendTests.stopAsync(fixture);
      const { cli: otherCli, main: otherMain } = await MachineSecretBackendTests.startWithMainAsync(fixture, declarations);
      const otherStatus = await MachineSecretBackendTests.answerAsync(otherCli, otherMain, [], new Request("cli:1", ShellMethods.secretStatus, reference),
        new SecretAnswered(1, "device-2"));
      const otherRead = await MachineSecretBackendTests.callAsync(otherCli, "cli:2", MachineSecretBackendTests.ECHO, { op: "read", name: "vault.token" });
      const otherRemoved = await MachineSecretBackendTests.callAsync(otherCli, "cli:3", ShellMethods.removeSecret, reference);
      await MachineSecretBackendTests.stopAsync(fixture);
      const { cli: firstCli, main: firstMain } = await MachineSecretBackendTests.startWithMainAsync(fixture, declarations);
      const kept = await MachineSecretBackendTests.answerAsync(firstCli, firstMain, [], new Request("cli:1", ShellMethods.secretStatus, reference),
        new SecretAnswered(1, "device-1"));

      Assert.areEqual("false,{\"value\":null},null,true", [otherStatus, otherRead, otherRemoved, kept].map(t => JSON.stringify(t.payload)).join(","));
    });
  }

  @TestMethod
  public asksTheMainProcessForItsDeviceOnceItConnectsSoAModuleReadsThatDevicesSetting(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const { cli, main } = await MachineSecretBackendTests.startWithMainAsync(fixture, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      const asked = await UpdateBarrierFixture.readEventAsync(main, ShellEvents.secretCommand);
      const checks = (device: string): JsonValue => new SettingValue(new SettingKey(QualifiedName.parse("desktop.updateChecks"), null, device), "OnRequest").toJson();
      await MachineSecretBackendTests.callAsync(main, "main:1", ShellMethods.setSetting, checks("device-1"));
      const before = await MachineSecretBackendTests.callAsync(cli, "cli:1", MachineSecretBackendTests.ECHO, { op: "setting" });
      await MachineSecretBackendTests.callAsync(main, "main:2", ShellMethods.secretAnswered, new SecretAnswered(1, "device-1").toJson());
      const after = await MachineSecretBackendTests.callAsync(cli, "cli:2", MachineSecretBackendTests.ECHO, { op: "setting" });
      const status = await MachineSecretBackendTests.callAsync(cli, "cli:3", ShellMethods.secretStatus, new SecretReference(MachineSecretBackendTests.TOKEN).toJson());

      Assert.areEqual("{\"call\":1,\"action\":\"Device\"} {\"value\":\"Automatic\"} {\"value\":\"OnRequest\"} false",
        [asked.payload, before.payload, after.payload, status.payload].map(t => JSON.stringify(t)).join(" "));
    });
  }

  @TestMethod
  public logsThatItDoesNotKnowItsDeviceWhenTheMainProcessCannotSayAndModulesReadTheDefaultAndAsksAgainForASecret(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const { cli, main } = await MachineSecretBackendTests.startWithMainAsync(fixture, await fixture.writeModulesAsync([new ModuleSourceFixture("vault", MachineSecretBackendTests.createPart())]));
      await UpdateBarrierFixture.readEventAsync(main, ShellEvents.secretCommand);
      await MachineSecretBackendTests.callAsync(main, "main:1", ShellMethods.secretAnswered, new SecretAnswered(1, null, SecretFailureKind.NoDevice).toJson());
      const read = await MachineSecretBackendTests.callAsync(cli, "cli:1", MachineSecretBackendTests.ECHO, { op: "setting" });
      const asked: JsonValue[] = [];
      const status = await MachineSecretBackendTests.answerAsync(cli, main, asked, new Request("cli:2", ShellMethods.secretStatus,
        new SecretReference(MachineSecretBackendTests.TOKEN).toJson()), new SecretAnswered(2, "device-1"));
      await MachineSecretBackendTests.stopAsync(fixture);
      const log = await readFile(fixture.dataDirectory.runtimeLog, "utf8");

      Assert.areEqual("{\"value\":\"Automatic\"} [{\"call\":2,\"action\":\"Device\"}] false",
        [read.payload, asked, status.payload].map(t => JSON.stringify(t)).join(" "));
      Assert.isTrue(log.includes("The runtime doesn't know which device it serves, so a module reading a device setting gets its default: "));
    });
  }

  private static async startWithMainAsync(fixture: RuntimeHostFixture, declarations: string): Promise<CliAndMainFixture> {
    await fixture.startAsync(30_000, declarations);
    const { connection: cli } = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
    const { connection: main } = await fixture.handshakeAsync("main", RuntimeBuild.identity, false);
    return new CliAndMainFixture(cli, main);
  }

  private static async stopAsync(fixture: RuntimeHostFixture): Promise<void> {
    fixture.host.requestStop("test");
    await fixture.host.waitForStopAsync();
  }

  private static async callAsync(connection: RawConnectionFixture, id: string, method: QualifiedName, payload: JsonValue): Promise<Response> {
    connection.sendMessages(new Request(id, method, payload));
    return RuntimeHostFixture.readAnswerAsync(connection);
  }

  private static async answerAsync(client: RawConnectionFixture, main: RawConnectionFixture, commands: JsonValue[], request: Request, answer: SecretAnswered): Promise<Response> {
    client.sendMessages(request);
    commands.push((await UpdateBarrierFixture.readEventAsync(main, ShellEvents.secretCommand)).payload);
    await MachineSecretBackendTests.callAsync(main, `main:${answer.call}`, ShellMethods.secretAnswered, answer.toJson());
    return RuntimeHostFixture.readAnswerAsync(client);
  }

  private static async readFilesAsync(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { recursive: true, withFileTypes: true });
    return Promise.all(entries.filter(t => t.isFile()).map(t => readFile(path.join(t.parentPath, t.name), "latin1")));
  }

  private static reasonOf(response: Response): string {
    return Object.isUndefined(response.failure) ? "none" : String(SecretFailures.reasonOf(response.failure));
  }

  private static partFailureOf(response: Response): string {
    const failure = JsonReader.fromValue(response.payload);
    return `${String(failure.readNullableString("code"))} ${String(failure.readNullableString("reason"))}`;
  }

  private static createPart(): string {
    return [
      "export class RuntimePart {",
      "  async activateAsync(context) {",
      "    context.registerMethod(\"vault.echo\", { handleAsync: async request => {",
      "      const { op, name, value } = request.payload;",
      "      if (op === \"setting\")",
      "        return { value: context.settings.read(\"desktop.updateChecks\") };",
      "      try {",
      "        if (op === \"save\")",
      "          return (await context.secrets.saveAsync(name, value)) ?? null;",
      "        return { value: await context.secrets.readAsync(name) };",
      "      }",
      "      catch (error) {",
      "        return { error: error.name, code: error.failure?.code ?? null, message: error.message, reason: error.failure?.details?.reason ?? null };",
      "      }",
      "    } });",
      "  }",
      String.empty,
      "  async deactivateAsync() {",
      "  }",
      "}",
      String.empty
    ].join("\n");
  }
}

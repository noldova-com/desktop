/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Event, FailureCode, Response, SecretAction, SecretCommand, ShellEvents } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";
import { FakeDeviceIdentity } from "../fixtures/fake-device-identity.fixture.js";
import { FakeElectron } from "../fixtures/fake-electron.fixture.js";
import { FakeRuntimeConnection } from "../fixtures/fake-runtime-connection.fixture.js";
import { FakeRuntimeLauncher } from "../fixtures/fake-runtime-launcher.fixture.js";

@TestClass
export class SecretAnswererTests {
  private calls: number = 0;

  @TestMethod
  public async namesTheDeviceAndEncryptsAndDecryptsWithTheSystemsKeyring(): Promise<void> {
    const [electron, launcher, connection] = await SecretAnswererTests.startAsync();

    const device = await this.commandAsync(launcher, connection, SecretAction.Device);
    const sealed = await this.commandAsync(launcher, connection, SecretAction.Encrypt, "s3cret");
    const opened = await this.commandAsync(launcher, connection, SecretAction.Decrypt, String(sealed["value"]));

    Assert.areEqual(JSON.stringify({ call: 1, value: FakeDeviceIdentity.ID }), JSON.stringify(device));
    Assert.areEqual(Buffer.from("sealed:s3cret").toString("base64"), sealed["value"]);
    Assert.areEqual(JSON.stringify({ call: 3, value: "s3cret" }), JSON.stringify(opened));
    Assert.areEqual("s3cret", electron.safeStorage.encrypted.join(","));
  }

  @TestMethod
  public async refusesWithoutADeviceIdentityAKeyringOrACiphertextItCanDecrypt(): Promise<void> {
    const identity = new FakeDeviceIdentity();
    identity.failure = new Error("The device folder can't be read.");
    const [electron, launcher, connection] = await SecretAnswererTests.startAsync("linux", identity);

    const noDevice = await this.commandAsync(launcher, connection, SecretAction.Device);
    const undecryptable = await this.commandAsync(launcher, connection, SecretAction.Decrypt, "AAEC");
    electron.safeStorage.encryptFailure = new Error("The keychain refused.");
    const refusedEncrypt = await this.commandAsync(launcher, connection, SecretAction.Encrypt, "s3cret");
    electron.safeStorage.encryptFailure = null;
    electron.safeStorage.isAvailable = false;
    const unavailable = await this.commandAsync(launcher, connection, SecretAction.Encrypt, "s3cret");

    Assert.areEqual(JSON.stringify({ call: 1, failure: "NoDevice" }), JSON.stringify(noDevice));
    Assert.areEqual(JSON.stringify({ call: 2, failure: "Undecryptable" }), JSON.stringify(undecryptable));
    Assert.areEqual(JSON.stringify({ call: 3, failure: "Unprotected" }), JSON.stringify(refusedEncrypt));
    Assert.areEqual(JSON.stringify({ call: 4, failure: "Unprotected" }), JSON.stringify(unavailable));
    Assert.areEqual(0, electron.safeStorage.encrypted.length);
  }

  @TestMethod
  public async refusesLinuxsFallbackTextKeyButNotTheBackendNameElsewhere(): Promise<void> {
    const answers: JsonValue[] = [];
    for (const [platform, backend] of [["linux", "basic_text"], ["linux", "unknown"], ["linux", "kwallet6"], ["win32", "unknown"], ["darwin", "unknown"]] as const) {
      const [electron, launcher, connection] = await SecretAnswererTests.startAsync(platform);
      electron.safeStorage.backend = backend;
      const answer = await this.commandAsync(launcher, connection, SecretAction.Encrypt, "s3cret");
      answers.push(answer["failure"] ?? "sealed");
    }

    Assert.areEqual("Unprotected,Unprotected,sealed,sealed,sealed", answers.join(","));
  }

  @TestMethod
  public async refusesToDecryptWithoutAKeyringOrWithLinuxsFallbackTextKeyAndDecryptsNothing(): Promise<void> {
    const [electron, launcher, connection] = await SecretAnswererTests.startAsync("linux");
    const sealed = Buffer.from("sealed:s3cret").toString("base64");

    electron.safeStorage.isAvailable = false;
    const noKeyring = await this.commandAsync(launcher, connection, SecretAction.Decrypt, sealed);
    electron.safeStorage.isAvailable = true;
    electron.safeStorage.backend = "basic_text";
    const fallback = await this.commandAsync(launcher, connection, SecretAction.Decrypt, sealed);
    const refused = electron.safeStorage.decrypted.length;
    electron.safeStorage.backend = "gnome_libsecret";
    const opened = await this.commandAsync(launcher, connection, SecretAction.Decrypt, sealed);

    Assert.areEqual(JSON.stringify({ call: 1, failure: "Unprotected" }), JSON.stringify(noKeyring));
    Assert.areEqual(JSON.stringify({ call: 2, failure: "Unprotected" }), JSON.stringify(fallback));
    Assert.areEqual(0, refused);
    Assert.areEqual(JSON.stringify({ call: 3, value: "s3cret" }), JSON.stringify(opened));
  }

  @TestMethod
  public async logsACommandThatIsNotValidWithoutItsValueAndLeavesItUnanswered(): Promise<void> {
    const [, launcher, connection, process] = await SecretAnswererTests.startAsync();

    launcher.listener?.onEvent(new Event(ShellEvents.secretCommand, { call: 1, action: "Device", value: "s3cret" }));
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(process, "The runtime sent a secret command that is not valid, so it was not answered: ").length === 1);

    Assert.areEqual(0, SecretAnswererTests.answers(connection).length);
    Assert.areEqual(1, MainProcessStartFixture.readErrors(process, "The runtime sent a secret command that is not valid, so it was not answered: ").length);
    Assert.isFalse(process.errors.includes("s3cret"));
  }

  @TestMethod
  public async letsAWindowSaveRemoveAndCheckASecretButNeverAnswerOne(): Promise<void> {
    const platform = "linux";
    const [electron, , connection] = await SecretAnswererTests.startAsync(platform);
    const event = MainProcessStartFixture.trustedEvent(platform, MainProcessStartFixture.firstWindow(electron).webContents.id);
    electron.ipcMain.send("desktop:page", event, "first");

    const saved = Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, "desktop.saveSecret", { name: "notes.syncToken", value: "s3cret" }, "first"));
    const status = Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, "desktop.secretStatus", { name: "notes.syncToken" }, "first"));
    const removed = Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, "desktop.removeSecret", { name: "notes.syncToken" }, "first"));
    const answered = Response.fromJson(await electron.ipcMain.invoke("desktop:request", event, "desktop.secretAnswered", { call: 1, value: "s3cret" }, "first"));

    Assert.areEqual("false,true,false", [saved.hasFailed, status.payload, removed.hasFailed].join(","));
    Assert.areEqual("desktop.saveSecret,desktop.secretStatus,desktop.removeSecret",
      connection.calls.filter(t => ["desktop.saveSecret", "desktop.secretStatus", "desktop.removeSecret", "desktop.secretAnswered"].includes(t)).join(","));
    Assert.areEqual(FailureCode.Unauthorized, answered.failure?.code);
  }

  private static async startAsync(platform: string = "linux", identity: FakeDeviceIdentity = new FakeDeviceIdentity()):
    Promise<[FakeElectron, FakeRuntimeLauncher, FakeRuntimeConnection, FakeMainProcessEnvironment]> {
    const connection = new FakeRuntimeConnection();
    for (const method of ["desktop.saveSecret", "desktop.removeSecret"])
      connection.answers.set(method, Response.success("r", null));
    connection.answers.set("desktop.secretStatus", Response.success("r", true));
    const launcher = new FakeRuntimeLauncher(connection);
    const process = new FakeMainProcessEnvironment(platform);
    const electron = await MainProcessStartFixture.startReadyAsync(platform, launcher, new FakeElectron(), identity, process);
    return [electron, launcher, connection, process];
  }

  private static answers(connection: FakeRuntimeConnection): JsonObject[] {
    return connection.calls.map((t, i) => [t, connection.payloads[i]] as const).filter(t => t[0] === "desktop.secretAnswered").map(t => JsonReader.fromValue(t[1]).toJson());
  }

  private async commandAsync(launcher: FakeRuntimeLauncher, connection: FakeRuntimeConnection, action: SecretAction, value: string | null = null): Promise<JsonObject> {
    const call = ++this.calls;
    launcher.listener?.onEvent(new Event(ShellEvents.secretCommand, new SecretCommand(call, action, value).toJson()));
    await Condition.waitAsync(() => SecretAnswererTests.answers(connection).some(t => t["call"] === call));
    const answer = SecretAnswererTests.answers(connection).find(t => t["call"] === call);
    Assert.isDefined(answer);
    return answer;
  }
}

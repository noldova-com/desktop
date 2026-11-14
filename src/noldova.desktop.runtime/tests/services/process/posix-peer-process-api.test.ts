/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Socket, connect, createServer } from "node:net";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { AddonIncompleteException, AddonUnexpectedValueException, RuntimeException } from "@noldova/desktop.runtime";

import type { IPosixProcessAddon } from "../../../src/interfaces/i-posix-process-addon.js";
import { NativeAddon } from "../../../src/services/native/native-addon.js";
import { PosixPeerProcessApi } from "../../../src/services/process/posix-peer-process-api.js";
import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class PosixPeerProcessApiTests {
  private static readonly MAC_FUNCTIONS: readonly (keyof IPosixProcessAddon)[] = ["peerToken", "readProcessPath", "readEnvironment"];
  private static readonly MAC_PEER: string = "readProcessPath: () => '/Applications/Notes.app/Contents/MacOS/Notes', readEnvironment: () => ['HOME=/Users/person']";

  @TestMethod
  public async readsThePeerOfTheSocketsDescriptorFromTheProcessFolderOnLinux(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ calls: [], peerProcessId(...values) { this.calls.push(values); return 4120; } }");
    await using folder = await TemporaryFolderFixture.createAsync();
    await mkdir(path.join(folder.path, "4120"));
    await writeFile(path.join(folder.path, "4120", "environ"), "HOME=/home/person\0ELECTRON_RUN_AS_NODE=1\0");
    const api = new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]), "linux", folder.path);

    const peer = await api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 }));

    Assert.areEqual(path.posix.join(folder.path, "4120", "exe"), peer?.program);
    Assert.areEqual("[\"HOME=/home/person\",\"ELECTRON_RUN_AS_NODE=1\"]", JSON.stringify(peer?.environment));
    Assert.isNull(peer?.sender);
    Assert.isNull(api.readSender(PosixPeerProcessApiTests.socket({ fd: 7 })));
    Assert.areEqual("[[7]]", JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  public async readsNoPeerWithoutADescriptorOrAProcessOnLinux(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ peerProcessId: () => 0 }");
    const api = new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]), "linux");

    Assert.isNull(await api.readAsync(PosixPeerProcessApiTests.socket(null)));
    Assert.isNull(await api.readAsync(PosixPeerProcessApiTests.socket({ fd: -1 })));
    Assert.isNull(await api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })));
  }

  @TestMethod
  public async failsWhenTheProcessFolderCannotBeReadOnLinux(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ peerProcessId: () => 4188 }");
    await using folder = await TemporaryFolderFixture.createAsync();

    await Assert.throwsAsync(() => new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]), "linux", folder.path).readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })), Error);
  }

  @TestMethod
  @TestData("'4120'")
  @TestData("1.5")
  public async refusesAPeerThatIsNotAnInteger(value: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ peerProcessId: () => ${value} }`);

    await Assert.throwsAsync(() => new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]), "linux").readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })), AddonUnexpectedValueException);
  }

  @TestMethod
  public async readsTheProgramAndTheEnvironmentOfThePeersTokenOnMacOs(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ calls: [], peerToken(...values) { this.calls.push(values); return [4120, 3]; }, ${PosixPeerProcessApiTests.MAC_PEER} }`);
    const api = new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixPeerProcessApiTests.MAC_FUNCTIONS), "darwin");

    const peer = await api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 }));

    Assert.areEqual("/Applications/Notes.app/Contents/MacOS/Notes", peer?.program);
    Assert.areEqual("[\"HOME=/Users/person\"]", JSON.stringify(peer?.environment));
    Assert.areEqual("4120:3", peer?.sender);
    Assert.areEqual("4120:3", api.readSender(PosixPeerProcessApiTests.socket({ fd: 7 })));
    Assert.areEqual("[[7],[7],[7]]", JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  @TestData("[[4120, 3], [4120, 4]]")
  @TestData("[[4120, 3], [4188, 1]]")
  @TestData("[[4120, 3], null]")
  public async readsNoPeerWhoseTokenChangedWhileItWasReadOnMacOs(tokens: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ tokens: ${tokens}, peerToken() { return this.tokens.shift(); }, ${PosixPeerProcessApiTests.MAC_PEER} }`);

    Assert.isNull(await new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixPeerProcessApiTests.MAC_FUNCTIONS), "darwin").readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })));
  }

  @TestMethod
  public async refusesASocketWhoseDescriptorItCannotFind(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ peerProcessId: () => 4120 }");
    const api = new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, ["peerProcessId"]), "linux");

    const unnamed = await Assert.throwsAsync(() => api.readAsync(PosixPeerProcessApiTests.socket({})), RuntimeException);
    const textual = await Assert.throwsAsync(() => api.readAsync(PosixPeerProcessApiTests.socket({ fd: "7" })), RuntimeException);

    Assert.areEqual(
      "The connection's socket has no _handle.fd, so the runtime cannot tell which process is on its other end. The Node.js version may have changed how it keeps it.",
      unnamed.message);
    Assert.areEqual(unnamed.message, textual.message);
  }

  @TestMethod
  public async readsNoPeerWithoutADescriptorATokenAProgramOrAnEnvironmentOnMacOs(): Promise<void> {
    const create = async (exports: string): Promise<AsyncDisposable & { api: PosixPeerProcessApi }> => {
      const fake = await AddonModuleFixture.createAsync(exports);
      return { api: new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixPeerProcessApiTests.MAC_FUNCTIONS), "darwin"), [Symbol.asyncDispose]: () => fake[Symbol.asyncDispose]() };
    };
    await using noToken = await create(`{ peerToken: () => null, ${PosixPeerProcessApiTests.MAC_PEER} }`);
    await using noProcess = await create(`{ peerToken: () => [0, 1], ${PosixPeerProcessApiTests.MAC_PEER} }`);
    await using noProgram = await create("{ peerToken: () => [4120, 3], readProcessPath: () => null, readEnvironment: () => [] }");
    await using noEnvironment = await create("{ peerToken: () => [4120, 3], readProcessPath: () => '/bin/sh', readEnvironment: () => null }");

    Assert.isNull(await noToken.api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })));
    Assert.isNull(noToken.api.readSender(PosixPeerProcessApiTests.socket({ fd: 7 })));
    Assert.isNull(noToken.api.readSender(PosixPeerProcessApiTests.socket({ fd: -1 })));
    Assert.isNull(await noProcess.api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })));
    Assert.isNull(await noProgram.api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })));
    Assert.isNull(await noEnvironment.api.readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })));
  }

  @TestMethod
  @TestData("{ peerToken: () => [4120, 3], readProcessPath: () => 7, readEnvironment: () => [] }")
  @TestData("{ peerToken: () => [4120, 3], readProcessPath: () => '/bin/sh', readEnvironment: () => [7] }")
  @TestData("{ peerToken: () => [4120, 3], readProcessPath: () => '/bin/sh', readEnvironment: () => 'HOME=/' }")
  @TestData("{ peerToken: () => [4120], readProcessPath: () => '/bin/sh', readEnvironment: () => [] }")
  @TestData("{ peerToken: () => [4120, -1], readProcessPath: () => '/bin/sh', readEnvironment: () => [] }")
  @TestData("{ peerToken: () => '4120:3', readProcessPath: () => '/bin/sh', readEnvironment: () => [] }")
  public async refusesAnAnswerThatIsNotATokenAProgramOrAnEnvironment(exports: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(exports);

    await Assert.throwsAsync(() => new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixPeerProcessApiTests.MAC_FUNCTIONS), "darwin").readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })), AddonUnexpectedValueException);
  }

  @TestMethod
  @TestData("linux", "{}")
  @TestData("darwin", "{}")
  @TestData("darwin", "{ peerToken: () => [4120, 3], readEnvironment: () => [] }")
  @TestData("darwin", "{ peerToken: () => [4120, 3], readProcessPath: () => '/bin/sh' }")
  public async refusesAnAddonThatLacksTheFunctionItCalls(platform: string, exports: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(exports);

    const error = await Assert.throwsAsync(() => new PosixPeerProcessApi(new NativeAddon<IPosixProcessAddon>(fake.file, []), platform).readAsync(PosixPeerProcessApiTests.socket({ fd: 7 })), AddonIncompleteException);

    Assert.areEqual(`The runtime's addon native/${AddonModuleFixture.TARGET}/fake-addon.cjs lacks functions this runtime calls; it comes from another build.`, error.message);
  }

  @TestMethod
  @PlatformFixture.linuxOnly()
  public async findsAndReadsTheProcessAtTheOtherEndOfALocalSocket(): Promise<void> {
    await PosixPeerProcessApiTests.withLocalSocketAsync(async socket => {
      const api = PosixPeerProcessApi.create();

      const peer = await api.readAsync(socket);

      Assert.areEqual(`/proc/${process.pid}/exe`, peer?.program);
      Assert.isTrue(peer?.environment.some(t => t.startsWith("PATH=")) === true, "the environment holds PATH");
      Assert.isNull(api.readSender(socket));
      await Assert.throwsAsync(() => PosixPeerProcessApi.create("darwin").readAsync(socket), AddonIncompleteException);
    });
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async findsAndReadsTheProcessAtTheOtherEndOfALocalSocketOnMacOs(): Promise<void> {
    await PosixPeerProcessApiTests.withLocalSocketAsync(async socket => {
      const api = PosixPeerProcessApi.create();

      const peer = await api.readAsync(socket);
      const [own, read] = await Promise.all([stat(process.execPath, { bigint: true }), stat(peer?.program ?? String.empty, { bigint: true })]);

      Assert.isTrue(own.dev === read.dev && own.ino === read.ino, "the program is the test's own file");
      Assert.isTrue(peer?.environment.some(t => t.startsWith("PATH=")) === true, "the environment holds PATH");
      Assert.isTrue(peer?.sender?.startsWith(`${process.pid}:`) === true, `the sender is the test's process: ${peer?.sender}`);
      Assert.areEqual(peer?.sender, api.readSender(socket));
    });
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async readsAnotherSenderOnceAnotherProcessSendsOnTheSocketOnMacOs(): Promise<void> {
    await PosixPeerProcessApiTests.withLocalSocketAsync(async (socket, client) => {
      const api = PosixPeerProcessApi.create();
      client.write("own");
      await once(socket, "data");
      const own = api.readSender(socket);
      const received = once(socket, "data");
      const child = spawn(process.execPath, ["-e", "require('node:fs').writeSync(3, 'child'); process.stdin.resume()"], { stdio: ["pipe", "ignore", "ignore", client] });
      const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
      await received;

      const shared = api.readSender(socket);
      child.stdin?.end();
      const code = await exited;
      const gone = api.readSender(socket);

      Assert.areEqual(0, code);
      Assert.isTrue(own?.startsWith(`${process.pid}:`) === true, `the first sender is the test's process: ${own}`);
      Assert.isTrue(shared?.startsWith(`${child.pid}:`) === true, `the later sender is the child while it runs: ${shared}`);
      Assert.areNotEqual(own, gone);
    });
  }

  private static async withLocalSocketAsync(action: (socket: Socket, client: Socket) => Promise<void>): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("nol-peer-");
    const accepted = Promise.withResolvers<Socket>();
    const server = createServer(t => accepted.resolve(t));
    server.listen(path.join(folder.path, "peer.sock"));
    await once(server, "listening");
    const client = connect(path.join(folder.path, "peer.sock"));
    const socket = await accepted.promise;
    try {
      await action(socket, client);
    }
    finally {
      client.destroy();
      socket.destroy();
      server.close();
    }
  }

  private static socket(handle: object | null): Socket {
    return Object.assign(new Socket(), { _handle: handle });
  }
}

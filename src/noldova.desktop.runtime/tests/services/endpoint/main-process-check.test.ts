/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { copyFile, writeFile } from "node:fs/promises";
import { Socket, createServer } from "node:net";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import type { IPeerProcessApi } from "../../../src/interfaces/i-peer-process-api.js";
import { PeerProcess } from "../../../src/models/peer-process.js";
import { LinuxProgramIdentity } from "../../../src/services/endpoint/linux-program-identity.js";
import { MainProcessCheck } from "../../../src/services/endpoint/main-process-check.js";
import { LinuxProcessFolderFixture } from "../../fixtures/linux-process-folder.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class MainProcessCheckTests {
  private static readonly SOCKET: Socket = new Socket();

  @TestMethod
  @TestData("darwin")
  @TestData("win32")
  public async acceptsAPeerRunningTheSameProgramFileWithoutRunAsNode(platform: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await MainProcessCheckTests.writeAsync(folder.path, "program", "app");

    const accepted = await new MainProcessCheck(MainProcessCheckTests.peers(program, ["HOME=/home/person", "ELECTRON_RUN_AS_NODES=1"]), platform, program)
      .isMainProcessAsync(MainProcessCheckTests.SOCKET);

    Assert.isTrue(accepted);
  }

  @TestMethod
  @TestData("ELECTRON_RUN_AS_NODE=1")
  @TestData("ELECTRON_RUN_AS_NODE=")
  @TestData("electron_run_as_node=1")
  public async refusesAPeerThatStartedInNodeMode(entry: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await MainProcessCheckTests.writeAsync(folder.path, "program", "app");

    for (const platform of ["linux", "darwin", "win32"])
      Assert.isFalse(await new MainProcessCheck(MainProcessCheckTests.peers(program, ["HOME=/home/person", entry]), platform, program).isMainProcessAsync(MainProcessCheckTests.SOCKET));
  }

  @TestMethod
  public async refusesAConnectionWhosePeerIsNotReadAndRejectsOneThatFailsToRead(): Promise<void> {
    const unread: IPeerProcessApi = { readAsync: () => Promise.resolve(null), readSender: () => null };
    const failing: IPeerProcessApi = { readAsync: () => Promise.reject(new Error("Not read.")), readSender: () => null };
    const check = new MainProcessCheck(unread, "linux");

    Assert.isFalse(await check.isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isFalse(check.isSameSender(MainProcessCheckTests.SOCKET));
    await Assert.throwsAsync(() => new MainProcessCheck(failing, "linux").isMainProcessAsync(MainProcessCheckTests.SOCKET), Error);
  }

  @TestMethod
  public async keepsTheSenderOfAnAcceptedConnectionAndRefusesAnotherSender(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await MainProcessCheckTests.writeAsync(folder.path, "program", "app");
    let sender: string | null = "4120:3";
    const peers: IPeerProcessApi = { readAsync: () => Promise.resolve(new PeerProcess(program, [], "4120:3")), readSender: () => sender };
    const check = new MainProcessCheck(peers, "darwin", program);
    const unchecked = new Socket();
    const before = check.isSameSender(MainProcessCheckTests.SOCKET);

    Assert.isTrue(await check.isMainProcessAsync(MainProcessCheckTests.SOCKET));
    const same = check.isSameSender(MainProcessCheckTests.SOCKET);
    sender = "4120:4";
    const executed = check.isSameSender(MainProcessCheckTests.SOCKET);
    sender = "4188:1";
    const forked = check.isSameSender(MainProcessCheckTests.SOCKET);

    Assert.areEqual("[false,true,false,false,false]", JSON.stringify([before, same, executed, forked, check.isSameSender(unchecked)]));
  }

  @TestMethod
  public async keepsAnAcceptedConnectionWhereThePlatformNamesNoSender(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await MainProcessCheckTests.writeAsync(folder.path, "program", "app");
    const check = new MainProcessCheck(MainProcessCheckTests.peers(program), "win32", program);
    const refused = new MainProcessCheck(MainProcessCheckTests.peers(program, ["ELECTRON_RUN_AS_NODE=1"]), "win32", program);

    Assert.isTrue(await check.isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isFalse(await refused.isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isTrue(check.isSameSender(MainProcessCheckTests.SOCKET));
    Assert.isFalse(refused.isSameSender(MainProcessCheckTests.SOCKET));
  }

  @TestMethod
  public async checksTheProgramAndTheAppArchiveOnLinux(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    const line = await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("own", "app"));
    await proc.writeOwnMapsAsync(line);
    const identity = new LinuxProgramIdentity(program, proc.path);
    const main = await proc.writePeerAsync(program, false, [line]);
    const node = await proc.writePeerAsync(await proc.writeAsync("node", "node"), false, [line]);
    const otherArchive = await proc.writePeerAsync(program, true, [await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("other", "apq"))]);
    const check = (peer: PeerProcess): MainProcessCheck => new MainProcessCheck({ readAsync: () => Promise.resolve(peer), readSender: () => null }, "linux", program, identity);
    const accepted = check(main);

    Assert.isTrue(await accepted.isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isTrue(accepted.isSameSender(MainProcessCheckTests.SOCKET));
    Assert.isFalse(await check(node).isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isFalse(await check(otherArchive).isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isFalse(await check(new PeerProcess(main.program, ["ELECTRON_RUN_AS_NODE=1"], null, main.processId, main.startTime)).isMainProcessAsync(MainProcessCheckTests.SOCKET));
  }

  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  public async refusesAnotherProgramFileOnMacOsAndWindowsEvenWithTheSameContent(platform: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await MainProcessCheckTests.writeAsync(folder.path, "program", "app");
    const copy = await MainProcessCheckTests.writeAsync(folder.path, "copy", "app");
    const other = await MainProcessCheckTests.writeAsync(folder.path, "other", "another app");

    Assert.isFalse(await new MainProcessCheck(MainProcessCheckTests.peers(copy), platform, program).isMainProcessAsync(MainProcessCheckTests.SOCKET));
    Assert.isFalse(await new MainProcessCheck(MainProcessCheckTests.peers(other), platform, program).isMainProcessAsync(MainProcessCheckTests.SOCKET));
  }

  @TestMethod
  @TestData("win32")
  @TestData("darwin")
  public async rejectsAPeerWhoseProgramIsGoneOnMacOsAndWindows(platform: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const program = await MainProcessCheckTests.writeAsync(folder.path, "program", "app");

    await Assert.throwsAsync(
      () => new MainProcessCheck(MainProcessCheckTests.peers(path.join(folder.path, "gone")), platform, program).isMainProcessAsync(MainProcessCheckTests.SOCKET),
      Error);
  }

  @TestMethod
  @TestData("linux")
  @TestData("darwin")
  @TestData("win32")
  public createsTheCheckForEachPlatform(platform: string): void {
    Assert.isInstanceOf(MainProcessCheck.create(platform), MainProcessCheck);
    Assert.isInstanceOf(MainProcessCheck.create(platform, process.execPath, { APPIMAGE: "/home/person/Noldova.AppImage" }), MainProcessCheck);
  }

  @TestMethod
  @PlatformFixture.linuxOnly()
  public async checksALiveChildOverALocalSocket(): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("nol-main-");
    const other = await MainProcessCheckTests.writeAsync(folder.path, "other", "another app");

    Assert.isTrue(await MainProcessCheckTests.checkChildAsync({ path: path.join(folder.path, "a.sock") }, {}, MainProcessCheck.create()));
    Assert.isFalse(await MainProcessCheckTests.checkChildAsync({ path: path.join(folder.path, "b.sock") }, {}, MainProcessCheck.create("linux", other)));
    Assert.isFalse(await MainProcessCheckTests.checkChildAsync({ path: path.join(folder.path, "c.sock") }, { ELECTRON_RUN_AS_NODE: "1" }, MainProcessCheck.create()));
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async checksALiveChildOverALoopbackConnection(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const copy = path.join(folder.path, "node.exe");
    await copyFile(process.execPath, copy);
    const target = { port: 0, host: "127.0.0.1" };

    Assert.isTrue(await MainProcessCheckTests.checkChildAsync(target, {}, MainProcessCheck.create()));
    Assert.isFalse(await MainProcessCheckTests.checkChildAsync(target, { ELECTRON_RUN_AS_NODE: "1" }, MainProcessCheck.create()));
    Assert.isFalse(await MainProcessCheckTests.checkChildAsync(target, {}, MainProcessCheck.create(), copy));
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async checksALiveChildOverALocalSocketOnMacOs(): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("nol-main-");
    const copy = path.join(folder.path, "node");
    await copyFile(process.execPath, copy);

    Assert.isTrue(await MainProcessCheckTests.checkChildAsync({ path: path.join(folder.path, "a.sock") }, {}, MainProcessCheck.create()));
    Assert.isFalse(await MainProcessCheckTests.checkChildAsync({ path: path.join(folder.path, "b.sock") }, { ELECTRON_RUN_AS_NODE: "1" }, MainProcessCheck.create()));
    Assert.isFalse(await MainProcessCheckTests.checkChildAsync({ path: path.join(folder.path, "c.sock") }, {}, MainProcessCheck.create(), copy));
  }

  private static peers(program: string, environment: readonly string[] = []): IPeerProcessApi {
    return { readAsync: () => Promise.resolve(new PeerProcess(program, environment)), readSender: () => null };
  }

  private static async writeAsync(folder: string, name: string, content: string): Promise<string> {
    const file = path.join(folder, name);
    await writeFile(file, content);
    return file;
  }

  private static async checkChildAsync(
    target: { path: string } | { port: number; host: string },
    added: NodeJS.ProcessEnv,
    check: MainProcessCheck,
    program: string = process.execPath): Promise<boolean> {
    const accepted = Promise.withResolvers<Socket>();
    const server = createServer(t => accepted.resolve(t));
    if ("path" in target)
      server.listen(target.path);
    else
      server.listen(target.port, target.host);
    await once(server, "listening");
    const listened = server.address();
    const address = "path" in target ? target : { port: Object.isObject(listened) ? listened.port : 0, host: target.host };
    const environment = { ...process.env, ...added };
    if (Object.isUndefined(added["ELECTRON_RUN_AS_NODE"]))
      delete environment["ELECTRON_RUN_AS_NODE"];
    const child = spawn(program, ["-e", `require("node:net").connect(${JSON.stringify(address)}); setTimeout(() => undefined, 30000);`],
      { env: environment, stdio: "ignore", windowsHide: true });
    const socket = await accepted.promise;
    try {
      const isMainProcess = await check.isMainProcessAsync(socket);
      Assert.areEqual(isMainProcess, check.isSameSender(socket));
      return isMainProcess;
    }
    finally {
      const exited = once(child, "exit");
      child.kill();
      socket.destroy();
      server.close();
      await exited;
    }
  }
}

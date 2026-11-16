/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createRequire } from "node:module";
import { type Socket, connect, createServer } from "node:net";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { AddonUnexpectedValueException } from "@noldova/desktop.runtime";

import { WindowsPeerProcessApi } from "../../../src/services/process/windows-peer-process-api.js";
import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";
import { LocalPortSocketFixture } from "../../fixtures/local-port-socket.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { PortsSocketFixture } from "../../fixtures/ports-socket.fixture.js";

@TestClass
export class WindowsPeerProcessApiTests {
  private static readonly ADDON: string = `{
    calls: [],
    findTcpOwner(...values) { this.calls.push(["findTcpOwner", ...values]); return values[0] === 5005 ? null : [values[0] - 880, 2000n]; },
    openProcess(...values) { this.calls.push(["openProcess", ...values]); return values[0] === 4188 ? 5 : BigInt(values[0]); },
    readCreationTime(handle) { return handle === 4121n ? 2001n : handle === 4122n ? null : 1999n; },
    readImagePath(handle) { return handle === 4199n ? null : "C:\\\\Program Files\\\\Notes\\\\Notes.exe"; },
    readEnvironment(handle) { return ["Path=C:\\\\Windows", "ELECTRON_RUN_AS_NODE=1"]; },
    closeHandle(handle) { this.calls.push(["closeHandle", String(handle)]); }
  }`;

  @TestMethod
  public async readsTheProgramAndTheEnvironmentOfTheConnectionsOwnerAndClosesTheProcess(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(WindowsPeerProcessApiTests.ADDON);
    const api = new WindowsPeerProcessApi(fake.file);

    const peer = await api.readAsync(WindowsPeerProcessApiTests.socket(5_000, 6_000));

    Assert.areEqual("C:\\Program Files\\Notes\\Notes.exe", peer?.program);
    Assert.areEqual("[\"Path=C:\\\\Windows\",\"ELECTRON_RUN_AS_NODE=1\"]", JSON.stringify(peer?.environment));
    Assert.isNull(peer?.sender);
    Assert.isNull(api.readSender());
    Assert.isNull(api.readStart());
    Assert.areEqual("[[\"findTcpOwner\",5000,6000],[\"openProcess\",4120,1040],[\"closeHandle\",\"4120\"]]", JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  public async readsNoProcessThatStartedAfterTheConnectionOrWhoseStartIsUnknown(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(WindowsPeerProcessApiTests.ADDON);
    const api = new WindowsPeerProcessApi(fake.file);

    const later = await api.readAsync(WindowsPeerProcessApiTests.socket(5_001, 6_000));
    const unknown = await api.readAsync(WindowsPeerProcessApiTests.socket(5_002, 6_000));

    Assert.isNull(later);
    Assert.isNull(unknown);
    Assert.areEqual(
      "[[\"findTcpOwner\",5001,6000],[\"openProcess\",4121,1040],[\"closeHandle\",\"4121\"],[\"findTcpOwner\",5002,6000],[\"openProcess\",4122,1040],[\"closeHandle\",\"4122\"]]",
      JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  public async readsNoProcessWithoutAConnectionAnOwnerAccessAProgramOrAnEnvironment(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(WindowsPeerProcessApiTests.ADDON);
    await using gone = await AddonModuleFixture.createAsync(`Object.assign(${WindowsPeerProcessApiTests.ADDON}, { readEnvironment: () => null })`);
    const api = new WindowsPeerProcessApi(fake.file);

    Assert.isNull(await api.readAsync(WindowsPeerProcessApiTests.socket(undefined, 6_000)));
    Assert.isNull(await api.readAsync(WindowsPeerProcessApiTests.socket(5_000, undefined)));
    Assert.isNull(await api.readAsync(WindowsPeerProcessApiTests.socket(5_005, 6_000)));
    Assert.isNull(await api.readAsync(WindowsPeerProcessApiTests.socket(5_068, 6_000)));
    Assert.isNull(await api.readAsync(WindowsPeerProcessApiTests.socket(5_079, 6_000)));
    Assert.isNull(await new WindowsPeerProcessApi(gone.file).readAsync(WindowsPeerProcessApiTests.socket(5_000, 6_000)));
  }

  @TestMethod
  @TestData("{ findTcpOwner: () => 4120 }")
  @TestData("{ findTcpOwner: () => [0, 2000n] }")
  @TestData("{ findTcpOwner: () => [4120, 2000] }")
  @TestData("{ findTcpOwner: () => [4120] }")
  @TestData("{ readCreationTime: () => 1999 }")
  @TestData("{ readEnvironment: () => [7] }")
  @TestData("{ readEnvironment: () => 'Path=C:\\\\Windows' }")
  @TestData("{ readImagePath: () => 7 }")
  @TestData("{ openProcess: () => 'handle' }")
  public async refusesAnAnswerThatIsNotAnOwnerAStartAProgramOrAnEnvironment(replaced: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`Object.assign(${WindowsPeerProcessApiTests.ADDON}, ${replaced})`);

    await Assert.throwsAsync(() => new WindowsPeerProcessApi(fake.file).readAsync(WindowsPeerProcessApiTests.socket(5_000, 6_000)), AddonUnexpectedValueException);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async findsAndReadsTheProcessAtTheOtherEndOfALoopbackConnection(): Promise<void> {
    const accepted = Promise.withResolvers<Socket>();
    const server = createServer(t => accepted.resolve(t));
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const listened = server.address();
    Assert.isTrue(Object.isObject(listened), "The server listens on a port.");
    const client = connect(listened.port, "127.0.0.1");
    const socket = await accepted.promise;
    try {
      const peer = await WindowsPeerProcessApi.create().readAsync(socket);

      Assert.areEqual(process.execPath.toLowerCase(), peer?.program.toLowerCase());
      Assert.isTrue(peer?.environment.some(t => t.toLowerCase().startsWith("path=")) === true, "the environment holds Path");
    }
    finally {
      client.destroy();
      socket.destroy();
      server.close();
    }
  }

  private static socket(remotePort: number | undefined, localPort: number | undefined): Socket {
    return Object.isUndefined(localPort) ? new PortsSocketFixture(remotePort) : new LocalPortSocketFixture(remotePort, localPort);
  }
}

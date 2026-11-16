/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rename, writeFile } from "node:fs/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { RuntimeException } from "@noldova/desktop.runtime";

import { PeerProcess } from "../../../src/models/peer-process.js";
import { LinuxProgramIdentity } from "../../../src/services/endpoint/linux-program-identity.js";
import { LinuxProcessFolderFixture } from "../../fixtures/linux-process-folder.fixture.js";

@TestClass
export class LinuxProgramIdentityTests {
  @TestMethod
  public async acceptsTheRuntimesOwnProgramAndAppArchiveFiles(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    const line = await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("own", "app"));
    await proc.writeOwnMapsAsync(line);

    Assert.isTrue(await new LinuxProgramIdentity(program, proc.path).isSameAsync(await proc.writePeerAsync(program, true, [line, line])));
  }

  @TestMethod
  public async acceptsCopiesWithTheSameContentAsOnAnotherMountOfTheAppImage(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("own", "app")));
    const peer = await proc.writePeerAsync(program, false, [await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("mount", "app"))]);
    const identity = new LinuxProgramIdentity(program, proc.path);

    Assert.areEqual("[true,true]", JSON.stringify([await identity.isSameAsync(peer), await identity.isSameAsync(peer)]));
  }

  @TestMethod
  public async refusesAProgramOfAnotherSizeOrContent(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync();
    const identity = new LinuxProgramIdentity(program, proc.path);

    Assert.isFalse(await identity.isSameAsync(await proc.writePeerAsync(await proc.writeAsync("node", "node"), false, [])));
    Assert.isFalse(await identity.isSameAsync(await proc.writePeerAsync(await proc.writeAsync("forged", "electrum"), false, [])));
  }

  @TestMethod
  public async acceptsAProgramThatMapsNoAppArchiveOnlyWhereTheRuntimeMapsNone(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync();
    const identity = new LinuxProgramIdentity(program, proc.path);
    const line = await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("peer", "app"));

    Assert.isTrue(await identity.isSameAsync(await proc.writePeerAsync(program, true, [])));
    Assert.isFalse(await identity.isSameAsync(await proc.writePeerAsync(program, true, [line])));
  }

  @TestMethod
  public async refusesAProgramThatMapsNoAppArchiveWhereTheRuntimeMapsOne(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("own", "app")));

    Assert.isFalse(await new LinuxProgramIdentity(program, proc.path).isSameAsync(await proc.writePeerAsync(program, true, [])));
  }

  @TestMethod
  public async refusesTheAppsProgramOnAnotherAppArchive(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("own", "app")));
    const identity = new LinuxProgramIdentity(program, proc.path);
    const changed = await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("changed", "apq"));
    const longer = await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("longer", "app with more"));

    Assert.isFalse(await identity.isSameAsync(await proc.writePeerAsync(program, true, [changed])));
    Assert.isFalse(await identity.isSameAsync(await proc.writePeerAsync(program, true, [longer])));
  }

  @TestMethod
  public async refusesTwoAppArchivesADeletedOneOrOneThatIsNoLongerAtItsPath(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    const own = await proc.writeArchiveAsync("own", "app");
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(own));
    const copy = await proc.writeArchiveAsync("copy", "app");
    const line = await LinuxProcessFolderFixture.lineAsync(copy);
    const identity = new LinuxProgramIdentity(program, proc.path);
    const two = await identity.isSameAsync(await proc.writePeerAsync(program, true, [line, await LinuxProcessFolderFixture.lineAsync(own)]));
    const deleted = await identity.isSameAsync(await proc.writePeerAsync(program, true, [await LinuxProcessFolderFixture.lineAsync(own, " (deleted)")]));
    const moved = await proc.writePeerAsync(program, true, [line]);
    await rename(copy, `${copy}.moved`);
    await writeFile(copy, "app");

    Assert.areEqual("[false,false,false]", JSON.stringify([two, deleted, await identity.isSameAsync(moved)]));
  }

  @TestMethod
  public async refusesAPeerWhoseProcessIdWasTakenByAnotherProcessOrIsUnknown(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync();
    const peer = await proc.writePeerAsync(program, true, []);
    const identity = new LinuxProgramIdentity(program, proc.path);
    const before = await identity.isSameAsync(peer);
    await proc.writeStartAsync(Number(peer.processId), "99001");

    Assert.areEqual("[true,false]", JSON.stringify([before, await identity.isSameAsync(peer)]));
    Assert.isFalse(await identity.isSameAsync(new PeerProcess(peer.program, [], null, null, LinuxProcessFolderFixture.START)));
    Assert.isFalse(await identity.isSameAsync(new PeerProcess(peer.program, [], null, peer.processId, null)));
  }

  @TestMethod
  public async failsWhenTheRuntimeCannotTellItsOwnAppArchive(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    const own = await proc.writeArchiveAsync("own", "app");
    const other = await proc.writeArchiveAsync("other", "app");
    const peer = await proc.writePeerAsync(program, true, []);

    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(own), await LinuxProcessFolderFixture.lineAsync(other));
    await Assert.throwsAsync(() => new LinuxProgramIdentity(program, proc.path).isSameAsync(peer), RuntimeException);
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(own, " (deleted)"));
    await Assert.throwsAsync(() => new LinuxProgramIdentity(program, proc.path).isSameAsync(peer), RuntimeException);
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(own));
    await rename(own, `${own}.moved`);
    await writeFile(own, "app");
    await Assert.throwsAsync(() => new LinuxProgramIdentity(program, proc.path).isSameAsync(peer), RuntimeException);
  }

  @TestMethod
  public async failsWhenTheRuntimesOwnProgramChangedBeforeItsDigest(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync();
    const identity = new LinuxProgramIdentity(program, proc.path);
    const node = await identity.isSameAsync(await proc.writePeerAsync(await proc.writeAsync("node", "node"), false, []));
    const copy = await proc.writePeerAsync(program, false, []);
    await rename(program, `${program}.moved`);
    await writeFile(program, "electron");

    Assert.isFalse(node);
    await Assert.throwsAsync(() => identity.isSameAsync(copy), RuntimeException);
  }

  @TestMethod
  public async preparesItsOwnDigestsOnceAndLeavesAFailureToTheCheck(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const program = await proc.writeAsync("program", "electron");
    await proc.writeOwnMapsAsync(await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("own", "app")));
    const peer = await proc.writePeerAsync(program, false, [await LinuxProcessFolderFixture.lineAsync(await proc.writeArchiveAsync("copy", "app"))]);
    await using bare = await LinuxProcessFolderFixture.createAsync();
    await bare.writeOwnMapsAsync();
    const bareProgram = await bare.writeAsync("program", "electron");
    const barePeer = await bare.writePeerAsync(bareProgram, false, []);
    const identity = new LinuxProgramIdentity(program, proc.path);
    const withoutArchive = new LinuxProgramIdentity(bareProgram, bare.path);
    const missing = new LinuxProgramIdentity(proc.file("missing"), proc.path);

    identity.prepare();
    withoutArchive.prepare();
    missing.prepare();

    Assert.isTrue(await identity.isSameAsync(peer));
    Assert.isTrue(await withoutArchive.isSameAsync(barePeer));
    await Assert.throwsAsync(() => missing.isSameAsync(peer), Error);
  }
}

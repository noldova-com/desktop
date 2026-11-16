/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { RuntimeException } from "@noldova/desktop.runtime";

import { PeerProcess } from "../../../src/models/peer-process.js";
import { LinuxProgramIdentity } from "../../../src/services/endpoint/linux-program-identity.js";
import { ArchiveSwitchFixture } from "../../fixtures/archive-switch.fixture.js";
import { LinuxProcessFolderFixture } from "../../fixtures/linux-process-folder.fixture.js";

@TestClass
export class LinuxProgramIdentityTests {
  private static create(proc: LinuxProcessFolderFixture, program: string): LinuxProgramIdentity {
    return new LinuxProgramIdentity(program, proc.path, proc.readLink);
  }

  @TestMethod
  public async acceptsTheRuntimesOwnProgramAndAppArchive(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program, archive] = await proc.writeAppAsync("own", "app");
    const peer = await proc.writePeerAsync(program, [archive, archive]);
    using archives = new ArchiveSwitchFixture(archive);

    Assert.isTrue(await LinuxProgramIdentityTests.create(proc, program).isSameAsync(peer));
    Assert.areEqual("[\"true before\",\"undefined before\"]", JSON.stringify(archives.changes));
  }

  @TestMethod
  public async acceptsAnotherCopyOfTheAppArchiveOnlyFromAReadOnlyMountOrWhereTheRuntimeRunsFromAWritableOne(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program] = await proc.writeAppAsync("own", "app");
    const [copy, archive] = await proc.writeAppAsync("mount", "app");
    const identity = LinuxProgramIdentityTests.create(proc, program);
    using archives = new ArchiveSwitchFixture(archive);
    const unknown = await identity.isSameAsync(await proc.writePeerAsync(copy, [archive]));
    await proc.writeMountsAsync("rw,errors=remount-ro");
    const writable = await identity.isSameAsync(await proc.writePeerAsync(copy, [archive]));
    await proc.writeMountsAsync("ro,user_id=0");
    const readOnly = await identity.isSameAsync(await proc.writePeerAsync(copy, [archive]));

    Assert.areEqual("[false,true,true]", JSON.stringify([unknown, writable, readOnly]));
    Assert.areEqual(JSON.stringify(Array.from({ length: 3 }, () => ["true before", "undefined before"]).flat()), JSON.stringify(archives.changes));
  }

  @TestMethod
  public async reusesTheDigestOfACopyOnlyOnAReadOnlyMount(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program] = await proc.writeAppAsync("own", "app");
    const [copy, archive] = await proc.writeAppAsync("mount", "app");
    const identity = LinuxProgramIdentityTests.create(proc, program);
    await proc.writeMountsAsync("ro");
    const first = await identity.isSameAsync(await proc.writePeerAsync(copy, [archive]));
    await proc.writeAsync(path.join("mount", "resources", "app.asar"), "apq");
    const cached = await identity.isSameAsync(await proc.writePeerAsync(copy, [archive]));
    await proc.writeMountsAsync("rw");

    Assert.areEqual("[true,true,false]", JSON.stringify([first, cached, await identity.isSameAsync(await proc.writePeerAsync(copy, [archive]))]));
  }

  @TestMethod
  public async acceptsACopyOfTheProgramOnlyWithTheSameSizeAndContent(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program] = await proc.writeAppAsync("own", null);
    const [node] = await proc.writeAppAsync("node", null, "node");
    const [forged] = await proc.writeAppAsync("forged", null, "electrum");
    const [copy] = await proc.writeAppAsync("copy", null);
    const identity = LinuxProgramIdentityTests.create(proc, program);
    const results = [await identity.isSameAsync(await proc.writePeerAsync(node)), await identity.isSameAsync(await proc.writePeerAsync(forged))];

    Assert.areEqual("[false,false,true]", JSON.stringify([...results, await identity.isSameAsync(await proc.writePeerAsync(copy))]));
  }

  @TestMethod
  public async acceptsAPeerWithoutAnAppArchiveOnlyWhereTheRuntimeHasNone(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [bare, bareArchive] = await proc.writeAppAsync("bare", null);
    const [program, archive] = await proc.writeAppAsync("own", "app");
    const withArchive = await proc.writePeerAsync(bare);
    await proc.addDescriptorAsync(withArchive, archive, bareArchive);
    const bareIdentity = LinuxProgramIdentityTests.create(proc, bare);
    const results = [await bareIdentity.isSameAsync(await proc.writePeerAsync(bare)), await bareIdentity.isSameAsync(withArchive)];

    Assert.areEqual("[true,false,false]", JSON.stringify([...results, await LinuxProgramIdentityTests.create(proc, program).isSameAsync(await proc.writePeerAsync(program))]));
  }

  @TestMethod
  public async refusesTheAppsProgramOnAnotherAppArchive(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    await proc.writeMountsAsync("ro");
    const [program] = await proc.writeAppAsync("own", "app");
    const [changed, changedArchive] = await proc.writeAppAsync("changed", "apq");
    const [longer, longerArchive] = await proc.writeAppAsync("longer", "app with more");
    const identity = LinuxProgramIdentityTests.create(proc, program);
    const results = [await identity.isSameAsync(await proc.writePeerAsync(changed, [changedArchive]))];

    Assert.areEqual("[false,false]", JSON.stringify([...results, await identity.isSameAsync(await proc.writePeerAsync(longer, [longerArchive]))]));
  }

  @TestMethod
  public async refusesTwoAppArchivesADeletedOneOneElsewhereOrADeletedProgram(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    await proc.writeMountsAsync("ro");
    const [program, archive] = await proc.writeAppAsync("own", "app");
    const [, copy] = await proc.writeAppAsync("copy", "app");
    const identity = LinuxProgramIdentityTests.create(proc, program);
    const two = await proc.writePeerAsync(program, [archive]);
    await proc.addDescriptorAsync(two, copy, archive);
    const deleted = await proc.writePeerAsync(program, [archive]);
    await proc.addDescriptorAsync(deleted, archive, `${archive} (deleted)`);
    const elsewhere = await proc.writePeerAsync(program);
    await proc.addDescriptorAsync(elsewhere, archive, copy);
    const results = [await identity.isSameAsync(two), await identity.isSameAsync(deleted), await identity.isSameAsync(elsewhere)];

    Assert.areEqual("[false,false,false,false]", JSON.stringify([...results, await identity.isSameAsync(await proc.writePeerAsync(program, [archive], `${program} (deleted)`))]));
  }

  @TestMethod
  public async refusesAPeerWhoseProcessIdWasTakenByAnotherProcessOrIsUnknown(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program] = await proc.writeAppAsync("own", null);
    const peer = await proc.writePeerAsync(program);
    const identity = LinuxProgramIdentityTests.create(proc, program);
    const before = await identity.isSameAsync(peer);
    await proc.writeStartAsync(Number(peer.processId), "99001");

    Assert.areEqual("[true,false]", JSON.stringify([before, await identity.isSameAsync(peer)]));
    Assert.isFalse(await identity.isSameAsync(new PeerProcess(peer.program, [], null, null, LinuxProcessFolderFixture.START)));
    Assert.isFalse(await identity.isSameAsync(new PeerProcess(peer.program, [], null, peer.processId, null)));
  }

  @TestMethod
  public async failsWhenADescriptorCannotBeRead(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program, archive] = await proc.writeAppAsync("own", "app");
    const peer = await proc.writePeerAsync(program, [archive]);
    proc.setLink(path.join(proc.path, String(peer.processId), "fd", "0"), Object.assign(new Error("Not read."), { code: "EIO" }));

    await Assert.throwsAsync(() => LinuxProgramIdentityTests.create(proc, program).isSameAsync(peer), Error);
  }

  @TestMethod
  public async failsWhenTheRuntimesOwnProgramChangedBeforeItsDigestAndReadsItAgainLater(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program] = await proc.writeAppAsync("own", null);
    const [node] = await proc.writeAppAsync("node", null, "node");
    const [copy] = await proc.writeAppAsync("copy", null);
    const identity = LinuxProgramIdentityTests.create(proc, program);
    const before = await identity.isSameAsync(await proc.writePeerAsync(node));
    const peer = await proc.writePeerAsync(copy);
    await rename(program, `${program}.moved`);
    await writeFile(program, "electron");

    Assert.isFalse(before);
    await Assert.throwsAsync(() => identity.isSameAsync(peer), RuntimeException);
    await rename(`${program}.moved`, program);
    Assert.isTrue(await identity.isSameAsync(peer));
  }

  @TestMethod
  public async preparesItsOwnDigestsAndTriesAgainAfterAFailure(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    await proc.writeMountsAsync("ro");
    const [program] = await proc.writeAppAsync("own", "app");
    const [bare] = await proc.writeAppAsync("bare", null);
    const [copy, archive] = await proc.writeAppAsync("copy", "app");
    const missingProgram = proc.file(path.join("missing", "program"));
    const identity = LinuxProgramIdentityTests.create(proc, program);
    const withoutArchive = LinuxProgramIdentityTests.create(proc, bare);
    const missing = LinuxProgramIdentityTests.create(proc, missingProgram);
    const peer = await proc.writePeerAsync(bare);

    identity.prepare();
    withoutArchive.prepare();
    missing.prepare();

    Assert.isTrue(await identity.isSameAsync(await proc.writePeerAsync(copy, [archive])));
    Assert.isTrue(await withoutArchive.isSameAsync(peer));
    await Assert.throwsAsync(() => missing.isSameAsync(peer), Error);
    await proc.writeAppAsync("missing", null);
    Assert.isTrue(await missing.isSameAsync(await proc.writePeerAsync(missingProgram)));
  }

  @TestMethod
  public async failsOnAProgramPathItCannotRead(): Promise<void> {
    await using proc = await LinuxProcessFolderFixture.createAsync();
    const [program] = await proc.writeAppAsync("own", null);
    const peer = await proc.writePeerAsync(program);

    await Assert.throwsAsync(() => LinuxProgramIdentityTests.create(proc, `${proc.file("own")}\0${program}`).isSameAsync(peer), Error);
  }
}

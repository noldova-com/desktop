/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IWindowsSignature, WindowsProcessApi } from "@noldova/desktop.runtime";
import { PublisherCheck } from "@noldova/desktop.electron";

import { PlatformFixture } from "../fixtures/platform.fixture.js";

class FakeSignatures {
  public readonly files: string[] = [];
  private readonly answer: () => Promise<IWindowsSignature>;

  public constructor(answer: () => Promise<IWindowsSignature>) {
    this.answer = answer;
  }

  public verifySignatureAsync(file: string): Promise<IWindowsSignature> {
    this.files.push(file);
    return this.answer();
  }
}

@TestClass
export class PublisherCheckTests {
  private static readonly PUBLISHER: string = "CN=Fixture Works, O=Fixture Works, C=US";
  private static readonly INSTALLER: string = "C:\\Temp\\it's\\Noldova Desktop Sample-windows-x64.exe";

  @TestMethod
  public async passesAValidSignatureOfThePublisherAndRecordsHowLongItTook(): Promise<void> {
    const lines: string[] = [];
    let time = 1_000;
    const signatures = new FakeSignatures(() => {
      time += 840;
      return Promise.resolve({ status: 0, message: "The operation completed successfully.\r\n", subject: "CN=Fixture Works, O=Fixture Works, L=Fixtureville, C=US" });
    });
    const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, signatures, t => lines.push(t), () => time);

    const failure = await check.checkAsync(PublisherCheckTests.INSTALLER);

    Assert.isNull(failure);
    Assert.areEqual(JSON.stringify([PublisherCheckTests.INSTALLER]), JSON.stringify(signatures.files));
    Assert.areEqual(JSON.stringify(["The update's publisher check passed in 840 ms."]), JSON.stringify(lines));
  }

  @TestMethod
  public async matchesTheSignersNameFieldByFieldWhateverItsQuotingEscapingSpacingAndCase(): Promise<void> {
    const signers = ["c=US,o=\"Fixture Works\",cn=Fixture Works", "CN=\"Fixture Works\", O=Fixture Works, C=US", "CN=Fixture\\ Works, O=Fixture Works, C=US, OU=Updates"];

    for (const signer of signers) {
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new FakeSignatures(() => Promise.resolve({ status: 0, message: String.empty, subject: signer })), () => undefined, () => 0);

      Assert.isNull(await check.checkAsync(PublisherCheckTests.INSTALLER), signer);
    }
  }

  @TestMethod
  public async failsInOneLineWhenTheSignatureIsInvalidHasNoReadableSignerOrIsAnothers(): Promise<void> {
    const cases: readonly (readonly [string, IWindowsSignature, string])[] = [
      [PublisherCheckTests.PUBLISHER, { status: 0x800B0100, message: "No signature was present\r\nin the subject.\r\n", subject: null },
        "its signature is not valid (0x800B0100): No signature was present in the subject."],
      [PublisherCheckTests.PUBLISHER, { status: 0x10B, message: " ", subject: "CN=Fixture Works, O=Fixture Works, C=US" }, "its signature is not valid (0x0000010B)"],
      [PublisherCheckTests.PUBLISHER, { status: 0, message: String.empty, subject: null }, "Windows verified its signature but could not read its signer's name"],
      [PublisherCheckTests.PUBLISHER, { status: 0, message: String.empty, subject: "CN=Fixture Works, O=Other, C=US" },
        "it is signed by CN=Fixture Works, O=Other, C=US, not by CN=Fixture Works, O=Fixture Works, C=US"],
      ["Noldova", { status: 0, message: String.empty, subject: "CN=Noldova" }, "it is signed by CN=Noldova, not by Noldova"]
    ];

    for (const [publisher, signature, expected] of cases) {
      const lines: string[] = [];
      const check = new PublisherCheck(publisher, new FakeSignatures(() => Promise.resolve(signature)), t => lines.push(t), () => 0);

      Assert.areEqual(expected, await check.checkAsync(PublisherCheckTests.INSTALLER));
      Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms."]), JSON.stringify(lines));
    }
  }

  @TestMethod
  public async failsInOneLineWhenTheSignatureCannotBeRead(): Promise<void> {
    const lines: string[] = [];
    const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, new FakeSignatures(() => Promise.reject(new Error("The runtime could not load\n  its Windows addon."))),
      t => lines.push(t), () => 0);

    Assert.areEqual("Error: The runtime could not load its Windows addon.", await check.checkAsync(PublisherCheckTests.INSTALLER));
    Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms."]), JSON.stringify(lines));
  }

  @TestMethod
  public async failsWithoutReadingTheSignatureWhenTheBuildHasNoPublisher(): Promise<void> {
    const lines: string[] = [];
    const signatures = new FakeSignatures(() => Promise.reject(new Error("The check read the signature.")));
    const check = new PublisherCheck(null, signatures, t => lines.push(t), () => 0);

    Assert.areEqual("this build is unsigned, so it has no publisher to check the update's signer against", await check.checkAsync(PublisherCheckTests.INSTALLER));
    Assert.areEqual(0, signatures.files.length);
    Assert.areEqual(JSON.stringify(["The update's publisher check failed in 0 ms."]), JSON.stringify(lines));
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async readsRealSignaturesWithoutHoldingTheEventLoopOnWindows(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "nol-publisher-"));
    try {
      const unsigned = path.join(folder, "Noldova Desktop Sample's ünsigned installer.exe");
      await writeFile(unsigned, "MZ");
      const lines: string[] = [];
      const check = new PublisherCheck(PublisherCheckTests.PUBLISHER, WindowsProcessApi.create(), t => lines.push(t), Date.now);
      const order: string[] = [];

      const unsignedFailure = await check.checkAsync(unsigned);
      const checking = check.checkAsync(process.execPath).then(t => {
        order.push("checked");
        return t;
      });
      setImmediate(() => order.push("immediate"));
      const signedFailure = await checking;

      const megabytes = Math.round((await stat(process.execPath)).size / 1_048_576);
      console.log(`${lines[1]} (${path.basename(process.execPath)}, ${megabytes} MB)`);
      Assert.isTrue(unsignedFailure?.startsWith("its signature is not valid (0x") === true, unsignedFailure ?? String.empty);
      Assert.isTrue(signedFailure?.startsWith("it is signed by CN=") === true, signedFailure ?? String.empty);
      Assert.areEqual(JSON.stringify(["immediate", "checked"]), JSON.stringify(order));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

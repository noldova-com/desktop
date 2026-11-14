/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagedPublisherCheck } from "../../../src/services/packaging/packaged-publisher-check.js";

@TestClass
export class PackagedPublisherCheckTests {
  private static readonly PICKLE_LENGTH: number = 4;
  private static readonly PICKLE_PREFIX: number = 8;
  private static readonly PUBLISHER: string = "CN=Sample, O=Sample";

  @TestMethod
  public async verifiesAPublisherThatMatches(): Promise<void> {
    const report = await PackagedPublisherCheckTests.verifyAsync(JSON.stringify({ windowsPublisher: PackagedPublisherCheckTests.PUBLISHER }),
      PackagedPublisherCheckTests.PUBLISHER);

    Assert.areEqual("The installed package's Windows publisher matches WINDOWS_PUBLISHER.", report);
  }

  @TestMethod
  public async verifiesNoPublisherWhenNoneIsSet(): Promise<void> {
    const report = await PackagedPublisherCheckTests.verifyAsync(JSON.stringify({ windowsPublisher: null }), null);

    Assert.areEqual("The installed package has no Windows publisher, and WINDOWS_PUBLISHER is not set.", report);
  }

  @TestMethod
  public async refusesAProductFileWithoutThePublisherField(): Promise<void> {
    const missing = await PackagedPublisherCheckTests.messageAsync(null, null);
    const unreadable = await PackagedPublisherCheckTests.messageAsync("{", null);
    const unnamed = await PackagedPublisherCheckTests.messageAsync(JSON.stringify({ name: "Sample App" }), null);

    for (const [message, archive] of [missing, unreadable, unnamed])
      Assert.areEqual(`The installed ${path.join(archive, "_build", "product.json")} has no windowsPublisher field to check against WINDOWS_PUBLISHER.`, message);
  }

  @TestMethod
  public async refusesAPublisherThatIsNotText(): Promise<void> {
    const [message, archive] = await PackagedPublisherCheckTests.messageAsync(JSON.stringify({ windowsPublisher: 3 }), PackagedPublisherCheckTests.PUBLISHER);

    Assert.areEqual(`The installed ${path.join(archive, "_build", "product.json")}'s Windows publisher is not a string, so it can't be checked against WINDOWS_PUBLISHER.`,
      message);
  }

  @TestMethod
  public async refusesAPublisherThePackageHasButTheReleaseDoesNotSet(): Promise<void> {
    const [message, archive] = await PackagedPublisherCheckTests.messageAsync(JSON.stringify({ windowsPublisher: PackagedPublisherCheckTests.PUBLISHER }), null);

    Assert.areEqual(`The installed ${path.join(archive, "_build", "product.json")} has a Windows publisher set, but WINDOWS_PUBLISHER is not set.`, message);
  }

  @TestMethod
  public async refusesAPublisherTheReleaseSetsButThePackageLacks(): Promise<void> {
    const [message, archive] = await PackagedPublisherCheckTests.messageAsync(JSON.stringify({ windowsPublisher: null }), PackagedPublisherCheckTests.PUBLISHER);

    Assert.areEqual(`The installed ${path.join(archive, "_build", "product.json")} is missing its Windows publisher, but WINDOWS_PUBLISHER is set.`, message);
  }

  @TestMethod
  public async refusesAnotherPublisher(): Promise<void> {
    const [message, archive] = await PackagedPublisherCheckTests.messageAsync(JSON.stringify({ windowsPublisher: "CN=Other" }), PackagedPublisherCheckTests.PUBLISHER);

    Assert.areEqual(`The installed ${path.join(archive, "_build", "product.json")}'s Windows publisher differs from WINDOWS_PUBLISHER.`, message);
  }

  private static async verifyAsync(product: string | null, publisher: string | null): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "packaged-publisher-"));
    try {
      return await PackagedPublisherCheck.verifyAsync(await PackagedPublisherCheckTests.writeArchiveAsync(folder, product), publisher);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async messageAsync(product: string | null, publisher: string | null): Promise<readonly [string, string]> {
    const folder = await mkdtemp(path.join(tmpdir(), "packaged-publisher-"));
    try {
      const archive = await PackagedPublisherCheckTests.writeArchiveAsync(folder, product);
      const error = await Assert.throwsAsync(() => PackagedPublisherCheck.verifyAsync(archive, publisher), BuildException);
      return [error.message, archive];
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async writeArchiveAsync(folder: string, product: string | null): Promise<string> {
    const content = Buffer.from(product ?? String.empty);
    const files = Object.isNull(product) ? {} : { _build: { files: { "product.json": { size: content.length, offset: "0" } } } };
    const json = Buffer.from(JSON.stringify({ files }));
    const pickle = Buffer.alloc(PackagedPublisherCheckTests.PICKLE_PREFIX + json.length);
    pickle.writeUInt32LE(PackagedPublisherCheckTests.PICKLE_LENGTH + json.length, 0);
    pickle.writeUInt32LE(json.length, PackagedPublisherCheckTests.PICKLE_LENGTH);
    json.copy(pickle, PackagedPublisherCheckTests.PICKLE_PREFIX);
    const sizes = Buffer.alloc(PackagedPublisherCheckTests.PICKLE_PREFIX);
    sizes.writeUInt32LE(PackagedPublisherCheckTests.PICKLE_LENGTH, 0);
    sizes.writeUInt32LE(pickle.length, PackagedPublisherCheckTests.PICKLE_LENGTH);
    const archive = path.join(folder, "app.asar");
    await writeFile(archive, Buffer.concat([sizes, pickle, content]));
    return archive;
  }
}

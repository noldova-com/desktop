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
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagingSection } from "../../../src/models/packaging/packaging-section.js";

@TestClass
export class PackagingSectionTests {
  private static readonly SHAPE: string = "The section has the wrong shape.";

  @TestMethod
  public async readsEachPackagesEntryOfTheSection(): Promise<void> {
    const values = await PackagingSectionTests.readAsync({ desktop: { packaging: { notes: { "sample@1.0.0": { text: "one" }, "@scope/other@2.0.0": { text: "two" } } } } });

    Assert.areEqual("sample@1.0.0=one|@scope/other@2.0.0=two", [...values].map(([id, text]) => `${id}=${text}`).join("|"));
  }

  @TestMethod
  public async readsNothingWhenAnyLevelOfTheSectionIsMissing(): Promise<void> {
    for (const manifest of [{}, { desktop: {} }, { desktop: { packaging: {} } }])
      Assert.areEqual(0, (await PackagingSectionTests.readAsync(manifest)).size);
  }

  @TestMethod
  public async refusesARootManifestThatCannotBeRead(): Promise<void> {
    await using root = await PackagingSectionTests.createRootAsync(null);

    const error = await Assert.throwsAsync(() => PackagingSection.readAsync(root.path, "notes", PackagingSectionTests.SHAPE, () => String.empty), BuildException);

    Assert.areEqual("The root package.json could not be read as JSON.", error.message);
  }

  @TestMethod
  public async refusesAnEntryThatIsNotAnObjectAnInvalidIdOrAnEntryTheReaderRefuses(): Promise<void> {
    const manifests = [
      { desktop: { packaging: { notes: { "sample@1.0.0": "text" } } } },
      { desktop: { packaging: { notes: { "sample": { text: "one" } } } } },
      { desktop: { packaging: { notes: { "sample@1.0.0": { text: String.empty } } } } }
    ];

    for (const manifest of manifests) {
      const error = await Assert.throwsAsync(() => PackagingSectionTests.readAsync(manifest), BuildException);

      Assert.areEqual(PackagingSectionTests.SHAPE, error.message);
    }
  }

  @TestMethod
  public readsANonEmptyListOfNamesWithAReason(): void {
    const names = PackagingSection.readNames(JsonReader.fromValue({ names: ["one", "two"], reason: "Never loaded." }), "names");

    Assert.areEqual("one,two", [...names ?? []].join(","));
  }

  @TestMethod
  public readsNoNamesFromAnEmptyListOrABlankName(): void {
    Assert.isNull(PackagingSection.readNames(JsonReader.fromValue({ names: [], reason: "Never loaded." }), "names"));
    Assert.isNull(PackagingSection.readNames(JsonReader.fromValue({ names: ["one", " "], reason: "Never loaded." }), "names"));
  }

  private static async readAsync(manifest: object): Promise<ReadonlyMap<string, string>> {
    await using root = await PackagingSectionTests.createRootAsync(manifest);
    return await PackagingSection.readAsync(root.path, "notes", PackagingSectionTests.SHAPE, t => {
      const text = t.readString("text");
      return String.isNullOrWhitespace(text) ? null : text;
    });
  }

  private static async createRootAsync(manifest: object | null): Promise<{ path: string } & AsyncDisposable> {
    const root = await mkdtemp(path.join(tmpdir(), "packaging-section-"));
    if (!Object.isNull(manifest))
      await writeFile(path.join(root, "package.json"), JSON.stringify(manifest));
    return { path: root, [Symbol.asyncDispose]: () => rm(root, { recursive: true, force: true }) };
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeclarationsUnreadableException, ModuleDeclarationReader } from "@noldova/desktop.runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ModuleDeclarationReaderTests {
  private static readonly NOTES: Readonly<Record<string, unknown>> = { id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: {}, runtimePackage: null, contributes: {} };

  @TestMethod
  public readsTheBuildsDeclarationsInOrder(): Promise<void> {
    return ModuleDeclarationReaderTests.runAsync(async file => {
      const tasks = { ...ModuleDeclarationReaderTests.NOTES, id: "tasks", displayName: "Tasks" };
      await writeFile(file, JSON.stringify({ formatVersion: 2, modules: [tasks, { ...ModuleDeclarationReaderTests.NOTES, dependencies: { tasks: "0.0.1" } }] }));

      const declarations = await ModuleDeclarationReader.readAsync(file);

      Assert.areEqual("tasks,notes", declarations.map(t => t.id).join(","));
      Assert.areEqual("tasks", declarations[1]?.dependencies.join(","));
    });
  }

  @TestMethod
  public readsTheAppsNoldovaDesktopVersionOrNoneWhenTheFileNamesNone(): Promise<void> {
    return ModuleDeclarationReaderTests.runAsync(async file => {
      await writeFile(file, JSON.stringify({ formatVersion: 2, noldovaDesktop: "0.0.70", modules: [ModuleDeclarationReaderTests.NOTES] }));
      const named = await ModuleDeclarationReader.readNoldovaDesktopAsync(file);
      await writeFile(file, JSON.stringify({ formatVersion: 2, modules: [ModuleDeclarationReaderTests.NOTES] }));

      Assert.areEqual("0.0.70|null", `${String(named)}|${String(await ModuleDeclarationReader.readNoldovaDesktopAsync(file))}`);
    });
  }

  @TestMethod
  public refusesANoldovaDesktopVersionThatIsNotOneExactVersion(): Promise<void> {
    return ModuleDeclarationReaderTests.runAsync(async file => {
      for (const noldovaDesktop of ["0.0", ">=0.0.70 <0.1.0", 70]) {
        await writeFile(file, JSON.stringify({ formatVersion: 2, noldovaDesktop, modules: [] }));
        for (const read of [ModuleDeclarationReader.readAsync, ModuleDeclarationReader.readNoldovaDesktopAsync]) {
          const exception = await Assert.throwsAsync(() => read(file), DeclarationsUnreadableException);
          Assert.isTrue(exception.message.endsWith("A module declaration's noldovaDesktop is missing or invalid."), exception.message);
        }
      }
    });
  }

  @TestMethod
  public locatesTheDeclarationsOfTheBuildAnEntryPointBelongsTo(): void {
    const root = path.resolve("noldova-desktop");
    const entryPath = path.join(root, "node_modules", "@noldova", "desktop.runtime", "services", "runtime-entry.js");

    Assert.areEqual(path.join(root, "_build", "modules", "declarations.json"), ModuleDeclarationReader.locate(entryPath));
  }

  @TestMethod
  public refusesAMissingOrMalformedFileAndNamesIt(): Promise<void> {
    return ModuleDeclarationReaderTests.runAsync(async file => {
      const missing = await Assert.throwsAsync(() => ModuleDeclarationReader.readAsync(file), DeclarationsUnreadableException);
      const cases: readonly (readonly [string, string])[] = [
        ["{", "JsonException: $: The text is not valid JSON."],
        ["[]", "JsonException: $: Expected a JSON object."],
        ["{\"modules\":[]}", "The module declarations have the unsupported format version undefined."],
        ["{\"formatVersion\":1,\"modules\":[]}", "The module declarations have the unsupported format version 1."],
        ["{\"formatVersion\":2}", "JsonException: $.modules: The field is required."],
        ["{\"formatVersion\":2,\"modules\":[1]}", "JsonException: $.modules.0: Expected an object."],
        ["{\"formatVersion\":2,\"modules\":[{}]}", "A module declaration's id is missing or invalid."]
      ];

      Assert.isTrue(missing.message.startsWith(`The module declarations ${file} are not valid: Error: ENOENT`), missing.message);
      Assert.isDefined(missing.cause);
      for (const [text, reason] of cases) {
        await writeFile(file, text);
        const exception = await Assert.throwsAsync(() => ModuleDeclarationReader.readAsync(file), DeclarationsUnreadableException);
        Assert.isTrue(exception.message.startsWith(`The module declarations ${file} are not valid: `), exception.message);
        Assert.isTrue(exception.message.includes(reason), exception.message);
      }
    });
  }

  private static async runAsync(action: (file: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await action(path.join(folder.path, "declarations.json"));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ModuleDeclaration } from "../../../src/models/modules/module-declaration.js";
import { ModuleArtifacts } from "../../../src/services/modules/module-artifacts.js";

@TestClass
export class ModuleArtifactsTests {
  @TestMethod
  public async writesTheDeclarationsAndTheWindowPartsOfTheBuiltModulesAsync(): Promise<void> {
    const root = await ModuleArtifactsTests.createRootAsync();
    try {
      const artifacts = new ModuleArtifacts(root);
      const declarations = [await ModuleDeclaration.readAsync(root, "src/modules/clock", false), await ModuleDeclaration.readAsync(root, "src/modules/worker", false)];

      await artifacts.writeAsync(declarations, null, null);

      const document = JsonReader.parse(await readFile(artifacts.declarationsFile, "utf8"));
      const windowParts = await readFile(artifacts.windowPartsFile, "utf8");
      Assert.areEqual(path.join(root, "_build", "modules", "declarations.json"), artifacts.declarationsFile);
      Assert.areEqual(path.join(root, "_build", "generated", "window-parts.ts"), artifacts.windowPartsFile);
      Assert.areEqual(2, document.readValue("formatVersion"));
      Assert.isFalse(document.hasField("noldovaDesktop"));
      Assert.areEqual("clock,worker", document.readObjectArray("modules").map(t => t.readString("id")).join());
      Assert.isTrue(windowParts.includes("new WindowPartSource(\"clock\""));
      Assert.areEqual(path.join(root, "src", "modules", "clock", "window", "src", "api", "index"),
        path.resolve(path.dirname(artifacts.windowPartsFile), windowParts.match(/import\("([^"]+)"\)/)?.[1] ?? String.empty));
      Assert.isFalse(windowParts.includes("\"worker\""));
      Assert.isTrue(windowParts.includes("export const moduleMenus: IWindowInputs[\"menus\"] = {\n  \"clock\": "));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async writesTheDeclarationsIntoTheOutputFolderWithTheNoldovaDesktopVersionAsync(): Promise<void> {
    const root = await ModuleArtifactsTests.createRootAsync();
    try {
      const artifacts = new ModuleArtifacts(root);
      const output = path.join(root, "out");

      await artifacts.writeAsync([await ModuleDeclaration.readAsync(root, "src/modules/worker", false)], output, "1.2.3");

      const document = JsonReader.parse(await readFile(path.join(output, "modules", "declarations.json"), "utf8"));
      Assert.areEqual(path.join(output, "modules", "declarations.json"), artifacts.locateDeclarations(output));
      Assert.areEqual("1.2.3", document.readString("noldovaDesktop"));
      Assert.isTrue((await readFile(artifacts.windowPartsFile, "utf8")).includes("export const moduleMenus: IWindowInputs[\"menus\"] = {};"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private static async createRootAsync(): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "module-artifacts-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    await ModuleArtifactsTests.writeModuleAsync(root, "clock", ["runtime", "window"], { menus: ["clock.face"] });
    await writeFile(path.join(root, "src", "modules", "clock", "menus.json"), JSON.stringify({ places: [{ name: "clock.face", title: "Face" }], groups: [] }));
    await ModuleArtifactsTests.writeModuleAsync(root, "worker", ["runtime"], {});
    return root;
  }

  private static async writeModuleAsync(root: string, id: string, parts: readonly string[], contributes: Readonly<Record<string, readonly string[]>>): Promise<void> {
    const folder = path.join(root, "src", "modules", id);
    for (const part of parts)
      await mkdir(path.join(folder, part), { recursive: true });
    await writeFile(path.join(folder, "module.json"), JSON.stringify({ id, version: "1.0.0", displayName: id, description: `The ${id} module.`, parts, dependencies: {}, contributes }));
  }
}

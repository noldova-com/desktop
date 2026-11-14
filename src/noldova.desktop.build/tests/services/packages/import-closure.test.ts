/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ContentHash } from "../../../src/services/packages/content-hash.js";
import { ImportClosure } from "../../../src/services/packages/import-closure.js";

@TestClass
export class ImportClosureTests {
  @TestMethod
  public async followsRelativeImportsThatExistInsideTheRootAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "import-closure-"));
    try {
      const root = path.join(folder, "root");
      await mkdir(path.join(root, "lib"), { recursive: true });
      await writeFile(path.join(folder, "outside.js"), "export const outside = 1;\n");
      await writeFile(path.join(root, "main.js"), "import { a } from \"./lib/a.js\";\nimport { b } from \"./lib/b.js\";\nimport { outside } from \"../outside.js\";\nimport { missing } from \"./missing.js\";\nimport path from \"node:path\";\n");
      await writeFile(path.join(root, "lib", "a.js"), "export { b } from \"./b.js\";\nexport const a = 1;\n");
      await writeFile(path.join(root, "lib", "b.js"), "import \"../main.js\";\nexport const b = 2;\n");

      const files = await new ImportClosure(root).listAsync(path.join(root, "main.js"));

      Assert.areEqual([path.join(root, "lib", "a.js"), path.join(root, "lib", "b.js"), path.join(root, "main.js")].join("\n"), files.join("\n"));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async hashesEachFileOfTheClosureByItsPathFromTheRootAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "import-closure-"));
    try {
      await mkdir(path.join(folder, "lib"), { recursive: true });
      await writeFile(path.join(folder, "main.js"), "import \"./lib/a.js\";\n");
      await writeFile(path.join(folder, "lib", "a.js"), "export const a = 1;\n");
      const closure = new ImportClosure(folder);

      const hash = await closure.hashAsync(path.join(folder, "main.js"));
      await writeFile(path.join(folder, "lib", "a.js"), "export const a = 2;\n");
      const changed = await closure.hashAsync(path.join(folder, "main.js"));

      Assert.areNotEqual(hash, changed);
      Assert.areEqual(ContentHash.ofParts([`lib/a.js ${await ContentHash.ofFileAsync(path.join(folder, "lib", "a.js"))}`, `main.js ${await ContentHash.ofFileAsync(path.join(folder, "main.js"))}`]), changed);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

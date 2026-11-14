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

import { OmittedOptionals } from "../../../src/models/packaging/omitted-optionals.js";

@TestClass
export class OmittedOptionalsTests {
  @TestMethod
  public async readsTheOptionalDependenciesEachPackageLeavesOut(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "omitted-optionals-"));
    try {
      await writeFile(path.join(root, "package.json"), JSON.stringify({ desktop: { packaging: { omittedOptionals: {
        "sample@1.0.0": { dependencies: ["native-a", "native-b"], reason: "Never loaded." }
      } } } }));

      const omitted = await OmittedOptionals.readAsync(root);

      Assert.isTrue(omitted.omits("sample@1.0.0", "native-b"));
      Assert.isFalse(omitted.omits("sample@1.0.0", "native-c"));
      Assert.isFalse(omitted.omits("other@1.0.0", "native-a"));
      Assert.areEqual("native-a,native-b", omitted.of("sample@1.0.0").join(","));
      Assert.areEqual(0, omitted.of("other@1.0.0").length);
      Assert.areEqual("sample@1.0.0", omitted.ids.join(","));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public omitsNothingByDefault(): void {
    Assert.areEqual(0, new OmittedOptionals().ids.length);
  }
}

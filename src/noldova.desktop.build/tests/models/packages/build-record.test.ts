/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildRecord } from "../../../src/models/packages/build-record.js";
import { Resources } from "../../../src/resources.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class BuildRecordTests {
  @TestMethod
  public async writesItsInputsAndOutputsAndKnowsWhenAFileRecordsThem(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    const file = path.join(tree.path, "_build", "records", "protocol.txt");
    const outputs = ["dist/index.js"];
    const record = new BuildRecord("abc", outputs);
    outputs.pop();

    const before = await record.isRecordedAsync(file);
    await record.writeAsync(file);

    Assert.isFalse(before);
    Assert.isTrue(await record.isRecordedAsync(file));
    Assert.isFalse(await new BuildRecord("abd", ["dist/index.js"]).isRecordedAsync(file));
    Assert.areEqual(Resources.formatBuildRecord("abc", ["dist/index.js"]), await readFile(file, "utf8"));
  }
}

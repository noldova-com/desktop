/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildPart } from "../../src/models/build-part.js";

@TestClass
export class BuildPartTests {
  @TestMethod
  public readsEachPartAsTheOnlyArgument(): void {
    const lists: readonly (readonly string[])[] = [["--shard=1/2"], ["--shard=2/2"]];

    Assert.areEqual("1 false true 0|2 true false 0", lists.map(t => {
      const part = BuildPart.parse(t);
      return `${String(part.part)} ${String(part.hasPackageTests)} ${String(part.hasWindowChecks)} ${part.removeFrom(t).length}`;
    }).join("|"));
  }

  @TestMethod
  public leavesEveryOtherArgumentListWholeAndUnchanged(): void {
    const lists: readonly (readonly string[])[] = [[], ["--test"], ["--shard=3/2"], ["--shard=1/3"], ["--shard=2/2", "--test"], ["--shard=1/2", "--shard=2/2"]];

    for (const list of lists) {
      const part = BuildPart.parse(list);

      Assert.areEqual(BuildPart.WHOLE, part, list.join(" "));
      Assert.areEqual(list, part.removeFrom(list), list.join(" "));
    }
    Assert.areEqual("true true", `${String(BuildPart.WHOLE.hasPackageTests)} ${String(BuildPart.WHOLE.hasWindowChecks)}`);
  }

  @TestMethod
  public takesAPartByItsNumberAndTheWholeBuildWithoutOne(): void {
    Assert.areEqual(BuildPart.WHOLE, BuildPart.of(null));
    Assert.areEqual(2, BuildPart.of(2).part);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { DependencyOrder } from "../../../src/services/ordering/dependency-order.js";

@TestClass
export class DependencyOrderTests {
  @TestMethod
  public putsEachItemAfterTheItemsItDependsOnKeepingTheGivenOrderWithinALayer(): void {
    const items: readonly (readonly [string, readonly string[]])[] = [["window", ["protocol", "runtime"]], ["runtime", ["protocol"]], ["cli", ["protocol"]], ["protocol", []]];

    const sorted = new DependencyOrder(items, t => t[0], t => t[1]).sort(t => new Error(t.join()));

    Assert.areEqual("protocol,runtime,cli,window", sorted.map(t => t[0]).join());
  }

  @TestMethod
  public refusesACycleWithTheItemsThatFormIt(): void {
    const items: readonly (readonly [string, readonly string[]])[] = [["protocol", []], ["runtime", ["window"]], ["window", ["runtime"]]];

    const error = Assert.throws(() => new DependencyOrder(items, t => t[0], t => t[1]).sort(t => new RangeError(t.join())), RangeError);

    Assert.areEqual("runtime,window", error.message);
  }

  @TestMethod
  public sortsNoItems(): void {
    Assert.areEqual(0, new DependencyOrder<string>([], t => t, () => []).sort(t => new Error(t.join())).length);
  }
}

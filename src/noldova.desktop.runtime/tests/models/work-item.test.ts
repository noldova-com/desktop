/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WorkItem } from "@noldova/desktop.runtime";

@TestClass
export class WorkItemTests {
  @TestMethod
  public cancelsThroughItsSignalAndReportsItsEnd(): void {
    const finished: WorkItem[] = [];
    const item = new WorkItem("Indexing the project", t => finished.push(t));

    Assert.areEqual("Indexing the project", item.description);
    Assert.isFalse(item.signal.aborted);
    item.cancel();
    Assert.isTrue(item.signal.aborted);
    Assert.areEqual(0, finished.length);
    item[Symbol.dispose]();
    Assert.areEqual(item, finished[0]);
  }

  @TestMethod
  public requiresADescription(): void {
    Assert.areEqual("description", Assert.throws(() => new WorkItem(" ", () => undefined), ArgumentException).parameterName);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PathCommandException } from "@noldova/desktop.electron";

@TestClass
export class PathCommandExceptionTests {
  @TestMethod
  public namesTheLinkAndKeepsTheCause(): void {
    const cause = new Error("EACCES: permission denied, symlink");

    const failure = new PathCommandException("/usr/local/bin/noldova-desktop", cause);

    Assert.areEqual("The noldova-desktop command could not be linked at /usr/local/bin/noldova-desktop: Error: EACCES: permission denied, symlink", failure.message);
    Assert.areEqual("/usr/local/bin/noldova-desktop", failure.link);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("PathCommandException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}

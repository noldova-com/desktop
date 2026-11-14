/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildIdentity, RuntimeHandover } from "@noldova/desktop.protocol";
import { BuildMismatchException } from "@noldova/desktop.runtime";

@TestClass
export class BuildMismatchExceptionTests {
  @TestMethod
  public namesTheRunningApp(): void {
    const handover = new RuntimeHandover(new BuildIdentity("1.0.0", BuildIdentity.supportedProtocolVersion, "older"), "/opt/noldova-desktop/noldova-desktop");

    const exception = new BuildMismatchException(handover);

    Assert.areEqual("Noldova Desktop Sample 1.0.0 at /opt/noldova-desktop/noldova-desktop owns this data directory; it is another build, and taking it over was not asked for.", exception.message);
    Assert.areEqual(handover, exception.handover);
    Assert.areEqual("BuildMismatchException", exception.name);
  }
}

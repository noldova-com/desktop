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
import { RuntimeHandoverException } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeHandoverExceptionTests {
  @TestMethod
  public namesTheNewerApp(): void {
    const handover = new RuntimeHandover(new BuildIdentity("2.0.0", BuildIdentity.supportedProtocolVersion, "newer"), "/opt/noldova-desktop/noldova-desktop");

    const exception = new RuntimeHandoverException(handover);

    Assert.areEqual("Noldova Desktop Sample 2.0.0 at /opt/noldova-desktop/noldova-desktop owns this data directory and is newer; open that Noldova Desktop Sample instead.", exception.message);
    Assert.areEqual(handover, exception.handover);
    Assert.areEqual("RuntimeHandoverException", exception.name);
  }
}

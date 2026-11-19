/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../src/exceptions/build.exception.js";
import { ProcessTimeoutException } from "../../src/exceptions/process-timeout.exception.js";

@TestClass
export class ProcessTimeoutExceptionTests {
  @TestMethod
  public isABuildExceptionWithItsOwnNameAndItsFacts(): void {
    const exception = new ProcessTimeoutException("npm", 5000);

    Assert.areEqual("ProcessTimeoutException", exception.name);
    Assert.areEqual("\"npm\" did not finish within 5000 ms.", exception.message);
    Assert.areEqual("npm", exception.command);
    Assert.areEqual(5000, exception.timeout);
    Assert.isUndefined(exception.cause);
    Assert.isInstanceOf(exception, BuildException);
  }

  @TestMethod
  public saysWhatTheProcessLastWroteOrThatItWroteNothing(): void {
    const waiting = "Waiting for cache lock: Could not get lock /var/lib/dpkg/lock-frontend. It is held by process 2384 (unattended-upgr)";
    const lines = Array.from({ length: 25 }, (_, i) => `Get:${i + 1} http://archive.ubuntu.com/ubuntu noble InRelease`);

    Assert.areEqual(`"sudo" did not finish within 120000 ms. Its last output before it was stopped:\nReading package lists...\n${waiting}`,
      new ProcessTimeoutException("sudo", 120000, `Reading package lists...\n\n${waiting}\n`).message);
    Assert.areEqual(`"sudo" did not finish within 120000 ms. Its last output before it was stopped:\n${lines.slice(-20).join("\n")}`,
      new ProcessTimeoutException("sudo", 120000, lines.join("\n")).message);
    Assert.areEqual("\"sudo\" did not finish within 120000 ms. It wrote nothing before it was stopped.", new ProcessTimeoutException("sudo", 120000, " \n").message);
  }
}

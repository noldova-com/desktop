/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { WindowsPublisher } from "../../../src/models/packaging/windows-publisher.js";

@TestClass
export class WindowsPublisherTests {
  private static readonly EXPECTED: string = "Signing Windows packages needs WINDOWS_PUBLISHER, the distinguished name of the signing certificate's subject, starting with CN= and with its "
    + "fields separated by \", \"; ";

  @TestMethod
  public takesTheCertificatesSubject(): void {
    Assert.areEqual("CN=Sample, O=Sample, C=US", WindowsPublisher.take({ WINDOWS_PUBLISHER: "CN=Sample, O=Sample, C=US" }));
  }

  @TestMethod
  public refusesAMissingPublisher(): void {
    const error = Assert.throws(() => WindowsPublisher.take({}), BuildException);

    Assert.areEqual(`${WindowsPublisherTests.EXPECTED}it is not set.`, error.message);
  }

  @TestMethod
  public refusesAPublisherThatIsNotASubject(): void {
    for (const publisher of ["Sample", "CN=Sample,O=Sample", "CN=Sample; O=Sample"]) {
      const error = Assert.throws(() => WindowsPublisher.take({ WINDOWS_PUBLISHER: publisher }), BuildException);

      Assert.areEqual(`${WindowsPublisherTests.EXPECTED}it is set to something else.`, error.message);
    }
  }
}

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
import { LicenseExpression } from "../../../src/models/packaging/license-expression.js";

@TestClass
export class LicenseExpressionTests {
  private static readonly ALLOWED: string = "one of MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0, Unlicense, or an OR expression with one of them";

  @TestMethod
  public takesAnAllowedLicenseAsItIs(): void {
    const license = new LicenseExpression("sample@1.0.0", "MIT");

    Assert.areEqual("MIT MIT false MIT", `${license.expression} ${license.chosen} ${license.isAccepted} ${license.describe()}`);
  }

  @TestMethod
  public choosesTheFirstAllowedLicenseOfAnOrExpression(): void {
    const license = new LicenseExpression("sample@1.0.0", "(GPL-3.0 OR Apache-2.0 OR MIT)");

    Assert.areEqual("Apache-2.0", license.chosen);
    Assert.areEqual("Apache-2.0, chosen from \"(GPL-3.0 OR Apache-2.0 OR MIT)\"", license.describe());
  }

  @TestMethod
  public takesTheLicenseTheAppAcceptsForThePackage(): void {
    const license = new LicenseExpression("sample@1.0.0", "SEE LICENSE IN TERMS.md", "SEE LICENSE IN TERMS.md");

    Assert.isTrue(license.isAccepted);
    Assert.areEqual("SEE LICENSE IN TERMS.md, accepted by the app", license.describe());
  }

  @TestMethod
  public refusesAPackageThatNamesNoLicense(): void {
    for (const expression of [undefined, 1, null]) {
      const error = Assert.throws(() => new LicenseExpression("sample@1.0.0", expression, null), BuildException);

      Assert.areEqual(`sample@1.0.0 names no license in its package.json; a third-party runtime package needs ${LicenseExpressionTests.ALLOWED}.`, error.message);
    }
  }

  @TestMethod
  public refusesALicenseWithoutAnAllowedChoiceAndNamesTheOtherAcceptedVersions(): void {
    const refused = Assert.throws(() => new LicenseExpression("sample@1.0.0", "GPL-3.0 OR AGPL-3.0"), BuildException);
    const compound = Assert.throws(() => new LicenseExpression("sample@1.0.0", "MIT AND Custom", "Custom", ["sample@0.9.0"]), BuildException);

    Assert.areEqual(`sample@1.0.0 is licensed under "GPL-3.0 OR AGPL-3.0"; a third-party runtime package needs ${LicenseExpressionTests.ALLOWED}.`, refused.message);
    Assert.areEqual(`sample@1.0.0 is licensed under "MIT AND Custom"; a third-party runtime package needs ${LicenseExpressionTests.ALLOWED}. `
      + "The app accepts another license only for sample@0.9.0, so this version's terms need accepting again.", compound.message);
  }
}

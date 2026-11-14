/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { InstalledCopies } from "../../../src/services/angular/installed-copies.js";

@TestClass
export class InstalledCopiesTests {
  private static readonly NAME: string = "@angular/cdk";

  @TestMethod
  public listsEachCopyWithItsVersionAndTheWayDownToIt(): void {
    const listing = JSON.stringify({ dependencies: {
      "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" },
      kit: { version: "1.0.0", dependencies: { other: { dependencies: { "@angular/cdk": { version: "22.2.0", path: "/app/node_modules/other/node_modules/@angular/cdk" } } } } }
    } });

    Assert.areEqual("22.2.1 (@angular/cdk); 22.2.0 (kit > other > @angular/cdk)", InstalledCopies.find(listing, InstalledCopiesTests.NAME).join("; "));
  }

  @TestMethod
  public countsACopyOnceHoweverOftenItIsListedAndLeavesOutOneThatIsMissing(): void {
    const listing = JSON.stringify({ dependencies: {
      "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" },
      kit: { dependencies: { "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" } } },
      peer: { dependencies: { "@angular/cdk": { required: "22.2.1", missing: true } } }
    } });

    Assert.areEqual("22.2.1 (@angular/cdk)", InstalledCopies.find(listing, InstalledCopiesTests.NAME).join("; "));
  }

  @TestMethod
  public countsEachCopyWithoutAPathByTheWayDownToIt(): void {
    const listing = JSON.stringify({ dependencies: {
      "@angular/cdk": { version: "22.2.1" },
      kit: { dependencies: { "@angular/cdk": { version: "22.2.1" } } }
    } });

    Assert.areEqual("22.2.1 (@angular/cdk); 22.2.1 (kit > @angular/cdk)", InstalledCopies.find(listing, InstalledCopiesTests.NAME).join("; "));
  }

  @TestMethod
  public findsNoCopyInAListingWithNoDependencies(): void {
    Assert.areEqual(0, InstalledCopies.find("{\"name\":\"app\"}", InstalledCopiesTests.NAME).length);
  }

  @TestMethod
  public countsAnExtraneousCopyAndAnInvalidOneBesideTheirPeers(): void {
    const listing = JSON.stringify({ dependencies: {
      "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk", extraneous: true },
      kit: { dependencies: { "@angular/cdk": { version: "22.2.0", path: "/app/node_modules/kit/node_modules/@angular/cdk", invalid: "\"22.2.1\" from the root project" } } }
    } });

    Assert.areEqual("22.2.1 (@angular/cdk); 22.2.0 (kit > @angular/cdk)", InstalledCopies.find(listing, InstalledCopiesTests.NAME).join("; "));
  }

  @TestMethod
  public stillChecksAListingThatReportsAnErrorBesideItsDependencies(): void {
    const listing = JSON.stringify({ error: { code: "ELSPROBLEMS" }, dependencies: { "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" } } });

    Assert.areEqual("22.2.1 (@angular/cdk)", InstalledCopies.find(listing, InstalledCopiesTests.NAME).join("; "));
  }

  @TestMethod
  public async refusesOutputThatIsNotAListing(): Promise<void> {
    const error = await Assert.throwsAsync(() => Promise.resolve(InstalledCopies.find("npm ERR! code ELSPROBLEMS", InstalledCopiesTests.NAME)), BuildException);

    Assert.areEqual("\"npm ls @angular/cdk\" gave no list of copies to check:\nnpm ERR! code ELSPROBLEMS", error.message);
  }

  @TestMethod
  public async refusesAnErrorWithNoDependenciesInsteadOfCountingNoCopies(): Promise<void> {
    const listing = "{\"error\":{\"code\":\"EJSONPARSE\"}}";

    const error = await Assert.throwsAsync(() => Promise.resolve(InstalledCopies.find(listing, InstalledCopiesTests.NAME)), BuildException);

    Assert.areEqual(`"npm ls @angular/cdk" gave no list of copies to check:\n${listing}`, error.message);
  }

  @TestMethod
  public async refusesJsonThatIsNotAnObject(): Promise<void> {
    const error = await Assert.throwsAsync(() => Promise.resolve(InstalledCopies.find("[]", InstalledCopiesTests.NAME)), BuildException);

    Assert.areEqual("\"npm ls @angular/cdk\" gave no list of copies to check:\n[]", error.message);
  }
}

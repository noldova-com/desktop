/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { Resources } from "../../../src/resources.js";

@TestClass
export class ProductIdentityTests {
  private static readonly PRODUCT: Readonly<Record<string, unknown>> = {
    name: "Sample App",
    publisher: "Sample",
    slug: "sample-app",
    applicationId: "com.example.sample",
    developmentApplicationId: "com.example.sample.development",
    dataFolder: ".sample/app",
    deviceFolders: { windows: "Sample/App", macos: "Sample/App", linux: "sample/app" },
    dataDirectoryVariable: "SAMPLE_APP_DATA_DIR",
    icons: "assets/icons",
    releaseRepository: "example/sample-app"
  };

  @TestMethod
  public readsTheAppsOwnFeedAndOtherwiseItsReleaseRepositorysLatestRelease(): void {
    const named = ProductIdentityTests.read({ updateFeed: "https://updates.example.test/" });
    const nested = ProductIdentityTests.read({ updateFeed: "https://updates.example.test/sample-app/" });
    const none = ProductIdentityTests.read({});

    Assert.areEqual(["https://updates.example.test/", "https://updates.example.test/"].join(" "), [named.namedUpdateFeed, named.updateFeed].join(" "));
    Assert.areEqual("https://updates.example.test/sample-app/", nested.updateFeed);
    Assert.isNull(none.namedUpdateFeed);
    Assert.areEqual("https://github.com/example/sample-app/releases/latest/download/", none.updateFeed);
  }

  @TestMethod
  public refusesAFeedThatIsNotAnHttpsFolderOrCarriesUserInfoAQueryOrAFragment(): void {
    const refused = [
      "http://updates.example.test/",
      "http://127.0.0.1:47325/",
      "https://updates.example.test",
      "https://updates.example.test/latest-linux-x64.yml",
      "https://user:secret@updates.example.test/",
      "https://user@updates.example.test/",
      "https://updates.example.test/?id=1/",
      "https://updates.example.test/?/",
      "https://updates.example.test/#a/",
      "https://updates.example.test/a b/",
      "updates.example.test/",
      String.empty,
      42
    ];

    for (const updateFeed of refused) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ updateFeed }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.updateFeed must be an https folder URL ending in /, with no user info, query or fragment.", refusal.message,
        JSON.stringify(updateFeed));
    }
  }

  @TestMethod
  public readsTheInstallFolderTheAppNamesAndNoneWhenItNamesNone(): void {
    Assert.areEqual("Noldova", ProductIdentityTests.read({ installFolder: "Noldova" }).installFolder);
    Assert.areEqual("Noldova Apps|Noldova.Apps|N", ["Noldova Apps", "Noldova.Apps", "N"].map(t => ProductIdentityTests.read({ installFolder: t }).installFolder).join("|"));
    Assert.isNull(ProductIdentityTests.read({}).installFolder);
  }

  @TestMethod
  public refusesANameTheScriptsOrTheUploadWouldReadOrThePackagesWouldNameOtherwise(): void {
    for (const value of ["Te\"st", "Te\\st", "Te\nst", "Te\rst", "Te\tst", "Te\u0000st", "Te\u007fst", "Te\u0085st", "100% Done", "Done!", "Te$t", "Te`st`", "A#B", "Notes/Pro", "Notes?",
      "<Notes>", "Notes: Pro", "Notes*", "Notes|Pro", "[Notes]", "{Notes}", "Notes@{HOME}", "Notes.", "Notes ", "...", "CON", "con.app", "Nul", "COM1", "lpt9", " ", String.empty]) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ name: value }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.name must be a name without quotes, backslashes, % ! $ ` # / ? < > : * | [ ] { } or control characters, "
        + "with no dot or space at its end, and not a name Windows reserves, such as CON.", refusal.message, JSON.stringify(value));
    }
    for (const name of ["Sample & App (2)", "Notes Pro 2.0", "Console", "COM", "Notes@Work", ".Notes"])
      Assert.areEqual(name, ProductIdentityTests.read({ name }).name);
  }

  @TestMethod
  public refusesAPublisherTheGeneratedScriptsWouldRead(): void {
    for (const value of ["Te\"st", "Te\\st", "Te\nst", "Te\rst", "100% Done", "Done!", "Te$t", "Te`st`", " ", String.empty]) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ publisher: value }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.publisher must be a name without quotes, backslashes, % ! $ ` or line breaks.", refusal.message,
        JSON.stringify(value));
    }
    Assert.areEqual("Sample Inc.", ProductIdentityTests.read({ publisher: "Sample Inc." }).publisher);
  }

  @TestMethod
  public refusesAnInstallFolderThatIsNotOneSafeFolderName(): void {
    for (const installFolder of ["Noldova/Apps", "Noldova\\Apps", "C:", " Noldova", "Noldova ", ".", "..", ".Noldova", "Noldova.", "No?va", "No'va", "No$va", "No`va",
      "No\tva", String.empty, 42]) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ installFolder }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.installFolder must be one folder name such as Noldova, without / \\ : * ? \" < > | ' $ ` or control characters, "
        + "and with no space or dot at either end.", refusal.message, JSON.stringify(installFolder));
    }
  }

  @TestMethod
  public readsTheTitleBarsNameAndIconTheAppGivesAndNoneWhenItGivesNone(): void {
    const given = ProductIdentityTests.read({ titleBarName: "Sample: Notes", titleBarIcon: "assets/Title Bar.SVG" });
    const none = ProductIdentityTests.read({});
    const icons = ["assets/title-bar.png", "data:image/png;base64,iVBORw0KGgo=", "data:image/svg+xml,%3Csvg%2F%3E"].map(t => ProductIdentityTests.read({ titleBarIcon: t }).titleBarIcon);

    Assert.areEqual(JSON.stringify([["Sample: Notes", "assets/Title Bar.SVG"], [null, null], ["assets/title-bar.png", "data:image/png;base64,iVBORw0KGgo=", "data:image/svg+xml,%3Csvg%2F%3E"]]),
      JSON.stringify([[given.titleBarName, given.titleBarIcon], [none.titleBarName, none.titleBarIcon], icons]));
  }

  @TestMethod
  public readsWhetherTheDocumentTabsStandInTheTitleBarAndLeavesThemOutWhenTheAppSaysNothing(): void {
    const read = [true, false].map(titleBarDocumentTabs => ProductIdentityTests.read({ titleBarDocumentTabs }).isTitleBarDocumentTabs);

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify([...read, ProductIdentityTests.read({}).isTitleBarDocumentTabs]));
  }

  @TestMethod
  public refusesATitleBarDocumentTabsValueThatIsNotTrueOrFalse(): void {
    for (const titleBarDocumentTabs of ["true", 1, 0, null, String.empty, []]) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ titleBarDocumentTabs }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.titleBarDocumentTabs must be true or false.", refusal.message, JSON.stringify(titleBarDocumentTabs));
    }
  }

  @TestMethod
  public refusesATitleBarNameThatIsNotOneLineOfText(): void {
    for (const titleBarName of ["Sample\nNotes", "Sample\rNotes", " ", String.empty, 42]) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ titleBarName }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.titleBarName must be one line of text.", refusal.message, JSON.stringify(titleBarName));
    }
  }

  @TestMethod
  public refusesATitleBarIconThatIsNotAPngOrSvgInTheAppOrADataUrlOfOne(): void {
    for (const titleBarIcon of ["assets/title-bar.jpg", "assets/title-bar", "/assets/title-bar.svg", "../title-bar.svg", "assets/../title-bar.svg", "assets//title-bar.svg",
      "C:\\title-bar.svg", "https://example.test/title-bar.svg", "data:image/jpeg;base64,AAAA", "data:image/png;base64,", "data:text/html,<svg/>", String.empty, 42]) {
      const refusal = Assert.throws(() => ProductIdentityTests.read({ titleBarIcon }), BuildException);
      Assert.areEqual("The root package.json's desktop.product.titleBarIcon must be a PNG or SVG file's path from the app's root, such as assets/title-bar.svg, "
        + "or a data: URL of a PNG or SVG image.", refusal.message, JSON.stringify(titleBarIcon));
    }
  }

  @TestMethod
  public async readsTheProductFromTheRootsManifestOrRefusesWithoutOneAsync(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "product-identity-"));
    try {
      const missing = await Assert.throwsAsync(() => ProductIdentity.readAsync(root), BuildException);
      await writeFile(path.join(root, "package.json"), JSON.stringify({ desktop: { product: ProductIdentityTests.PRODUCT } }));

      const product = await ProductIdentity.readAsync(root);

      Assert.areEqual(Resources.productMissing, missing.message);
      Assert.areEqual("sample-app", product.slug);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private static read(fields: Readonly<Record<string, unknown>>): ProductIdentity {
    return ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product: { ...ProductIdentityTests.PRODUCT, ...fields } } }));
  }
}

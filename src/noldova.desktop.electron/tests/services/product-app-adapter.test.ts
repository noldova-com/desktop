/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

@TestClass
export class ProductAppAdapterTests {
  @TestMethod
  public async findsTheUpdaterInternalsItBuildsOnWhereItImportsThem(): Promise<void> {
    const [appAdapter, httpExecutor, provider] = await Promise.all([
      import("electron-updater/out/AppAdapter.js"),
      import("electron-updater/out/electronHttpExecutor.js"),
      import("electron-updater/out/providers/Provider.js")
    ]);

    Assert.areEqual("function,function,function,function",
      [typeof appAdapter.getAppCacheDir, typeof httpExecutor.ElectronHttpExecutor, typeof httpExecutor.getNetSession, typeof provider.parseUpdateInfo].join(","));
  }
}

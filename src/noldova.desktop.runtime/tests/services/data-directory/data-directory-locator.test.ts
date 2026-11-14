/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectoryLocator } from "@noldova/desktop.runtime";

@TestClass
export class DataDirectoryLocatorTests {
  private static readonly HOME: string = path.resolve("home", "person");
  private static readonly CHECKOUT: string = path.resolve("work", "noldova-desktop");
  private static readonly VARIABLE: string = path.resolve("lane", "data");
  private static readonly EXPLICIT: string = path.resolve("chosen", "data");

  @TestMethod
  public anExplicitDirectoryWins(): void {
    const environment = { NOLDOVA_DESKTOP_DATA_DIR: DataDirectoryLocatorTests.VARIABLE };

    Assert.areEqual(DataDirectoryLocatorTests.EXPLICIT, DataDirectoryLocatorTests.locate(true, environment, DataDirectoryLocatorTests.EXPLICIT));
    Assert.areEqual(DataDirectoryLocatorTests.EXPLICIT, DataDirectoryLocatorTests.locate(false, environment, DataDirectoryLocatorTests.EXPLICIT));
  }

  @TestMethod
  public aPackagedBuildUsesThePersonsDirectory(): void {
    const expected = path.join(DataDirectoryLocatorTests.HOME, ".noldova", "desktop");

    Assert.areEqual(expected, DataDirectoryLocatorTests.locate(true, { NOLDOVA_DESKTOP_DATA_DIR: DataDirectoryLocatorTests.VARIABLE }));
    Assert.areEqual(expected, DataDirectoryLocatorTests.locate(true, {}, " "));
  }

  @TestMethod
  public developmentUsesTheVariable(): void {
    Assert.areEqual(DataDirectoryLocatorTests.VARIABLE, DataDirectoryLocatorTests.locate(false, { NOLDOVA_DESKTOP_DATA_DIR: DataDirectoryLocatorTests.VARIABLE }));
  }

  @TestMethod
  public developmentOtherwiseStaysInTheCheckout(): void {
    const expected = path.join(DataDirectoryLocatorTests.CHECKOUT, "_build", "data");

    Assert.areEqual(expected, DataDirectoryLocatorTests.locate(false, {}));
    Assert.areEqual(expected, DataDirectoryLocatorTests.locate(false, { NOLDOVA_DESKTOP_DATA_DIR: "  " }, String.empty));
  }

  private static locate(isPackaged: boolean, environment: NodeJS.ProcessEnv, explicit?: string): string {
    return DataDirectoryLocator.locate(isPackaged, environment, DataDirectoryLocatorTests.HOME, DataDirectoryLocatorTests.CHECKOUT, explicit).root;
  }
}

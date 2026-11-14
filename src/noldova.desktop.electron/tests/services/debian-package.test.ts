/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DebianPackage } from "@noldova/desktop.electron";

@TestClass
export class DebianPackageTests {
  @TestMethod
  public async findsADebianInstallOnLinuxFromThePackageTypeBesideTheProgram(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-debian-package-"));
    try {
      const program = path.join(folder, "noldova-desktop");
      const missing = DebianPackage.isInstalled("linux", program);
      await mkdir(path.join(folder, "resources"));
      await writeFile(path.join(folder, "resources", "package-type"), "AppImage\n");
      const other = DebianPackage.isInstalled("linux", program);
      await writeFile(path.join(folder, "resources", "package-type"), "deb\n");

      Assert.isFalse(missing);
      Assert.isFalse(other);
      Assert.isTrue(DebianPackage.isInstalled("linux", program));
      Assert.isFalse(DebianPackage.isInstalled("win32", program));
      Assert.isFalse(DebianPackage.isInstalled("darwin", program));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

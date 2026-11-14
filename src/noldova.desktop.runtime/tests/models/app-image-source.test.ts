/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageSource } from "@noldova/desktop.runtime";

import { FileSystemPatchFixture } from "../fixtures/file-system-patch.fixture.js";

@TestClass
export class AppImageSourceTests {
  private static readonly ENVIRONMENT: NodeJS.ProcessEnv = { APPIMAGE: "/home/person/Studio.AppImage", APPDIR: "/tmp/.mount_StudiX" };

  @TestMethod
  public findsTheAppImageOfAProgramInsideItsFolder(): void {
    const source = AppImageSource.find({ ...AppImageSourceTests.ENVIRONMENT, APPDIR: "/tmp//.mount_StudiX/" }, "/tmp/.mount_StudiX/studio");

    Assert.areEqual("/home/person/Studio.AppImage", source?.file);
    Assert.areEqual("/tmp/.mount_StudiX", source?.folder);
  }

  @TestMethod
  public findsNoAppImageWithoutBothAbsolutePathsOrForAProgramOutsideItsFolder(): void {
    const cases: readonly (readonly [NodeJS.ProcessEnv, string])[] = [
      [{}, "/tmp/.mount_StudiX/studio"],
      [{ APPIMAGE: "/home/person/Studio.AppImage" }, "/tmp/.mount_StudiX/studio"],
      [{ APPDIR: "/tmp/.mount_StudiX" }, "/tmp/.mount_StudiX/studio"],
      [{ ...AppImageSourceTests.ENVIRONMENT, APPIMAGE: "Studio.AppImage" }, "/tmp/.mount_StudiX/studio"],
      [{ ...AppImageSourceTests.ENVIRONMENT, APPDIR: "mount" }, "mount/studio"],
      [AppImageSourceTests.ENVIRONMENT, "/tmp/.mount_StudiX"],
      [AppImageSourceTests.ENVIRONMENT, "/tmp"],
      [AppImageSourceTests.ENVIRONMENT, "/tmp/.mount_StudiY/studio"],
      [AppImageSourceTests.ENVIRONMENT, "/opt/studio/studio"]
    ];

    Assert.areEqual(",,,,,,,,", cases.map(([environment, program]) => AppImageSource.find(environment, program)?.file ?? String.empty).join(","));
  }

  @TestMethod
  public async isMountedWhenItsFolderIsAMountPoint(): Promise<void> {
    const table = [
      "22 1 0:21 / /proc rw,nosuid shared:12 - proc proc rw",
      "98 29 0:62 / /tmp/.mount\\040Studio rw,nosuid,nodev shared:51 - fuse.Studio.AppImage Studio.AppImage ro",
      String.empty
    ].join("\n");
    using _fileSystem = new FileSystemPatchFixture(null, table);

    const mounted = AppImageSource.find({ APPIMAGE: "/home/person/Studio.AppImage", APPDIR: "/tmp/.mount Studio" }, "/tmp/.mount Studio/studio");
    const extracted = AppImageSource.find({ APPIMAGE: "/home/person/Studio.AppImage", APPDIR: "/tmp/appimage_extracted_1f" }, "/tmp/appimage_extracted_1f/studio");

    Assert.areEqual(true, await mounted?.isMountedAsync());
    Assert.areEqual(false, await extracted?.isMountedAsync());
  }

  @TestMethod
  public async isNotMountedWhenTheSystemHasNoMountTable(): Promise<void> {
    using fileSystem = new FileSystemPatchFixture(null, null);

    const source = AppImageSource.find({ APPIMAGE: "/home/person/Studio.AppImage", APPDIR: "/tmp/.mount Studio" }, "/tmp/.mount Studio/studio");

    Assert.areEqual(false, await source?.isMountedAsync());
    Assert.areEqual("/proc/self/mountinfo", fileSystem.checked.join(","));
  }

  @TestMethod
  public async failsWhenTheMountTableCannotBeRead(): Promise<void> {
    using _fileSystem = new FileSystemPatchFixture("/proc/self/mountinfo");

    const source = AppImageSource.find({ APPIMAGE: "/home/person/Studio.AppImage", APPDIR: "/tmp/.mount Studio" }, "/tmp/.mount Studio/studio");
    if (Object.isNull(source))
      throw new Error("The fixture names no AppImage.");

    const error = await Assert.throwsAsync(() => source.isMountedAsync(), Error);

    Assert.isTrue(error.message.startsWith("EACCES"), error.message);
  }

  @TestMethod
  public locatesTheAppImageForAProgramInsideItAndTheProgramOtherwise(): void {
    Assert.areEqual("/home/person/Studio.AppImage", AppImageSource.locateProgram(AppImageSourceTests.ENVIRONMENT, "/tmp/.mount_StudiX/studio"));
    Assert.areEqual("/opt/studio/studio", AppImageSource.locateProgram(AppImageSourceTests.ENVIRONMENT, "/opt/studio/studio"));
  }
}

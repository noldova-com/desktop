/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import type { IShownPathFiles } from "@noldova/desktop.electron";

import { ShownFilePolicy } from "../../src/services/shown-file-policy.js";
import { CodedError } from "../fixtures/coded-error.fixture.js";
import { LinkedPathsFixture } from "../fixtures/linked-paths.fixture.js";

@TestClass
export class ShownFilePolicyTests {
  @TestMethod
  @TestData("/Noldova/data/report.pdf", "/Noldova/data/report.pdf", null)
  @TestData("/Noldova/data", "/Noldova/data", null)
  @TestData("/Noldova/linked/report.pdf", "/Noldova/data/report.pdf", null)
  @TestData("/Noldova/profile/./report.pdf", "/Noldova/data/report.pdf", null)
  @TestData("/Noldova/data/../data/report.pdf", "/Noldova/data/report.pdf", null)
  @TestData("/Noldova/pipe", "/Noldova/pipe", "the path isn't a regular file or a folder.")
  @TestData("/Noldova/missing.pdf", "/Noldova/missing.pdf", "no file can be read at the path.")
  @TestData("/Noldova/loop/report.pdf", "/Noldova/loop/report.pdf", "no file can be read at the path.")
  @TestData("/Noldova/broken/report.pdf", "/Noldova/broken/report.pdf", "no file can be read at the path.")
  @TestData("Noldova/data/report.pdf", "Noldova/data/report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.")
  @TestData("/Noldova/\u0000report.pdf", "/Noldova/\u0000report.pdf", "the path isn't text without null characters.")
  public async checksWhatAPosixPathLeadsToByFollowingEachLink(file: string, path: string, refusal: string | null): Promise<void> {
    const paths = new LinkedPathsFixture("linux", {
      "/Noldova/data/report.pdf": LinkedPathsFixture.fileMode,
      "/Noldova/linked": "data",
      "/Noldova/profile": "linked",
      "/Noldova/pipe": 0o010644,
      "/Noldova/loop": "/Noldova/loop",
      "/Noldova/broken": null
    });

    const checked = await ShownFilePolicy.checkAsync(file, "linux", paths);

    Assert.areEqual(JSON.stringify({ path, refusal }), JSON.stringify(checked));
  }

  @TestMethod
  @TestData("C:\\Noldova\\report.pdf", "C:\\Noldova\\report.pdf", null)
  @TestData("C:/Noldova/report.pdf", "C:\\Noldova\\report.pdf", null)
  @TestData("C:\\Noldova\\shared.pdf", "\\\\server\\share\\report.pdf", "a link in the path leads to a network or device path, which is never shown.")
  @TestData("\\\\server\\share\\report.pdf", "\\\\server\\share\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.")
  @TestData("\\\\?\\C:\\Noldova\\report.pdf", "\\\\?\\C:\\Noldova\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.")
  public async showsOnlyDrivePathsOnWindowsAndNeverLooksAtANetworkPath(file: string, path: string, refusal: string | null): Promise<void> {
    const paths = new LinkedPathsFixture("win32", {
      "C:\\Noldova\\report.pdf": LinkedPathsFixture.fileMode,
      "C:\\Noldova\\shared.pdf": "\\\\server\\share\\report.pdf"
    });

    const checked = await ShownFilePolicy.checkAsync(file, "win32", paths);

    Assert.areEqual(JSON.stringify({ path, refusal }), JSON.stringify(checked));
    Assert.isFalse(paths.looked.some(t => t.startsWith("\\\\")), paths.looked.join(" "));
  }

  @TestMethod
  public refusesAPathThatIsNotAbsoluteWithTheTextItIsGiven(): void {
    Assert.areEqual("refused", ShownFilePolicy.findPathRefusal("report.pdf", "linux", "refused"));
    Assert.areEqual("refused", ShownFilePolicy.findPathRefusal("\\Noldova\\report.pdf", "win32", "refused"));
    Assert.isNull(ShownFilePolicy.findPathRefusal("/Noldova/report.pdf", "linux", "refused"));
    Assert.isNull(ShownFilePolicy.findPathRefusal("D:\\Noldova\\report.pdf", "win32", "refused"));
  }

  @TestMethod
  @TestData("/Noldova/broken")
  @TestData("/Noldova/loop")
  @TestData("/Noldova/dangling")
  public async findsNoTargetWhenALinkCannotBeReadLinksTooDeepOrLeadsNowhere(file: string): Promise<void> {
    const paths = new LinkedPathsFixture("linux", { "/Noldova/broken": null, "/Noldova/loop": "/Noldova/loop", "/Noldova/dangling": "/Noldova/missing" });

    Assert.isNull(await ShownFilePolicy.findTargetAsync(file, "linux", paths));
  }

  @TestMethod
  @TestData("lstat")
  @TestData("readlink")
  public async throwsAFailureToReadAPathThatIsNotAnUnreadablePath(failing: string): Promise<void> {
    const paths = new LinkedPathsFixture("linux", { "/Noldova/data/report.pdf": LinkedPathsFixture.fileMode, "/Noldova/linked": "data" });
    const files: IShownPathFiles = {
      lstat: file => failing === "lstat" ? Promise.reject(new CodedError("EIO", "i/o error")) : paths.lstat(file),
      readlink: link => failing === "readlink" ? Promise.reject(new CodedError("EIO", "i/o error")) : paths.readlink(link),
      realpath: file => paths.realpath(file)
    };

    const error = await Assert.throwsAsync(() => ShownFilePolicy.checkAsync("/Noldova/linked/report.pdf", "linux", files), CodedError);

    Assert.areEqual("EIO", error.code);
  }

  @TestMethod
  public async followsARelativeLinkFromTheFolderItSitsIn(): Promise<void> {
    const paths = new LinkedPathsFixture("linux", { "/Noldova/data/inner/report.pdf": LinkedPathsFixture.fileMode, "/Noldova/data/link": "inner/report.pdf" });

    const found = await ShownFilePolicy.findTargetAsync("/Noldova/data/link", "linux", paths);

    Assert.areEqual("/Noldova/data/inner/report.pdf", found?.path);
    Assert.isTrue(found?.status?.isFile() === true, "the target is a file");
  }

  @TestMethod
  public async reportsTheTargetOfALinkElsewhereWithNoStatus(): Promise<void> {
    const paths = new LinkedPathsFixture("win32", { "C:\\Noldova\\shared": "\\\\server\\share" });

    const found = await ShownFilePolicy.findTargetAsync("C:\\Noldova\\shared\\report.pdf", "win32", paths);

    Assert.areEqual("\\\\server\\share", found?.path);
    Assert.isNull(found?.status);
  }
}

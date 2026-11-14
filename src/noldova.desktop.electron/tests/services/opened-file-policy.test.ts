/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { OpenedFilePolicy } from "../../src/services/opened-file-policy.js";
import { LinkedPathsFixture } from "../fixtures/linked-paths.fixture.js";

@TestClass
export class OpenedFilePolicyTests {
  @TestMethod
  @TestData("/Noldova/report.pdf", "/Noldova/report.pdf", null)
  @TestData("/Noldova/REPORT.PDF", "/Noldova/REPORT.PDF", null)
  @TestData("/Noldova/linked.md", "/Noldova/notes.txt", null)
  @TestData("/Noldova/run.sh", "/Noldova/run.sh", "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("/Noldova/.pdf", "/Noldova/.pdf", "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("/Noldova/script.md", "/Noldova/script.sh", "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("/Noldova/notes.md", "/Noldova/notes.md", "the file is marked executable, so it never opens.")
  @TestData("/Noldova/folder.pdf", "/Noldova/folder.pdf", "the path isn't a regular file; a folder, or a link to one, isn't opened.")
  @TestData("/Noldova/missing.pdf", "/Noldova/missing.pdf", "no file can be read at the path.")
  @TestData("/Noldova/unresolved.pdf", "/Noldova/unresolved.pdf", "no file can be read at the path.")
  @TestData("Noldova/report.pdf", "Noldova/report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  public async opensOnlyAListedRegularFileThatIsNotExecutableOffWindows(file: string, path: string, refusal: string | null): Promise<void> {
    const paths = new LinkedPathsFixture("linux", {
      "/Noldova/report.pdf": LinkedPathsFixture.fileMode,
      "/Noldova/REPORT.PDF": LinkedPathsFixture.fileMode,
      "/Noldova/linked.md": "notes.txt",
      "/Noldova/notes.txt": LinkedPathsFixture.fileMode,
      "/Noldova/script.md": LinkedPathsFixture.fileMode,
      "/Noldova/notes.md": 0o100744,
      "/Noldova/folder.pdf": LinkedPathsFixture.folderMode,
      "/Noldova/unresolved.pdf": LinkedPathsFixture.fileMode
    }, { "/Noldova/script.md": "/Noldova/script.sh", "/Noldova/unresolved.pdf": null });

    const checked = await OpenedFilePolicy.checkAsync(file, "linux", paths);

    Assert.areEqual(JSON.stringify({ path, refusal }), JSON.stringify(checked));
  }

  @TestMethod
  @TestData("C:\\Noldova\\notes.txt", "C:\\Noldova\\notes.txt", null)
  @TestData("C:\\Noldova\\report.pdf:hidden.pdf", "C:\\Noldova\\report.pdf:hidden.pdf", "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("C:\\Noldova\\run.exe", "C:\\Noldova\\run.exe", "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.")
  @TestData("C:\\Noldova\\shared.pdf", "\\\\server\\share\\report.pdf", "a link in the path leads to a network or device path, which is never opened.")
  @TestData("Z:\\Noldova\\report.pdf", "\\\\server\\share\\Noldova\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  @TestData("\\\\server\\share\\report.pdf", "\\\\server\\share\\report.pdf", "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.")
  public async opensOnWindowsWhateverTheExecuteBitsButNoStreamNorNetworkPath(file: string, path: string, refusal: string | null): Promise<void> {
    const paths = new LinkedPathsFixture("win32", {
      "C:\\Noldova\\notes.txt": 0o100755,
      "C:\\Noldova\\report.pdf:hidden.pdf": LinkedPathsFixture.fileMode,
      "C:\\Noldova\\run.exe": LinkedPathsFixture.fileMode,
      "C:\\Noldova\\shared.pdf": "\\\\server\\share\\report.pdf",
      "Z:\\Noldova\\report.pdf": LinkedPathsFixture.fileMode
    }, { "Z:\\Noldova\\report.pdf": "\\\\server\\share\\Noldova\\report.pdf" });

    const checked = await OpenedFilePolicy.checkAsync(file, "win32", paths);

    Assert.areEqual(JSON.stringify({ path, refusal }), JSON.stringify(checked));
    Assert.isFalse(paths.looked.some(t => t.startsWith("\\\\")), paths.looked.join(" "));
  }

  @TestMethod
  @TestData("/Noldova/run.sh")
  @TestData("/Noldova/report")
  @TestData("/Noldova/\u0000report.pdf")
  public async looksAtNoFileForAPathItRefusesByItsText(file: string): Promise<void> {
    const paths = new LinkedPathsFixture("linux", { [file]: LinkedPathsFixture.fileMode });

    const checked = await OpenedFilePolicy.checkAsync(file, "linux", paths);

    Assert.isNotNull(checked.refusal);
    Assert.areEqual(0, paths.looked.length);
  }
}

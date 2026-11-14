/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { access, lstat, mkdir, mkdtemp, open, readdir, readFile, readlink, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode, type FileGrant, Response } from "@noldova/desktop.protocol";
import { FileGrantIssuer, type IShownPathFiles, type IShownPathStatus, IssuedFiles, OfferedFile } from "@noldova/desktop.electron";
import { FileIdentity } from "@noldova/desktop.runtime";

import { CodedError } from "../fixtures/coded-error.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class FileGrantIssuerTests {
  private static readonly MIB: number = 1024 * 1024;
  private static readonly FILES: IShownPathFiles = { lstat, readlink, realpath };

  @TestMethod
  public grantsAPickedFileByItsRealPathSizeAndIdentityForTheModuleWindowAndPage(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const file = path.join(folder, "report.pdf");
      await writeFile(file, "a report");
      const issuer = FileGrantIssuerTests.create(folder, sent);

      const issued = await issuer.issueAsync([new OfferedFile("report.pdf", "application/pdf", file, null, 3)], "notes", 4, 2, 60_000);

      const real = await realpath(file);
      Assert.areEqual(
        `${"1".repeat(32)}|${real}|report.pdf|application/pdf|8|${FileIdentity.of(await lstat(real, { bigint: true }))}|notes|4|2|60000|false`,
        sent.map(t => [t.grant, t.path, t.name, t.mediaType, t.size, t.identity, t.module, t.window, t.page, t.lifetime, t.isStaged].join("|")).join(","));
      Assert.areEqual(JSON.stringify({ granted: [{ grant: "1".repeat(32), name: "report.pdf", mediaType: "application/pdf", size: 8 }], refused: [] }),
        JSON.stringify(issued.toJson()));
    });
  }

  @TestMethod
  public refusesAFolderAndAMissingFile(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const issuer = FileGrantIssuerTests.create(folder, sent);

      const issued = await issuer.issueAsync([".", "gone.txt"].map(t => OfferedFile.ofPath(path.join(folder, t))), "notes", 4, 2, 600_000);

      Assert.areEqual(JSON.stringify([
        `${path.basename(folder)} was not given to the module: it is not a regular file.`,
        "gone.txt was not given to the module: no file can be read at the path."
      ]), JSON.stringify(issued.refused));
      Assert.areEqual("0|0", `${issued.granted.length}|${sent.length}`);
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public grantsTheFileALinkNamesAndRefusesAFifoAndOneTheRuntimeRefuses(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const file = path.join(folder, "notes.txt");
      await writeFile(file, "notes");
      await symlink(file, path.join(folder, "link.txt"));
      execFileSync("mkfifo", [path.join(folder, "pipe")]);
      const issuer = FileGrantIssuerTests.create(folder, sent, t => t.name === "refused.txt" ? "The window holds too many grants." : null);
      await writeFile(path.join(folder, "refused.txt"), "kept");

      const issued = await issuer.issueAsync(["link.txt", "pipe", "refused.txt"].map(t => OfferedFile.ofPath(path.join(folder, t))), "notes", 4, 2, 600_000);

      Assert.areEqual(`${await realpath(file)}|link.txt|application/octet-stream`, `${sent[0]?.path}|${sent[0]?.name}|${sent[0]?.mediaType}`);
      Assert.areEqual(JSON.stringify([
        "pipe was not given to the module: it is not a regular file.",
        "refused.txt was not given to the module: The window holds too many grants."
      ]), JSON.stringify(issued.refused));
      Assert.areEqual(1, issued.granted.length);
    });
  }

  @TestMethod
  public stagesPastedBytesUnderTheirGrantAndDeletesTheCopyWhenTheRuntimeRefusesIt(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const staged = path.join(folder, "staged");
      const issuer = FileGrantIssuerTests.create(staged, sent, t => t.name === "refused.png" ? "Refused." : null);

      const issued = await issuer.issueAsync([
        new OfferedFile("image.png", "image/png", null, new Uint8Array([1, 2, 3]), 3),
        new OfferedFile("refused.png", "image/png", null, new Uint8Array([4]), 1)
      ], "notes", 4, 2, 600_000);

      const copy = path.join(staged, "1".repeat(32));
      Assert.areEqual(`${copy}|true|3|${FileIdentity.of(await lstat(copy, { bigint: true }))}`, `${sent[0]?.path}|${sent[0]?.isStaged}|${sent[0]?.size}|${sent[0]?.identity}`);
      Assert.areEqual("1,2,3", Array.from(await readFile(copy)).join(","));
      Assert.areEqual(JSON.stringify([{ grant: "1".repeat(32), name: "image.png", mediaType: "image/png", size: 3 }]), JSON.stringify(issued.granted));
      Assert.areEqual(JSON.stringify(["refused.png was not given to the module: Refused."]), JSON.stringify(issued.refused));
      Assert.areEqual("1".repeat(32), (await readdir(staged)).join(","));
    });
  }

  @TestMethod
  public refusesAPasteOver64MiBInAllAndAnyPasteOnceTheStagedFilesHold256MiB(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const staged = path.join(folder, "staged");
      const issuer = FileGrantIssuerTests.create(staged, sent);
      const half = new Uint8Array(33 * FileGrantIssuerTests.MIB);

      const overPaste = await issuer.issueAsync([
        new OfferedFile("first.bin", "application/octet-stream", null, half, half.byteLength),
        new OfferedFile("second.bin", "application/octet-stream", null, half, half.byteLength),
        new OfferedFile("huge.bin", "application/octet-stream", null, null, 65 * FileGrantIssuerTests.MIB)
      ], "notes", 4, 2, 600_000);
      const filler = await open(path.join(staged, "filler"), "w");
      await filler.truncate(223 * FileGrantIssuerTests.MIB);
      await filler.close();
      const overStaged = await issuer.issueAsync([new OfferedFile("small.bin", "application/octet-stream", null, new Uint8Array(1), 1)], "notes", 4, 2, 600_000);

      Assert.areEqual(JSON.stringify([
        "second.bin was not given to the module: a paste may stage at most 64 MiB.",
        "huge.bin was not given to the module: a paste may stage at most 64 MiB."
      ]), JSON.stringify(overPaste.refused));
      Assert.areEqual(1, overPaste.granted.length);
      Assert.areEqual(JSON.stringify(["small.bin was not given to the module: the files staged for modules already hold 256 MiB."]), JSON.stringify(overStaged.refused));
      Assert.areEqual(1, sent.length);
    });
  }

  @TestMethod
  public issuesOneCallAtATimeSoConcurrentPastesStayWithin256MiB(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const staged = path.join(folder, "staged");
      await mkdir(staged);
      const filler = await open(path.join(staged, "filler"), "w");
      await filler.truncate(200 * FileGrantIssuerTests.MIB);
      await filler.close();
      const issuer = new FileGrantIssuer(staged, process.platform, FileGrantIssuerTests.FILES, t => {
        sent.push(t);
        return Promise.resolve(Response.success("r", null));
      });
      const paste = new Uint8Array(25 * FileGrantIssuerTests.MIB);

      const calls = await Promise.all(Array.from({ length: 3 }, (_, t) =>
        issuer.issueAsync([new OfferedFile(`${t}.bin`, "application/octet-stream", null, paste, paste.byteLength)], "notes", 4, 2, 600_000)));

      Assert.areEqual("1,1,0", calls.map(t => t.granted.length).join(","));
      Assert.areEqual(JSON.stringify(["2.bin was not given to the module: the files staged for modules already hold 256 MiB."]), JSON.stringify(calls[2]?.refused));
      Assert.areEqual(3, (await readdir(staged)).length);
    });
  }

  @TestMethod
  public refusesOnWindowsAnyPathButOneOnADriveAndElsewhereARelativePathBeforeReachingIt(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const windows = FileGrantIssuerTests.create(folder, sent, () => null, "win32");
      const posix = FileGrantIssuerTests.create(folder, sent, () => null, "linux");
      const paths = ["\\\\host\\share\\notes.txt", "//host/share/notes.txt", "\\\\?\\UNC\\host\\share\\notes.txt", "\\\\?\\C:\\notes.txt", "\\\\.\\pipe\\notes",
        "\\??\\UNC\\host\\share\\notes.txt", "C:notes.txt", "notes.txt"];
      const offer = (filePath: string): OfferedFile => new OfferedFile("notes.txt", "text/plain", filePath, null, 0);

      const onWindows = await windows.issueAsync(paths.map(offer), "notes", 4, 2, 600_000);
      const elsewhere = await posix.issueAsync([offer("notes.txt"), offer("/home/person/notes\u0000.txt")], "notes", 4, 2, 600_000);

      const notLocal = "notes.txt was not given to the module: the path isn't absolute; on Windows only a path on a drive, such as C:\\, is granted, never a network or device path.";
      Assert.areEqual(JSON.stringify(paths.map(() => notLocal)), JSON.stringify(onWindows.refused));
      Assert.areEqual(JSON.stringify([notLocal, "notes.txt was not given to the module: the path isn't text without null characters."]), JSON.stringify(elsewhere.refused));
      Assert.areEqual(0, sent.length);
    });
  }

  @TestMethod
  public refusesOnWindowsALinkOffTheDriveWithoutFollowingItAndARealPathOffTheDrive(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const realPaths: string[] = [];
      const files: IShownPathFiles = {
        lstat: file => Promise.resolve(FileGrantIssuerTests.status(file.endsWith("link.txt") ? "link" : file.endsWith(".txt") ? "file" : "folder")),
        readlink: () => Promise.resolve("\\\\host\\share\\notes.txt"),
        realpath: file => {
          realPaths.push(file);
          return file.endsWith("mapped.txt") ? Promise.resolve("\\\\host\\share\\mapped.txt") : Promise.reject(new CodedError("EACCES", "denied"));
        }
      };
      const issuer = FileGrantIssuerTests.create(folder, sent, () => null, "win32", files);
      const offered = [
        new OfferedFile("link.txt", "text/plain", "C:\\drop\\link.txt", null, 0),
        new OfferedFile("mapped.txt", "text/plain", "M:\\mapped.txt", null, 0),
        new OfferedFile("locked.txt", "text/plain", "C:\\drop\\locked.txt", null, 0)
      ];

      const issued = await issuer.issueAsync(offered, "notes", 4, 2, 600_000);

      Assert.areEqual(JSON.stringify([
        "link.txt was not given to the module: a link in the path leads to a network or device path, which is never granted.",
        "mapped.txt was not given to the module: the path isn't absolute; on Windows only a path on a drive, such as C:\\, is granted, never a network or device path.",
        "locked.txt was not given to the module: it can't be read (EACCES)."
      ]), JSON.stringify(issued.refused));
      Assert.areEqual(JSON.stringify(["M:\\mapped.txt", "C:\\drop\\locked.txt"]), JSON.stringify(realPaths));
      Assert.areEqual(0, sent.length);
    });
  }

  @TestMethod
  public failsACallOnAnErrorThatIsNotTheFileSystemsAndIssuesTheNextOne(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const file = path.join(folder, "notes.txt");
      await writeFile(file, "notes");
      const issuer = FileGrantIssuerTests.create(folder, sent);

      const failed = issuer.issueAsync([new OfferedFile("notes.txt", String.empty, file, null, 0)], "notes", 4, 2, 600_000);
      const next = issuer.issueAsync([OfferedFile.ofPath(file)], "notes", 4, 2, 600_000);

      Assert.areEqual("mediaType", (await Assert.throwsAsync(() => failed, ArgumentException)).parameterName);
      Assert.areEqual(1, (await next).granted.length);
    });
  }

  @TestMethod
  public neverOverwritesAStagedFileAndStagesNothingForNoFiles(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const staged = path.join(folder, "staged");
      await mkdir(staged);
      await writeFile(path.join(staged, "1".repeat(32)), "kept");
      const issuer = FileGrantIssuerTests.create(staged, sent);

      const issued = await issuer.issueAsync([new OfferedFile("pasted", "application/octet-stream", null, new Uint8Array([1]), 1)], "notes", 4, 2, 600_000);
      const none = await FileGrantIssuerTests.create(path.join(folder, "missing"), sent).issueAsync([], "notes", 4, 2, 600_000);

      Assert.areEqual(JSON.stringify(["pasted was not given to the module: it can't be staged for the module (EEXIST)."]), JSON.stringify(issued.refused));
      Assert.areEqual("kept", await readFile(path.join(staged, "1".repeat(32)), "utf8"));
      Assert.areEqual(JSON.stringify(IssuedFiles.none.toJson()), JSON.stringify(none.toJson()));
      Assert.isFalse(await access(path.join(folder, "missing")).then(() => true, () => false));
    });
  }

  @TestMethod
  public drawsADifferentRandomGrantForEachFile(): Promise<void> {
    return FileGrantIssuerTests.runAsync(async (folder, sent) => {
      const file = path.join(folder, "notes.txt");
      await writeFile(file, "notes");
      const issuer = new FileGrantIssuer(folder, process.platform, FileGrantIssuerTests.FILES, t => {
        sent.push(t);
        return Promise.resolve(Response.success("r", null));
      });

      await issuer.issueAsync([OfferedFile.ofPath(file), OfferedFile.ofPath(file)], "notes", 4, 2, 600_000);

      Assert.areEqual(2, new Set(sent.map(t => t.grant)).size);
      Assert.isTrue(sent.every(t => /^[0-9a-f]{32}$/.test(t.grant)));
    });
  }

  private static create(stagedFolder: string, sent: FileGrant[], refuse: (grant: FileGrant) => string | null = () => null, platform: string = process.platform,
    files: IShownPathFiles = FileGrantIssuerTests.FILES): FileGrantIssuer {
    let next = 1;
    return new FileGrantIssuer(stagedFolder, platform, files, t => {
      const reason = refuse(t);
      if (Object.isNull(reason))
        sent.push(t);
      return Promise.resolve(Object.isNull(reason) ? Response.success("r", null) : Response.failure("r", new Failure(FailureCode.Conflict, reason)));
    }, () => String(next++ % 10).repeat(32));
  }

  private static status(kind: string): IShownPathStatus {
    return { mode: 0o644, isFile: () => kind === "file", isDirectory: () => kind === "folder", isSymbolicLink: () => kind === "link" };
  }

  private static async runAsync(test: (folder: string, sent: FileGrant[]) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-file-grants-"));
    try {
      await test(folder, []);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

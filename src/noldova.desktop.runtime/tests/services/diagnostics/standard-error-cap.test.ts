/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, existsSync, openSync, readFileSync, writeSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiagnosticRedactor, StandardErrorCap } from "@noldova/desktop.runtime";

import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class StandardErrorCapTests {
  private static readonly LIMIT: number = 10;
  private static readonly UNTIMED: number = 60_000;
  private static readonly HOME: string = path.resolve("home", "person");
  private static readonly REDACTOR: DiagnosticRedactor = new DiagnosticRedactor(StandardErrorCapTests.HOME);

  @TestMethod
  public cutsBackAFileOverItsLimitToItsLastBytesAndTheNextWriteStartsItAgain(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "older text then the last bytes");
      await using cap = StandardErrorCap.start(descriptor, [path.join(path.dirname(file), "missing.log"), file], previous, StandardErrorCapTests.REDACTOR,
        new TextOutputFixture(), StandardErrorCapTests.LIMIT, StandardErrorCapTests.UNTIMED);

      await cap.checkAsync();
      writeSync(descriptor, "after");

      Assert.areEqual("last bytes", readFileSync(previous, "utf8"));
      Assert.areEqual("after", readFileSync(file, "utf8"));
    });
  }

  @TestMethod
  public redactsWhatItKeeps(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      const kept = `Error: ENOENT, open '${path.join(StandardErrorCapTests.HOME, "notes.txt")}' for person@example.com`;
      writeSync(descriptor, `older text then ${kept}`);
      await using cap = StandardErrorCap.start(descriptor, [file], previous, StandardErrorCapTests.REDACTOR, new TextOutputFixture(), Buffer.byteLength(kept),
        StandardErrorCapTests.UNTIMED);

      await cap.checkAsync();

      Assert.areEqual(`Error: ENOENT, open '${path.join("~", "notes.txt")}' for [redacted]`, readFileSync(previous, "utf8"));
      Assert.areEqual(String.empty, readFileSync(file, "utf8"));
    });
  }

  @TestMethod
  public keepsAWholeFileWithinItsLimitRedacted(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "ten bytes from person@example.com");

      await StandardErrorCap.keepAsync(file, previous, StandardErrorCapTests.REDACTOR);

      Assert.areEqual("ten bytes from [redacted]", readFileSync(previous, "utf8"));
      Assert.areEqual("ten bytes from person@example.com", readFileSync(file, "utf8"));
    });
  }

  @TestMethod
  public leavesAFileThatIsWithinItsLimit(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "ten bytes.");
      await using cap = StandardErrorCap.start(descriptor, [file], previous, StandardErrorCapTests.REDACTOR, new TextOutputFixture(), StandardErrorCapTests.LIMIT,
        StandardErrorCapTests.UNTIMED);

      await cap.checkAsync();

      Assert.areEqual("ten bytes.", readFileSync(file, "utf8"));
      Assert.isFalse(existsSync(previous));
    });
  }

  @TestMethod
  public leavesAStandardErrorThatIsNoneOfItsFiles(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "older text then the last bytes");
      await using cap = StandardErrorCap.start(descriptor, [path.join(path.dirname(file), "missing.log")], previous, StandardErrorCapTests.REDACTOR,
        new TextOutputFixture(), StandardErrorCapTests.LIMIT, StandardErrorCapTests.UNTIMED);

      await cap.checkAsync();

      Assert.areEqual("older text then the last bytes", readFileSync(file, "utf8"));
      Assert.isFalse(existsSync(previous));
    });
  }

  @TestMethod
  public throwsNothingForAClosedDescriptor(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (_descriptor, file, previous) => {
      const closed = openSync(file, "r");
      closeSync(closed);
      await using cap = StandardErrorCap.start(closed, [file], previous, StandardErrorCapTests.REDACTOR, new TextOutputFixture(), StandardErrorCapTests.LIMIT,
        StandardErrorCapTests.UNTIMED);

      await cap.checkAsync();

      Assert.isFalse(existsSync(previous));
    });
  }

  @TestMethod
  public stillEmptiesTheFileWhenThePreviousCannotBeWritten(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      await mkdir(previous);
      writeSync(descriptor, "older text then the last bytes");
      await using cap = StandardErrorCap.start(descriptor, [file], previous, StandardErrorCapTests.REDACTOR, new TextOutputFixture(), StandardErrorCapTests.LIMIT,
        StandardErrorCapTests.UNTIMED);

      await cap.checkAsync();

      Assert.areEqual(String.empty, readFileSync(file, "utf8"));
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public failsACheckThatFailsForAnUnexpectedReason(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "older text then the last bytes");
      const diagnostics = new TextOutputFixture();
      const unreadable = path.join(path.dirname(file), "e".repeat(300));
      const cap = StandardErrorCap.start(descriptor, [unreadable, file], previous, StandardErrorCapTests.REDACTOR, diagnostics, StandardErrorCapTests.LIMIT,
        StandardErrorCapTests.UNTIMED);

      const error = await Assert.throwsAsync(() => cap.checkAsync(), Error);
      await cap[Symbol.asyncDispose]();

      Assert.isTrue(error.message.startsWith("ENAMETOOLONG"), error.message);
      Assert.isTrue(diagnostics.text.startsWith("The standard error's size could not be checked: Error: ENAMETOOLONG"), diagnostics.text);
      Assert.areEqual("older text then the last bytes", readFileSync(file, "utf8"));
    });
  }

  @TestMethod
  public failsACheckOfAFileItCannotNameAndChecksAgainWhenDisposedAfterTheFailure(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "older text then the last bytes");
      const diagnostics = new TextOutputFixture();
      const unnamed = path.join(path.dirname(file), "errors\u0000.log");
      const cap = StandardErrorCap.start(descriptor, [unnamed, file], previous, StandardErrorCapTests.REDACTOR, diagnostics, StandardErrorCapTests.LIMIT,
        StandardErrorCapTests.UNTIMED);

      const error = await Assert.throwsAsync(() => cap.checkAsync(), TypeError);
      await cap[Symbol.asyncDispose]();

      Assert.areEqual("ERR_INVALID_ARG_VALUE", ErrorCodeFixture.of(error));
      Assert.isTrue(diagnostics.text.startsWith("The standard error's size could not be checked: TypeError"), diagnostics.text);
      Assert.areEqual("older text then the last bytes", readFileSync(file, "utf8"));
      Assert.isFalse(existsSync(previous));
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public reportsACheckOnItsTimerThatFailsForAnUnexpectedReason(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      writeSync(descriptor, "older text then the last bytes");
      const diagnostics = new TextOutputFixture();
      const unreadable = path.join(path.dirname(file), "e".repeat(300));
      await using _cap = StandardErrorCap.start(descriptor, [unreadable], previous, StandardErrorCapTests.REDACTOR, diagnostics, StandardErrorCapTests.LIMIT, 20);

      Assert.isTrue(await WaitFixture.untilAsync(() => diagnostics.text.length > 0, 5_000), "The cap reported no failed check on its timer within 5 s.");
      Assert.isTrue(diagnostics.text.startsWith("The standard error's size could not be checked: Error: ENAMETOOLONG"), diagnostics.text);
    });
  }

  @TestMethod
  public checksOnItsTimer(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      await using _cap = StandardErrorCap.start(descriptor, [file], previous, StandardErrorCapTests.REDACTOR, new TextOutputFixture(), StandardErrorCapTests.LIMIT, 20);
      writeSync(descriptor, "older text then the last bytes");

      Assert.isTrue(await WaitFixture.untilAsync(() => readFileSync(file, "utf8") === String.empty, 5_000), "The cap did not empty the file on its timer within 5 s.");
      Assert.areEqual("last bytes", readFileSync(previous, "utf8"));
    });
  }

  @TestMethod
  public checksOnceMoreWhenDisposed(): Promise<void> {
    return StandardErrorCapTests.runAsync(async (descriptor, file, previous) => {
      const cap = StandardErrorCap.start(descriptor, [file], previous, StandardErrorCapTests.REDACTOR, new TextOutputFixture(), StandardErrorCapTests.LIMIT,
        StandardErrorCapTests.UNTIMED);
      writeSync(descriptor, "older text then the last bytes");

      await cap[Symbol.asyncDispose]();

      Assert.areEqual("last bytes", readFileSync(previous, "utf8"));
      Assert.areEqual(String.empty, readFileSync(file, "utf8"));
    });
  }

  private static async runAsync(test: (descriptor: number, file: string, previous: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "errors.log");
    const descriptor = openSync(file, "a");
    try {
      await test(descriptor, file, path.join(folder.path, "previous.log"));
    }
    finally {
      closeSync(descriptor);
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PathLike } from "node:fs";
import { type FileHandle, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { TextFile } from "../../../src/services/files/text-file.js";

@TestClass
export class TextFileTests {
  private static readonly LONG_TEXT: string = `{"name":"${"ä".repeat(40000)}"}`;

  @TestMethod
  public async readsAFileAsUtf8(): Promise<void> {
    await TextFileTests.withFileAsync(TextFileTests.LONG_TEXT, async file => {
      Assert.areEqual(TextFileTests.LONG_TEXT, await TextFile.readAsync(file));
    });
  }

  @TestMethod
  public async readsTheWholeFileThroughItsHandleWhenFstatAnswersEinval(): Promise<void> {
    await TextFileTests.withFileAsync(TextFileTests.LONG_TEXT, async file => {
      const asked: string[] = [];

      const text = await TextFile.readAsync(file, TextFileTests.fail("EINVAL", "fstat", file, asked));

      Assert.areEqual(TextFileTests.LONG_TEXT, text);
      Assert.areEqual(file, asked.join());
    });
  }

  @TestMethod
  public async readsAnEmptyFileThroughItsHandleWhenFstatAnswersEinval(): Promise<void> {
    await TextFileTests.withFileAsync(String.empty, async file => {
      Assert.areEqual(String.empty, await TextFile.readAsync(file, TextFileTests.fail("EINVAL", "fstat", file, [])));
    });
  }

  @TestMethod
  @TestData("EINVAL", "open")
  @TestData("EACCES", "fstat")
  @TestData("ENOENT", "open")
  public async passesOnAnyOtherFailure(code: string, call: string): Promise<void> {
    await TextFileTests.withFileAsync(TextFileTests.LONG_TEXT, async file => {
      const error = await Assert.throwsAsync(() => TextFile.readAsync(file, TextFileTests.fail(code, call, file, [])), Error);

      Assert.areEqual(`${code}: ${call} '${file}'`, error.message);
    });
  }

  @TestMethod
  public async passesOnTheHandlesFailureWhenTheFileIsGoneAfterFstatAnswersEinval(): Promise<void> {
    await TextFileTests.withFileAsync(String.empty, async file => {
      const missing = path.join(path.dirname(file), "missing.json");

      const error = await Assert.throwsAsync(() => TextFile.readAsync(missing, TextFileTests.fail("EINVAL", "fstat", missing, [])), Error);

      Assert.isTrue(error.message.startsWith("ENOENT: no such file or directory, open '"), error.message);
    });
  }

  private static fail(code: string, call: string, file: string, asked: string[]): (target: PathLike | FileHandle) => Promise<never> {
    return async target => {
      asked.push(String(target));
      throw Object.assign(new Error(`${code}: ${call} '${file}'`), { code, syscall: call, path: file });
    };
  }

  private static async withFileAsync(text: string, test: (file: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-text-file-"));
    try {
      const file = path.join(folder, "package.json");
      await writeFile(file, text);
      await test(file);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

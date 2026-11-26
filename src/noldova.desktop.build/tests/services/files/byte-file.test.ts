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

import { ByteFile } from "../../../src/services/files/byte-file.js";

@TestClass
export class ByteFileTests {
  private static readonly BYTES: Buffer = Buffer.from(Array.from({ length: 200000 }, (_, i) => i % 251));

  @TestMethod
  public async readsAFilesBytes(): Promise<void> {
    await ByteFileTests.withFileAsync(ByteFileTests.BYTES, async file => {
      Assert.isTrue(ByteFileTests.BYTES.equals(await ByteFile.readAsync(file)));
    });
  }

  @TestMethod
  public async readsTheWholeFileThroughItsHandleWhenFstatAnswersEinval(): Promise<void> {
    await ByteFileTests.withFileAsync(ByteFileTests.BYTES, async file => {
      const asked: string[] = [];

      const bytes = await ByteFile.readAsync(file, ByteFileTests.fail("EINVAL", "fstat", file, asked));

      Assert.isTrue(ByteFileTests.BYTES.equals(bytes));
      Assert.areEqual(file, asked.join());
    });
  }

  @TestMethod
  public async readsAnEmptyFileThroughItsHandleWhenFstatAnswersEinval(): Promise<void> {
    await ByteFileTests.withFileAsync(Buffer.alloc(0), async file => {
      Assert.areEqual(0, (await ByteFile.readAsync(file, ByteFileTests.fail("EINVAL", "fstat", file, []))).length);
    });
  }

  @TestMethod
  @TestData("EINVAL", "open")
  @TestData("EACCES", "fstat")
  @TestData("ENOENT", "open")
  public async passesOnAnyOtherFailure(code: string, call: string): Promise<void> {
    await ByteFileTests.withFileAsync(ByteFileTests.BYTES, async file => {
      const error = await Assert.throwsAsync(() => ByteFile.readAsync(file, ByteFileTests.fail(code, call, file, [])), Error);

      Assert.areEqual(`${code}: ${call} '${file}'`, error.message);
    });
  }

  @TestMethod
  public async passesOnTheHandlesFailureWhenTheFileIsGoneAfterFstatAnswersEinval(): Promise<void> {
    await ByteFileTests.withFileAsync(Buffer.alloc(0), async file => {
      const missing = path.join(path.dirname(file), "missing.bin");

      const error = await Assert.throwsAsync(() => ByteFile.readAsync(missing, ByteFileTests.fail("EINVAL", "fstat", missing, [])), Error);

      Assert.isTrue(error.message.startsWith("ENOENT: no such file or directory, open '"), error.message);
    });
  }

  private static fail(code: string, call: string, file: string, asked: string[]): (target: PathLike | FileHandle) => Promise<never> {
    return async target => {
      asked.push(String(target));
      throw Object.assign(new Error(`${code}: ${call} '${file}'`), { code, syscall: call, path: file });
    };
  }

  private static async withFileAsync(bytes: Buffer, test: (file: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-build-byte-file-"));
    try {
      const file = path.join(folder, "file.bin");
      await writeFile(file, bytes);
      await test(file);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FailureCode, FrameReader, ProtocolException } from "@noldova/desktop.protocol";

@TestClass
export class FrameReaderTests {
  @TestMethod
  public splitsChunksIntoFrames(): void {
    const reader = new FrameReader();

    Assert.areEqual(String.empty, reader.read("{\"a\"").join("|"));
    Assert.areEqual("{\"a\":1}|{\"b\":2}", reader.read(":1}\n{\"b\":2}\n{\"c\"").join("|"));
    Assert.areEqual("{\"c\":3}", reader.read(":3}\n").join("|"));
  }

  @TestMethod
  public skipsBlankLines(): void {
    Assert.areEqual("x|y", new FrameReader().read("\n  \nx\n\r\ny\n").join("|"));
  }

  @TestMethod
  public acceptsAFrameOfExactlyTheMaximumLength(): void {
    Assert.areEqual("1234", new FrameReader(4).read("1234\n").join("|"));
  }

  @TestMethod
  @TestData("12345\n")
  @TestData("12345")
  @TestData("12\n12345")
  public refusesAnOversizedFrame(chunk: string): void {
    const failure = Assert.throws(() => new FrameReader(4).read(chunk), ProtocolException);

    Assert.areEqual(FailureCode.FrameTooLarge, failure.code);
  }

  @TestMethod
  public refusesAFrameThatGrowsAcrossChunks(): void {
    const reader = new FrameReader(4);
    reader.read("123");

    Assert.areEqual(FailureCode.FrameTooLarge, Assert.throws(() => reader.read("45"), ProtocolException).code);
  }

  @TestMethod
  public joinsAFrameSpreadOverManyChunks(): void {
    const reader = new FrameReader();

    Assert.areEqual(String.empty, reader.read("ab").join("|"));
    Assert.areEqual(String.empty, reader.read("cd").join("|"));
    Assert.areEqual("abcde|f", reader.read("e\nf\ng").join("|"));
    Assert.areEqual("gh", reader.read("h\n").join("|"));
  }

  @TestMethod
  public searchesALargeFrameInTimeLinearInItsSize(): void {
    const frame = "x".repeat(4 * 1024 * 1024);
    const text = frame + "\n";
    const chunkLength = 8 * 1024;
    const reader = new FrameReader();
    const frames: string[] = [];

    const searched = FrameReaderTests.countSearchedCharacters(() => {
      for (let start = 0; start < text.length; start += chunkLength)
        frames.push(...reader.read(text.slice(start, start + chunkLength)));
    });

    Assert.areEqual(1, frames.length);
    Assert.isTrue(frames[0] === frame, String(frames[0]?.length));
    Assert.isTrue(searched >= text.length && searched <= 2 * text.length, `${searched} characters searched for ${text.length}`);
  }

  @TestMethod
  @TestData(["123", "4\n5"], "1234")
  @TestData(["1234\n1234", "\n"], "1234|1234")
  @TestData(["1234\n1234\n"], "1234|1234")
  @TestData(["ab", "\ncd\n"], "ab|cd")
  public readsFramesOfUpToTheMaximumLengthAcrossChunks(chunks: string[], expected: string): void {
    const reader = new FrameReader(4);

    Assert.areEqual(expected, chunks.flatMap(t => reader.read(t)).join("|"));
  }

  @TestMethod
  @TestData(["123", "45\n"])
  @TestData(["1\n12345\n"])
  public refusesAFrameThatPassesTheMaximumAtItsDelimiter(chunks: string[]): void {
    const reader = new FrameReader(4);

    Assert.areEqual(FailureCode.FrameTooLarge, Assert.throws(() => chunks.forEach(t => reader.read(t)), ProtocolException).code);
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(2.5)
  public rejectsAnInvalidMaximum(maximum: number): void {
    Assert.throws(() => new FrameReader(maximum), ArgumentOutOfRangeException);
  }

  private static countSearchedCharacters(action: () => void): number {
    const indexOf = String.prototype.indexOf;
    let searched = 0;
    String.prototype.indexOf = function (this: string, search: string, position?: number): number {
      const index = indexOf.call(this, search, position);
      searched += (index >= 0 ? index + search.length : this.length) - (position ?? 0);
      return index;
    };
    try {
      action();
    }
    finally {
      String.prototype.indexOf = indexOf;
    }

    return searched;
  }
}

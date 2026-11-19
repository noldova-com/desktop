/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessTranscript } from "../../../src/models/processes/process-transcript.js";

@TestClass
export class ProcessTranscriptTests {
  @TestMethod
  public keepsBothStreamsLinesInTheOrderTheyEnded(): void {
    const transcript = new ProcessTranscript();

    transcript.add(Buffer.from("W: Waiting for cache lock\nReading pack"), true);
    transcript.add(Buffer.from("Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nGet:2 "), false);
    transcript.add(Buffer.from("age lists...\nE: Could not get lock\n"), true);
    transcript.add(Buffer.from("https://archive.ubuntu.com/ubuntu noble-updates InRelease\n"), false);

    Assert.areEqual("W: Waiting for cache lock\nHit:1 http://archive.ubuntu.com/ubuntu noble InRelease\nReading package lists...\nE: Could not get lock\n"
      + "Get:2 https://archive.ubuntu.com/ubuntu noble-updates InRelease\n", transcript.text);
  }

  @TestMethod
  public decodesACharacterSplitAcrossChunks(): void {
    const transcript = new ProcessTranscript();
    const bytes = Buffer.from("Paramètres\n");
    const split = bytes.indexOf(0xa8);

    transcript.add(bytes.subarray(0, split), false);
    transcript.add(Buffer.from("E: stopped\n"), true);
    transcript.add(bytes.subarray(split), false);

    Assert.areEqual("E: stopped\nParamètres\n", transcript.text);
  }

  @TestMethod
  public endsWithEachStreamsUnfinishedLine(): void {
    const transcript = new ProcessTranscript();

    transcript.add(Buffer.from("Get:5 noble-security InRelease\n0% [Waiting for headers]"), false);
    transcript.add(Buffer.from("E: stalled"), true);

    Assert.areEqual("Get:5 noble-security InRelease\n0% [Waiting for headers]\nE: stalled", transcript.text);
  }

  @TestMethod
  public isEmptyBeforeAnythingArrives(): void {
    Assert.areEqual("", new ProcessTranscript().text);
  }
}

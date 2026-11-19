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
  public keepsBothStreamsInTheOrderTheyArrived(): void {
    const transcript = new ProcessTranscript();

    transcript.add(Buffer.from("W: Waiting for cache lock\n"));
    transcript.add(Buffer.from("Reading package lists...\n"));
    transcript.add(Buffer.from("E: Could not get lock\n"));

    Assert.areEqual("W: Waiting for cache lock\nReading package lists...\nE: Could not get lock\n", transcript.text);
  }

  @TestMethod
  public isEmptyBeforeAnythingArrives(): void {
    Assert.areEqual("", new ProcessTranscript().text);
  }
}

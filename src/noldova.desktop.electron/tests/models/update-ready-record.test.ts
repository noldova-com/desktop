/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateReadyRecord } from "@noldova/desktop.electron";

@TestClass
export class UpdateReadyRecordTests {
  @TestMethod
  public readsWhatItWritesAndMarksItselfPosted(): void {
    const record = UpdateReadyRecord.fromJson({ version: "1.3.0", file: "/downloads/a.AppImage", sha512: "c2hh", notified: false });

    const posted = record.notified();

    Assert.areEqual(JSON.stringify({ version: "1.3.0", file: "/downloads/a.AppImage", sha512: "c2hh", notified: false, signature: null }), JSON.stringify(record.toJson()));
    Assert.isFalse(record.isNotified);
    Assert.isTrue(posted.isNotified);
    Assert.areEqual(JSON.stringify({ version: "1.3.0", file: "/downloads/a.AppImage", sha512: "c2hh", notified: true, signature: null }), JSON.stringify(UpdateReadyRecord.fromJson(posted.toJson()).toJson()));
  }

  @TestMethod
  public keepsTheSignatureOfTheUpdateThroughARestartAndNotice(): void {
    const record = UpdateReadyRecord.fromJson({ version: "1.3.0", file: "/downloads/a.AppImage", sha512: "c2hh", notified: false, signature: "c2ln" });

    const posted = UpdateReadyRecord.fromJson(record.notified().toJson());

    Assert.areEqual("c2ln", record.signature);
    Assert.areEqual("c2ln", posted.signature);
    Assert.isTrue(posted.isNotified);
  }

  @TestMethod
  public refusesARecordWithABlankOrMissingField(): void {
    Assert.throws(() => UpdateReadyRecord.fromJson({ version: " ", file: "/a", sha512: "c2hh", notified: false }), JsonException);
    Assert.throws(() => UpdateReadyRecord.fromJson({ version: "1.3.0", file: "/a", sha512: "c2hh" }), JsonException);
    Assert.throws(() => UpdateReadyRecord.fromJson(["1.3.0"]), JsonException);
    Assert.throws(() => UpdateReadyRecord.fromJson({ version: "1.3.0", file: "/a", sha512: "c2hh", notified: false, signature: 5 }), JsonException);
  }
}

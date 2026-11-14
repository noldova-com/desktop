/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WorkReport } from "@noldova/desktop.protocol";

@TestClass
export class WorkReportTests {
  @TestMethod
  public keepsItsDescriptionsInOrderAndMayBeEmpty(): void {
    const descriptions = ["Indexing the project", "Saving the notes"];
    const report = new WorkReport(descriptions, 4);
    descriptions.pop();

    const copy = WorkReport.fromJson(JsonReader.parse(JSON.stringify(report.toJson())).toJson());

    Assert.areEqual("Indexing the project,Saving the notes|4", `${copy.descriptions.join(",")}|${copy.sequence}`);
    Assert.areEqual(0, WorkReport.fromJson({ descriptions: [], sequence: 0 }).descriptions.length);
    Assert.areEqual(0, new WorkReport([]).sequence);
  }

  @TestMethod
  public isNewerThanNoReportAndThanOneWithALowerSequence(): void {
    const report = new WorkReport([], 2);

    Assert.isTrue(report.isNewerThan(null));
    Assert.isTrue(report.isNewerThan(new WorkReport(["Indexing"], 1)));
    Assert.isFalse(report.isNewerThan(new WorkReport(["Indexing"], 2)));
    Assert.isFalse(report.isNewerThan(new WorkReport(["Indexing"], 3)));
  }

  @TestMethod
  public refusesABlankDescriptionOrAnInvalidSequenceAndNamesWhatIsInvalid(): void {
    Assert.throws(() => new WorkReport(["Indexing", " "]), ArgumentException);
    Assert.areEqual("sequence", Assert.throws(() => new WorkReport([], -1), ArgumentException).parameterName);
    Assert.throws(() => new WorkReport([], 1.5), ArgumentException);
    Assert.areEqual("$.descriptions", Assert.throws(() => WorkReport.fromJson({ sequence: 0 }), JsonException).path);
    Assert.areEqual("$.descriptions", Assert.throws(() => WorkReport.fromJson({ descriptions: [String.empty], sequence: 0 }), JsonException).path);
    Assert.areEqual("$.sequence", Assert.throws(() => WorkReport.fromJson({ descriptions: [] }), JsonException).path);
  }
}

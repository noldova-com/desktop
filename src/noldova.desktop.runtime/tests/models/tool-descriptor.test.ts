/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type IToolDescriptor, type IToolLimits, ToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";

@TestClass
export class ToolDescriptorTests {
  private static readonly TOOLS: readonly string[] = ["notes_search", "notes_append"];
  private static readonly SEARCH: IToolDescriptor = {
    name: "notes_search",
    description: "Searches the notes.",
    inputSchema: { type: "object" },
    hints: { isReadOnly: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 5_000, maximum: 30_000 }
  };
  private static readonly APPEND: IToolDescriptor = {
    name: "notes_append",
    title: "Append to a note",
    description: "Appends text to a note.",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    hints: { isReadOnly: false, isDestructive: false, isOpenWorld: false },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.High },
    isResumable: false,
    marksSending: true,
    deadline: { default: 1, maximum: 120_000 },
    resource: "/path",
    limits: { textCharacters: 262_144, imageBytes: 1_048_576, imageLongEdge: 2_000, imagePixels: 4_000_000 },
    nextTool: "notes_search"
  };

  @TestMethod
  public writesOnlyWhatTheModuleGaveAndItsDefaults(): void {
    const search = new ToolDescriptor(ToolDescriptorTests.SEARCH, ToolDescriptorTests.TOOLS);

    Assert.isTrue(search.isReadOnly);
    Assert.isFalse(search.canBeUncertain);
    Assert.isNull(search.title);
    Assert.isNull(search.outputSchema);
    Assert.isNull(search.resource);
    Assert.isNull(search.nextTool);
    Assert.areEqual(
      "{\"name\":\"notes_search\",\"description\":\"Searches the notes.\",\"inputSchema\":{\"type\":\"object\"},\"hints\":{\"isReadOnly\":true},"
      + "\"risk\":{\"default\":\"Low\",\"maximum\":\"Low\"},\"isResumable\":false,\"marksSending\":false,\"deadline\":{\"default\":5000,\"maximum\":30000},\"limits\":{}}",
      JSON.stringify(search.toJson()));
  }

  @TestMethod
  public writesEveryFieldAToolGives(): void {
    const append = new ToolDescriptor(ToolDescriptorTests.APPEND, ToolDescriptorTests.TOOLS);

    Assert.isFalse(append.isReadOnly);
    Assert.isTrue(append.canBeUncertain);
    Assert.areEqual(
      "{\"name\":\"notes_append\",\"title\":\"Append to a note\",\"description\":\"Appends text to a note.\",\"inputSchema\":{\"type\":\"object\"},"
      + "\"outputSchema\":{\"type\":\"object\"},\"hints\":{\"isReadOnly\":false,\"isDestructive\":false,\"isOpenWorld\":false},"
      + "\"risk\":{\"default\":\"Low\",\"maximum\":\"High\"},\"isResumable\":false,\"marksSending\":true,\"deadline\":{\"default\":1,\"maximum\":120000},"
      + "\"resource\":\"/path\",\"limits\":{\"textCharacters\":262144,\"imageBytes\":1048576,\"imageLongEdge\":2000,\"imagePixels\":4000000},\"nextTool\":\"notes_search\"}",
      JSON.stringify(append.toJson()));
  }

  @TestMethod
  public writesOnlyTheHintsAToolGives(): void {
    const append = new ToolDescriptor({ ...ToolDescriptorTests.APPEND, hints: { isDestructive: true } }, ToolDescriptorTests.TOOLS);

    Assert.isFalse(append.isReadOnly);
    Assert.areEqual(
      "{\"name\":\"notes_append\",\"title\":\"Append to a note\",\"description\":\"Appends text to a note.\",\"inputSchema\":{\"type\":\"object\"},"
      + "\"outputSchema\":{\"type\":\"object\"},\"hints\":{\"isDestructive\":true},"
      + "\"risk\":{\"default\":\"Low\",\"maximum\":\"High\"},\"isResumable\":false,\"marksSending\":true,\"deadline\":{\"default\":1,\"maximum\":120000},"
      + "\"resource\":\"/path\",\"limits\":{\"textCharacters\":262144,\"imageBytes\":1048576,\"imageLongEdge\":2000,\"imagePixels\":4000000},\"nextTool\":\"notes_search\"}",
      JSON.stringify(append.toJson()));
  }

  @TestMethod
  public needsNoNextToolForAResumableTool(): void {
    const { nextTool: _nextTool, ...append } = ToolDescriptorTests.APPEND;

    const resumable = new ToolDescriptor({ ...append, isResumable: true }, ToolDescriptorTests.TOOLS);

    Assert.isFalse(resumable.canBeUncertain);
    Assert.isNull(resumable.nextTool);
  }

  @TestMethod
  public refusesABlankDescriptionOrTitleAndADefaultRiskAboveTheMaximum(): void {
    const description = Assert.throws(() => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, description: " " }, ToolDescriptorTests.TOOLS), ArgumentException);
    const title = Assert.throws(() => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, title: String.empty }, ToolDescriptorTests.TOOLS), ArgumentException);
    const risk = Assert.throws(
      () => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, risk: { default: ToolRisk.Medium, maximum: ToolRisk.Low } }, ToolDescriptorTests.TOOLS), ArgumentException);

    Assert.areEqual("description", description.parameterName);
    Assert.areEqual("title", title.parameterName);
    Assert.areEqual("risk", risk.parameterName);
  }

  @TestMethod
  @TestData("Critical", "High")
  @TestData("low", "High")
  @TestData("Low", "high")
  @TestData("low", "low")
  public refusesARiskOutsideLowMediumAndHigh(value: string, maximum: string): void {
    const exception = Assert.throws(
      () => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, risk: { default: value as ToolRisk, maximum: maximum as ToolRisk } }, ToolDescriptorTests.TOOLS), ArgumentException);

    Assert.areEqual("risk", exception.parameterName);
  }

  @TestMethod
  @TestData(0, 1_000)
  @TestData(1.5, 1_000)
  @TestData(1_000, 1_000.5)
  @TestData(2_000, 1_000)
  @TestData(1_000, 120_001)
  public refusesADeadlineOutOfItsRange(value: number, maximum: number): void {
    const exception = Assert.throws(
      () => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, deadline: { default: value, maximum } }, ToolDescriptorTests.TOOLS), ArgumentOutOfRangeException);

    Assert.areEqual("deadline", exception.parameterName);
  }

  @TestMethod
  @TestData("item_id")
  @TestData("/item~2id")
  @TestData("binding:")
  @TestData("binding:a folder")
  public refusesAResourceThatIsNeitherAPointerNorABinding(resource: string): void {
    const exception = Assert.throws(() => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, resource }, ToolDescriptorTests.TOOLS), ArgumentException);

    Assert.areEqual("resource", exception.parameterName);
  }

  @TestMethod
  @TestData("/item_id")
  @TestData("/items/0/id")
  @TestData("/a~0b/c~1d")
  @TestData("binding:folder")
  public acceptsAPointerOrABinding(resource: string): void {
    Assert.areEqual(resource, new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, resource }, ToolDescriptorTests.TOOLS).resource);
  }

  @TestMethod
  public refusesALimitOutOfItsRange(): void {
    const cases: readonly IToolLimits[] = [{ textCharacters: 262_145 }, { imageBytes: 1_048_577 }, { imageLongEdge: 0 }, { imagePixels: 2.5 }];

    const names = cases.map(t => Assert.throws(() => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, limits: t }, ToolDescriptorTests.TOOLS), ArgumentOutOfRangeException));

    Assert.areEqual("limits,limits,limits,limits", names.map(t => t.parameterName).join(","));
  }

  @TestMethod
  public needsADeclaredNextToolForAToolThatCanEndUncertain(): void {
    const { nextTool: _nextTool, ...append } = ToolDescriptorTests.APPEND;

    const missing = Assert.throws(() => new ToolDescriptor(append, ToolDescriptorTests.TOOLS), ArgumentException);
    const undeclared = Assert.throws(() => new ToolDescriptor({ ...append, nextTool: "notes_status" }, ToolDescriptorTests.TOOLS), ArgumentException);
    const readOnly = Assert.throws(() => new ToolDescriptor({ ...ToolDescriptorTests.SEARCH, nextTool: "notes_status" }, ToolDescriptorTests.TOOLS), ArgumentException);

    Assert.areEqual("nextTool", missing.parameterName);
    Assert.areEqual("nextTool", undeclared.parameterName);
    Assert.areEqual("nextTool", readOnly.parameterName);
  }
}

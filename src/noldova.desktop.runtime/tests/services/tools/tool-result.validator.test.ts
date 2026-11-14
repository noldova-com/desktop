/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IToolDescriptor, ToolContent, ToolDescriptor, ToolFailure, ToolFailureCode, ToolResult, ToolRisk, ToolSchemaValidator } from "@noldova/desktop.runtime";

import { RegisteredTool } from "../../../src/models/registered-tool.js";
import { ToolResultValidator } from "../../../src/services/tools/tool-result.validator.js";
import { ModuleLogFixture } from "../../fixtures/module-log.fixture.js";
import { ToolHandlerFixture } from "../../fixtures/tool-handler.fixture.js";
import { ToolImageFixture } from "../../fixtures/tool-image.fixture.js";

@TestClass
export class ToolResultValidatorTests {
  private static readonly TOOLS: readonly string[] = ["notes_append", "notes_status", "notes_search"];
  private static readonly APPEND: IToolDescriptor = {
    name: "notes_append",
    description: "Appends to a note.",
    inputSchema: { type: "object" },
    outputSchema: { type: "object", properties: { count: { type: "integer" } }, required: ["count"] },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
    deadline: { default: 2_000, maximum: 5_000 },
    limits: { textCharacters: 8, imageLongEdge: 64 },
    nextTool: "notes_status"
  };
  private static readonly SEARCH: IToolDescriptor = {
    name: "notes_search",
    description: "Searches the notes.",
    inputSchema: { type: "object" },
    hints: { isReadOnly: true },
    risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
    deadline: { default: 2_000, maximum: 5_000 }
  };
  private static readonly MALFORMED: string = "Unavailable|The tool's result does not fit its shape or its schema.|notes.malformedResult";
  private static readonly TOO_LARGE: string = "TooLarge|The tool's result is over its limits.|null";

  @TestMethod
  public passesAWellFormedResultOnUnchanged(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const result = new ToolResult([
      ToolContent.fromText("Done.", null),
      ToolContent.fromText("Page", "notes:page-1"),
      ToolContent.fromText("Site", "https://example.com"),
      ToolContent.fromImage(ToolImageFixture.png(64, 32), "image/png", null)
    ], { count: 2 });

    const checked = validator.checkResult(ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND), result, false);

    Assert.areEqual(result, checked);
  }

  @TestMethod
  public findsAResultMalformedWhenItsContentClaimsAnotherOriginOrItsImageCannotBeRead(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const tool = ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND);
    const results = [
      new ToolResult([ToolContent.fromText("Page", "clock:page-1")], { count: 1 }),
      new ToolResult([ToolContent.fromText("Page", "notes:")], { count: 1 }),
      new ToolResult([ToolContent.fromText("Site", "https://example.com/page")], { count: 1 }),
      new ToolResult([ToolContent.fromImage(ToolImageFixture.bytes([1, 2, 3]), "image/png", null)], { count: 1 })
    ];

    const checked = results.map(t => ToolResultValidatorTests.describe(validator.checkResult(tool, t, false)));

    Assert.areEqual(Array.from({ length: 4 }, () => ToolResultValidatorTests.MALFORMED).join(","), checked.join(","));
  }

  @TestMethod
  public findsAResultMalformedWhenItsStructuredValueDoesNotMatchTheOutputSchema(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const append = ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND);
    const search = ToolResultValidatorTests.tool(ToolResultValidatorTests.SEARCH);

    const missing = validator.checkResult(append, new ToolResult([]), false);
    const mismatched = validator.checkResult(append, new ToolResult([], { count: "two" }), false);
    const unexpected = validator.checkResult(search, new ToolResult([], { count: 2 }), false);
    const plain = new ToolResult([]);
    const unstructured = validator.checkResult(search, plain, false);

    Assert.areEqual(ToolResultValidatorTests.MALFORMED, ToolResultValidatorTests.describe(missing));
    Assert.areEqual(ToolResultValidatorTests.MALFORMED, ToolResultValidatorTests.describe(mismatched));
    Assert.areEqual(ToolResultValidatorTests.MALFORMED,ToolResultValidatorTests.describe(unexpected));
    Assert.areEqual(plain, unstructured);
  }

  @TestMethod
  public findsAResultTooLargeOverTheToolsOwnLimitsOrTheRuntimes(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const append = ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND);
    const search = ToolResultValidatorTests.tool(ToolResultValidatorTests.SEARCH);

    const text = validator.checkResult(append, new ToolResult([ToolContent.fromText("123456789", null)], { count: 1 }), false);
    const image = validator.checkResult(append, new ToolResult([ToolContent.fromImage(ToolImageFixture.jpeg(65, 8), "image/jpeg", null)], { count: 1 }), false);
    const runtimeText = validator.checkResult(search, new ToolResult([ToolContent.fromText("x".repeat(256 * 1024 + 1), null)]), false);
    const whole = validator.checkResult(search, new ToolResult(Array.from({ length: 9 }, () => ToolContent.fromText("x".repeat(256 * 1024), null))), false);

    Assert.areEqual([1, 2, 3, 4].map(() => ToolResultValidatorTests.TOO_LARGE).join(","),
      [text, image, runtimeText, whole].map(t => ToolResultValidatorTests.describe(t)).join(","));
  }

  @TestMethod
  public turnsAProblemPastThePointOfNoReturnIntoAnUncertainOutcomeNamingTheToolsNextTool(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const tool = ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND);

    const checked = validator.checkResult(tool, new ToolResult([ToolContent.fromText("123456789", null)], { count: 1 }), true);

    Assert.areEqual("OutcomeUncertain|The tool's result is over its limits.|null|notes_status",
      `${ToolResultValidatorTests.describe(checked)}|${checked instanceof ToolFailure ? String(checked.nextTool) : "result"}`);
  }

  @TestMethod
  public keepsAWellFormedFailureAndMakesItUncertainOnlyPastThePointOfNoReturn(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const tool = ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND);
    const failure = new ToolFailure(ToolFailureCode.Refused, "The note is locked.", "notes.locked", [ToolContent.fromText("Locked", null)], "notes_search");

    const before = validator.checkFailure(tool, failure, false);
    const after = validator.checkFailure(tool, failure, true);
    const isWellFormed = validator.isWellFormed(tool, failure);

    Assert.areEqual(failure, before);
    Assert.areEqual("OutcomeUncertain|The note is locked.|notes.locked|notes_search", `${ToolResultValidatorTests.describe(after)}|${String(after.nextTool)}`);
    Assert.areEqual(1, after.content.length);
    Assert.isTrue(isWellFormed);
  }

  @TestMethod
  public findsAFailureMalformedWhenItsCodeOrNextToolIsNotTheModulesOrItCannotBeUncertain(): void {
    const validator = new ToolResultValidator(new ToolSchemaValidator());
    const append = ToolResultValidatorTests.tool(ToolResultValidatorTests.APPEND);
    const search = ToolResultValidatorTests.tool(ToolResultValidatorTests.SEARCH);
    const failures: readonly [RegisteredTool, ToolFailure][] = [
      [append, new ToolFailure(ToolFailureCode.Refused, "Locked.", "clock.locked")],
      [append, new ToolFailure(ToolFailureCode.Refused, "Locked.", "notes.Locked")],
      [append, new ToolFailure(ToolFailureCode.Refused, "Locked.", "notes.locked", [], "clock_status")],
      [search, new ToolFailure(ToolFailureCode.OutcomeUncertain, "Unknown.")],
      [append, new ToolFailure(ToolFailureCode.Refused, "Locked.", null, [ToolContent.fromText("Page", "clock:page-1")])]
    ];

    const checked = failures.map(([tool, failure]) => ToolResultValidatorTests.describe(validator.checkFailure(tool, failure, false)));
    const areWellFormed = failures.map(([tool, failure]) => validator.isWellFormed(tool, failure));

    Assert.areEqual(Array.from({ length: 5 }, () => ToolResultValidatorTests.MALFORMED).join(","), checked.join(","));
    Assert.isFalse(areWellFormed.some(t => t));
  }

  private static tool(descriptor: IToolDescriptor): RegisteredTool {
    return new RegisteredTool("notes", new ToolDescriptor(descriptor, ToolResultValidatorTests.TOOLS), new ToolHandlerFixture(), ToolResultValidatorTests.TOOLS, new ModuleLogFixture());
  }

  private static describe(checked: ToolResult | ToolFailure): string {
    return checked instanceof ToolFailure ? `${checked.code}|${checked.message}|${String(checked.moduleCode)}` : "result";
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { type IPermissionDetail, type IPermissionRequest, type IToolDescriptor, PermissionDetailKind, PermissionOption, ToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";

import { PermissionRequestChecker } from "../../../src/services/permissions/permission-request-checker.js";
import { PermissionDetailFixture } from "../../fixtures/permission-detail.fixture.js";

@TestClass
export class PermissionRequestCheckerTests {
  private static readonly MODULE: string = "notes";
  private static readonly TOOL: IToolDescriptor = {
    name: "notes_delete",
    description: "Deletes a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.High },
    deadline: { default: 2_000, maximum: 5_000 },
    isResumable: true
  };
  private static readonly REQUEST: IPermissionRequest = {
    action: "notes.deleteItem",
    subject: "item-1",
    title: "Delete the note Plans",
    details: [{ label: "Note", kind: PermissionDetailKind.Text, value: "Plans" }],
    risk: ToolRisk.Medium,
    options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways]
  };

  private static check(request: unknown, tool: IToolDescriptor = PermissionRequestCheckerTests.TOOL): string | null {
    const read = PermissionRequestChecker.read(PermissionRequestCheckerTests.MODULE, new ToolDescriptor(tool, []), request);
    return Object.isString(read) ? read : null;
  }

  private static read(request: unknown): IPermissionRequest {
    const read = PermissionRequestChecker.read(PermissionRequestCheckerTests.MODULE, new ToolDescriptor(PermissionRequestCheckerTests.TOOL, []), request);
    if (Object.isString(read))
      throw new Error(read);
    return read;
  }

  @TestMethod
  public copiesTheRequestSoLaterChangesToTheModulesListsDoNotReachIt(): void {
    const details: IPermissionDetail[] = [{ label: "Note", kind: PermissionDetailKind.Text, value: "Plans" }];
    const options: PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways];
    const labels: Partial<Record<PermissionOption.AllowAlways, string>> = { [PermissionOption.AllowAlways]: "Allow this note" };

    const copy = PermissionRequestCheckerTests.read({ ...PermissionRequestCheckerTests.REQUEST, details, options, labels, isAsking: true, isRememberedOnly: false });
    details.push({ label: "Later", kind: PermissionDetailKind.Text, value: "x" });
    options.push(PermissionOption.Deny);
    labels[PermissionOption.AllowAlways] = "Later";

    Assert.areEqual(JSON.stringify([{ label: "Note", kind: PermissionDetailKind.Text, value: "Plans" }]), JSON.stringify(copy.details));
    Assert.areEqual([PermissionOption.AllowOnce, PermissionOption.AllowAlways].join(","), copy.options.join(","));
    Assert.areEqual(JSON.stringify({ AllowAlways: "Allow this note" }), JSON.stringify(copy.labels));
    Assert.areEqual("notes.deleteItem|item-1|Delete the note Plans|Medium|true|false",
      `${copy.action}|${String(copy.subject)}|${copy.title}|${copy.risk}|${String(copy.isAsking)}|${String(copy.isRememberedOnly)}`);
  }

  @TestMethod
  public refusesFieldsOfTheWrongTypeAndAValueThatIsNotJson(): void {
    const request = PermissionRequestCheckerTests.REQUEST;

    Assert.areEqual("The action must be notes, a dot and a camelCase name.", PermissionRequestCheckerTests.check({ ...request, action: 7 }));
    Assert.areEqual("The subject, when there is one, must be a string of at most 1,024 characters.", PermissionRequestCheckerTests.check({ ...request, subject: null }));
    Assert.areEqual("isAsking and isRememberedOnly, when present, must be true or false.", PermissionRequestCheckerTests.check({ ...request, isAsking: "yes" }));
    Assert.areEqual(
      "The labels must name only offered AllowAlways or TakeOver options, each one line that isn't blank, of at most 40 characters, and TakeOver must have one.",
      PermissionRequestCheckerTests.check({ ...request, labels: null }));
    Assert.throws(() => PermissionRequestCheckerTests.check({ ...request, title: (): string => "Delete" }), JsonException);
    Assert.throws(() => PermissionRequestCheckerTests.check("Delete the note"), JsonException);
  }

  @TestMethod
  public findsNoProblemInAWellFormedRequest(): void {
    Assert.isNull(PermissionRequestCheckerTests.check(PermissionRequestCheckerTests.REQUEST));
    Assert.isNull(PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, subject: undefined }));
  }

  @TestMethod
  public refusesARequestFromAReadOnlyLowRiskTool(): void {
    const tool: IToolDescriptor = { ...PermissionRequestCheckerTests.TOOL, risk: { default: ToolRisk.Low, maximum: ToolRisk.Low }, hints: { isReadOnly: true } };

    Assert.areEqual("A call of a read-only tool whose maximum risk is Low raises no request.", PermissionRequestCheckerTests.check(PermissionRequestCheckerTests.REQUEST, tool));
  }

  @TestMethod
  public refusesAnActionOutsideTheModuleOrNotInCamelCase(): void {
    const expected = "The action must be notes, a dot and a camelCase name.";

    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, action: "tasks.deleteItem" }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, action: "notes.Delete-Item" }));
  }

  @TestMethod
  public refusesASubjectOverItsLimitAndATitleThatIsBlankLongOrMoreThanOneLine(): void {
    const title = "The title must be one line that isn't blank, of at most 200 characters.";

    Assert.areEqual("The subject, when there is one, must be a string of at most 1,024 characters.",
      PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, subject: "s".repeat(1_025) }));
    Assert.areEqual(title, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, title: " " }));
    Assert.areEqual(title, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, title: "t".repeat(201) }));
    Assert.areEqual(title, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, title: "Delete\nthe note" }));
    Assert.isNull(PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, subject: "s".repeat(1_024), title: "t".repeat(200) }));
  }

  @TestMethod
  public refusesTooManyDetailsOrADetailWithABlankLabel(): void {
    const detail: IPermissionDetail = { label: "Note", kind: PermissionDetailKind.Text, value: "Plans" };
    const expected = "The details must be at most 64 items, each with a label that isn't blank, a kind of Text, Code, Secret or AgentText, and a string value, and at most 80 KiB as JSON.";

    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: Array.from({ length: 65 }, () => detail) }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: [{ ...detail, label: " " }] }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: [{ ...detail, value: "v".repeat(80 * 1_024) }] }));
    Assert.isNull(PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: Array.from({ length: 64 }, () => detail) }));
  }

  @TestMethod
  public readsADetailThatIsAClassInstanceAsItsFields(): void {
    const details = [new PermissionDetailFixture("Note", PermissionDetailKind.Text, "Plans")];

    const copy = PermissionRequestCheckerTests.read({ ...PermissionRequestCheckerTests.REQUEST, details });

    Assert.areEqual(JSON.stringify([{ label: "Note", kind: PermissionDetailKind.Text, value: "Plans" }]), JSON.stringify(copy.details));
  }

  @TestMethod
  public refusesARequestOrDetailThatIsNotAnObjectOrHasNoFields(): void {
    const expected = "The details must be at most 64 items, each with a label that isn't blank, a kind of Text, Code, Secret or AgentText, and a string value, and at most 80 KiB as JSON.";

    Assert.areEqual("The action must be notes, a dot and a camelCase name.", PermissionRequestCheckerTests.check({}));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: [{}] }));

    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: ["Plans"] }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, details: "Plans" }));
    Assert.throws(() => PermissionRequestCheckerTests.check([PermissionRequestCheckerTests.REQUEST]), JsonException);
    Assert.throws(() => PermissionRequestCheckerTests.check((): IPermissionRequest => PermissionRequestCheckerTests.REQUEST), JsonException);
  }

  @TestMethod
  public refusesARiskAboveTheToolsMaximum(): void {
    const tool: IToolDescriptor = { ...PermissionRequestCheckerTests.TOOL, risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium } };

    Assert.areEqual("The risk must be Low, Medium or High, and at most the tool's maximum risk, Medium.",
      PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, risk: ToolRisk.High }, tool));
  }

  @TestMethod
  public refusesNoOrRepeatedOptions(): void {
    const expected = "The options must be a list of distinct options from AllowOnce, AllowAlways, Deny, DenyAlways and TakeOver, and not empty.";

    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, options: [] }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, options: [PermissionOption.Deny, PermissionOption.Deny] }));
  }

  @TestMethod
  public refusesAnAlwaysOptionInANamedHighRiskRequest(): void {
    const request: IPermissionRequest = {
      ...PermissionRequestCheckerTests.REQUEST, risk: ToolRisk.High, options: [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.DenyAlways],
      labels: { [PermissionOption.TakeOver]: "Take over the note" }
    };

    Assert.isTrue(PermissionRequestChecker.isNamedHighRisk(request));
    Assert.isFalse(PermissionRequestChecker.isNamedHighRisk({ ...PermissionRequestCheckerTests.REQUEST, risk: ToolRisk.High }));
    Assert.areEqual("A High-risk request that gives labels or offers TakeOver may offer neither AllowAlways nor DenyAlways.", PermissionRequestCheckerTests.check(request));
    Assert.isNull(PermissionRequestCheckerTests.check({ ...request, options: [PermissionOption.AllowOnce, PermissionOption.TakeOver, PermissionOption.Deny] }));
  }

  @TestMethod
  public refusesLabelsForOptionsNotOfferedTooLongOrMissingForTakeOver(): void {
    const expected = "The labels must name only offered AllowAlways or TakeOver options, each one line that isn't blank, of at most 40 characters, and TakeOver must have one.";
    const offered = [PermissionOption.AllowOnce, PermissionOption.TakeOver];

    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, options: offered }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, options: offered, labels: { [PermissionOption.AllowAlways]: "Allow" } }));
    Assert.areEqual(expected, PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, labels: { [PermissionOption.AllowAlways]: "a".repeat(41) } }));
    Assert.isNull(PermissionRequestCheckerTests.check({ ...PermissionRequestCheckerTests.REQUEST, labels: { [PermissionOption.AllowAlways]: "a".repeat(40) } }));
  }

  @TestMethod
  public keepsTheLabelsOfBothAllowAlwaysAndTakeOverWhenBothAreOffered(): void {
    const labels = { [PermissionOption.AllowAlways]: "Allow this note", [PermissionOption.TakeOver]: "Take over the note" };

    const read = PermissionRequestCheckerTests.read({
      ...PermissionRequestCheckerTests.REQUEST, options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.TakeOver], labels
    });

    Assert.areEqual(JSON.stringify(labels), JSON.stringify(read.labels));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AnswererRegisteredException, type IPermissionDetail, type IPermissionRequest, type IToolDescriptor, PermissionCenter, PermissionDecision, PermissionDetailKind,
  PermissionOption, type PermissionOutcome, type PermissionRevocation, PermissionsClosedException, PermissionsModuleOnlyException, RememberedPermissionStore, ToolDescriptor, ToolRegistry, ToolRisk, ToolSession
} from "@noldova/desktop.runtime";

import { ModuleLogFixture } from "../../fixtures/module-log.fixture.js";
import { PermissionAnswererFixture } from "../../fixtures/permission-answerer.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";

@TestClass
export class PermissionCenterTests {
  private static readonly APP: string = "app";
  private static readonly DELETE: IToolDescriptor = {
    name: "notes_delete",
    description: "Deletes a note.",
    inputSchema: { type: "object" },
    risk: { default: ToolRisk.Medium, maximum: ToolRisk.Medium },
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

  @TestMethod
  public asksTheAnswererWithTheCallsSessionAndScopeAndACopyOfTheRequest(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async (center, store) => {
      const answerer = new PermissionAnswererFixture();
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const details: IPermissionDetail[] = [{ label: "Note", kind: PermissionDetailKind.Text, value: "Plans" }];
      const request = { ...PermissionCenterTests.REQUEST, details, isAsking: false };

      const outcome = await PermissionCenterTests.requestAsync(center, request);
      details.push({ label: "Later", kind: PermissionDetailKind.Text, value: "x" });

      const [question] = answerer.questions;
      Assert.isDefined(question);
      Assert.areEqual("notes|session-1|conversation-1", `${question.module}|${question.session}|${question.scope}`);
      Assert.areEqual(JSON.stringify(request.details.slice(0, 1)), JSON.stringify(question.request.details));
      Assert.areEqual(`${request.action}|${String(request.subject)}|${request.title}|${request.risk}|false|${request.options.join(",")}`,
        `${question.request.action}|${String(question.request.subject)}|${question.request.title}|${question.request.risk}|${String(question.request.isAsking)}|${question.request.options.join(",")}`);
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedOnce, false, outcome);
      Assert.isTrue(outcome.isAllowed);
      Assert.areEqual(0, store.list().length);
    });
  }

  @TestMethod
  public remembersAnAlwaysAnswerByModuleActionSubjectAndScope(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answerer = new PermissionAnswererFixture(t => Promise.resolve(t.request.subject === "item-2" ? PermissionDecision.DeniedAlways : PermissionDecision.AllowedAlways));
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const { action, title, details, risk, options } = PermissionCenterTests.REQUEST;
      const withoutSubject: IPermissionRequest = { action, title, details, risk, options };

      const first = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);
      const again = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);
      const denied = await PermissionCenterTests.requestAsync(center, { ...PermissionCenterTests.REQUEST, subject: "item-2" });
      const deniedAgain = await PermissionCenterTests.requestAsync(center, { ...PermissionCenterTests.REQUEST, subject: "item-2" });
      await PermissionCenterTests.requestAsync(center, withoutSubject);
      await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-2");
      await PermissionCenterTests.requestAsync(center, { ...PermissionCenterTests.REQUEST, action: "tasks.deleteItem" }, "conversation-1", "tasks");
      await PermissionCenterTests.requestAsync(center, { ...PermissionCenterTests.REQUEST, action: "notes.archiveItem" });
      const withoutSubjectAgain = await PermissionCenterTests.requestAsync(center, withoutSubject);

      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedAlways, false, first);
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedAlways, true, again);
      PermissionCenterTests.assertOutcome(PermissionDecision.DeniedAlways, false, denied);
      PermissionCenterTests.assertOutcome(PermissionDecision.DeniedAlways, true, deniedAgain);
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedAlways, true, withoutSubjectAgain);
      Assert.isFalse(deniedAgain.isAllowed);
      Assert.areEqual("item-1,item-2,undefined,item-1,item-1,item-1", answerer.questions.map(t => String(t.request.subject)).join(","));
    });
  }

  @TestMethod
  public answersARememberedOnlyRequestWithoutAskingAnyone(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async (center, store) => {
      const answerer = new PermissionAnswererFixture();
      const log = new ModuleLogFixture();
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const request = { ...PermissionCenterTests.REQUEST, isRememberedOnly: true };

      const unknown = await PermissionCenterTests.requestAsync(center, request, "conversation-1", "notes", log);
      store.remember("notes", request.action, request.subject ?? null, "conversation-1", PermissionDecision.AllowedAlways);
      const known = await PermissionCenterTests.requestAsync(center, request);

      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, unknown);
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedAlways, true, known);
      Assert.isTrue(center.revoke(PermissionCenterTests.APP, center.listRemembered(PermissionCenterTests.APP)[0]?.id ?? String.empty));
      Assert.areEqual(0, answerer.questions.length);
      Assert.areEqual(0, log.lines.length);
    });
  }

  @TestMethod
  public listsAndRevokesRememberedAnswersAndTellsTheirModule(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async (center, store) => {
      const answerer = new PermissionAnswererFixture(() => Promise.resolve(PermissionDecision.AllowedAlways));
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const revoked: PermissionRevocation[] = [];
      const others: PermissionRevocation[] = [];
      const log = new ModuleLogFixture();
      center.onRevoked("notes", () => {
        throw new Error("The view is gone.");
      }, log);
      center.onRevoked("notes", t => revoked.push(t), log);
      const stopped = center.onRevoked("notes", t => revoked.push(t), log);
      center.onRevoked("tasks", t => others.push(t), log);
      stopped[Symbol.dispose]();
      await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);
      const [remembered] = center.listRemembered(PermissionCenterTests.APP);
      Assert.isDefined(remembered);

      const isRevoked = center.revoke(PermissionCenterTests.APP, remembered.id);
      const isRevokedTwice = center.revoke(PermissionCenterTests.APP, remembered.id);
      const after = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);

      Assert.areEqual(`notes|notes.deleteItem|item-1|conversation-1|${PermissionDecision.AllowedAlways}`,
        `${remembered.module}|${remembered.action}|${String(remembered.subject)}|${remembered.scope}|${remembered.decision}`);
      Assert.isTrue(isRevoked);
      Assert.isFalse(isRevokedTwice);
      Assert.areEqual("notes.deleteItem|item-1|conversation-1", revoked.map(t => `${t.action}|${String(t.subject)}|${t.scope}`).join(","));
      Assert.areEqual(0, others.length);
      Assert.isTrue(log.lines.length === 1 && log.lines[0]?.startsWith("A listener for revoked permission answers failed: Error: The view is gone.") === true, log.lines.join("\n"));
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedAlways, false, after);
      Assert.areEqual(2, answerer.questions.length);
      Assert.areEqual(1, store.list().length);
    });
  }

  @TestMethod
  public refusesAnyOtherModuleTheAnswererAndTheRememberedAnswers(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(center => {
      const answerer = new PermissionAnswererFixture();
      const message = "The module notes cannot answer permission requests or manage remembered answers; only the module the app names in desktop.product.permissionsModule can.";

      const register = Assert.throws(() => center.registerAnswerer("notes", answerer, new ModuleLogFixture()), PermissionsModuleOnlyException);
      const list = Assert.throws(() => center.listRemembered("notes"), PermissionsModuleOnlyException);
      const revoke = Assert.throws(() => center.revoke("notes", "any"), PermissionsModuleOnlyException);

      Assert.areEqual(message, register.message);
      Assert.areEqual(message, list.message);
      Assert.areEqual(message, revoke.message);
      return Promise.resolve();
    });
  }

  @TestMethod
  public takesOneAnswererAtATime(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const first = new PermissionAnswererFixture();
      const second = new PermissionAnswererFixture(() => Promise.resolve(PermissionDecision.Denied));
      const registration = center.registerAnswerer(PermissionCenterTests.APP, first, new ModuleLogFixture());

      const refused = Assert.throws(() => center.registerAnswerer(PermissionCenterTests.APP, second, new ModuleLogFixture()), AnswererRegisteredException);
      registration[Symbol.dispose]();
      center.registerAnswerer(PermissionCenterTests.APP, second, new ModuleLogFixture());
      registration[Symbol.dispose]();
      const outcome = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);

      Assert.areEqual("The module app already registered an answerer for permission requests.", refused.message);
      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, outcome);
      Assert.areEqual(0, first.questions.length);
    });
  }

  @TestMethod
  public deniesEveryRequestAndSaysWhyWithoutAnAnswerer(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async (center, store) => {
      const log = new ModuleLogFixture();

      const outcome = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-1", "notes", log);
      const noModule = new PermissionCenter();
      noModule.open(store);
      const unnamed = await PermissionCenterTests.requestAsync(noModule, PermissionCenterTests.REQUEST, "conversation-1", "notes", log);
      const refused = Assert.throws(() => noModule.registerAnswerer(PermissionCenterTests.APP, new PermissionAnswererFixture(), log), PermissionsModuleOnlyException);

      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, outcome);
      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, unnamed);
      const reason = "The permission request for notes.deleteItem was denied: No module answers permission requests: the app names none in desktop.product.permissionsModule, " +
        "or that module registered no answerer.";
      Assert.areEqual(`${reason}\n${reason}`, log.lines.join("\n"));
      Assert.isTrue(refused.message.startsWith("The module app cannot answer"), refused.message);
    });
  }

  @TestMethod
  public deniesAnInvalidRequestWithoutAskingAndSaysWhy(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answerer = new PermissionAnswererFixture();
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const request = PermissionCenterTests.REQUEST;
      const text = (value: string): IPermissionDetail => ({ label: "Item", kind: PermissionDetailKind.Code, value });
      const subject = "The subject, when there is one, must be a string of at most 1,024 characters.";
      const title = "The title must be one line that isn't blank, of at most 200 characters.";
      const details = "The details must be at most 64 items, each with a label that isn't blank, a kind of Text, Code, Secret or AgentText, and a string value, and at most 80 KiB as JSON.";
      const options = "The options must be a list of distinct options from AllowOnce, AllowAlways, Deny, DenyAlways and TakeOver, and not empty.";
      const cases: readonly (readonly [unknown, string])[] = [
        [{ ...request, action: "tasks.deleteItem" }, "The action must be notes, a dot and a camelCase name."],
        [{ ...request, action: "notes.DeleteItem" }, "The action must be notes, a dot and a camelCase name."],
        [{ ...request, action: 7 }, "The action must be notes, a dot and a camelCase name."],
        [{ ...request, subject: "s".repeat(1025) }, subject],
        [{ ...request, subject: 7 }, subject],
        [{ ...request, title: " " }, title],
        [{ ...request, title: "t".repeat(201) }, title],
        [{ ...request, title: "Delete\nthe note" }, title],
        [{ ...request, title: null }, title],
        [{ ...request, details: Array.from({ length: 65 }, () => text("x")) }, details],
        [{ ...request, details: [{ label: " ", kind: PermissionDetailKind.Text, value: "x" }] }, details],
        [{ ...request, details: [{ label: "Item", kind: "Html", value: "x" }] }, details],
        [{ ...request, details: [{ label: "Item", kind: PermissionDetailKind.Text, value: 7 }] }, details],
        [{ ...request, details: null }, details],
        [{ ...request, details: [text("x".repeat(80 * 1024))] }, details],
        [{ ...request, risk: ToolRisk.High }, "The risk must be Low, Medium or High, and at most the tool's maximum risk, Medium."],
        [{ ...request, risk: "Severe" }, "The risk must be Low, Medium or High, and at most the tool's maximum risk, Medium."],
        [{ ...request, isAsking: "yes" }, "isAsking and isRememberedOnly, when present, must be true or false."],
        [{ ...request, isRememberedOnly: 1 }, "isAsking and isRememberedOnly, when present, must be true or false."],
        [{ ...request, options: [] }, options],
        [{ ...request, options: [PermissionOption.Deny, PermissionOption.Deny] }, options],
        [{ ...request, options: ["Later"] }, options]
      ];

      for (const [invalid, reason] of cases) {
        const log = new ModuleLogFixture();
        const outcome = await PermissionCenterTests.requestAsync(center, invalid, "conversation-1", "notes", log);
        PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, outcome);
        Assert.areEqual(`The permission request for notes_delete was denied: ${reason}`, log.lines.join("\n"));
      }
      const unreadable = new ModuleLogFixture();
      const broken = await PermissionCenterTests.requestAsync(center, { ...request, title: (): string => "Delete" }, "conversation-1", "notes", unreadable);
      const readOnly = new ModuleLogFixture();
      const descriptor = new ToolDescriptor({ ...PermissionCenterTests.DELETE, hints: { isReadOnly: true }, risk: { default: ToolRisk.Low, maximum: ToolRisk.Low } }, ["notes_delete"]);
      const read = await center.requestAsync("notes", descriptor, readOnly, PermissionCenterTests.session("conversation-1"), { ...request, risk: ToolRisk.Low },
        new AbortController().signal);
      const longest = await PermissionCenterTests.requestAsync(center, {
        ...request, subject: "s".repeat(1024), title: "t".repeat(200), details: Array.from({ length: 64 }, () => text("x")), options: [PermissionOption.AllowOnce]
      });

      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, broken);
      const unreadableLine = unreadable.lines[0] ?? String.empty;
      Assert.isTrue(
        unreadableLine.startsWith("The permission request for notes_delete was denied: The request could not be read: ") && unreadableLine.includes("JsonException"),
        unreadable.lines.join("\n"));
      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, read);
      Assert.areEqual("The permission request for notes_delete was denied: A call of a read-only tool whose maximum risk is Low raises no request.", readOnly.lines.join("\n"));
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedOnce, false, longest);
      Assert.areEqual(1, answerer.questions.length);
    });
  }

  @TestMethod
  public deniesAnAnswerThatFailsOrThatTheRequestDoesNotOffer(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answers: (() => Promise<PermissionDecision>)[] = [
        () => {
          throw new Error("The card failed.");
        },
        () => Promise.reject(new Error("The policy failed.")),
        () => Promise.resolve(PermissionDecision.Withdrawn),
        () => Promise.resolve(PermissionDecision.AllowedAlways),
        () => Promise.resolve(PermissionDecision.DeniedAlways),
        () => Promise.resolve(PermissionDecision.Expired),
        () => Promise.resolve(PermissionDecision.Denied)
      ];
      const log = new ModuleLogFixture();
      center.registerAnswerer(PermissionCenterTests.APP, new PermissionAnswererFixture(() => answers.shift()?.() ?? PermissionAnswererFixture.never()), log);
      const request = { ...PermissionCenterTests.REQUEST, options: [PermissionOption.AllowOnce] };

      const outcomes: PermissionOutcome[] = [];
      for (let index = 0; index < 7; index++)
        outcomes.push(await PermissionCenterTests.requestAsync(center, request));

      Assert.areEqual(
        [PermissionDecision.Denied, PermissionDecision.Denied, PermissionDecision.Denied, PermissionDecision.Denied, PermissionDecision.Denied,
          PermissionDecision.Expired, PermissionDecision.Denied].join(","),
        outcomes.map(t => t.decision).join(","));
      Assert.areEqual(5, log.lines.length);
      Assert.isTrue(log.lines[0]?.startsWith("The answerer failed for notes.deleteItem, so the request is denied: Error: The card failed.") === true, log.lines[0]);
      Assert.isTrue(log.lines[1]?.startsWith("The answerer failed for notes.deleteItem, so the request is denied: Error: The policy failed.") === true, log.lines[1]);
      Assert.areEqual(
        ["Withdrawn", "AllowedAlways", "DeniedAlways"].map(t => `The answerer's decision ${t} for notes.deleteItem is not one the request offers, so the request is denied.`).join("\n"),
        log.lines.slice(2).join("\n"));
    });
  }

  @TestMethod
  public expiresARequestNobodyAnswersInTime(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answerer = new PermissionAnswererFixture(() => PermissionAnswererFixture.never());
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());

      const outcome = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);

      PermissionCenterTests.assertOutcome(PermissionDecision.Expired, false, outcome);
      Assert.isTrue(answerer.signals[0]?.aborted === true);
    }, 20);
  }

  @TestMethod
  public withdrawsAWaitingRequestWhenItsCallAbortsOrAllAreWithdrawn(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const late: ((decision: PermissionDecision) => void)[] = [];
      const answerer = new PermissionAnswererFixture(() => new Promise(resolve => late.push(resolve)));
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const aborted = new AbortController();
      aborted.abort();
      const call = new AbortController();

      const before = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-1", "notes", new ModuleLogFixture(), aborted.signal);
      const first = PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-1", "notes", new ModuleLogFixture(), call.signal);
      await answerer.waitForQuestionAsync(1);
      call.abort("anything");
      const second = PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-2");
      const third = PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-3");
      await answerer.waitForQuestionAsync(3);
      center.withdrawAll();
      for (const resolve of late)
        resolve(PermissionDecision.AllowedAlways);

      PermissionCenterTests.assertOutcome(PermissionDecision.Withdrawn, false, before);
      for (const outcome of await Promise.all([first, second, third]))
        PermissionCenterTests.assertOutcome(PermissionDecision.Withdrawn, false, outcome);
      Assert.areEqual("true,true,true", answerer.signals.map(t => t.aborted).join(","));
      Assert.areEqual(0, center.listRemembered(PermissionCenterTests.APP).length);
    });
  }

  @TestMethod
  public deniesTheRequestsWaitingForAnAnswererWhenItsRegistrationIsDisposedAndIgnoresItsLateAnswers(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const late: ((decision: PermissionDecision) => void)[] = [];
      const first = new PermissionAnswererFixture(() => new Promise(resolve => late.push(resolve)));
      const second = new PermissionAnswererFixture(() => Promise.resolve(PermissionDecision.AllowedOnce));
      const registration = center.registerAnswerer(PermissionCenterTests.APP, first, new ModuleLogFixture());
      const log = new ModuleLogFixture();

      const waiting = [
        PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-1", "notes", log),
        PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-2", "notes", log)
      ];
      await first.waitForQuestionAsync(2);
      registration[Symbol.dispose]();
      center.registerAnswerer(PermissionCenterTests.APP, second, new ModuleLogFixture());
      registration[Symbol.dispose]();
      for (const resolve of late)
        resolve(PermissionDecision.AllowedAlways);
      const next = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST, "conversation-3");

      for (const outcome of await Promise.all(waiting))
        PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, outcome);
      const reason = "The permission request for notes.deleteItem was denied: The module that answers permission requests withdrew its answerer while the request waited.";
      Assert.areEqual(`${reason}\n${reason}`, log.lines.join("\n"));
      Assert.areEqual("true,true", first.signals.map(t => t.aborted).join(","));
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedOnce, false, next);
      Assert.areEqual(0, center.listRemembered(PermissionCenterTests.APP).length);
    });
  }

  @TestMethod
  public keepsAnAnswerForItsCallOnlyWhenItCannotBeRemembered(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async () => {
      const closed = new PermissionCenter(PermissionCenterTests.APP);
      const answers = [PermissionDecision.AllowedAlways, PermissionDecision.DeniedAlways];
      closed.registerAnswerer(PermissionCenterTests.APP, new PermissionAnswererFixture(() => Promise.resolve(answers.shift() ?? PermissionDecision.Denied)), new ModuleLogFixture());
      const log = new ModuleLogFixture();

      const allowed = await PermissionCenterTests.requestAsync(closed, PermissionCenterTests.REQUEST, "conversation-1", "notes", log);
      const denied = await PermissionCenterTests.requestAsync(closed, PermissionCenterTests.REQUEST, "conversation-1", "notes", log);
      const list = Assert.throws(() => closed.listRemembered(PermissionCenterTests.APP), PermissionsClosedException);
      const revoke = Assert.throws(() => closed.revoke(PermissionCenterTests.APP, "any"), PermissionsClosedException);

      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedOnce, false, allowed);
      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, denied);
      Assert.areEqual(4, log.lines.length);
      Assert.isTrue(log.lines[0]?.startsWith("A remembered answer for notes.deleteItem could not be read, so the answerer decides: PermissionsClosedException: Noldova Desktop's database is not open.") === true, log.lines[0]);
      Assert.isTrue(log.lines[1]?.startsWith("The answer for notes.deleteItem could not be remembered, so it holds for this call only: PermissionsClosedException") === true, log.lines[1]);
      Assert.areEqual("Noldova Desktop's database is not open.", list.message);
      Assert.areEqual("Noldova Desktop's database is not open.", revoke.message);
    });
  }

  @TestMethod
  public givesTheAnswererTheModulesLabelsExactlyAsGivenAndFrozen(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answerer = new PermissionAnswererFixture();
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const labels: Partial<Record<PermissionOption, string>> = { [PermissionOption.AllowAlways]: " Allow this site for the project " };
      const longest = { [PermissionOption.AllowAlways]: "a".repeat(40) };

      const outcome = await PermissionCenterTests.requestAsync(center, { ...PermissionCenterTests.REQUEST, labels });
      labels[PermissionOption.AllowAlways] = "Later";
      await PermissionCenterTests.requestAsync(center, { ...PermissionCenterTests.REQUEST, labels: longest });
      await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);

      const [labelled, widest, plain] = answerer.questions;
      PermissionCenterTests.assertOutcome(PermissionDecision.AllowedOnce, false, outcome);
      Assert.areEqual(JSON.stringify({ AllowAlways: " Allow this site for the project " }), JSON.stringify(labelled?.request.labels));
      Assert.areEqual(JSON.stringify(longest), JSON.stringify(widest?.request.labels));
      Assert.isUndefined(plain?.request.labels);
    });
  }

  @TestMethod
  public deniesLabelsOutsideTheirLimitsWithoutAskingAndSaysWhy(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answerer = new PermissionAnswererFixture();
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const request = PermissionCenterTests.REQUEST;
      const takeOver = [PermissionOption.AllowOnce, PermissionOption.Deny, PermissionOption.TakeOver];
      const cases: readonly unknown[] = [
        { ...request, labels: { [PermissionOption.AllowOnce]: "Allow" } },
        { ...request, labels: { [PermissionOption.Deny]: "Not now" } },
        { ...request, options: [PermissionOption.AllowOnce, PermissionOption.Deny], labels: { [PermissionOption.AllowAlways]: "Allow for this chat" } },
        { ...request, labels: { [PermissionOption.AllowAlways]: " " } },
        { ...request, labels: { [PermissionOption.AllowAlways]: "a".repeat(41) } },
        { ...request, labels: { [PermissionOption.AllowAlways]: "Allow for\nthis chat" } },
        { ...request, labels: { [PermissionOption.AllowAlways]: 7 } },
        { ...request, labels: { Later: "Later" } },
        { ...request, labels: "Allow for this chat" },
        { ...request, labels: ["Allow for this chat"] },
        { ...request, labels: null },
        { ...request, options: takeOver },
        { ...request, options: takeOver, labels: {} }
      ];

      for (const invalid of cases) {
        const log = new ModuleLogFixture();
        const outcome = await PermissionCenterTests.requestAsync(center, invalid, "conversation-1", "notes", log);
        PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, outcome);
        Assert.areEqual("The permission request for notes_delete was denied: The labels must name only offered AllowAlways or TakeOver options, each one line that "
          + "isn't blank, of at most 40 characters, and TakeOver must have one.", log.lines.join("\n"), JSON.stringify(invalid));
      }
      Assert.areEqual(0, answerer.questions.length);
    });
  }

  @TestMethod
  public deniesAnAlwaysOptionAtHighRiskOnlyOnARequestThatGivesLabelsOrOffersTakeOver(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answerer = new PermissionAnswererFixture();
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const descriptor = new ToolDescriptor({ ...PermissionCenterTests.DELETE, risk: { default: ToolRisk.High, maximum: ToolRisk.High } }, ["notes_delete"]);
      const high = { ...PermissionCenterTests.REQUEST, risk: ToolRisk.High };
      const typing = { [PermissionOption.TakeOver]: "I'll type it myself" };
      const ask = (request: IPermissionRequest, log: ModuleLogFixture = new ModuleLogFixture()): Promise<PermissionOutcome> =>
        center.requestAsync("notes", descriptor, log, PermissionCenterTests.session("conversation-1"), request, new AbortController().signal);
      const logs = [new ModuleLogFixture(), new ModuleLogFixture()];

      const refused = [
        await ask({ ...high, options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny],
          labels: { [PermissionOption.AllowAlways]: "Allow for this chat" } }, logs[0]),
        await ask({ ...high, options: [PermissionOption.AllowOnce, PermissionOption.Deny, PermissionOption.DenyAlways, PermissionOption.TakeOver], labels: typing }, logs[1])
      ];
      const asked = [
        await ask({ ...high, options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways] }),
        await ask({ ...high, options: [PermissionOption.AllowOnce, PermissionOption.Deny, PermissionOption.TakeOver], labels: typing }),
        await ask({ ...PermissionCenterTests.REQUEST, options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways],
          labels: { [PermissionOption.AllowAlways]: "Allow for this chat" } })
      ];

      Assert.areEqual("Denied,Denied,AllowedOnce,AllowedOnce,AllowedOnce", [...refused, ...asked].map(t => t.decision).join(","));
      Assert.areEqual(Array.from({ length: 2 }, () => "The permission request for notes_delete was denied: "
        + "A High-risk request that gives labels or offers TakeOver may offer neither AllowAlways nor DenyAlways.").join("\n"), logs.flatMap(t => t.lines).join("\n"));
      Assert.areEqual(3, answerer.questions.length);
    });
  }

  @TestMethod
  public asksAgainForANamedHighRiskRequestThatARememberedAllowWouldDecideButKeepsARememberedDeny(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async center => {
      const answers = [PermissionDecision.AllowedAlways, PermissionDecision.TakenOver, PermissionDecision.DeniedAlways];
      const answerer = new PermissionAnswererFixture(() => Promise.resolve(answers.shift() ?? PermissionDecision.Denied));
      center.registerAnswerer(PermissionCenterTests.APP, answerer, new ModuleLogFixture());
      const descriptor = new ToolDescriptor({ ...PermissionCenterTests.DELETE, risk: { default: ToolRisk.High, maximum: ToolRisk.High } }, ["notes_delete"]);
      const ask = (request: IPermissionRequest, scope: string = "conversation-1"): Promise<PermissionOutcome> =>
        center.requestAsync("notes", descriptor, new ModuleLogFixture(), PermissionCenterTests.session(scope), request, new AbortController().signal);
      const named = { ...PermissionCenterTests.REQUEST, risk: ToolRisk.High, options: [PermissionOption.AllowOnce, PermissionOption.Deny, PermissionOption.TakeOver],
        labels: { [PermissionOption.TakeOver]: "I'll type it myself" } };
      const plain = { ...PermissionCenterTests.REQUEST, risk: ToolRisk.High };
      const empty = { ...plain, labels: {} };
      const medium = { ...PermissionCenterTests.REQUEST, options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways] };

      const kept = await ask(medium);
      const namedAfterAllow = await ask(named);
      const plainAfterAllow = await ask(plain);
      const emptyAfterAllow = await ask(empty);
      const denied = await ask(medium, "conversation-2");
      const namedAfterDeny = await ask(named, "conversation-2");

      Assert.areEqual("AllowedAlways|false,TakenOver|false,AllowedAlways|true,AllowedAlways|true,DeniedAlways|false,DeniedAlways|true",
        [kept, namedAfterAllow, plainAfterAllow, emptyAfterAllow, denied, namedAfterDeny].map(t => `${t.decision}|${String(t.isRemembered)}`).join(","));
      Assert.areEqual(3, answerer.questions.length);
    });
  }

  @TestMethod
  public resolvesATakeOverAnswerOnlyWhenOfferedAndKeepsNothing(): Promise<void> {
    return PermissionCenterTests.withCenterAsync(async (center, store) => {
      const log = new ModuleLogFixture();
      center.registerAnswerer(PermissionCenterTests.APP, new PermissionAnswererFixture(() => Promise.resolve(PermissionDecision.TakenOver)), log);
      const offered = { ...PermissionCenterTests.REQUEST, options: [PermissionOption.AllowOnce, PermissionOption.Deny, PermissionOption.TakeOver],
        labels: { [PermissionOption.TakeOver]: "I'll type it myself" } };

      const takenOver = await PermissionCenterTests.requestAsync(center, offered);
      const again = await PermissionCenterTests.requestAsync(center, offered);
      const notOffered = await PermissionCenterTests.requestAsync(center, PermissionCenterTests.REQUEST);

      PermissionCenterTests.assertOutcome(PermissionDecision.TakenOver, false, takenOver);
      PermissionCenterTests.assertOutcome(PermissionDecision.TakenOver, false, again);
      Assert.isFalse(takenOver.isAllowed);
      PermissionCenterTests.assertOutcome(PermissionDecision.Denied, false, notOffered);
      Assert.areEqual("The answerer's decision TakenOver for notes.deleteItem is not one the request offers, so the request is denied.", log.lines.join("\n"));
      Assert.areEqual(0, store.list().length);
    });
  }

  private static async withCenterAsync(
    test: (center: PermissionCenter, store: RememberedPermissionStore) => Promise<void>,
    waitMilliseconds?: number): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const store = new RememberedPermissionStore(settings.database);
    const center = new PermissionCenter(PermissionCenterTests.APP, waitMilliseconds);
    center.open(store);
    await test(center, store);
  }

  private static requestAsync(
    center: PermissionCenter,
    request: unknown,
    scope: string = "conversation-1",
    moduleId: string = "notes",
    log: ModuleLogFixture = new ModuleLogFixture(),
    signal: AbortSignal = new AbortController().signal): Promise<PermissionOutcome> {
    const descriptor = new ToolDescriptor({ ...PermissionCenterTests.DELETE, name: `${moduleId}_delete` }, [`${moduleId}_delete`]);
    return center.requestAsync(moduleId, descriptor, log, PermissionCenterTests.session(scope), request, signal);
  }

  private static session(scope: string): ToolSession {
    return new ToolSession("session-1", scope, {}, new ToolRegistry());
  }

  private static assertOutcome(decision: PermissionDecision, isRemembered: boolean, outcome: PermissionOutcome): void {
    Assert.areEqual(`${decision}|${String(isRemembered)}`, `${outcome.decision}|${String(outcome.isRemembered)}`);
  }
}

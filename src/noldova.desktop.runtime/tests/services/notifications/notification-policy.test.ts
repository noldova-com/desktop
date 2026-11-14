/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRun, NotificationAction, NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
import { ModuleDeclaration, NotContributedException, NotificationPolicy } from "@noldova/desktop.runtime";

@TestClass
export class NotificationPolicyTests {
  private static readonly NOTES: ModuleDeclaration = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map([["tasks", "0.0.1"]]), null, new Map([["notifications", ["notes.saved"]]]));
  private static readonly TASKS: ModuleDeclaration = new ModuleDeclaration("tasks", "0.0.1", "Tasks", "Tracks tasks.", new Map(), null, new Map([["notifications", ["tasks.due"]]]));

  @TestMethod
  public allowsADeclaredKindWithTheModulesOwnAndItsDependenciesCommands(): void {
    const policy = new NotificationPolicy([NotificationPolicyTests.NOTES, NotificationPolicyTests.TASKS], () => true);

    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("notes.saved", "notes.open", ["tasks.show", "notes.undo"])));
    Assert.doesNotThrow(() => policy.requireDeclared(NotificationPolicyTests.NOTES, NotificationPolicyTests.post("notes.saved", null, [])));
  }

  @TestMethod
  public refusesAnUndeclaredKindAndAnotherModulesCommand(): void {
    const policy = new NotificationPolicy([NotificationPolicyTests.NOTES, NotificationPolicyTests.TASKS], () => true);

    const undeclared = Assert.throws(() => policy.requireDeclared(NotificationPolicyTests.NOTES, NotificationPolicyTests.post("notes.deleted", null, [])), NotContributedException);
    const open = policy.findRefusal(NotificationPolicyTests.post("tasks.due", "notes.open", []));
    const action = policy.findRefusal(NotificationPolicyTests.post("notes.saved", null, ["calendar.show"]));
    const windowUndeclared = policy.findRefusal(NotificationPolicyTests.post("notes.deleted", null, []));

    Assert.areEqual("The module notes does not declare notes.deleted among its notifications.", undeclared.message);
    Assert.areEqual("The module tasks may not offer the command notes.open in a notification; it must be its own or a dependency's.", open);
    Assert.areEqual("The module notes may not offer the command calendar.show in a notification; it must be its own or a dependency's.", action);
    Assert.areEqual(undeclared.message, windowUndeclared);
  }

  @TestMethod
  public refusesAWindowsPostForAModuleThatIsInactiveOrAbsent(): void {
    const policy = new NotificationPolicy([NotificationPolicyTests.NOTES], t => t !== "notes");

    const inactive = policy.findRefusal(NotificationPolicyTests.post("notes.saved", null, []));
    const absent = policy.findRefusal(NotificationPolicyTests.post("calendar.due", null, []));

    Assert.areEqual("The notification kind notes.saved belongs to notes, which is not an active module.", inactive);
    Assert.areEqual("The notification kind calendar.due belongs to calendar, which is not an active module.", absent);
  }

  @TestMethod
  public allowsTheShellsOwnKindsWithoutCommandsAndRefusesAnyOther(): void {
    const policy = new NotificationPolicy([], () => false);

    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("desktop.saveFailed", null, [])));
    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("desktop.saveUnfinished", null, [])));
    Assert.areEqual("The shell posts no notification of the kind desktop.saved.", policy.findRefusal(NotificationPolicyTests.post("desktop.saved", null, [])));
    Assert.areEqual("The shell's notification kind desktop.saveFailed offers no command.", policy.findRefusal(NotificationPolicyTests.post("desktop.saveFailed", "desktop.openSettings", [])));
    Assert.areEqual("The shell's notification kind desktop.saveUnfinished offers no command.", policy.findRefusal(NotificationPolicyTests.post("desktop.saveUnfinished", null, ["desktop.openSettings"])));
  }

  @TestMethod
  public letsTheUpdateKindRunOnlyTheShellsCommands(): void {
    const policy = new NotificationPolicy([], () => true);

    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("desktop.updateReady", "desktop.openSettings", ["desktop.restartToUpdate"])));
    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("desktop.updateReady", null, [])));
    Assert.areEqual("The shell's notification kind desktop.updateReady runs only the shell's commands, not notes.open.",
      policy.findRefusal(NotificationPolicyTests.post("desktop.updateReady", "desktop.openSettings", ["notes.open"])));
    Assert.areEqual("The shell's notification kind desktop.updateReady runs only the shell's commands, not notes.open.",
      policy.findRefusal(NotificationPolicyTests.post("desktop.updateReady", "notes.open", [])));
  }

  @TestMethod
  public letsTheSupportKindRunOnlyTheShellsCommands(): void {
    const policy = new NotificationPolicy([], () => true);

    Assert.isNull(policy.findRefusal(NotificationPolicyTests.post("desktop.support", null, ["desktop.openLogFolder", "desktop.copyDetails"])));
    Assert.areEqual("The shell's notification kind desktop.support runs only the shell's commands, not notes.open.",
      policy.findRefusal(NotificationPolicyTests.post("desktop.support", null, ["desktop.copyDetails", "notes.open"])));
  }

  private static post(kind: string, open: string | null, actions: readonly string[]): NotificationPost {
    return new NotificationPost(
      QualifiedName.parse(kind), null, "Title", null, NotificationSeverity.Info,
      Object.isNull(open) ? null : NotificationPolicyTests.run(open), actions.map(t => new NotificationAction("Run", NotificationPolicyTests.run(t))), null);
  }

  private static run(name: string): CommandRun {
    return new CommandRun(QualifiedName.parse(name), null);
  }
}

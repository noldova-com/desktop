/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellEvents } from "@noldova/desktop.protocol";

@TestClass
export class ShellEventsTests {
  @TestMethod
  public namesTheNotificationsEvent(): void {
    Assert.areEqual("desktop.notifications", ShellEvents.notifications.text);
    Assert.isTrue(ShellEvents.notifications.isShell);
  }

  @TestMethod
  public namesTheSettingsEvent(): void {
    Assert.areEqual("desktop.settingsChanged", ShellEvents.settingsChanged.text);
  }

  @TestMethod
  public namesTheWorkEvent(): void {
    Assert.areEqual("desktop.work", ShellEvents.work.text);
  }

  @TestMethod
  public namesTheUpdateEvents(): void {
    Assert.areEqual("desktop.updating|desktop.updateEnded", [ShellEvents.updating.text, ShellEvents.updateEnded.text].join("|"));
  }

  @TestMethod
  public namesTheQuitEvent(): void {
    Assert.areEqual("desktop.quitting", ShellEvents.quitting.text);
  }

  @TestMethod
  public namesTheCommandsEvent(): void {
    Assert.areEqual("desktop.commandsChanged", ShellEvents.commandsChanged.text);
  }

  @TestMethod
  public namesTheModulesEvent(): void {
    Assert.areEqual("desktop.modulesChanged", ShellEvents.modulesChanged.text);
  }

  @TestMethod
  public namesTheProgramsEvent(): void {
    Assert.areEqual("desktop.programsChanged", ShellEvents.programsChanged.text);
  }

  @TestMethod
  public namesTheRecentCommandsEvent(): void {
    Assert.areEqual("desktop.recentCommandsChanged", ShellEvents.recentCommandsChanged.text);
  }

  @TestMethod
  public namesTheWebViewCommandEvent(): void {
    Assert.areEqual("desktop.webViewCommand", ShellEvents.webViewCommand.text);
  }

  @TestMethod
  public namesTheSecretCommandEvent(): void {
    Assert.areEqual("desktop.secretCommand", ShellEvents.secretCommand.text);
  }

  @TestMethod
  public namesTheAgentControlEvent(): void {
    Assert.areEqual("desktop.agentControlChanged", ShellEvents.agentControlChanged.text);
  }
}

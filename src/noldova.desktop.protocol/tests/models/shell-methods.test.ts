/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellMethods } from "@noldova/desktop.protocol";

@TestClass
export class ShellMethodsTests {
  @TestMethod
  public pinsTheCrossBuildMethodNames(): void {
    Assert.areEqual("desktop.stop", ShellMethods.stop.text);
    Assert.areEqual("desktop.moveAside", ShellMethods.moveAside.text);
    Assert.areEqual("desktop.modules", ShellMethods.modules.text);
    Assert.isTrue(ShellMethods.stop.isShell && ShellMethods.moveAside.isShell && ShellMethods.modules.isShell);
  }

  @TestMethod
  public namesTheWorkMethod(): void {
    Assert.areEqual("desktop.work", ShellMethods.work.text);
    Assert.isTrue(ShellMethods.work.isShell);
  }

  @TestMethod
  public namesTheProgramsMethod(): void {
    Assert.areEqual("desktop.programs", ShellMethods.programs.text);
    Assert.isTrue(ShellMethods.programs.isShell);
  }

  @TestMethod
  public namesTheUpdateMethods(): void {
    Assert.areEqual("desktop.update|desktop.updateSaved", [ShellMethods.update.text, ShellMethods.updateSaved.text].join("|"));
  }

  @TestMethod
  public namesTheQuitMethods(): void {
    Assert.areEqual("desktop.quit|desktop.quitAnswered", [ShellMethods.quit.text, ShellMethods.quitAnswered.text].join("|"));
  }

  @TestMethod
  public namesTheCommandMethods(): void {
    Assert.areEqual("desktop.commands", ShellMethods.commands.text);
    Assert.areEqual("desktop.runCommand", ShellMethods.runCommand.text);
  }

  @TestMethod
  public namesTheNotificationMethods(): void {
    Assert.areEqual(
      JSON.stringify(["desktop.notifications", "desktop.postNotification", "desktop.dismissNotification", "desktop.markNotificationsRead", "desktop.clearNotifications"]),
      JSON.stringify([
        ShellMethods.notifications, ShellMethods.postNotification, ShellMethods.dismissNotification,
        ShellMethods.markNotificationsRead, ShellMethods.clearNotifications
      ].map(t => t.text)));
  }

  @TestMethod
  public namesTheWindowStateMethods(): void {
    Assert.areEqual(
      JSON.stringify(["desktop.readWindowBounds", "desktop.writeWindowBounds", "desktop.readWindowLayout", "desktop.writeWindowLayout"]),
      JSON.stringify([ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds, ShellMethods.readWindowLayout, ShellMethods.writeWindowLayout].map(t => t.text)));
  }

  @TestMethod
  public namesTheSettingsMethods(): void {
    Assert.areEqual("desktop.settings,desktop.readSetting,desktop.setSetting,desktop.resetSetting", [ShellMethods.settings, ShellMethods.readSetting, ShellMethods.setSetting, ShellMethods.resetSetting].map(t => t.text).join(","));
  }

  @TestMethod
  public namesTheRecentCommandsMethods(): void {
    Assert.areEqual("desktop.recentCommands,desktop.recordCommand", [ShellMethods.recentCommands, ShellMethods.recordCommand].map(t => t.text).join(","));
  }

  @TestMethod
  public namesTheWindowClosedMethod(): void {
    Assert.areEqual("desktop.windowClosed", ShellMethods.windowClosed.text);
    Assert.isTrue(ShellMethods.windowClosed.isShell);
  }

  @TestMethod
  public namesTheFileGrantMethods(): void {
    const methods = [ShellMethods.grantFile, ShellMethods.discardFileGrants, ShellMethods.endFileGrants, ShellMethods.resolveFileShare];

    Assert.areEqual("desktop.grantFile,desktop.discardFileGrants,desktop.endFileGrants,desktop.resolveFileShare", methods.map(t => t.text).join(","));
    Assert.isTrue(methods.every(t => t.isShell));
  }

  @TestMethod
  public namesTheWebViewMethods(): void {
    Assert.areEqual("desktop.webViewAnswered,desktop.webViewEvents,desktop.readWebViewBlockedPorts,desktop.webViewPortsBlocked",
      [ShellMethods.webViewAnswered, ShellMethods.webViewEvents, ShellMethods.readWebViewBlockedPorts, ShellMethods.webViewPortsBlocked].map(t => t.text).join(","));
  }

  @TestMethod
  public namesTheSecretMethods(): void {
    Assert.areEqual("desktop.saveSecret,desktop.removeSecret,desktop.secretStatus,desktop.secretAnswered",
      [ShellMethods.saveSecret, ShellMethods.removeSecret, ShellMethods.secretStatus, ShellMethods.secretAnswered].map(t => t.text).join(","));
  }

  @TestMethod
  public namesTheAgentControlMethod(): void {
    Assert.areEqual("desktop.agentControl", ShellMethods.agentControl.text);
  }

  @TestMethod
  public namesTheAppWindowsAndShortcutsMethods(): void {
    Assert.areEqual("desktop.appWindowsChanged", ShellMethods.appWindowsChanged.text);
    Assert.areEqual("desktop.appShortcutsChanged", ShellMethods.appShortcutsChanged.text);
    Assert.areEqual("desktop.mainWindowChanged", ShellMethods.mainWindowChanged.text);
    Assert.areEqual("desktop.mainWindow", ShellMethods.mainWindow.text);
  }
}

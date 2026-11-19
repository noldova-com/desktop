/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as api from "@noldova/desktop.protocol";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

@TestClass
export class ProtocolApiTests {
  @TestMethod
  public exportsTheCompleteCatalog(): void {
    const exportNames = [
      "AgentControlState", "AppShortcut", "AppShortcutList", "AppWindow", "AppWindowList", "BuildIdentity", "Cancel", "CommandInfo", "CommandList", "CommandRun", "DatePattern", "DesktopProtocolException", "EditAction", "Event", "Failure", "FailureCode", "FileGrant", "FileGrantsDiscard", "FileGrantsEnded", "FileShareResolve", "FrameReader", "FrameWriter", "Handshake", "KeptRuntime", "KeyChord", "KeyName", "KeyText", "LinkPolicy", "MainWindow", "ModuleState", "ModuleStatus", "ModuleStatusList", "Notification", "NotificationAction", "NotificationBroadcast",
      "NotificationList", "NotificationPost", "NotificationReference", "NotificationState", "NotificationSeverity", "NotificationsQuery", "PreShellData", "ProgramStatus", "ProgramStatusList",
      "ProtocolException", "QualifiedName", "QuitAnswer", "QuitAnswered", "QuitReport", "QuitResult", "RecentCommandUse", "RecentCommands", "RecentCommandsQuery", "Request", "Response", "RunningWork", "RuntimeHandover", "SecretAction", "SecretAnswered", "SecretCommand", "SecretFailureKind", "SecretFailureReason", "SecretFailures", "SecretReference", "SecretValue", "SettingChange", "SettingDefinition", "SettingEntry", "SettingKey", "SettingKind", "SettingLocality", "SettingOption",
      "SettingScope", "SettingType", "SettingValue", "SettingsQuery", "SettingsSnapshot", "ShellClients", "ShellEvents", "ShellKeys", "ShellMethods", "ShellNotifications", "StopPolicy", "StopRequest", "UpdateProcess", "UpdateReady", "UpdateRequest", "UpdateSaved", "WebViewAction", "WebViewAnswered", "WebViewBlockedPorts", "WebViewCommand", "WebViewDeclaration", "WebViewEvent", "WebViewEventKind", "WebViewEvents", "WebViewFailure", "WebViewFailureKind", "WebViewInfo", "WebViewKey", "WebViewMethod", "WebViewNavigation", "WebViewNavigationKind", "WebViewPane", "WebViewParameter", "WindowAction", "WindowClosed", "WindowStateKey", "WindowStateValue", "WindowStateWrite", "WireContract", "WireDecoder", "WireMessage", "WireMessageKind", "WorkReport"
    ];

    Assert.areEqual(exportNames.sort().join(","), Object.keys(api).sort().join(","));
  }
}

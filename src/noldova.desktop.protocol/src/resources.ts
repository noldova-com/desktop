/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly protocolVersion: string = "__PROTOCOL_VERSION__";
  public static readonly defaultMaximumFrameLength: number = 16 * 1024 * 1024;
  public static readonly linkLimit: number = 32768;
  public static readonly linkProtocols: readonly string[] = ["http:", "https:", "mailto:"];
  public static readonly frameDelimiter: string = "\n";
  public static readonly shellOwner: string = "desktop";
  public static readonly nameSeparator: string = ".";
  public static readonly pathSeparator: string = ".";
  public static readonly ownerPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly memberPattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly languageTagPattern: RegExp = /^[a-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/;
  public static readonly protocolVersionPattern: RegExp = /^[1-9][0-9]*$/;
  public static readonly moduleVersionPattern: RegExp = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;
  public static readonly datePatternTokens: RegExp = /'[^']*'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a/g;
  public static readonly dateLocale: string = "en-GB";
  public static readonly quoteMark: string = "'";
  public static readonly fullYearToken: string = "yyyy";
  public static readonly shortYearToken: string = "yy";
  public static readonly longMonthToken: string = "MMMM";
  public static readonly shortMonthToken: string = "MMM";
  public static readonly paddedMonthToken: string = "MM";
  public static readonly monthToken: string = "M";
  public static readonly paddedDayToken: string = "dd";
  public static readonly dayToken: string = "d";
  public static readonly longWeekdayToken: string = "EEEE";
  public static readonly shortWeekdayToken: string = "EEE";
  public static readonly paddedHourToken: string = "HH";
  public static readonly hourToken: string = "H";
  public static readonly paddedTwelveHourToken: string = "hh";
  public static readonly twelveHourToken: string = "h";
  public static readonly paddedMinuteToken: string = "mm";
  public static readonly paddedSecondToken: string = "ss";
  public static readonly halfDayToken: string = "a";
  public static readonly longMonthFormat: Readonly<Intl.DateTimeFormatOptions> = { month: "long" };
  public static readonly shortMonthFormat: Readonly<Intl.DateTimeFormatOptions> = { month: "short" };
  public static readonly longWeekdayFormat: Readonly<Intl.DateTimeFormatOptions> = { weekday: "long" };
  public static readonly shortWeekdayFormat: Readonly<Intl.DateTimeFormatOptions> = { weekday: "short" };
  public static readonly yearsPerCentury: number = 100;
  public static readonly hoursPerHalfDay: number = 12;
  public static readonly datePadLength: number = 2;
  public static readonly datePadCharacter: string = "0";
  public static readonly maximumUpdateProblems: number = 100;
  public static readonly maximumUpdateProblemLength: number = 1_000;
  public static readonly twelveHourTokens: readonly string[] = [Resources.paddedTwelveHourToken, Resources.twelveHourToken, Resources.halfDayToken];
  public static readonly morningMarker: string = "AM";
  public static readonly afternoonMarker: string = "PM";

  public static readonly kindField: string = "kind";
  public static readonly idField: string = "id";
  public static readonly methodField: string = "method";
  public static readonly nameField: string = "name";
  public static readonly payloadField: string = "payload";
  public static readonly failureField: string = "failure";
  public static readonly codeField: string = "code";
  public static readonly messageField: string = "message";
  public static readonly timeoutField: string = "timeoutMilliseconds";
  public static readonly identityField: string = "identity";
  public static readonly tokenField: string = "token";
  public static readonly clientField: string = "client";
  public static readonly productVersionField: string = "productVersion";
  public static readonly protocolVersionField: string = "protocolVersion";
  public static readonly fingerprintField: string = "fingerprint";
  public static readonly detailsField: string = "details";
  public static readonly reasonField: string = "reason";
  public static readonly executablePathField: string = "executablePath";
  public static readonly policyField: string = "policy";
  public static readonly keepsWhileSharedField: string = "keepsWhileShared";
  public static readonly keptForField: string = "keptFor";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly installationField: string = "installation";
  public static readonly problemsField: string = "problems";
  public static readonly processesField: string = "processes";
  public static readonly earliestField: string = "earliest";
  public static readonly latestField: string = "latest";
  public static readonly roleField: string = "role";
  public static readonly locationField: string = "location";
  public static readonly stateField: string = "state";
  public static readonly causeField: string = "cause";
  public static readonly outcomeField: string = "outcome";
  public static readonly answerField: string = "answer";
  public static readonly displayNameField: string = "displayName";
  public static readonly versionField: string = "version";
  public static readonly dependenciesField: string = "dependencies";
  public static readonly contributesField: string = "contributes";
  public static readonly blockedByField: string = "blockedBy";
  public static readonly optionalDependenciesField: string = "optionalDependencies";
  public static readonly switchSettingField: string = "switchSetting";
  public static readonly modulesField: string = "modules";
  public static readonly deviceField: string = "device";
  public static readonly windowField: string = "window";
  public static readonly valueField: string = "value";
  public static readonly titleField: string = "title";
  public static readonly iconField: string = "icon";
  public static readonly defaultKeyField: string = "defaultKey";
  public static readonly commandsField: string = "commands";
  public static readonly isEnabledField: string = "isEnabled";
  public static readonly isCheckedField: string = "isChecked";
  public static readonly argumentsField: string = "arguments";
  public static readonly commandsMember: string = "commands";
  public static readonly runCommandMember: string = "runCommand";
  public static readonly notificationsMember: string = "notifications";
  public static readonly postNotificationMember: string = "postNotification";
  public static readonly dismissNotificationMember: string = "dismissNotification";
  public static readonly markNotificationsReadMember: string = "markNotificationsRead";
  public static readonly clearNotificationsMember: string = "clearNotifications";
  public static readonly keyField: string = "key";
  public static readonly textField: string = "text";
  public static readonly severityField: string = "severity";
  public static readonly openField: string = "open";
  public static readonly actionsField: string = "actions";
  public static readonly progressField: string = "progress";
  public static readonly commandField: string = "command";
  public static readonly postField: string = "post";
  public static readonly postedAtField: string = "postedAt";
  public static readonly isReadField: string = "isRead";
  public static readonly notificationsField: string = "notifications";
  public static readonly isDoNotDisturbField: string = "isDoNotDisturb";
  public static readonly quietDevicesField: string = "quietDevices";
  public static readonly mutedModulesField: string = "mutedModules";
  public static readonly idsField: string = "ids";
  public static readonly sequenceField: string = "sequence";
  public static readonly moduleField: string = "module";
  public static readonly programField: string = "program";
  public static readonly processIdField: string = "processId";
  public static readonly startedAtField: string = "startedAt";
  public static readonly hasExitedField: string = "hasExited";
  public static readonly programsField: string = "programs";
  public static readonly handleField: string = "handle";
  public static readonly windowsField: string = "windows";
  public static readonly shortcutsField: string = "shortcuts";
  public static readonly isGlobalField: string = "isGlobal";
  public static readonly isVisibleField: string = "isVisible";
  public static readonly isPaintedField: string = "isPainted";
  public static readonly keyParameterName: string = "key";
  public static readonly commandTitleInvalid: string = "A command's title must not be blank.";
  public static readonly commandIconInvalid: string = "A command's icon, when it has one, must not be blank.";
  public static readonly notificationKeyInvalid: string = "A notification's key, when it has one, must not be blank.";
  public static readonly notificationTitleInvalid: string = "A notification's title must not be blank.";
  public static readonly notificationTextInvalid: string = "A notification's text, when it has one, must not be blank.";
  public static readonly notificationProgressInvalid: string = "A notification's progress must be indeterminate or a number from 0 to 1.";
  public static readonly notificationActionTitleInvalid: string = "A notification action's title must not be blank.";
  public static readonly notificationIdInvalid: string = "A notification's id must not be blank.";
  public static readonly notificationTimeInvalid: string = "A notification's time must be a date and time.";
  public static readonly quietDeviceInvalid: string = "A device with Do not disturb on must have an id.";
  public static readonly mutedModuleInvalid: string = "A muted module must have an id.";
  public static readonly recentCommandInvalid: string = "A recent command must have an id.";
  public static readonly recentCommandRepeated: string = "A recent command is listed once.";
  public static readonly notificationSequenceInvalid: string = "A notification's sequence must be a whole number from 1.";
  public static readonly currentSequenceInvalid: string = "The notifications' sequence must be a whole number from 0.";
  public static readonly workSequenceInvalid: string = "The work's sequence must be a whole number from 0.";
  public static readonly keptForInvalid: string = "The number of other clients a runtime is kept for must be a whole number from 1.";
  public static readonly commandSequenceInvalid: string = "The commands' sequence must be a whole number from 0.";
  public static readonly processIdInvalid: string = "A running program's process id must be a whole number from 1.";
  public static readonly programStartInvalid: string = "A running program's start must be a date and time.";
  public static readonly programSequenceInvalid: string = "The programs' sequence must be a whole number from 0.";
  public static readonly appWindowHandleInvalid: string = "An app window's handle must be null or a whole number from 1.";
  public static readonly appWindowProcessIdInvalid: string = "An app window's process id must be a whole number from 1.";
  public static readonly macPlatform: string = "darwin";
  public static readonly standardPlatform: string = "win32";
  public static readonly keySeparator: string = "+";
  public static readonly modToken: string = "Mod";
  public static readonly ctrlToken: string = "Ctrl";
  public static readonly altToken: string = "Alt";
  public static readonly shiftToken: string = "Shift";
  public static readonly modifierTokens: readonly string[] = [Resources.modToken, Resources.ctrlToken, Resources.altToken, Resources.shiftToken];
  public static readonly macControlSymbol: string = "\u2303";
  public static readonly macOptionSymbol: string = "\u2325";
  public static readonly macShiftSymbol: string = "\u21E7";
  public static readonly macCommandSymbol: string = "\u2318";
  public static readonly controlLabel: string = "Ctrl";
  public static readonly altLabel: string = "Alt";
  public static readonly shiftLabel: string = "Shift";
  public static readonly ariaControlKey: string = "Control";
  public static readonly ariaAltKey: string = "Alt";
  public static readonly ariaShiftKey: string = "Shift";
  public static readonly ariaMetaKey: string = "Meta";
  public static readonly asciiLetterPattern: RegExp = /^[A-Za-z]$/;
  public static readonly letterKeys: readonly string[] = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
  public static readonly digitKeys: readonly string[] = [..."0123456789"];
  public static readonly letterCodePrefix: string = "Key";
  public static readonly digitCodePrefix: string = "Digit";
  public static readonly functionKeyPrefix: string = "F";
  public static readonly functionKeyCount: number = 24;
  public static readonly spaceKey: string = "Space";
  public static readonly punctuationKeys: readonly (readonly [string, string])[] = [
    ["Backquote", "`"],
    ["Minus", "-"],
    ["Equal", "="],
    ["BracketLeft", "["],
    ["BracketRight", "]"],
    ["Backslash", "\\"],
    ["Semicolon", ";"],
    ["Quote", "'"],
    ["Comma", ","],
    ["Period", "."],
    ["Slash", "/"]
  ];
  public static readonly namedKeys: readonly (readonly [string, string, string])[] = [
    ["Enter", "\u21A9", "Enter"],
    ["Escape", "\u238B", "Esc"],
    ["Tab", "\u21E5", "Tab"],
    ["Space", "Space", "Space"],
    ["Backspace", "\u232B", "Backspace"],
    ["Delete", "\u2326", "Delete"],
    ["Insert", "Insert", "Insert"],
    ["Home", "\u2196", "Home"],
    ["End", "\u2198", "End"],
    ["PageUp", "\u21DE", "PageUp"],
    ["PageDown", "\u21DF", "PageDown"],
    ["ArrowUp", "\u2191", "Up"],
    ["ArrowDown", "\u2193", "Down"],
    ["ArrowLeft", "\u2190", "Left"],
    ["ArrowRight", "\u2192", "Right"]
  ];
  public static readonly editingKeys: readonly string[] = ["Mod+A", "Mod+C", "Mod+V", "Mod+X", "Mod+Z", "Mod+Y", "Mod+Shift+Z"];
  public static readonly macSystemKeys: readonly string[] = ["Mod+Q", "Mod+W", "Mod+H", "Mod+M", "Mod+Comma", "Mod+Tab", "Mod+Space", "Mod+Alt+Escape"];
  public static readonly standardSystemKeys: readonly string[] = ["Alt+F4", "Alt+Tab", "Mod+Escape"];
  public static readonly reservedKeys: readonly (readonly [string, string, readonly string[]])[] = [
    [Resources.macPlatform, "editing", Resources.editingKeys],
    [Resources.standardPlatform, "editing", Resources.editingKeys],
    [Resources.macPlatform, "macOS", Resources.macSystemKeys],
    [Resources.standardPlatform, "Windows and Linux", Resources.standardSystemKeys]
  ];
  public static readonly shellCommandKeys: readonly string[] = ["Mod+W", "Mod+Comma"];
  public static readonly shellKeys: readonly (readonly [string, readonly string[], readonly string[]])[] = [
    ["desktop.search", ["Mod+K"], ["Mod+K"]],
    ["desktop.showCommands", ["Mod+Shift+P"], ["Mod+Shift+P"]],
    ["desktop.goBack", ["Alt+ArrowLeft"], ["Mod+BracketLeft"]],
    ["desktop.goForward", ["Alt+ArrowRight"], ["Mod+BracketRight"]],
    ["desktop.openSettings", ["Mod+Comma"], ["Mod+Comma"]],
    ["desktop.closeTab", ["Mod+W"], ["Mod+W"]],
    ["desktop.nextTab", ["Ctrl+Tab", "Ctrl+PageDown"], ["Ctrl+Tab", "Mod+Alt+ArrowRight"]],
    ["desktop.previousTab", ["Ctrl+Shift+Tab", "Ctrl+PageUp"], ["Ctrl+Shift+Tab", "Mod+Alt+ArrowLeft"]],
    ["desktop.toggleLeftDock", ["Mod+B"], ["Mod+B"]],
    ["desktop.toggleBottomDock", ["Mod+J"], ["Mod+J"]],
    ["desktop.toggleRightDock", ["Mod+Alt+B"], ["Mod+Alt+B"]]
  ];
  public static readonly pageFirstShellKeys: readonly (readonly [string, readonly string[], readonly string[]])[] = [
    ["desktop.showShortcuts", ["Mod+Slash"], ["Mod+Slash"]]
  ];
  public static readonly stopAgentControlKey: string = "Mod+Shift+Period";
  public static readonly stopMember: string = "stop";
  public static readonly moveAsideMember: string = "moveAside";
  public static readonly modulesMember: string = "modules";
  public static readonly workMember: string = "work";
  public static readonly programsMember: string = "programs";
  public static readonly updateMember: string = "update";
  public static readonly updateSavedMember: string = "updateSaved";
  public static readonly updatingMember: string = "updating";
  public static readonly updateEndedMember: string = "updateEnded";
  public static readonly quitMember: string = "quit";
  public static readonly quittingMember: string = "quitting";
  public static readonly quitAnsweredMember: string = "quitAnswered";
  public static readonly mainClient: string = "main";
  public static readonly commandLineClient: string = "cli";
  public static readonly readWindowBoundsMember: string = "readWindowBounds";
  public static readonly writeWindowBoundsMember: string = "writeWindowBounds";
  public static readonly readWindowLayoutMember: string = "readWindowLayout";
  public static readonly writeWindowLayoutMember: string = "writeWindowLayout";
  public static readonly settingsMember: string = "settings";
  public static readonly readSettingMember: string = "readSetting";
  public static readonly setSettingMember: string = "setSetting";
  public static readonly resetSettingMember: string = "resetSetting";
  public static readonly recentCommandsMember: string = "recentCommands";
  public static readonly recordCommandMember: string = "recordCommand";
  public static readonly windowClosedMember: string = "windowClosed";
  public static readonly grantFileMember: string = "grantFile";
  public static readonly discardFileGrantsMember: string = "discardFileGrants";
  public static readonly endFileGrantsMember: string = "endFileGrants";
  public static readonly resolveFileShareMember: string = "resolveFileShare";
  public static readonly settingsChangedMember: string = "settingsChanged";
  public static readonly commandsChangedMember: string = "commandsChanged";
  public static readonly modulesChangedMember: string = "modulesChanged";
  public static readonly programsChangedMember: string = "programsChanged";
  public static readonly recentCommandsChangedMember: string = "recentCommandsChanged";
  public static readonly saveFailedMember: string = "saveFailed";
  public static readonly saveUnfinishedMember: string = "saveUnfinished";
  public static readonly updateReadyMember: string = "updateReady";
  public static readonly supportMember: string = "support";
  public static readonly optionsField: string = "options";
  public static readonly dynamicField: string = "dynamic";
  public static readonly minimumField: string = "minimum";
  public static readonly maximumField: string = "maximum";
  public static readonly stepField: string = "step";
  public static readonly maxLengthField: string = "maxLength";
  public static readonly checkedField: string = "checked";
  public static readonly labelField: string = "label";
  public static readonly descriptionField: string = "description";
  public static readonly typeField: string = "type";
  public static readonly defaultField: string = "default";
  public static readonly localityField: string = "locality";
  public static readonly scopesField: string = "scopes";
  public static readonly pageField: string = "page";
  public static readonly grantField: string = "grant";
  public static readonly grantsField: string = "grants";
  public static readonly pathField: string = "path";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly sizeField: string = "size";
  public static readonly lifetimeField: string = "lifetime";
  public static readonly stagedField: string = "staged";
  public static readonly grantPattern: RegExp = /^[0-9a-f]{32}$/;
  public static readonly maximumGrantLifetime: number = 600_000;
  public static readonly maximumDiscardedGrants: number = 256;
  public static readonly groupField: string = "group";
  public static readonly scopeField: string = "scope";
  public static readonly isSetField: string = "isSet";
  public static readonly definitionsField: string = "definitions";
  public static readonly entriesField: string = "entries";
  public static readonly methodsField: string = "methods";
  public static readonly eventsField: string = "events";
  public static readonly newWindowsField: string = "newWindows";
  public static readonly parametersField: string = "parameters";
  public static readonly requiredField: string = "required";
  public static readonly valuesField: string = "values";
  public static readonly fieldsField: string = "fields";
  public static readonly viewField: string = "view";
  public static readonly callField: string = "call";
  public static readonly actionField: string = "action";
  public static readonly paneField: string = "pane";
  public static readonly instanceField: string = "instance";
  public static readonly profileKeyField: string = "profileKey";
  public static readonly addressField: string = "address";
  public static readonly isLoadingField: string = "isLoading";
  public static readonly canGoBackField: string = "canGoBack";
  public static readonly canGoForwardField: string = "canGoForward";
  public static readonly originField: string = "origin";
  public static readonly isRedirectField: string = "isRedirect";
  public static readonly hadRecentInputField: string = "hadRecentInput";
  public static readonly requestField: string = "request";
  public static readonly paramsField: string = "params";
  public static readonly isCutField: string = "isCut";
  public static readonly countField: string = "count";
  public static readonly factorField: string = "factor";
  public static readonly matchesField: string = "matches";
  public static readonly activeField: string = "active";
  public static readonly webViewZoomMinimum: number = 0.25;
  public static readonly webViewZoomMaximum: number = 5;
  public static readonly webViewCommandMember: string = "webViewCommand";
  public static readonly webViewAnsweredMember: string = "webViewAnswered";
  public static readonly webViewEventsMember: string = "webViewEvents";
  public static readonly agentControlMember: string = "agentControl";
  public static readonly agentControlChangedMember: string = "agentControlChanged";
  public static readonly saveSecretMember: string = "saveSecret";
  public static readonly removeSecretMember: string = "removeSecret";
  public static readonly secretStatusMember: string = "secretStatus";
  public static readonly secretCommandMember: string = "secretCommand";
  public static readonly secretAnsweredMember: string = "secretAnswered";
  public static readonly secretValueLimit: number = 16384;
  public static readonly secretCipherLimit: number = 131072;
  public static readonly appWindowsChangedMember: string = "appWindowsChanged";
  public static readonly appShortcutsChangedMember: string = "appShortcutsChanged";
  public static readonly mainWindowChangedMember: string = "mainWindowChanged";
  public static readonly mainWindowMember: string = "mainWindow";
  public static readonly isStoppedField: string = "isStopped";
  public static readonly isActingField: string = "isActing";
  public static readonly profileKeyPattern: RegExp = /^[a-z0-9][a-z0-9-]{0,63}$/;
  public static readonly webViewAddressLimit: number = 32768;
  public static readonly webViewTimeoutLimit: number = 10000;
  public static readonly notificationActionLimit: number = 2;
  public static readonly indeterminateProgress: "indeterminate" = "indeterminate";
  public static readonly webViewRefusedRequests: readonly string[] = ["download", "newWindow", "permission", "fileChooser", "authentication", "certificate", "nestedView"];
  public static readonly webViewMethodPattern: RegExp = /^[A-Z][A-Za-z]*\.[a-z][A-Za-z]*$/;
  public static readonly webViewRefusedMethods: readonly string[] = [
    "Page.navigate", "Page.navigateToHistoryEntry", "Page.reload", "Page.setDocumentContent", "Page.resetNavigationHistory",
    "Page.setInterceptFileChooserDialog", "Page.disable", "Page.setDownloadBehavior", "Page.close", "Page.crash",
    "Network.setRequestInterception", "Network.continueInterceptedRequest"
  ];
  public static readonly webViewRefusedDomains: readonly string[] = ["Target", "Browser", "Fetch", "Security"];
  public static readonly webViewKeysLimit: number = 32;
  public static readonly webViewKeyChordsLimit: number = 4;
  public static readonly keysField: string = "keys";
  public static readonly macKeysField: string = "macKeys";
  public static readonly standardPlatformLabel: string = "Windows and Linux";
  public static readonly macPlatformLabel: string = "macOS";
  public static readonly stepTolerance: number = 1e-9;
  public static readonly textParameterName: string = "text";
  public static readonly maximumFrameLengthParameterName: string = "maximumFrameLength";

  public static readonly nameInvalid: string = "A name must be an owner, a dot and a member, such as \"desktop.handshake\": the owner is \"desktop\" or a module id in lowercase kebab-case, and the member starts with a lowercase letter followed by letters and digits.";
  public static readonly protocolVersionInvalid: string = "The protocol version must be a positive integer.";
  public static readonly processStartInvalid: string = "A process's earliest start must be a finite number no later than its latest start.";
  public static readonly stampedProtocolVersionInvalid: string = "The package's protocol version was not stamped by the build.";
  public static readonly timeoutInvalid: string = "The time limit must be a positive integer of milliseconds.";
  public static readonly windowInvalid: string = "A window must be a positive integer, the id its main process gives it.";
  public static readonly pageInvalid: string = "A page must be a positive integer, the number its main process gives the page its window loaded.";
  public static readonly grantInvalid: string = "A file grant must be 32 lowercase hexadecimal digits.";
  public static readonly grantPathInvalid: string = "A file grant's path, name, media type and identity must not be blank.";
  public static readonly grantSizeInvalid: string = "A file grant's size must be a whole number of bytes, zero or more.";
  public static readonly grantModuleInvalid: string = "A file grant belongs to a module, named by its id in lowercase kebab-case and not \"desktop\".";
  public static readonly grantLifetimeInvalid: string = "A file grant's lifetime must be a whole number of milliseconds from 1 to 600000, ten minutes.";
  public static readonly grantsInvalid: string = "File grants to discard must be at least one and at most 256, each named once.";
  public static readonly maximumFrameLengthInvalid: string = "The maximum frame length must be a positive integer.";
  public static readonly responseOutcomeMissing: string = "A response must carry a payload or a failure.";
  public static readonly moduleVersionInvalid: string = "A module's version must have the form <major>.<minor>.<patch>: three whole numbers of up to nine digits without leading zeros, such as 0.0.1.";
  public static readonly moduleCauseInvalid: string = "An active or off module has no cause, and a failed or blocked module has one that is not blank.";
  public static readonly moduleBlockerInvalid: string = "A blocked module names the dependency that blocks it, and no other module names one.";
  public static readonly moduleSwitchInvalid: string = "An off module names the setting that turns it on, and a module's switch setting is not blank.";
  public static readonly responseOutcomeAmbiguous: string = "A response cannot carry both a payload and a failure.";
  public static readonly unknownField: string = "The field is not part of this message, which accepts no unknown fields.";
  public static readonly settingTextInvalid: string = "A setting's title, description, page and group must not be blank.";
  public static readonly settingOptionsInvalid: string = "A choice needs at least one option, each with a distinct value, empty or not blank, and a title that is not blank.";
  public static readonly settingChoiceSourceInvalid: string = "A choice either lists its options or is dynamic, with dynamic set to true, and never both.";
  public static readonly settingRangeInvalid: string = "A number needs a finite minimum no greater than its finite maximum and a positive step.";
  public static readonly settingMaxLengthInvalid: string = "A text's maximum length must be a positive integer.";
  public static readonly settingCheckedInvalid: string = "A text that its module checks has checked set to true; leave it out otherwise.";
  public static readonly settingLabelInvalid: string = "An action's label must not be blank.";
  public static readonly settingDefaultInvalid: string = "A setting's default must be a value its type accepts.";
  public static readonly settingScopesInvalid: string = "A setting's scopes must be distinct, and a device setting takes none.";
  public static readonly settingScopeIdInvalid: string = "A scope's object id must not be blank.";
  public static readonly settingDeviceInvalid: string = "A device, when given, must not be blank.";
  public static readonly settingEntriesInvalid: string = "Settings must be distinct, and each entry must name a defined setting.";
  public static readonly webViewMethodNameInvalid: string = "A web view's method or event must be a debugging protocol domain, a dot and a name, such as \"Page.captureScreenshot\".";
  public static readonly webViewNamesRepeated: string = "A web view declaration names each method and each event once.";
  public static readonly webViewKeyNameInvalid: string = "A declared key's name must start with a lowercase letter followed by letters and digits.";
  public static readonly webViewKeysRepeated: string = `A web view declaration names each key once, and gives each key once on each platform, with at most ${Resources.webViewKeysLimit} names.`;
  public static readonly webViewKeyChordsInvalid: string = `A declared key has one to ${Resources.webViewKeyChordsLimit} keys on each platform.`;
  public static readonly webViewParameterNameInvalid: string = "A parameter's name must start with a lowercase letter followed by letters and digits.";
  public static readonly webViewRuleInvalid: string = "A parameter's rule gives at most one of values, a minimum and maximum, a maxLength and fields.";
  public static readonly webViewValuesInvalid: string = "A parameter's values must be distinct texts, finite numbers or booleans, at least one.";
  public static readonly webViewInstanceInvalid: string = "A pane's instance, when given, must not be blank.";
  public static readonly webViewIdInvalid: string = "A web view's id must not be blank, and only the calls on one view name it.";
  public static readonly webViewModuleInvalid: string = "A web view belongs to a module, named by its id, whose own view or document is its pane.";
  public static readonly profileKeyInvalid: string = "A profile key is a lowercase letter or digit followed by up to 63 lowercase letters, digits and hyphens.";
  public static readonly webViewFailureInvalid: string = "A web view's failure carries an engine code, a whole number, only when it is a protocol failure, and a protocol failure carries its message.";
  public static readonly webViewNavigationInvalid: string = "A web view's answer carries the refused origin exactly when it is a refusal.";
  public static readonly webViewCallInvalid: string = "A web view command's call number must be a positive integer.";
  public static readonly webViewEventsEmpty: string = "A batch of web view events holds at least one event.";
  public static readonly webViewRangeInvalid: string ="A parameter's minimum and maximum must be finite numbers, the minimum no greater than the maximum.";
  public static readonly secretNameInvalid: string = "A secret's name is a module's own name, \"<module>.<name>\", never Noldova Desktop's.";
  public static readonly secretValueInvalid: string = "A secret's value must not be empty, is at most 16,384 characters and has no lone surrogate.";
  public static readonly secretCommandValueInvalid: string = "A secret command carries no value to name the device, a value of at most 16,384 characters to encrypt, and a ciphertext of at most 131,072 characters to decrypt.";
  public static readonly secretCallInvalid: string = "A secret command's call number must be a positive integer.";

  public static formatNotificationActionsTooMany(maximum: number): string {
    return `A notification has at most ${maximum} actions.`;
  }

  public static formatKeyInvalid(text: string): string {
    return `"${text}" is not a key. A key is any of Mod, Ctrl, Alt and Shift joined by "+" to one key, such as K, 1, Comma, Enter or F2; Mod is Ctrl on Windows and Linux and Cmd on macOS.`;
  }

  public static formatKeyAmbiguous(text: string): string {
    return `"${text}" names both Mod and Ctrl, which are the same key on Windows and Linux.`;
  }

  public static formatKeyNeedsModifier(text: string): string {
    return `The default key ${text} needs Mod, Ctrl or Alt, or a function key, so that typing is never taken.`;
  }

  public static formatKeyReserved(text: string, owner: string): string {
    return `The key ${text} is reserved for ${owner} and cannot be a command's default.`;
  }

  public static formatWebViewKeyRefused(text: string, platform: string): string {
    return `The key ${text} cannot be declared for a web view on ${platform}: it needs Mod, Ctrl or Alt, or a function key, and it must not be a key that editing, the operating system or Noldova Desktop holds.`;
  }

  public static formatFrameTooLarge(maximumFrameLength: number): string {
    return `A frame exceeds the maximum length of ${maximumFrameLength} characters.`;
  }

  public static formatWebViewMethodRefused(name: string): string {
    return `${name} is refused in a web view: it loads or replaces a document, which only the navigation that the origin check sees may do, or it undoes what the host holds for the view.`;
  }

  public static formatWebViewEventInvalid(kind: string): string {
    return `A web view's ${kind} event must carry exactly the details of its kind, each of its type.`;
  }

  public static formatWebViewValueInvalid(action: string): string {
    return `A web view command's value doesn't fit its action ${action}: an address for navigate, origins for setAllowedOrigins, a profile key for clearProfile, a method with its params and timeoutMilliseconds for send, and none otherwise.`;
  }

  public static formatFieldPath(path: string, field: string): string {
    return `${path}${Resources.pathSeparator}${field}`;
  }

  public static formatUnansweredCall(member: string): string {
    return `The fake has no answer for ${member}; a test gives one with answer("${member}", …) before the code under test calls it.`;
  }
}

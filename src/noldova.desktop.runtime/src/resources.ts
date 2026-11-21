/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BinaryToTextEncoding } from "node:crypto";

import "@noldova/context.core";

import { PermissionDecision } from "./enums/permission-decision.js";
import { PermissionDetailKind } from "./enums/permission-detail-kind.js";
import { PermissionOption } from "./enums/permission-option.js";
import { ToolRisk } from "./enums/tool-risk.js";
import { WindowStateKind } from "./enums/window-state-kind.js";
import type { IWindowsPeerAddon } from "./interfaces/i-windows-peer-addon.js";
import type { IWindowsProcessAddon } from "./interfaces/i-windows-process-addon.js";

export class Resources {
  public static readonly folderSeparator: string = "/";
  public static readonly rootParameterName: string = "root";
  public static readonly idParameterName: string = "id";
  public static readonly versionParameterName: string = "version";
  public static readonly statementsParameterName: string = "statements";
  public static readonly endpointParameterName: string = "endpoint";
  public static readonly tokenParameterName: string = "token";
  public static readonly processIdParameterName: string = "processId";
  public static readonly executablePathParameterName: string = "executablePath";
  public static readonly productVersionParameterName: string = "productVersion";
  public static readonly protocolVersionParameterName: string = "protocolVersion";
  public static readonly buildParameterName: string = "build";
  public static readonly displayNameParameterName: string = "displayName";
  public static readonly dependenciesParameterName: string = "dependencies";
  public static readonly runtimePackageParameterName: string = "runtimePackage";
  public static readonly contributesParameterName: string = "contributes";
  public static readonly cliPackageField: string = "cliPackage";
  public static readonly cliCommandsField: string = "cliCommands";
  public static readonly webViewsField: string = "webViews";
  public static readonly pseudoTerminalsField: string = "pseudoTerminals";
  public static readonly optionalDependenciesField: string = "optionalDependencies";
  public static readonly switchSettingField: string = "switchSetting";
  public static readonly platformsField: string = "platforms";
  public static readonly noldovaDesktopField: string = "noldovaDesktop";
  public static readonly formerNamesField: string = "formerNames";
  public static readonly formatVersionField: string = "formatVersion";
  public static readonly modulesField: string = "modules";
  public static readonly modulePlatforms: ReadonlyMap<string, string> = new Map([["win32", "windows"], ["darwin", "macos"], ["linux", "linux"]]);
  public static readonly platformDisplayNames: ReadonlyMap<string, string> = new Map([["windows", "Windows"], ["macos", "macOS"], ["linux", "Linux"]]);
  public static readonly otherPlatformName: string = "this platform";
  public static readonly optionalDependencyAbsent: string = "the app doesn't include it.";
  public static readonly webViewPaneField: string = "pane";
  public static readonly webViewProfileKeyField: string = "profileKey";
  public static readonly webViewMethodField: string = "method";
  public static readonly webViewParamsField: string = "params";
  public static readonly webViewTimeoutField: string = "timeoutMilliseconds";
  public static readonly webViewIsCutField: string = "isCut";
  public static readonly focusEmulationMethod: string = "Emulation.setFocusEmulationEnabled";
  public static readonly focusEmulationRefused: string = "The host owns focus emulation, so a module may not send Emulation.setFocusEmulationEnabled.";
  public static readonly webViewActionParameter: string = "action";
  public static readonly webViewMoveInvalid: string = "A web view moves back, forward, reloads or stops; the other calls have their own methods.";
  public static readonly rootNotAbsolute: string = "The data directory must be an absolute path.";
  public static readonly migrationIdInvalid: string = "A migration id is lowercase letters and digits separated by single hyphens.";
  public static readonly moduleIdInvalid: string = "A module id is lowercase kebab-case and is not \"desktop\".";
  public static readonly dependencyVersionInvalid: string = "A dependency's version must have the form <major>.<minor>.<patch>: three whole numbers of up to nine digits without leading zeros, such as 0.0.1.";
  public static readonly moduleVersionInvalid: string = "A module's version must have the form <major>.<minor>.<patch>: three whole numbers of up to nine digits without leading zeros, such as 0.0.1.";
  public static readonly ownershipDatabaseFileName: string = "ownership.sqlite";
  public static readonly shellDatabaseFileName: string = "desktop.sqlite";
  public static readonly discoveryFolderName: string = "discovery";
  public static readonly runtimeLogFileName: string = "runtime.log";
  public static readonly previousRuntimeLogFileName: string = "runtime.previous.log";
  public static readonly runtimeErrorsLogFileName: string = "runtime.errors.log";
  public static readonly previousRuntimeErrorsLogFileName: string = "runtime.previous.errors.log";
  public static readonly mainProcessLogFileName: string = "main.log";
  public static readonly previousMainProcessLogFileName: string = "main.previous.log";
  public static readonly startLogPrefix: string = "start-";
  public static readonly startLogExtension: string = ".log";
  public static readonly copyRecordPrefix: string = "copy-";
  public static readonly discoveryFileName: string = "runtime.json";
  public static readonly backupsFolderName: string = "backups";
  public static readonly profileFolderName: string = "main";
  public static readonly modulesFolderName: string = "modules";
  public static readonly workFolderName: string = "work";
  public static readonly logsFolderName: string = "logs";
  public static readonly stagedFolderName: string = "staged";
  public static readonly runtimeEntries: readonly string[] = [
    Resources.ownershipDatabaseFileName,
    `${Resources.ownershipDatabaseFileName}-journal`,
    Resources.discoveryFolderName,
    Resources.backupsFolderName,
    Resources.profileFolderName,
    Resources.modulesFolderName,
    Resources.workFolderName,
    Resources.logsFolderName,
    Resources.stagedFolderName
  ];
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly migrationIdPattern: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  public static readonly reservedModuleId: string = "desktop";
  public static readonly windowsDeviceNames: readonly string[] = [
    "con", "prn", "aux", "nul",
    "com0", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
    "lpt0", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"
  ];
  public static readonly shellSettingsPages: readonly string[] = ["Keyboard shortcuts", "About"];
  public static readonly moduleVersionPattern: RegExp = /^(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})$/;
  public static readonly noldovaDesktopRangePattern: RegExp = /^>=((?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})) <((?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8})\.(?:0|[1-9][0-9]{0,8}))$/;
  public static readonly movedFolderInfix: string = "-before-shell-";
  public static readonly timestampSeparatorPattern: RegExp = /[-:]|\.\d+/g;
  public static readonly acquireOwnershipStatement: string = "BEGIN EXCLUSIVE";
  public static readonly rollbackStatement: string = "ROLLBACK";
  public static readonly beginStatement: string = "BEGIN";
  public static readonly readSchemaStatement: string = "SELECT count(*) FROM sqlite_schema";
  public static readonly beginMigrationStatement: string = "BEGIN IMMEDIATE";
  public static readonly commitStatement: string = "COMMIT";
  public static readonly writeAheadLogStatement: string = "PRAGMA journal_mode = WAL";
  public static readonly creatingSynchronousStatement: string = "PRAGMA synchronous = OFF";
  public static readonly migratingSynchronousStatement: string = "PRAGMA synchronous = NORMAL";
  public static readonly openSynchronousStatement: string = "PRAGMA synchronous = FULL";
  public static readonly writeAheadLogSuffix: string = "-wal";
  public static readonly flushFileMode: string = "r+";
  public static readonly newDatabaseLimitBytes: number = 65_536;
  public static readonly unreadableFolderInfix: string = "-unreadable-";
  public static readonly rollbackJournalStatement: string = "PRAGMA journal_mode = DELETE";
  public static readonly databaseFileSuffixes: readonly string[] = [String.empty, "-wal", "-shm", "-journal"];
  public static readonly historyTableName: string = "migration_history";
  public static readonly createHistoryStatement: string = "CREATE TABLE migration_history (position INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE) STRICT";
  public static readonly readHistoryStatement: string = "SELECT position, id FROM migration_history ORDER BY position";
  public static readonly insertHistoryStatement: string = "INSERT INTO migration_history (position, id) VALUES (?, ?)";
  public static readonly readTablesStatement: string = "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
  public static readonly integrityCheckStatement: string = "PRAGMA integrity_check";
  public static readonly integrityCheckColumn: string = "integrity_check";
  public static readonly integrityOk: string = "ok";
  public static readonly nameColumn: string = "name";
  public static readonly positionColumn: string = "position";
  public static readonly idColumn: string = "id";
  public static readonly valueColumn: string = "value";
  public static readonly windowStatesMigration: string = "window-states";
  public static readonly quietDevicesMigration: string = "quiet-devices";
  public static readonly createQuietDevicesStatement: string = "CREATE TABLE quiet_devices (device TEXT PRIMARY KEY) STRICT";
  public static readonly quietDevicesMovedMigration: string = "quiet-devices-moved";
  public static readonly forgetDoNotDisturbStatement: string =
    "DELETE FROM setting_values WHERE name = 'desktop.doNotDisturb' AND scope_name = '' AND scope_id = '' AND device <> ''";
  public static readonly dropQuietDevicesStatement: string = "DROP TABLE quiet_devices";
  public static readonly settingsMigration: string = "settings";
  public static readonly createSettingValuesStatement: string =
    "CREATE TABLE setting_values (name TEXT NOT NULL, scope_name TEXT NOT NULL, scope_id TEXT NOT NULL, device TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (name, scope_name, scope_id, device)) STRICT";
  public static readonly copyQuietDevicesStatement: string =
    "INSERT INTO setting_values (name, scope_name, scope_id, device, value) SELECT 'desktop.doNotDisturb', '', '', device, 'true' FROM quiet_devices";
  public static readonly createSettingScopesStatement: string =
    "CREATE TABLE setting_scopes (scope_name TEXT NOT NULL, scope_id TEXT NOT NULL, parent_name TEXT NOT NULL, parent_id TEXT NOT NULL, PRIMARY KEY (scope_name, scope_id)) STRICT";
  public static readonly readSettingStatement: string = "SELECT value FROM setting_values WHERE name = ? AND scope_name = ? AND scope_id = ? AND device = ?";
  public static readonly readSettingDevicesStatement: string = "SELECT device, value FROM setting_values WHERE name = ? AND scope_name = '' AND scope_id = '' AND device <> ''";
  public static readonly writeSettingStatement: string =
    "INSERT INTO setting_values (name, scope_name, scope_id, device, value) VALUES (?, ?, ?, ?, ?) ON CONFLICT (name, scope_name, scope_id, device) DO UPDATE SET value = excluded.value";
  public static readonly resetSettingStatement: string = "DELETE FROM setting_values WHERE name = ? AND scope_name = ? AND scope_id = ? AND device = ?";
  public static readonly readScopeParentStatement: string = "SELECT parent_name, parent_id FROM setting_scopes WHERE scope_name = ? AND scope_id = ?";
  public static readonly writeScopeParentStatement: string =
    "INSERT INTO setting_scopes (scope_name, scope_id, parent_name, parent_id) VALUES (?, ?, ?, ?) ON CONFLICT (scope_name, scope_id) DO UPDATE SET parent_name = excluded.parent_name, parent_id = excluded.parent_id";
  public static readonly removeScopeParentStatement: string = "DELETE FROM setting_scopes WHERE scope_name = ? AND scope_id = ?";
  public static readonly removeScopeValuesStatement: string = "DELETE FROM setting_values WHERE scope_name = ? AND scope_id = ?";
  public static readonly deviceColumn: string = "device";
  public static readonly parentNameColumn: string = "parent_name";
  public static readonly parentIdColumn: string = "parent_id";
  public static readonly applicationScope: string = String.empty;
  public static readonly sharedDevice: string = String.empty;
  public static readonly createWindowStatesStatement: string =
    "CREATE TABLE window_states (device TEXT NOT NULL, window TEXT NOT NULL, bounds TEXT, layout TEXT, PRIMARY KEY (device, window)) STRICT";
  public static readonly windowStateColumns: Readonly<Record<WindowStateKind, string>> = {
    [WindowStateKind.Bounds]: "bounds",
    [WindowStateKind.Layout]: "layout"
  };
  public static readonly errorCodeField: "errcode" = "errcode";
  public static readonly busyErrorCode: number = 5;
  public static readonly sqliteErrorCode: string = "ERR_SQLITE_ERROR";
  public static readonly busyFileErrorCodes: readonly string[] = ["EPERM", "EACCES", "EBUSY"];
  public static readonly stagedKeptErrorCodes: readonly string[] = ["EPERM", "EACCES", "EBUSY", "ERR_FS_EISDIR"];
  public static readonly replaceAttempts: number = 40;
  public static readonly refusedTokenRetries: number = 3;
  public static readonly replaceRetryDelay: number = 50;
  public static readonly discoveryReadAttempts: number = 40;
  public static readonly discoveryReadRetryDelay: number = 50;
  public static readonly ownershipWaitMilliseconds: number = 250;
  public static readonly backupGuardWaitMilliseconds: number = 1000;
  public static readonly backupSweepWaitMilliseconds: number = 250;
  public static readonly privateFileMode: number = 0o600;
  public static readonly logSizeLimit: number = 1048576;
  public static readonly logWriteWaitMilliseconds: number = 2_000;
  public static readonly logWriteWaitPause: number = 5;
  public static readonly errorsLogCheckInterval: number = 5_000;
  public static readonly errorsCapSkippedCodes: readonly string[] = ["EBADF", "ENOENT", "EACCES", "EPERM", "EISDIR"];
  public static readonly startLogKeptCodes: readonly string[] = ["ENOENT", "EACCES", "EPERM", "EBUSY"];
  public static readonly readFlag: string = "r";
  public static readonly logRecordShare: number = 4;
  public static readonly missingFileErrorCode: string = "ENOENT";
  public static readonly existingFileErrorCode: string = "EEXIST";
  public static readonly utf8ContinuationMask: number = 0xC0;
  public static readonly utf8ContinuationBits: number = 0x80;
  public static readonly privateFolderMode: number = 0o700;
  public static readonly exclusiveWriteFlag: string = "wx";
  public static readonly temporarySuffix: string = ".tmp";
  public static readonly backupInfix: string = "-before-migration-";
  public static readonly updateBackupInfix: string = "-before-update-";
  public static readonly backupExtension: string = ".sqlite";
  public static readonly backupGuardFileName: string = ".backup-guard";
  public static readonly shellBackupEntryPattern: RegExp = /^(?:\.backup-guard|[a-z][a-z0-9]*(?:-[a-z0-9]+)*-before-(?:migration-\d+|update)-\d{8}T\d{6}Z\.sqlite(?:\.tmp)?)(?:-wal|-shm|-journal)?$/u;
  public static readonly backupTailPattern: RegExp = /^(?:\d+-)?(\d{8}T\d{6}Z)\.sqlite$/;
  public static readonly keptBackupCount: number = 3;
  public static readonly discoveryFormatVersion: number = 1;
  public static readonly declarationsFormatVersion: number = 2;
  public static readonly declarationsFileSegments: readonly string[] = ["_build", "modules", "declarations.json"];
  public static readonly productFileSegments: readonly string[] = ["_build", "product.json"];
  public static readonly nameField: string = "name";
  public static readonly slugField: string = "slug";
  public static readonly applicationIdField: string = "applicationId";
  public static readonly developmentApplicationIdField: string = "developmentApplicationId";
  public static readonly dataFolderField: string = "dataFolder";
  public static readonly deviceFoldersField: string = "deviceFolders";
  public static readonly windowsField: string = "windows";
  public static readonly macosField: string = "macos";
  public static readonly linuxField: string = "linux";
  public static readonly dataDirectoryVariableField: string = "dataDirectoryVariable";
  public static readonly iconsField: string = "icons";
  public static readonly windowsPublisherField: string = "windowsPublisher";
  public static readonly updateFeedField: string = "updateFeed";
  public static readonly permissionsModuleField: string = "permissionsModule";
  public static readonly installFolderField: string = "installFolder";
  public static readonly versionField: string = "version";
  public static readonly holderField: string = "holder";
  public static readonly stateField: string = "state";
  public static readonly handoffField: string = "handoff";
  public static readonly extractionField: string = "extraction";
  public static readonly mounterField: string = "mounter";
  public static readonly dataDirectoryField: string = "dataDirectory";
  public static readonly buildField: string = "build";
  public static readonly installRootSegments: readonly string[] = ["..", "..", "..", ".."];
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly nodeErrorCodeField: "code" = "code";
  public static readonly systemErrorCode: string = "ERR_SYSTEM_ERROR";
  public static readonly unwritableStreamCodes: readonly string[] = ["EDQUOT", "ENOSPC", "EIO", "EPIPE", "EBADF", "ERR_STREAM_DESTROYED", "ERR_STREAM_WRITE_AFTER_END"];
  public static readonly lineEnd: string = "\n";
  public static readonly mountTableFieldSeparator: string = " ";
  public static readonly asarSegmentPattern: RegExp = /(^|[\\/])app\.asar(?=[\\/]|$)/u;
  public static readonly asarUnpackedReplacement: string = "$1app.asar.unpacked";
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly grantByteLength: number = 16;
  public static readonly stopEndCount: number = 3;
  public static readonly settingDeviceColumnIndex: 3 = 3;
  public static readonly missingFileCode: string = "ENOENT";
  public static readonly lineSeparator: string = "\n";
  public static readonly lineBreakPattern: RegExp = /\r?\n/;
  public static readonly logLineBreakPattern: RegExp = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/u;
  public static readonly logControlPattern: RegExp = /[^\P{Cc}\t]/gu;
  public static readonly windowsPlatform: string = "win32";
  public static readonly systemRootVariable: string = "SystemRoot";
  public static readonly systemFolderName: string = "System32";
  public static readonly identityCommandName: string = "whoami.exe";
  public static readonly identityArguments: readonly string[] = ["/user", "/fo", "csv", "/nh"];
  public static readonly accessCommandName: string = "icacls.exe";
  public static readonly removeInheritanceArgument: string = "/inheritance:r";
  public static readonly replaceGrantArgument: string = "/grant:r";
  public static readonly resetAccessArgument: string = "/reset";
  public static readonly saveAccessArgument: string = "/save";
  public static readonly accessFileName: string = "access.sddl";
  public static readonly accessFileEncoding: BufferEncoding = "utf16le";
  public static readonly accessEntryPattern: RegExp = /\((?:[^;()]*;){5}([^;()]+)[^()]*\)/g;
  public static readonly protectedAccessPattern: RegExp = /\bD:[A-Z]*P/;
  public static readonly administratorSuffix: string = "-500";
  public static readonly administratorAlias: string = "LA";
  public static readonly securityIdentifierPattern: RegExp = /"(S-1-[0-9-]+)"\s*$/;
  public static readonly listCommand: string = "/bin/ls";
  public static readonly listAccessArgument: string = "-led";
  public static readonly macPrivateModePattern: RegExp = /^drwx------[@+]? /;
  public static readonly macAccessListModePattern: RegExp = /^drwx------\+ /;
  public static readonly macAccessEntryPattern: RegExp = /^ *\d+: (.+?) (?:inherited )?(allow|deny) /;
  public static readonly macUserQualifier: string = "user:";
  public static readonly macDenyKind: string = "deny";
  public static readonly commandTimeoutMilliseconds: number = 30_000;
  public static readonly commandOutputLimit: number = 1024 * 1024;
  public static readonly ownershipReleased: string = "The data directory's ownership has been released.";
  public static readonly systemRootMissing: string = "SystemRoot is not set, so the Windows system tools cannot be found.";
  public static readonly backupUnverified: string = "The database backup did not pass its integrity check.";
  public static readonly shellDatabaseName: string = "shell database";
  public static readonly moduleDatabaseExtension: string = ".sqlite";
  public static readonly thenProperty: "then" = "then";
  public static readonly actionParameterName: string = "action";
  public static readonly transactionNotSynchronous: string =
    "A transaction's action must finish before it returns; it committed nothing, because an awaited step would run after the commit.";
  public static readonly moduleDatabaseUnknown: string = "Its database was written by a newer build or is not one this build recognizes.";
  public static readonly moduleDatabaseFailed: string = "Its database could not be opened or migrated.";
  public static readonly discoveryNotObject: string = "The discovery metadata is not a JSON object.";
  public static readonly declarationNotObject: string = "A module declaration is not a JSON object.";
  public static readonly moduleLoadFailed: string = "Its runtime part could not be loaded.";
  public static readonly moduleActivationFailed: string = "Its runtime part failed to activate.";
  public static readonly moduleDeactivationFailed: string = "One or more runtime parts failed to deactivate.";
  public static readonly moduleDeactivationPartFailed: string = "Its runtime part failed to deactivate.";
  public static readonly moduleSwitchFailed: string = "It could not be turned off or on completely.";
  public static readonly runtimePartMissing: string = "The package does not export a RuntimePart class whose instances can activate and deactivate.";
  public static readonly runtimePartExport: "RuntimePart" = "RuntimePart";
  public static readonly activateMember: "activateAsync" = "activateAsync";
  public static readonly deactivateMember: "deactivateAsync" = "deactivateAsync";
  public static readonly methodsKind: string = "methods";
  public static readonly eventsKind: string = "events";
  public static readonly commandsKind: string = "commands";
  public static readonly notificationsKind: string = "notifications";
  public static readonly notificationLimit: number = 100;
  public static readonly settingsKind: string = "settings";
  public static readonly themeSetting: string = "theme";
  public static readonly modeSetting: string = "mode";
  public static readonly interfaceFontSetting: string = "interfaceFont";
  public static readonly codeFontSetting: string = "codeFont";
  public static readonly panelSizeSetting: string = "panelSize";
  public static readonly messageSizeSetting: string = "messageSize";
  public static readonly codeSizeSetting: string = "codeSize";
  public static readonly leftDockStyleSetting: string = "leftDockStyle";
  public static readonly rightDockStyleSetting: string = "rightDockStyle";
  public static readonly previewTabsSetting: string = "previewTabs";
  public static readonly menuBarSetting: string = "menuBar";
  public static readonly doNotDisturbSetting: string = "doNotDisturb";
  public static readonly mutedModulesSetting: string = "mutedModules";
  public static readonly trayIconSetting: string = "trayIcon";
  public static readonly keyBindingsSetting: string = "keyBindings";
  public static readonly recentCommandCountSetting: string = "recentCommandCount";
  public static readonly spellCheckSetting: string = "spellCheck";
  public static readonly spellCheckLanguagesSetting: string = "spellCheckLanguages";
  public static readonly updateChecksSetting: string = "updateChecks";
  public static readonly timeFormatSetting: string = "timeFormat";
  public static readonly dateTimeFormatSetting: string = "dateTimeFormat";
  public static readonly generalPage: string = "General";
  public static readonly appearancePage: string = "Appearance";
  public static readonly notificationsPage: string = "Notifications";
  public static readonly shortcutsPage: string = "Keyboard shortcuts";
  public static readonly aboutPage: string = "About";
  public static readonly themeGroup: string = "Theme";
  public static readonly textGroup: string = "Text";
  public static readonly layoutGroup: string = "Layout";
  public static readonly commandSearchGroup: string = "Command search";
  public static readonly spellingGroup: string = "Spelling";
  public static readonly notificationsGroup: string = "Notifications";
  public static readonly backgroundGroup: string = "Background";
  public static readonly shortcutsGroup: string = "Keys";
  public static readonly updatesGroup: string = "Updates";
  public static readonly dateTimeGroup: string = "Date and time";
  public static readonly timeFormatTitle: string = "Time format";
  public static readonly timeFormatDescription: string =
    "Shown beside every message. Tokens: yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm ss a; punctuation and spaces stay, and other text goes in single quotes, as in 'at' HH:mm.";
  public static readonly defaultTimeFormat: string = "h:mm a";
  public static readonly dateTimeFormatTitle: string = "Date and time format";
  public static readonly dateTimeFormatDescription: string = "Shown where the date matters: message tooltips, recent conversations. Same tokens.";
  public static readonly defaultDateTimeFormat: string = "MMM d, yyyy, h:mm a";
  public static readonly maximumFormatLength: number = 64;
  public static readonly defaultThemeId: string = "desktop.default";
  public static readonly defaultThemeTitle: string = "Default";
  public static readonly themeTitle: string = "Theme";
  public static readonly pngSignature: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  public static readonly pngHeader: string = "IHDR";
  public static readonly pngHeaderEnd: number = 24;
  public static readonly jpegStartMarker: number = 0xd8;
  public static readonly jpegMarkerPrefix: number = 0xff;
  public static readonly jpegMarkerLength: number = 2;
  public static readonly jpegFrameMarkers: readonly number[] = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  public static readonly jpegFrameEnd: number = 9;
  public static readonly pngHeaderEncoding: BufferEncoding = "latin1";
  public static readonly pngHeaderStart: number = 12;
  public static readonly pngWidthOffset: number = 16;
  public static readonly pngHeightOffset: number = 20;
  public static readonly jpegFrameHeightOffset: number = 5;
  public static readonly jpegFrameWidthOffset: number = 7;
  public static readonly toolSchemaDialect: string = "https://json-schema.org/draft/2020-12/schema";
  public static readonly toolSchemaPatternFlags: string = "u";
  public static readonly nullType: string = "null";
  public static readonly booleanType: string = "boolean";
  public static readonly objectType: string = "object";
  public static readonly arrayType: string = "array";
  public static readonly numberType: string = "number";
  public static readonly integerType: string = "integer";
  public static readonly stringType: string = "string";
  public static readonly schemaKeyword: string = "$schema";
  public static readonly commentKeyword: string = "$comment";
  public static readonly titleKeyword: string = "title";
  public static readonly descriptionKeyword: string = "description";
  public static readonly defaultKeyword: string = "default";
  public static readonly examplesKeyword: string = "examples";
  public static readonly deprecatedKeyword: string = "deprecated";
  public static readonly readOnlyKeyword: string = "readOnly";
  public static readonly writeOnlyKeyword: string = "writeOnly";
  public static readonly typeKeyword: string = "type";
  public static readonly enumKeyword: string = "enum";
  public static readonly constKeyword: string = "const";
  public static readonly minLengthKeyword: string = "minLength";
  public static readonly maxLengthKeyword: string = "maxLength";
  public static readonly patternKeyword: string = "pattern";
  public static readonly minimumKeyword: string = "minimum";
  public static readonly maximumKeyword: string = "maximum";
  public static readonly exclusiveMinimumKeyword: string = "exclusiveMinimum";
  public static readonly exclusiveMaximumKeyword: string = "exclusiveMaximum";
  public static readonly minItemsKeyword: string = "minItems";
  public static readonly maxItemsKeyword: string = "maxItems";
  public static readonly itemsKeyword: string = "items";
  public static readonly propertiesKeyword: string = "properties";
  public static readonly requiredKeyword: string = "required";
  public static readonly additionalPropertiesKeyword: string = "additionalProperties";
  public static readonly anyOfKeyword: string = "anyOf";

  public static formatPipeLink(inode: number): string {
    return `${Resources.pipeLinkPrefix}[${inode}]`;
  }

  public static formatTooManyFileGrants(window: number, limit: number): string {
    return `Window ${window} holds ${limit} live file grants, the most it may, so no other file is granted until a part redeems or discards one.`;
  }

  public static formatGrantedFileUnreadable(code: string): string {
    return `The granted file can't be read (${code}), so it is not read.`;
  }

  public static formatSharedFileUnreadable(code: string): string {
    return `The file to share can't be read (${code}), so it is not shared.`;
  }

  public static formatMainProcessRefused(connection: number): string {
    return `Connection ${connection} named itself the main process, but its process is not the app's main process, so it was refused.\n`;
  }

  public static formatMainProcessSenderChanged(connection: number): string {
    return `Connection ${connection} was checked as the main process, but another process sent on it since, so it was ended.\n`;
  }

  public static formatMainProcessCheckFailed(connection: number, reason: string): string {
    return `Connection ${connection} named itself the main process, and checking its process failed, so it was refused: ${reason}\n`;
  }

  public static formatTrayIconTitle(productName: string, platform: string): string {
    const place = platform === Resources.windowsPlatform ? "the notification area" : platform === Resources.macPlatform ? "the menu bar" : "the tray";
    return `Show ${productName} in ${place}`;
  }

  public static formatTrayIconDescription(productName: string): string {
    return `An icon that shows when work is running or notifications are unread, with a menu to open ${productName}, turn on Do not disturb or quit.`;
  }

  public static formatThemeDescription(productName: string): string {
    return `The colors and look of ${productName}.`;
  }

  public static readonly modeTitle: string = "Mode";
  public static readonly modeDescription: string = "Follow the operating system, or always light or dark.";
  public static readonly modeOptions: readonly (readonly [string, string])[] = [["System", "System"], ["Light", "Light"], ["Dark", "Dark"]];
  public static readonly defaultMode: string = "System";
  public static readonly leftDockStyleTitle: string = "Left dock";
  public static readonly leftDockStyleDescription: string = "Show the left dock's views as tabs, or as icons along the window's left edge.";
  public static readonly rightDockStyleTitle: string = "Right dock";
  public static readonly rightDockStyleDescription: string = "Show the right dock's views as tabs, or as icons along the window's right edge.";
  public static readonly previewTabsTitle: string = "Preview tabs";
  public static readonly previewTabsDescription: string = "Open a document as a preview tab that the next preview replaces until it is kept. Off opens every document as an ordinary tab.";
  public static readonly dockStyleOptions: readonly (readonly [string, string])[] = [["Tabs", "Tabs"], ["Icons", "Icons"]];
  public static readonly defaultDockStyle: string = "Tabs";
  public static readonly menuBarTitle: string = "Menus";
  public static readonly menuBarDescription: string = "On Windows and Linux, show the menus as a bar in the window row, as a menu button, or not at all. A menu bar that does not fit the window row folds into the menu button. macOS keeps its menu bar.";
  public static readonly menuBarOptions: readonly (readonly [string, string])[] = [["Inline", "Menu bar"], ["Button", "Menu button"], ["Hidden", "Hidden"]];
  public static readonly defaultMenuBar: string = "Inline";
  public static readonly interfaceFontTitle: string = "Interface font";
  public static readonly interfaceFontDescription: string = "The font of menus, panels and prose.";
  public static readonly codeFontTitle: string = "Code font";
  public static readonly codeFontDescription: string = "The font of code and terminals.";
  public static readonly fontOptions: readonly (readonly [string, string])[] = [["Noldova", "Noldova"], ["System", "System"]];
  public static readonly defaultFont: string = "Noldova";
  public static readonly panelSizeTitle: string = "Interface text size";
  public static readonly panelSizeDescription: string = "The size of interface text, in pixels; spacing and controls scale with it.";
  public static readonly messageSizeTitle: string = "Message text size";
  public static readonly messageSizeDescription: string = "The size of prose you read and write, in pixels.";
  public static readonly codeSizeTitle: string = "Code text size";
  public static readonly codeSizeDescription: string = "The size of code, in pixels.";
  public static readonly minimumTextSize: number = 12;
  public static readonly maximumTextSize: number = 18;
  public static readonly textSizeStep: number = 1;
  public static readonly defaultPanelSize: number = 13;
  public static readonly defaultMessageSize: number = 13;
  public static readonly defaultCodeSize: number = 12;
  public static readonly doNotDisturbTitle: string = "Do not disturb";
  public static readonly doNotDisturbDescription: string = "Holds back notifications on this device; they still collect in the list.";
  public static readonly mutedModulesTitle: string = "Notifications from modules";
  public static readonly mutedModulesDescription: string = "A module turned off still adds its notifications to the list, without toasts or operating system notifications.";
  public static readonly macPlatform: string = "darwin";
  public static readonly keyBindingsTitle: string = "Keyboard shortcuts";
  public static readonly keyBindingsDescription: string = "The keys you chose for commands, in place of their default keys, on every device.";
  public static readonly spellCheckTitle: string = "Check spelling";
  public static readonly spellCheckDescription: string = "Underline misspelled words in the text you type and offer corrections in the text field's menu. Code is never checked.";
  public static readonly spellCheckLanguagesTitle: string = "Spelling languages";
  public static readonly updateChecksTitle: string = "Check for updates";
  public static readonly updateChecksDescription: string = "When this device looks for a newer version: shortly after starting and then every 10 minutes, only shortly after starting, or only when you choose Check for updates. A newer version downloads by itself; installing it waits for you.";
  public static readonly updateChecksOptions: readonly (readonly [string, string])[] = [["Automatic", "Automatically"], ["AtStart", "Only at start"], ["OnRequest", "Only when I ask"]];
  public static readonly defaultUpdateChecks: string = "Automatic";
  public static readonly spellCheckLanguagesDescription: string = "The languages words are checked in on this device. With none chosen, the operating system's languages that have a dictionary are used, or else the first language offered. On macOS the system chooses the languages.";
  public static readonly recentCommandCountTitle: string = "Recent commands";
  public static readonly recentCommandCountDescription: string = "How many commands you recently ran from command search are listed first. 0 lists none.";
  public static readonly maximumRecentCommands: number = 20;
  public static readonly defaultRecentCommands: number = 5;
  public static readonly settingScopesKind: string = "settingScopes";
  public static readonly settingsField: string = "settings";
  public static readonly nameParameterName: string = "name";
  public static readonly defaultKeyParameterName: string = "defaultKey";
  public static readonly developmentDataFolder: readonly string[] = ["_build", "data"];
  public static formatPreShellDataFailure(productName: string): string {
    return `This data directory holds data from a ${productName} release that predates the shell; move it aside to continue.`;
  }

  public static readonly linuxPlatform: string = "linux";
  public static readonly loopbackHost: string = "127.0.0.1";
  public static readonly tcpEndpointPrefix: string = "tcp://127.0.0.1:";
  public static readonly portPattern: RegExp = /^[1-9]\d{0,4}$/;
  public static readonly maximumPort: number = 65_535;
  public static readonly socketFileName: string = "runtime.sock";
  public static readonly maximumSocketPathLength: number = 103;
  public static readonly tokenByteLength: number = 32;
  public static readonly tokenDigestAlgorithm: string = "sha256";
  public static readonly hexEncoding: "hex" = "hex";
  public static readonly dataEvent: string = "data";
  public static readonly errorEvent: string = "error";
  public static readonly closeEvent: string = "close";
  public static readonly connectEvent: string = "connect";
  public static readonly listeningEvent: string = "listening";
  public static readonly spawnEvent: string = "spawn";
  public static readonly abortEvent: string = "abort";
  public static readonly ignoredOutput: "ignore" = "ignore";
  public static readonly requestIdSeparator: string = ":";
  public static readonly maximumClientNameLength: number = 256 - Resources.requestIdSeparator.length - String(Number.MAX_SAFE_INTEGER).length;
  public static readonly clientNameTooLong: string = `A client name is at most ${Resources.maximumClientNameLength} characters, so each of its request ids fits the protocol's 256.`;
  public static readonly maximumFrameLength: number = 16 * 1024 * 1024;
  public static readonly handshakeTimeout: number = 5_000;
  public static readonly defaultRequestTimeout: number = 600_000;
  public static readonly maximumRequestTimeout: number = 3_600_000;
  public static readonly answerGrace: number = 5_000;
  public static readonly closeGrace: number = 2_000;
  public static readonly idleGrace: number = 30_000;
  public static readonly takeover: number = 5_000;
  public static readonly takeoverInterval: number = 50;
  public static readonly launchTimeout: number = 20_000;
  public static readonly launchLimit: number = 60_000;
  public static readonly stopTimeoutMargin: number = 10_000;
  public static readonly launchCheckInterval: number = 100;
  public static readonly productVersionPattern: RegExp = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
  public static readonly positiveIntegerPattern: RegExp = /^[1-9]\d{0,9}$/;
  public static readonly versionSeparator: string = ".";
  public static readonly versionParts: number = 3;
  public static readonly versionPartWidth: number = 9;
  public static readonly versionPadding: string = "0";
  public static readonly dataDirectoryArgument: string = "--data-dir";
  public static readonly installationArgument: string = "--installation-dir";
  public static readonly installationsFolderName: string = "installations";
  public static readonly dataDirectoriesFolderName: string = "data-directories";
  public static readonly mainProcessesFolderName: string = "main processes";
  public static readonly barrierFileName: string = "barrier.json";
  public static readonly jsonExtension: string = ".json";
  public static readonly installationIdLength: number = 16;
  public static readonly localAppDataVariable: string = "LOCALAPPDATA";
  public static readonly windowsLocalAppData: readonly string[] = ["AppData", "Local"];
  public static readonly macApplicationSupport: readonly string[] = ["Library", "Application Support"];
  public static readonly xdgStateVariable: string = "XDG_STATE_HOME";
  public static readonly xdgStateDefault: readonly string[] = [".local", "state"];
  public static readonly idleGraceArgument: string = "--idle-grace";
  public static readonly stopSignals: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  public static readonly usageExitCode: number = 2;
  public static readonly ownedExitCode: number = 3;
  public static readonly updatingExitCode: number = 4;
  public static readonly programRole: string = "program";
  public static readonly copyLauncherRole: string = "runtime launcher";
  public static readonly copyRuntimeRole: string = "runtime";
  public static readonly copyMounterRole: string = "AppImage mount";
  public static readonly failureExitCode: number = 1;
  public static readonly launchShell: string = "/bin/bash";
  public static readonly launchDescriptors: string = "/proc/self/fd";
  public static readonly launchDescriptorClosing: string = "for descriptor in /proc/self/fd/*; do descriptor=${descriptor##*/}; if (( descriptor > 2 )); then exec {descriptor}>&-; fi; done";
  public static readonly launchShellArguments: readonly string[] = [
    "--noprofile",
    "--norc",
    "-p",
    "-c",
    `set -e; shopt -s failglob; ${Resources.launchDescriptorClosing}; exec -- "$@"`
  ];
  public static readonly launchNameSuffix: string = "-launch";
  public static readonly appImageVariable: string = "APPIMAGE";
  public static readonly appImageFolderVariable: string = "APPDIR";
  public static readonly appImageMountOption: string = "--appimage-mount";
  public static readonly appImageExtractOption: string = "--appimage-extract";
  public static readonly copyMountWait: number = 10_000;
  public static readonly copyListingSuffix: string = ".mount";
  public static readonly processFolder: string = "/proc";
  public static readonly descriptorFolderName: string = "fd";
  public static readonly pipeLinkPrefix: string = "pipe:";
  public static readonly outputDescriptorName: string = "1";
  public static readonly processIdPattern: RegExp = /^[1-9][0-9]*$/;
  public static readonly copyExtractionPrefix: string = "desktop-runtime-";
  public static readonly copyExtractionFolder: string = "squashfs-root";
  public static readonly temporaryFolderVariable: string = "TMPDIR";
  public static readonly temporaryVariable: string = "TMP";
  public static readonly tempVariable: string = "TEMP";
  public static readonly defaultTemporaryFolder: string = "/tmp";
  public static readonly trailingSlashes: RegExp = /\/+$/;
  public static readonly parentFolder: string = "..";
  public static readonly mountTableFile: string = "/proc/self/mountinfo";
  public static readonly mountPointField: number = 4;
  public static readonly copyExtractionName: RegExp = /^desktop-runtime-[A-Za-z0-9]{6}$/;
  public static readonly copyEndSignal: NodeJS.Signals = "SIGTERM";
  public static readonly stoppedByIdle: string = "idle";
  public static readonly stoppedByRequest: string = "request";
  public static readonly stoppedBySignal: string = "signal";
  public static readonly portParameterName: string = "port";
  public static readonly pathParameterName: string = "path";
  public static readonly textParameterName: string = "text";
  public static readonly descriptionParameterName: string = "description";
  public static readonly idleGraceParameterName: string = "idleGraceMilliseconds";
  public static readonly maximumFrameLengthParameterName: string = "maximumFrameLength";
  public static readonly handshakeTimeoutParameterName: string = "handshakeTimeout";
  public static readonly defaultRequestTimeoutParameterName: string = "defaultRequestTimeout";
  public static readonly maximumRequestTimeoutParameterName: string = "maximumRequestTimeout";
  public static readonly updateSaveWaitParameterName: string = "updateSaveWait";
  public static readonly updateBarrierHolderCheckIntervalParameterName: string = "updateBarrierHolderCheckInterval";
  public static readonly callTimeoutParameterName: string = "callTimeout";
  public static readonly timeoutMillisecondsParameterName: string = "timeoutMilliseconds";
  public static readonly answerGraceParameterName: string = "answerGrace";
  public static readonly clientNameParameterName: string = "clientName";
  public static readonly clientParameterName: string = "client";
  public static readonly entryPathParameterName: string = "entryPath";
  public static readonly launchTimeoutParameterName: string = "launchTimeout";
  public static readonly launchLimitParameterName: string = "launchLimit";
  public static readonly stopTimeoutParameterName: string = "stopTimeout";
  public static readonly argumentsParameterName: string = "arguments";
  public static readonly portOutOfRange: string = "A port must be from 1 to 65535.";
  public static readonly socketPathNotAbsolute: string = "A local socket's path must be absolute.";
  public static readonly defaultRequestTimeoutTooLong: string = "The default time limit of a request cannot exceed its maximum.";
  public static readonly launchLimitTooShort: string = "The limit while the data directory is owned cannot be shorter than the launch timeout.";
  public static readonly endpointUnavailable: string = "The runtime's local endpoint has no address.";
  public static readonly handshakeRequired: string = "A connection must begin with a handshake.";
  public static readonly unauthorized: string = "The capability token is not valid for this runtime.";
  public static readonly mainProcessRefused: string = "Only the app's main process may connect as the main process.";
  public static readonly maximumWindowFileGrants: number = 256;
  public static readonly fileGrantsNotFromApp: string = "Only the app's main process grants files and ends a page's grants.";
  public static readonly fileGrantsNotFromPage: string = "Only a window's page discards its file grants.";
  public static readonly appSurfaceNotFromMainProcess: string = "Only the main process reports the app's windows and shortcuts.";
  public static readonly mainWindowNotFromMainProcess: string = "Only the main process reports its main window.";
  public static readonly appWindowsName: string = "windows";
  public static readonly appShortcutsName: string = "shortcuts";
  public static readonly fileGrantTaken: string = "The file grant is already given.";
  public static readonly fileGrantUnknown: string = "The file grant is unknown or has ended, or it was given to another module or page.";
  public static readonly grantedFileNotRegular: string = "The granted file is no longer a regular file, so it is not read.";
  public static readonly grantedFileChanged: string = "The granted file changed or was replaced since it was granted, so it is not read.";
  public static readonly fileSharesNotFromApp: string = "Only the app's main process resolves a shared file.";
  public static readonly fileSharesNotFromPage: string = "A runtime part shares a file only while it answers a request from its window's page.";
  public static readonly fileShareUnknown: string = "The shared file is unknown or has ended.";
  public static readonly sharedFileOutside: string = "The file to share is outside the module's own data and work folders, so it is not shared.";
  public static readonly sharedFileNotRegular: string = "The file to share is not a regular file, so it is not shared.";
  public static readonly sharedMediaType: string = "application/octet-stream";
  public static readonly mainProcessRefusedAgain: string = "The runtime refused this app's main process, also after the app restarted it from its own program.";
  public static readonly handshakeUnanswered: string = "The handshake has not been answered yet.";
  public static formatBuildMismatchFailure(productName: string): string {
    return `Another build of ${productName} owns this data directory.`;
  }

  public static readonly otherBuildMayOnlyStop: string = "A connection from another build may only ask the runtime to stop.";
  public static readonly unexpectedMessage: string = "Only requests and cancellations may follow the handshake.";
  public static readonly invalidFrame: string = "The frame is not a valid message.";
  public static readonly internalFailure: string = "The runtime failed to handle the request.";
  public static readonly unreadableError: string = "an error the runtime cannot describe";
  public static readonly deadlineExceeded: string = "The request did not finish within its time limit.";
  public static readonly cancelled: string = "The request was cancelled.";
  public static readonly workInProgress: string = "Work is in progress; stopping now would interrupt it.";
  public static readonly updateNotPreparing: string = "The runtime is not preparing for an update.";
  public static readonly barrierUnwatchable: string = "The runtime could not watch its installation's folder for the end of the update.";
  public static readonly barrierUncheckable: string = "The runtime could not check whether the update has ended, so it ended the wait for it.";
  public static readonly installationNotAbsolute: string = "The installation's folder must be an absolute path.";
  public static readonly installationNotThisRuntimes: string = "The update names another installation than the one this runtime belongs to.";
  public static readonly updateSaveWait: number = 6000;
  public static readonly updateBarrierHolderCheckInterval: number = 5000;
  public static readonly clientClosed: string = "The connection to the runtime is closed.";
  public static readonly handshakeTimedOut: string = "The runtime did not answer the handshake in time.";
  public static readonly handshakeRefused: string = "The runtime closed the connection during the handshake.";
  public static readonly handshakeIdentityMismatch: string = "The runtime answered the handshake with another build's identity.";
  public static readonly launchTimedOut: string = "The runtime did not start in time.";
  public static readonly runtimeExitedWithoutReason: string = "The runtime exited while starting and left no reason.";
  public static readonly startLogArgument: string = "--start-log";
  public static readonly startLogNamePattern: RegExp = /^start-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.log$/;
  public static readonly copyRecordNamePattern: RegExp = /^copy-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.log$/;
  public static readonly startLogTailLength: number = 4096;
  public static readonly homeAbbreviation: string = "~";
  public static readonly redactedValue: string = "[redacted]";
  public static readonly opaqueValuePattern: RegExp = /[A-Za-z0-9+/_=-]{32,}/g;
  public static readonly opaqueValueLength: number = 32;
  public static readonly opaqueValueSeparator: string = "/";
  public static readonly tokenPartPattern: RegExp = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])[A-Za-z0-9+=]{16,}$/;
  public static readonly mixedPartPattern: RegExp = /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])/;
  public static readonly tokenTextPattern: RegExp = /^[A-Za-z0-9+=]+$/;
  public static readonly identifierPattern: RegExp = /^[A-Z][a-z]{2,}(?:[A-Z][a-z]{2,})+$/;
  public static readonly tokenPartAverageLength: number = 12;
  public static readonly urlCredentialsPattern: RegExp = /([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s/?#]+@/g;
  public static get urlCredentialsReplacement(): string {
    return `$1${Resources.redactedValue}@`;
  }
  public static readonly emailPattern: RegExp = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
  public static readonly pathSeparatorPattern: RegExp = /[\\/]/;
  public static readonly pathSeparatorSource: string = "(?:\\\\{1,2}|/)";
  public static readonly nameEndSource: string = "(?=[.,;:!?)\\]}]*(?:$|[\\\\/\"'`<>|]|\\s(?![^\\s\\\\/\"'`<>|]+[\\\\/])))";
  public static readonly wordStartSource: string = "(?<![\\p{L}\\p{M}])";
  public static readonly wordEndSource: string = "(?![\\p{L}\\p{M}])";
  public static readonly profileSuffixPattern: RegExp = /\.(?:[0-9]{3}|[A-Z][A-Z0-9-]*)$/u;
  public static readonly uriUnreservedPattern: RegExp = /^[A-Za-z0-9_.!~*'()-]$/;
  public static readonly hexBytePattern: RegExp = /../g;
  public static readonly percentEncodedByte: string = "%$&";
  public static readonly alternativeSeparator: string = "|";
  public static readonly ownNameStartSource: string = "(?<![\\p{L}\\p{M}\\p{N}_])";
  public static readonly ownNameEndSource: string = "(?![\\p{L}\\p{M}\\p{N}_])";
  public static readonly packageScopes: readonly string[] = ["@noldova-com", "@noldova"];
  public static formatOwnNamesSource(names: readonly string[]): string {
    return `(${Resources.ownNameStartSource}(?:${names.join(Resources.alternativeSeparator)})${Resources.ownNameEndSource})`;
  }
  public static readonly shortNamePattern: RegExp = /^[A-Za-z0-9!#$%&'()@^_`{}~-]{1,8}(?:\.[A-Za-z0-9!#$%&'()@^_`{}~-]{1,3})?$/;
  public static readonly shortNameRemovedPattern: RegExp = /[\s.]/g;
  public static readonly shortNameCharacterPattern: RegExp = /^[A-Za-z0-9!#$%&'()@^_`{}~-]$/;
  public static readonly shortNameAnyCharacterSource: string = "[^\\\\/\\s]";
  public static readonly shortNameBaseLength: number = 6;
  public static readonly shortNameExtensionLength: number = 3;
  public static readonly shortNameSuffixSource: string = "~[0-9]+";
  public static readonly extensionSeparator: string = ".";
  public static readonly memberSeparator: string = ".";
  public static readonly entryArgumentsStart: number = 2;
  public static readonly userNameMinimumLength: number = 3;
  public static readonly genericUserNames: readonly string[] = [
    "admin", "administrator", "azureuser", "codespace", "default", "dev", "ec2-user", "guest", "node", "root", "runner", "runneradmin", "test",
    "ubuntu", "user", "vagrant"
  ];
  public static readonly regularExpressionSyntaxPattern: RegExp = /[.*+?^${}()|[\]\\]/g;
  public static readonly escapedMatch: string = "\\$&";
  public static readonly caseInsensitiveGlobalFlags: string = "giu";
  public static readonly unicodeFlag: string = "u";
  public static readonly appendFlag: string = "a";
  public static readonly uncaughtExceptionEvent: string = "uncaughtExceptionMonitor";
  public static readonly startLogNameParameterName: string = "startLog";
  public static readonly stopTimedOut: string = "The other build's runtime did not stop in time.";
  public static readonly launchShellUnavailable: string = "Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.";
  public static readonly launchDescriptorsUnavailable: string = "Starting a program on Linux requires access to /proc/self/fd. Ensure procfs is mounted at /proc and this process can read and traverse its descriptor directory.";
  public static readonly dataDirectoryRequired: string = "The --data-dir argument is required.";
  public static readonly usage: string = "Usage: runtime-entry --data-dir <absolute path> [--idle-grace <milliseconds>] [--start-log <start log name>] [--installation-dir <folder>]";
  public static readonly recentCommandsMigration: string = "recent-commands";
  public static readonly createRecentCommandsStatement: string =
    "CREATE TABLE recent_commands (device TEXT NOT NULL, id TEXT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY (device, id)) STRICT";
  public static readonly readRecentCommandsStatement: string = "SELECT id FROM recent_commands WHERE device = ? ORDER BY used DESC";
  public static readonly recordRecentCommandStatement: string =
    "INSERT INTO recent_commands (device, id, used) SELECT ?1, ?2, COALESCE(MAX(used), 0) + 1 FROM recent_commands WHERE device = ?1 " +
    "ON CONFLICT (device, id) DO UPDATE SET used = excluded.used";
  public static readonly trimRecentCommandsStatement: string =
    "DELETE FROM recent_commands WHERE device = ?1 AND id NOT IN (SELECT id FROM recent_commands WHERE device = ?1 ORDER BY used DESC LIMIT ?2)";
  public static readonly rememberedPermissionsMigration: string = "remembered-permissions";
  public static readonly createRememberedPermissionsStatement: string =
    "CREATE TABLE remembered_permissions (id TEXT PRIMARY KEY, module TEXT NOT NULL, action TEXT NOT NULL, subject TEXT, scope TEXT NOT NULL, " +
    "decision TEXT NOT NULL, remembered INTEGER NOT NULL) STRICT";
  public static readonly indexRememberedPermissionsStatement: string = "CREATE INDEX remembered_permissions_match ON remembered_permissions (module, action, scope)";
  public static readonly findRememberedPermissionStatement: string =
    "SELECT decision FROM remembered_permissions WHERE module = ? AND action = ? AND subject IS ? AND scope = ? ORDER BY remembered DESC LIMIT 1";
  public static readonly forgetMatchingPermissionsStatement: string = "DELETE FROM remembered_permissions WHERE module = ? AND action = ? AND subject IS ? AND scope = ?";
  public static readonly rememberPermissionStatement: string =
    "INSERT INTO remembered_permissions (id, module, action, subject, scope, decision, remembered) VALUES (?, ?, ?, ?, ?, ?, ?)";
  public static readonly listRememberedPermissionsStatement: string =
    "SELECT id, module, action, subject, scope, decision, remembered FROM remembered_permissions ORDER BY remembered, id";
  public static readonly readRememberedPermissionStatement: string =
    "SELECT id, module, action, subject, scope, decision, remembered FROM remembered_permissions WHERE id = ?";
  public static readonly forgetRememberedPermissionStatement: string = "DELETE FROM remembered_permissions WHERE id = ?";
  public static readonly secretsMigration: string = "secrets";
  public static readonly createSecretsStatement: string =
    "CREATE TABLE secrets (device TEXT NOT NULL, module TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (device, module, name)) STRICT";
  public static readonly saveSecretStatement: string =
    "INSERT INTO secrets (device, module, name, value) VALUES (?, ?, ?, ?) ON CONFLICT (device, module, name) DO UPDATE SET value = excluded.value";
  public static readonly readSecretStatement: string = "SELECT value FROM secrets WHERE device = ? AND module = ? AND name = ?";
  public static readonly removeSecretStatement: string = "DELETE FROM secrets WHERE device = ? AND module = ? AND name = ?";
  public static readonly actionColumn: string = "action";
  public static readonly subjectColumn: string = "subject";
  public static readonly scopeColumn: string = "scope";
  public static readonly decisionColumn: string = "decision";
  public static readonly rememberedColumn: string = "remembered";
  public static readonly ownedProcessesMigration: string = "owned-processes";
  public static readonly createOwnedProcessesStatement: string =
    "CREATE TABLE owned_processes (id INTEGER PRIMARY KEY, module TEXT NOT NULL, process_id INTEGER NOT NULL, program TEXT NOT NULL, executable TEXT NOT NULL, " +
    "boot TEXT NOT NULL, requested INTEGER NOT NULL, started INTEGER NOT NULL, seen INTEGER NOT NULL, clock_offset INTEGER NOT NULL) STRICT";
  public static readonly insertOwnedProcessStatement: string =
    "INSERT INTO owned_processes (module, process_id, program, executable, boot, requested, started, seen, clock_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  public static readonly updateOwnedProcessSeenStatement: string = "UPDATE owned_processes SET seen = ?, clock_offset = ? WHERE id = ?";
  public static readonly deleteOwnedProcessStatement: string = "DELETE FROM owned_processes WHERE id = ?";
  public static readonly readOwnedProcessesStatement: string =
    "SELECT id, module, process_id, program, executable, boot, requested, started, seen, clock_offset FROM owned_processes ORDER BY id";
  public static readonly moduleColumn: string = "module";
  public static readonly processIdColumn: string = "process_id";
  public static readonly programColumn: string = "program";
  public static readonly executableColumn: string = "executable";
  public static readonly bootColumn: string = "boot";
  public static readonly requestedColumn: string = "requested";
  public static readonly startedColumn: string = "started";
  public static readonly seenColumn: string = "seen";
  public static readonly clockOffsetColumn: string = "clock_offset";
  public static readonly programParameterName: string = "program";
  public static readonly workingFolderParameterName: string = "workingFolder";
  public static readonly environmentParameterName: string = "environment";
  public static readonly inheritParameterName: string = "inherit";
  public static readonly codeParameterName: string = "code";
  public static readonly columnsParameterName: string = "columns";
  public static readonly rowsParameterName: string = "rows";
  public static readonly terminalColumnsInvalid: string = "A pseudo-terminal's columns must be a whole number of at least 1.";
  public static readonly terminalRowsInvalid: string = "A pseudo-terminal's rows must be a whole number of at least 1.";
  public static readonly pseudoTerminalExitInvalid: string = "A pseudo-terminal's exit has an exit code, a signal or neither, not both.";
  public static readonly graceMillisecondsParameterName: string = "graceMilliseconds";
  public static readonly endMillisecondsParameterName: string = "endMilliseconds";
  public static readonly seenMillisecondsParameterName: string = "seenMilliseconds";
  public static readonly terminalWatchMillisecondsParameterName: string = "terminalWatchMilliseconds";
  public static readonly terminalReportMillisecondsParameterName: string = "terminalReportMilliseconds";
  public static readonly workingFolderNotAbsolute: string = "The working folder must be an absolute path.";
  public static readonly processExitInvalid: string = "A process exit has either an exit code or a signal, not both.";
  public static readonly pseudoTerminalExitUnreported: string = "The program ended, but its pseudo-terminal library didn't report its exit, so it ended without a code.";
  public static readonly clockStepped: string =
    "The system clock changed by more than a second after it was last seen running, so what it started could not be told apart from other processes and was left running.";
  public static readonly environmentNamePattern: RegExp = /^[^=\0]+$/;
  public static readonly environmentEntrySeparator: string = "=";
  public static readonly sharedEnvironmentNames: readonly string[] = ["PATH", "TEMP", "TMP", "TMPDIR"];
  public static readonly posixEnvironmentNames: readonly string[] = ["HOME", "LANG", "LC_ALL"];
  public static readonly windowsEnvironmentNames: readonly string[] =
    ["SystemRoot", "windir", "PATHEXT", "ComSpec", "USERPROFILE", "SystemDrive", "LOCALAPPDATA", "APPDATA", "ProgramData", "ProgramFiles"];
  public static readonly pathVariable: string = "PATH";
  public static readonly programExtensionsVariable: string = "PATHEXT";
  public static readonly defaultProgramExtensions: string = ".COM;.EXE;.BAT;.CMD";
  public static readonly programExtensions: readonly string[] = [".com", ".exe", ".bat", ".cmd"];
  public static readonly ownEnvironmentNames: readonly string[] = ["ELECTRON_RUN_AS_NODE", "ELECTRON_NO_ATTACH_CONSOLE"];
  public static readonly homeVariable: string = "HOME";
  public static readonly shellVariable: string = "SHELL";
  public static readonly zshFolderVariable: string = "ZDOTDIR";
  public static readonly runAsNodeValue: string = "1";
  public static readonly defaultPosixShell: string = "/bin/sh";
  public static readonly loginShellArguments: readonly string[] = ["-i", "-l", "-c"];
  public static readonly nodeEvaluateArgument: string = "-e";
  public static readonly loginShellReadMilliseconds: number = 10_000;
  public static readonly shellOwnNames: readonly string[] = ["PWD", "OLDPWD", "SHLVL", "_"];
  public static readonly shellProfileFiles: readonly string[] =
    [".zshenv", ".zprofile", ".zshrc", ".zlogin", ".bash_profile", ".bash_login", ".bashrc", ".profile"];
  public static readonly profilesUnwatched: string =
    "The shell's profile files are not watched, so a change to them reaches the programs modules start only after the app restarts.\n";
  public static readonly windowsPowerShellPath: readonly string[] = ["System32", "WindowsPowerShell", "v1.0", "powershell.exe"];
  public static readonly windowsEnvironmentArguments: readonly string[] = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"];
  public static readonly windowsEnvironmentScript: string = [
    "$ErrorActionPreference = 'Stop'",
    "function Read-Scope($key) {",
    "  $variables = @{}",
    "  if ($null -ne $key) {",
    "    foreach ($name in $key.GetValueNames()) {",
    "      $kind = $key.GetValueKind($name)",
    "      if ($name -ne '' -and ($kind -eq 'String' -or $kind -eq 'ExpandString')) {",
    "        $variables[$name] = @([string]$key.GetValue($name, '', 'DoNotExpandEnvironmentNames'), ($kind -eq 'ExpandString'))",
    "      }",
    "    }",
    "    $key.Dispose()",
    "  }",
    "  return $variables",
    "}",
    "while ($null -ne ($id = [Console]::In.ReadLine())) {",
    "  $machine = Read-Scope ([Microsoft.Win32.Registry]::LocalMachine.OpenSubKey('SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'))",
    "  $user = Read-Scope ([Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment'))",
    "  $json = ConvertTo-Json -Compress -Depth 4 -InputObject @{ id = $id; machine = $machine; user = $user }",
    "  [Console]::Out.WriteLine([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json)))",
    "  [Console]::Out.Flush()",
    "}"
  ].join("\n");
  public static readonly windowsEnvironmentReadMilliseconds: number = 60_000;
  public static readonly requestIdKey: string = "id";
  public static readonly machineVariablesKey: string = "machine";
  public static readonly userVariablesKey: string = "user";
  public static readonly windowsVariableMark: string = "%";
  public static readonly utf16Encoding: BufferEncoding = "utf16le";
  public static readonly carriageReturnPattern: RegExp = /\r$/u;
  public static readonly maximumLineLength: number = 4_194_304;
  public static readonly windowsEnvironmentLineDropped: string = "Windows PowerShell wrote a line that answers no read of the environment under way, so it was dropped.\n";
  public static readonly windowsEnvironmentSystemRootMissing: string = "SystemRoot is not set, so Windows PowerShell can't be found.";
  public static readonly windowsEnvironmentOutputInvalid: string = "Windows PowerShell did not write the machine's and the person's variables as text.";

  public static formatEnvironmentUnread(reason: string): string {
    return `Programs start with the last environment read, or the app's own, since the person's current environment could not be read: ${reason}\n`;
  }

  public static formatWindowsEnvironmentTimedOut(milliseconds: number): string {
    return `Windows PowerShell did not answer within ${milliseconds / 1000} seconds.`;
  }

  public static formatLoginShellTimedOut(shell: string, milliseconds: number): string {
    return `The login shell ${shell} did not give its environment within ${milliseconds / 1000} seconds.`;
  }

  public static formatLoginShellEnded(shell: string, reason: string): string {
    return `The login shell ${shell} ended before it gave its environment: ${reason}`;
  }

  public static formatLoginShellOutputInvalid(shell: string): string {
    return `The login shell ${shell} did not write its environment as text.`;
  }

  public static formatLineProcessExited(name: string, codeOrSignal: number | string | null): string {
    return `${name} exited with ${String(codeOrSignal)}.`;
  }

  public static formatLineProcessGroupUnsignalled(name: string, reason: string): string {
    return `What ${name} started may outlive it, since its process group could not be ended: ${reason}\n`;
  }

  public static formatShellQuoted(text: string): string {
    return `'${text.replaceAll("'", "'\\''")}'`;
  }

  public static formatEnvironmentScript(mark: string): string {
    return `process.stdout.write("${mark}" + JSON.stringify(process.env) + "${mark}\\n")`;
  }

  public static readonly refusedLinkCodes: readonly string[] = ["EACCES", "EPERM"];
  public static readonly unreadableLinkCodes: readonly string[] = ["EACCES", "EPERM", "ENOENT", "ELOOP"];
  public static readonly unreadableDescriptorCodes: readonly string[] = ["EINVAL", "ENOENT", "EACCES", "EPERM"];
  public static readonly missingPathCodes: readonly string[] = ["ENOENT", "ENOTDIR"];
  public static readonly unreadablePathCodes: readonly string[] = ["ENOENT", "ENOTDIR", "EACCES", "EPERM", "ELOOP"];
  public static readonly unwatchableFolderCodes: readonly string[] = ["ENOENT", "ENOTDIR", "EACCES", "EPERM", "ENOSPC", "EMFILE"];
  public static readonly windowsNamePattern: RegExp = /[\\/:]/;
  public static readonly windowsPathDelimiter: string = ";";
  public static readonly windowsPathQuote: string = "\"";
  public static readonly posixPathDelimiter: string = ":";
  public static readonly batchExtensions: readonly string[] = [".bat", ".cmd"];
  public static readonly commandShellName: string = "cmd.exe";
  public static readonly commandShellArguments: readonly string[] = ["/d", "/s", "/c"];
  public static readonly commandLineSeparator: string = " ";
  public static readonly argumentQuote: string = "\"";
  public static readonly batchMetacharacterPattern: RegExp = /([()\][%!^"`<>&|;, *?])/g;
  public static readonly batchMetacharacterEscape: string = "^$1";
  public static readonly trailingBackslashesPattern: RegExp = /(\\*)$/;
  public static readonly trailingBackslashesReplacement: string = "$1$1";
  public static readonly batchRefusedArgumentPattern: RegExp = /[%"!\r\n\0]/;
  public static readonly nativeProgramExtension: string = ".exe";
  public static readonly nodeProgramName: string = "node.exe";
  public static readonly scriptExtensions: readonly string[] = [".js", ".cjs", ".mjs", String.empty];
  public static readonly shimBlankPattern: RegExp = /[ \t]+/g;
  public static readonly shimHead: readonly string[] = ["@ECHO off", "GOTO start", ":find_dp0", "SET dp0=%~dp0", "EXIT /b", ":start", "SETLOCAL", "CALL :find_dp0"];
  public static readonly shimNodeBody: readonly string[] = [
    String.empty,
    "IF EXIST \"%dp0%\\node.exe\" (",
    " SET \"_prog=%dp0%\\node.exe\"",
    ") ELSE (",
    " SET \"_prog=node\"",
    " SET PATHEXT=%PATHEXT:;.JS;=;%",
    ")",
    String.empty
  ];
  public static readonly shimNodeLinePattern: RegExp = /^endLocal & goto #_undefined_# 2>NUL \|\| title %COMSPEC% & "%_prog%" "%dp0%\\([^"%]+)" %\*$/;
  public static readonly shimOneLinePattern: RegExp = /^@"%~dp0\\([^"%]+)" %\*$/;
  public static readonly shimProgramLinePattern: RegExp = /^"%dp0%\\([^"%]+)" %\*$/;
  public static readonly processStatFile: string = "stat";
  public static readonly processExecutableFile: string = "exe";
  public static readonly processCommandLineFile: string = "cmdline";
  public static readonly processArgumentSeparator: string = String.fromCharCode(0);
  public static readonly processArgumentsEndPattern: RegExp = /\u0000$/u;
  public static readonly processIdListSeparator: string = ",";
  public static readonly unreadableLeaderErrorCodes: readonly string[] = ["EACCES", "EPERM", "ENOENT"];
  public static readonly unreadProgram: readonly [null, null] = [null, null];
  public static readonly processStatFieldSeparator: string = " ";
  public static readonly processNameEnd: string = ")";
  public static readonly processStatFields: readonly number[] = [1, 2, 4, 19];
  public static readonly processStateField: number = 0;
  public static readonly processSessionField: number = 3;
  public static readonly foregroundGroupField: number = 5;
  public static readonly processStatusCommand: string = "/bin/ps";
  public static readonly foregroundGroupArguments: readonly string[] = ["-o", "lstart=,tpgid=", "-p"];
  public static readonly foregroundGroupEnvironment: Readonly<Record<string, string>> = { LC_ALL: "C" };
  public static readonly foregroundGroupTimeoutMilliseconds: number = 1_000;
  public static readonly foregroundGroupStatusPattern: RegExp = /^([A-Z][a-z]{2} [A-Z][a-z]{2} +\d{1,2} \d{2}:\d{2}:\d{2} \d{4}) +(-?\d+)$/;
  public static readonly foregroundProgramArguments: readonly string[] = ["-o", "pid=,comm=", "-p"];
  public static readonly foregroundCommandLineArguments: readonly string[] = ["-o", "pid=,args=", "-p"];
  public static readonly foregroundRowPattern: RegExp = /^ *(\d+) (.*)$/u;
  public static readonly secondMilliseconds: number = 1_000;
  public static readonly processReadBatch: number = 64;
  public static readonly processSkippedCodes: readonly string[] = ["ENOENT", "ESRCH", "EACCES", "EPERM"];
  public static readonly processRowLength: number = 6;
  public static readonly processZombieState: string = "Z";
  public static readonly processDeadState: string = "X";
  public static readonly processEndingGroupId: number = -1;
  public static readonly windowsQueryAccess: number = 0x1000;
  public static readonly windowsEndAccess: number = 0x1000 | 0x0001 | 0x100000;
  public static readonly windowsJobAccess: number = 0x1000 | 0x0100 | 0x0001 | 0x100000;
  public static readonly windowsGoneError: number = 87;
  public static readonly addonFolder: string = "../../native/";
  public static readonly addonTargetSeparator: string = "-";
  public static readonly posixAddonFile: string = "posix-process.node";
  public static readonly startDetachedFunction: "startDetached" = "startDetached";
  public static readonly clockTicksFunction: "clockTicks" = "clockTicks";
  public static readonly windowsAddonFile: string = "windows-process.node";
  public static readonly listProcessesFunction: "listProcesses" = "listProcesses";
  public static readonly openProcessFunction: "openProcess" = "openProcess";
  public static readonly readCreationTimeFunction: "readCreationTime" = "readCreationTime";
  public static readonly readImagePathFunction: "readImagePath" = "readImagePath";
  public static readonly terminateProcessFunction: "terminateProcess" = "terminateProcess";
  public static readonly hasExitedFunction: "hasExited" = "hasExited";
  public static readonly readExitCodeFunction: "readExitCode" = "readExitCode";
  public static readonly openFileForReadingFunction: "openFileForReading" = "openFileForReading";
  public static readonly closeHandleFunction: "closeHandle" = "closeHandle";
  public static readonly createJobFunction: "createJob" = "createJob";
  public static readonly assignProcessToJobFunction: "assignProcessToJob" = "assignProcessToJob";
  public static readonly listJobProcessesFunction: "listJobProcesses" = "listJobProcesses";
  public static readonly verifySignatureFunction: "verifySignatureAsync" = "verifySignatureAsync";
  public static readonly peerProcessIdFunction: "peerProcessId" = "peerProcessId";
  public static readonly peerTokenFunction: "peerToken" = "peerToken";
  public static readonly readProcessPathFunction: "readProcessPath" = "readProcessPath";
  public static readonly readEnvironmentFunction: "readEnvironment" = "readEnvironment";
  public static readonly readVolumeFunction: "readVolume" = "readVolume";
  public static readonly readResponsibleProcessIdFunction: "readResponsibleProcessId" = "readResponsibleProcessId";
  public static readonly disclaimSystemFunction: string = "responsibility_spawnattrs_setdisclaim";
  public static readonly responsibleSystemFunction: string = "responsibility_get_pid_responsible_for_pid";
  public static readonly responsibilityUnreadable: string =
    "macOS gives no way to read this runtime's responsible process, so its start could not hand it responsibility: programs that modules start may ask for privacy permissions in the name of whatever started the app, such as a terminal.";
  public static readonly responsibilityInherited: string =
    "This runtime is not its own responsible process, so its start could not hand it responsibility: programs that modules start ask for privacy permissions in the name of whatever started the app, such as a terminal.";
  public static readonly findTcpOwnerFunction: "findTcpOwner" = "findTcpOwner";
  public static readonly windowsPeerFunctions: readonly (keyof IWindowsPeerAddon)[] = [
    Resources.findTcpOwnerFunction,
    Resources.openProcessFunction,
    Resources.readCreationTimeFunction,
    Resources.readImagePathFunction,
    Resources.readEnvironmentFunction,
    Resources.closeHandleFunction
  ];
  public static readonly windowsReadAccess: number = 0x0400 | 0x0010;
  public static readonly socketHandleField: "_handle" = "_handle";
  public static readonly socketDescriptorField: "fd" = "fd";
  public static readonly environmentFile: string = "environ";
  public static readonly executableLink: string = "exe";
  public static readonly environmentSeparator: string = "\0";
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly descriptorFolder: string = "fd";
  public static readonly mountInfoFile: string = "mountinfo";
  public static readonly ownProcessFolder: string = "self";
  public static readonly processStartField: number = 19;
  public static readonly processStartPattern: RegExp = /^[0-9]+$/u;
  public static readonly mountInfoPattern: RegExp = /^\S+ \S+ ([0-9]+):([0-9]+) .* - \S+ \S+ (\S+)$/u;
  public static readonly mountOptionSeparator: string = ",";
  public static readonly readOnlyOption: string = "ro";
  public static readonly deletedLinkSuffix: string = " (deleted)";
  public static readonly appResourcesFolder: string = "resources";
  public static readonly appArchiveName: string = "app.asar";
  public static readonly deviceMajorLowMask: bigint = 0xfffn;
  public static readonly deviceMinorLowMask: bigint = 0xffn;
  public static readonly deviceMajorLowShift: bigint = 8n;
  public static readonly deviceMajorHighShift: bigint = 32n;
  public static readonly deviceMinorHighShift: bigint = 12n;
  public static readonly programDigestAlgorithm: string = "sha256";
  public static readonly programDigestRanges: number = 8;
  public static readonly programDigestChunkBytes: number = 1 << 20;
  public static readonly senderSeparator: string = ":";
  public static readonly windowsAddonFunctions: readonly (keyof IWindowsProcessAddon)[] = [
    Resources.listProcessesFunction,
    Resources.openProcessFunction,
    Resources.readCreationTimeFunction,
    Resources.readImagePathFunction,
    Resources.terminateProcessFunction,
    Resources.hasExitedFunction,
    Resources.readExitCodeFunction,
    Resources.openFileForReadingFunction,
    Resources.closeHandleFunction,
    Resources.createJobFunction,
    Resources.assignProcessToJobFunction,
    Resources.listJobProcessesFunction,
    Resources.verifySignatureFunction
  ];
  public static readonly signatureStatusField: "status" = "status";
  public static readonly signatureMessageField: "message" = "message";
  public static readonly signatureSubjectField: "subject" = "subject";
  public static readonly windowsProcessRowLength: number = 2;
  public static readonly fileTimeUnitsPerMillisecond: bigint = 10_000n;
  public static readonly fileTimeEpochMilliseconds: number = 11_644_473_600_000;
  public static readonly processGraceMilliseconds: number = 3_000;
  public static readonly processEndMilliseconds: number = 5_000;
  public static readonly processSeenMilliseconds: number = 5_000;
  public static readonly processPollMilliseconds: number = 50;
  public static readonly windowsStartMargin: number = 50;
  public static readonly posixStartMargin: number = 1_000;
  public static readonly clockStepTolerance: number = 1_500;
  public static readonly bootIdFile: string = "/proc/sys/kernel/random/boot_id";
  public static readonly bootToleranceSeconds: number = 60;
  public static readonly terminateSignal: NodeJS.Signals = "SIGTERM";
  public static readonly killSignal: NodeJS.Signals = "SIGKILL";
  public static readonly hangupSignal: NodeJS.Signals = "SIGHUP";
  public static readonly hangupAgainDivisor: number = 3;
  public static readonly terminalName: string = "xterm-256color";
  public static readonly pseudoTerminalAgent: "_agent" = "_agent";
  public static readonly pseudoTerminalOutputWorker: "_conoutSocketWorker" = "_conoutSocketWorker";
  public static readonly pseudoTerminalWorker: "_worker" = "_worker";
  public static readonly pseudoTerminalWorkerStop: "terminate" = "terminate";
  public static readonly pseudoTerminalOutputSocket: "_socket" = "_socket";
  public static readonly pseudoTerminalOutputClose: "destroy" = "destroy";
  public static readonly pseudoTerminalWatchMilliseconds: number = 1_000;
  public static readonly pseudoTerminalReportMilliseconds: number = 1_000;
  public static readonly probeSignal: number = 0;
  public static readonly missingProcessCode: string = "ESRCH";
  public static readonly refusedProcessCode: string = "EPERM";
  public static readonly exitEvent: string = "exit";
  public static readonly pipedOutput: "pipe" = "pipe";
  public static readonly toolsKind: string = "tools";
  public static readonly titleParameterName: string = "title";
  public static readonly riskParameterName: string = "risk";
  public static readonly deadlineParameterName: string = "deadline";
  public static readonly resourceParameterName: string = "resource";
  public static readonly limitsParameterName: string = "limits";
  public static readonly endGraceParameterName: string = "endGraceMilliseconds";
  public static readonly nextToolParameterName: string = "nextTool";
  public static readonly originParameterName: string = "origin";
  public static readonly dataParameterName: string = "data";
  public static readonly mimeTypeParameterName: string = "mimeType";
  public static readonly messageParameterName: string = "message";
  public static readonly scopeParameterName: string = "scope";
  public static readonly inputSchemaParameterName: string = "inputSchema";
  public static readonly outputSchemaParameterName: string = "outputSchema";
  public static readonly textCharactersLimitName: string = "textCharacters";
  public static readonly imageBytesLimitName: string = "imageBytes";
  public static readonly imageLongEdgeLimitName: string = "imageLongEdge";
  public static readonly imagePixelsLimitName: string = "imagePixels";
  public static readonly toolRisks: readonly ToolRisk[] = [ToolRisk.Low, ToolRisk.Medium, ToolRisk.High];
  public static readonly maximumToolDeadline: number = 120_000;
  public static readonly maximumToolArgumentBytes: number = 64 * 1024;
  public static readonly maximumToolTextBytes: number = 256 * 1024;
  public static readonly maximumToolImageBytes: number = 1024 * 1024;
  public static readonly maximumToolResultBytes: number = 2 * 1024 * 1024;
  public static readonly maximumToolCallsInFlight: number = 16;
  public static readonly maximumToolScopeLength: number = 256;
  public static readonly maximumToolOriginLength: number = 1024;
  public static readonly pngMimeType: string = "image/png";
  public static readonly toolImageTypes: readonly string[] = [Resources.pngMimeType, "image/jpeg"];
  public static readonly base64Encoding: BufferEncoding = "base64";
  public static readonly base64Pattern: RegExp = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  public static readonly toolResourcePattern: RegExp = /^(?:binding:[A-Za-z0-9_.-]+|(?:\/(?:[^~/]|~[01])*)+)$/;
  public static readonly moduleCodeNamePattern: RegExp = /^[a-z][a-zA-Z0-9]*$/;
  public static readonly bindingResourcePrefix: string = "binding:";
  public static readonly pointerSeparator: string = "/";
  public static readonly escapedSlash: string = "~1";
  public static readonly escapedTilde: string = "~0";
  public static readonly tilde: string = "~";
  public static readonly pointerIndexPattern: RegExp = /^(?:0|[1-9][0-9]*)$/;
  public static readonly internalFailureCode: string = "internal";
  public static readonly malformedResultCode: string = "malformedResult";
  public static readonly toolTitleInvalid: string = "A tool's title, when it has one, must not be blank.";
  public static readonly toolSchemaInvalid: string = "A tool's schema must be a JSON Schema object whose type is object.";
  public static readonly toolRiskInvalid: string = "A tool's risks must each be Low, Medium or High, and its default risk must not be above its maximum risk.";
  public static readonly toolResourceInvalid: string = "A tool's resource must be a JSON Pointer into its arguments, such as /item_id, or binding:<name>.";
  public static readonly toolTextInvalid: string = "A text item's value must be a string.";
  public static readonly toolOriginInvalid: string = "A content item's origin must not be blank and must have at most 1,024 characters.";
  public static readonly toolImageDataInvalid: string = "An image item's data must be base64.";
  public static readonly toolSessionEnded: string = "The agent session has ended.";
  public static readonly toolArgumentsTooLarge: string = "The call's arguments are over 64 KiB as JSON.";
  public static readonly toolResourceHeld: string = "What the call acts on is held by another agent session.";
  public static readonly toolInternalFailure: string = "The tool failed inside its module.";
  public static readonly toolMalformedResult: string = "The tool's result does not fit its shape or its schema.";
  public static readonly toolResultTooLarge: string = "The tool's result is over its limits.";
  public static readonly toolCancelled: string = "The call was cancelled.";
  public static readonly toolStopped: string = "Agent control was stopped.";
  public static readonly toolTimedOut: string = "The call's deadline passed.";
  public static readonly toolSwitchedOff: string = "The tool was switched off.";
  public static readonly toolWithdrawn: string = "The call was aborted while its permission request waited.";
  public static readonly toolEndGraceMilliseconds: number = 1_000;
  public static readonly toolsStopped: string = "Agent control is stopped until the person resumes it.";
  public static readonly toolEndpointClosed: string = "The tool endpoint is closed.";
  public static readonly toolSessionNotAdmissible: string = "Only an open agent session that the same part opened gets a token.";
  public static readonly toolTokenBytes: number = 32;
  public static readonly toolTokenEncoding: BinaryToTextEncoding = "base64url";
  public static readonly toolTokenDigest: string = "sha256";
  public static readonly toolEndpointHeadersMilliseconds: number = 10_000;
  public static readonly toolEndpointRequestMilliseconds: number = 30_000;
  public static readonly maximumToolEndpointHeaderBytes: number = 16 * 1024;
  public static readonly toolEndpointCheckMilliseconds: number = 1_000;
  public static readonly maximumToolEndpointConnections: number = 64;
  public static readonly bearerScheme: string = "Bearer";
  public static readonly bearerPrefix: string = `${Resources.bearerScheme} `;
  public static readonly authenticateHeader: string = "www-authenticate";
  public static readonly unauthorizedStatus: number = 401;
  public static readonly forbiddenStatus: number = 403;
  public static readonly misdirectedRequestStatus: number = 421;
  public static readonly internalErrorStatus: number = 500;
  public static readonly requestEvent: string = "request";
  public static readonly sessionParameterName: string = "session";
  public static readonly stopReasonInvalid: string = "The reason must be one line that isn't blank, of at most 200 characters.";
  public static readonly maximumStopReasonLength: number = 200;
  public static readonly reasonParameterName: string = "reason";
  public static readonly stopAgentControlMember: string = "stopAgentControl";
  public static readonly stopAgentControlTitle: string = "Stop agents";
  public static readonly stopAgentControlIcon: string = "stop_circle";
  public static readonly resumeAgentControlMember: string = "resumeAgentControl";
  public static readonly resumeAgentControlTitle: string = "Resume agents";
  public static readonly resumeAgentControlIcon: string = "play_circle";
  public static readonly personStoppedAgents: string = "The person stopped agent control.";
  public static readonly permissionWaitMilliseconds: number = 5 * 60_000;
  public static readonly maximumPermissionSubjectLength: number = 1024;
  public static readonly maximumPermissionTitleLength: number = 200;
  public static readonly maximumPermissionDetails: number = 64;
  public static readonly maximumPermissionDetailBytes: number = 80 * 1024;
  public static readonly permissionActionSeparator: string = ".";
  public static readonly permissionActionField: string = "action";
  public static readonly permissionSubjectField: string = "subject";
  public static readonly permissionTitleField: string = "title";
  public static readonly permissionDetailsField: string = "details";
  public static readonly permissionDetailLabelField: string = "label";
  public static readonly permissionDetailKindField: string = "kind";
  public static readonly permissionDetailValueField: string = "value";
  public static readonly permissionRiskField: string = "risk";
  public static readonly permissionIsAskingField: string = "isAsking";
  public static readonly permissionIsRememberedOnlyField: string = "isRememberedOnly";
  public static readonly permissionOptionsField: string = "options";
  public static readonly permissionLabelsField: string = "labels";
  public static readonly permissionOptions: readonly PermissionOption[] =
    [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny, PermissionOption.DenyAlways, PermissionOption.TakeOver];
  public static readonly labelledPermissionOptions: readonly PermissionOption[] = [PermissionOption.AllowAlways, PermissionOption.TakeOver];
  public static readonly alwaysPermissionOptions: readonly PermissionOption[] = [PermissionOption.AllowAlways, PermissionOption.DenyAlways];
  public static readonly maximumPermissionLabelLength: number = 40;
  public static readonly permissionDetailKinds: readonly PermissionDetailKind[] =
    [PermissionDetailKind.Text, PermissionDetailKind.Code, PermissionDetailKind.Secret, PermissionDetailKind.AgentText];
  public static readonly rememberedDecisions: readonly PermissionDecision[] = [PermissionDecision.AllowedAlways, PermissionDecision.DeniedAlways];
  public static readonly offeredDecisions: ReadonlyMap<PermissionDecision, PermissionOption> = new Map([
    [PermissionDecision.AllowedOnce, PermissionOption.AllowOnce],
    [PermissionDecision.AllowedAlways, PermissionOption.AllowAlways],
    [PermissionDecision.DeniedAlways, PermissionOption.DenyAlways],
    [PermissionDecision.TakenOver, PermissionOption.TakeOver]
  ]);
  public static readonly answerableDecisions: readonly PermissionDecision[] = [
    PermissionDecision.AllowedOnce, PermissionDecision.AllowedAlways, PermissionDecision.Denied, PermissionDecision.DeniedAlways, PermissionDecision.Expired,
    PermissionDecision.TakenOver
  ];
  public static readonly permissionSubjectInvalid: string = "The subject, when there is one, must be a string of at most 1,024 characters.";
  public static readonly permissionTitleInvalid: string = "The title must be one line that isn't blank, of at most 200 characters.";
  public static readonly permissionDetailsInvalid: string =
    "The details must be at most 64 items, each with a label that isn't blank, a kind of Text, Code, Secret or AgentText, and a string value, and at most 80 KiB as JSON.";
  public static readonly permissionFlagsInvalid: string = "isAsking and isRememberedOnly, when present, must be true or false.";
  public static readonly permissionOptionsInvalid: string = "The options must be a list of distinct options from AllowOnce, AllowAlways, Deny, DenyAlways and TakeOver, and not empty.";
  public static readonly permissionAlwaysAtHighRisk: string = "A High-risk request that gives labels or offers TakeOver may offer neither AllowAlways nor DenyAlways.";
  public static readonly permissionLabelsInvalid: string =
    "The labels must name only offered AllowAlways or TakeOver options, each one line that isn't blank, of at most 40 characters, and TakeOver must have one.";
  public static readonly permissionNotRaised: string = "A call of a read-only tool whose maximum risk is Low raises no request.";
  public static readonly permissionNoAnswerer: string =
    "No module answers permission requests: the app names none in desktop.product.permissionsModule, or that module registered no answerer.";
  public static readonly permissionAnswererWithdrawn: string = "The module that answers permission requests withdrew its answerer while the request waited.";
  public static readonly permissionAlreadyWaiting: string = "The call already has a permission request waiting.";
  public static readonly permissionCallEnded: string = "The call has already ended.";
  public static readonly permissionsClosed: string = "Noldova Desktop's database is not open.";

  public static formatFolderPrefix(folder: string): string {
    return `${folder}/`;
  }

  public static formatRelativePath(folder: string, name: string): string {
    return `${folder}/${name}`;
  }

  public static formatAddonUrl(platform: string, architecture: string, name: string): string {
    return `${Resources.addonFolder}${platform}${Resources.addonTargetSeparator}${architecture}/${name}`;
  }

  public static formatFirstRequestId(clientName: string): string {
    return `${clientName}${Resources.requestIdSeparator}0`;
  }

  public static formatEitherSource(first: string, second: string): string {
    return `(?:${first}|${second})`;
  }

  public static formatWordsSource(words: string): string {
    return `${Resources.wordStartSource}(?:${words})${Resources.wordEndSource}`;
  }

  public static formatLogLine(time: string, text: string): string {
    return `${time} ${text}`;
  }

  public static formatNodeEvaluateCommand(node: string, script: string): string {
    return `${node} ${Resources.nodeEvaluateArgument} ${script}`;
  }

  public static formatFileKey(device: number | bigint, inode: number | bigint): string {
    return `${device}:${inode}`;
  }

  public static formatFileIdentity(device: number | bigint, inode: number | bigint, size: number | bigint, modified: number | bigint): string {
    return `${device}:${inode}:${size}:${modified}`;
  }

  public static formatFailureLine(failure: string): string {
    return `${failure}${Resources.lineEnd}`;
  }

  public static formatScopeName(name: string, id: string): string {
    return `${name} ${id}`;
  }

  public static formatSettingReport(name: string, scope: string, device: string): string {
    return `${name}\u0000${scope}\u0000${device}`;
  }

  public static formatErrorText(name: string, message: string): string {
    return `${name}: ${message}`;
  }

  public static formatModuleCode(moduleId: string, code: string): string {
    return `${moduleId}.${code}`;
  }

  public static formatModuleOrigin(moduleId: string): string {
    return `${moduleId}:`;
  }

  public static formatUsageFailure(failure: string): string {
    return `${failure}${Resources.lineEnd}${Resources.usage}${Resources.lineEnd}`;
  }

  public static formatDiscoveryVersion(version: unknown): string {
    return `The discovery metadata has the unsupported format version ${String(version)}.`;
  }

  public static formatDiscoveryField(name: string): string {
    return `The discovery metadata's ${name} is missing or invalid.`;
  }

  public static formatDeclarationsVersion(version: unknown): string {
    return `The module declarations have the unsupported format version ${String(version)}.`;
  }

  public static formatDeclarationField(name: string): string {
    return `A module declaration's ${name} is missing or invalid.`;
  }

  public static formatProductFileUnreadable(file: string, reason: string): string {
    return `The build's product file ${file} is not valid: ${reason}`;
  }

  public static formatCheckoutVariable(slug: string): string {
    return `${slug.toUpperCase().replaceAll("-", "_")}_CHECKOUT`;
  }

  public static formatDeclarationsUnreadable(file: string, reason: string): string {
    return `The module declarations ${file} are not valid: ${reason}`;
  }

  public static formatDiscoveryUnreadable(file: string, reason: string): string {
    return `The discovery file ${file} is not valid: ${reason}`;
  }

  public static formatLogFileClosed(file: string): string {
    return `The log ${file} is closed, so the line was not written.`;
  }

  public static formatOwned(productName: string, root: string): string {
    return `Another ${productName} runtime owns the data directory ${root}.`;
  }

  public static formatPreShellData(root: string, entries: readonly string[]): string {
    return `The data directory ${root} holds data from a release before the shell: ${entries.join(", ")}.`;
  }

  public static formatMigrationFailed(database: string, id: string): string {
    return `The migration ${id} of the ${database} failed and was rolled back.`;
  }

  public static formatHistoryNotRecognized(database: string): string {
    return `The ${database}'s migration history is not one this build recognizes.`;
  }

  public static formatHistoryNewer(database: string): string {
    return `The ${database} was written by a newer build.`;
  }

  public static formatTablesWithoutHistory(database: string): string {
    return `The ${database} has tables but no migration history.`;
  }

  public static formatModuleDatabaseName(moduleId: string): string {
    return `database of the module ${moduleId}`;
  }

  public static formatNoModuleDatabase(moduleId: string): string {
    return `The module ${moduleId} has no database, because its runtime part declares no migrations.`;
  }

  public static formatModuleIdDevice(moduleId: string): string {
    return `The module id "${moduleId}" names a device on Windows, so it is refused on every platform.`;
  }

  public static formatAccessGrant(securityIdentifier: string): string {
    return `*${securityIdentifier}:(OI)(CI)F`;
  }

  public static formatFolderNotPrivate(folder: string, access: string): string {
    return `The folder ${folder} is still open to others: ${access}`;
  }

  public static formatOwnershipIgnored(volume: string): string {
    return `the volume ${volume} is mounted with ownership ignored, so every account acts as the owner of its files`;
  }

  public static formatCommandFailed(command: string, output: string): string {
    return `${command} failed: ${output}`;
  }

  public static formatForegroundGroupUnreadable(processId: number, text: string): string {
    return `The foreground process group of process ${processId}'s terminal could not be read from: ${text}`;
  }

  public static formatIdentityUnreadable(output: string): string {
    return `The current user's security identifier could not be read from: ${output}`;
  }

  public static formatBackupName(owner: string, position: number, timestamp: string): string {
    return `${Resources.formatBackupSeries(owner)}${position}-${timestamp}${Resources.backupExtension}`;
  }

  public static formatUpdateBackupName(owner: string, timestamp: string): string {
    return `${Resources.formatUpdateBackupSeries(owner)}${timestamp}${Resources.backupExtension}`;
  }

  public static formatBackupSeries(owner: string): string {
    return `${owner}${Resources.backupInfix}`;
  }

  public static formatUpdateBackupSeries(owner: string): string {
    return `${owner}${Resources.updateBackupInfix}`;
  }

  public static formatMovedFolderName(root: string, timestamp: string): string {
    return `${root}${Resources.movedFolderInfix}${timestamp}`;
  }

  public static formatTimestamp(moment: Date): string {
    return moment.toISOString().replace(Resources.timestampSeparatorPattern, String.empty);
  }

  public static formatTemporaryName(fileName: string, unique: string): string {
    return `${fileName}.${unique}${Resources.temporarySuffix}`;
  }

  public static formatEndpointInvalid(productName: string, text: string): string {
    return `"${text}" is not a ${productName} endpoint.`;
  }

  public static formatSocketPathTooLong(socketPath: string): string {
    return `The local socket path "${socketPath}" exceeds ${Resources.maximumSocketPathLength} bytes; use a data directory with a shorter path.`;
  }

  public static formatCommandRegistered(name: string): string {
    return `The command ${name} is already registered.`;
  }

  public static formatNotificationKindChanged(id: string, kind: string): string {
    return `Notification ${id} is of the kind ${kind}, which an update keeps.`;
  }

  public static formatNotificationModuleInactive(moduleId: string, kind: string): string {
    return `The notification kind ${kind} belongs to ${moduleId}, which is not an active module.`;
  }

  public static formatNotificationCommandNotAllowed(moduleId: string, command: string): string {
    return `The module ${moduleId} may not offer the command ${command} in a notification; it must be its own or a dependency's.`;
  }

  public static formatShellNotificationUnknown(kind: string): string {
    return `The shell posts no notification of the kind ${kind}.`;
  }

  public static formatShellNotificationCommand(kind: string): string {
    return `The shell's notification kind ${kind} offers no command.`;
  }

  public static formatShellNotificationModuleCommand(kind: string, command: string): string {
    return `The shell's notification kind ${kind} runs only the shell's commands, not ${command}.`;
  }

  public static formatCommandNotEnabled(name: string): string {
    return `The command ${name} is not enabled now.`;
  }

  public static formatCommandNotFound(name: string): string {
    return `The command ${name} is not registered; its module may not be active.`;
  }

  public static formatMethodRegistered(name: string): string {
    return `The method ${name} is already registered.`;
  }

  public static formatEventDeclared(name: string): string {
    return `The event ${name} is already declared.`;
  }

  public static formatServicePublished(name: string): string {
    return `The service ${name} is already published.`;
  }

  public static formatSettingUnknown(name: string): string {
    return `No setting named ${name} is declared.`;
  }

  public static formatSettingValueInvalid(name: string): string {
    return `The value is not one the setting ${name} accepts.`;
  }

  public static formatSettingNeedsDevice(name: string): string {
    return `The setting ${name} is kept per device and needs a device.`;
  }

  public static formatSettingScopeNotAllowed(name: string, scope: string): string {
    return `The setting ${name} does not list the scope ${scope}.`;
  }

  public static formatSettingNotReadable(moduleId: string, name: string): string {
    return `The module ${moduleId} may only read its own settings, its dependencies' and the shell's, not ${name}.`;
  }

  public static formatSettingNotWritable(moduleId: string, name: string): string {
    return `The module ${moduleId} may only change its own settings, not ${name}.`;
  }

  public static formatSettingScopeNotOwned(moduleId: string, scope: string): string {
    return `The module ${moduleId} may only describe the scopes it declares, its dependencies' as parents, not ${scope}.`;
  }

  public static formatSettingValueIgnored(name: string, scope: string, device: string): string {
    return `The stored value of the setting ${name} for the scope "${scope}" and device "${device}" no longer fits its definition; it is kept and ignored.\n`;
  }

  public static formatNoldovaDesktopInvalid(moduleId: string): string {
    return `The module ${moduleId} must name the Noldova Desktop versions it accepts as >=<lowest version> <first version refused>, with the lowest below the first refused.`;
  }

  public static formatPlatformsInvalid(moduleId: string): string {
    return `The module ${moduleId} must list its platforms once each as windows, macos or linux, with at least one.`;
  }

  public static formatSwitchSettingInvalid(moduleId: string, name: string): string {
    return `The module ${moduleId} names ${name} as its switch setting, which must be one of its own Boolean settings with the locality Shared and no scopes.`;
  }

  public static formatSettingOwnerInvalid(moduleId: string, name: string): string {
    return `The module ${moduleId} declares the setting ${name}, which it does not own.`;
  }

  public static formatSettingCommandUnknown(moduleId: string, name: string, command: string): string {
    return `The module ${moduleId} declares the action setting ${name}, whose command ${command} it does not declare.`;
  }

  public static formatSettingKindReserved(moduleId: string, name: string, kind: string): string {
    return `The module ${moduleId} declares the setting ${name} of the kind ${kind}, which only the shell declares.`;
  }

  public static formatSettingPageReserved(moduleId: string, name: string, page: string): string {
    return `The module ${moduleId} puts the setting ${name} on the page ${page}, which only the shell fills.`;
  }

  public static formatNotContributed(moduleId: string, kind: string, name: string): string {
    return `The module ${moduleId} does not declare ${name} among its ${kind}.`;
  }

  public static formatServiceNotOwned(moduleId: string, name: string): string {
    return `The module ${moduleId} may publish services only under its own id, not ${name}.`;
  }

  public static formatServiceNotAllowed(moduleId: string, name: string): string {
    return `The module ${moduleId} may use only the shell's services and those of the modules it depends on, not ${name}.`;
  }

  public static formatServiceMissing(name: string): string {
    return `No service ${name} is published.`;
  }

  public static formatServiceType(name: string, type: string): string {
    return `The service ${name} is not a ${type}.`;
  }

  public static formatServiceRefused(name: string): string {
    return `The service ${name} is not what its check expects, so the module goes without it.`;
  }

  public static formatDependencyListenerFailed(moduleId: string, detail: string): string {
    return `Its listener for a change of ${moduleId} failed:\n${detail}`;
  }

  public static formatOptionalDependencyUnavailable(moduleId: string, version: string, dependency: string, reason: string): string {
    return `The module ${moduleId} ${version} runs without its optional dependency ${dependency}: ${reason}\n`;
  }

  public static formatOptionalDependencyInactive(state: string): string {
    return `it is ${state.toLowerCase()}.`;
  }

  public static formatOptionalDependencyOtherVersion(dependency: string, version: string, needed: string): string {
    return `it needs ${dependency} ${needed}, and the app has ${dependency} ${version}.`;
  }

  public static formatModuleDiagnostic(moduleId: string, version: string, cause: string, detail: string): string {
    return `The module ${moduleId} ${version}: ${cause}\n${detail}\n`;
  }

  public static formatModuleLogLine(moduleId: string, line: string): string {
    return `${moduleId}: ${line}\n`;
  }

  public static formatModuleBlocked(dependency: string): string {
    return `It depends on ${dependency}, which is not active.`;
  }

  public static formatModuleBlockedOff(dependency: string): string {
    return `It depends on ${dependency}, which is off.`;
  }

  public static formatModuleUnavailable(platformName: string): string {
    return `It doesn't run on ${platformName}.`;
  }

  public static formatModuleOutsideNoldovaDesktop(range: string, version: string | null): string {
    return `It accepts Noldova Desktop ${range}, but this app has ${Object.isNull(version) ? "no Noldova Desktop version in its module declarations" : `Noldova Desktop ${version}`}.`;
  }

  public static formatModuleRefused(moduleId: string, version: string, cause: string): string {
    return `The module ${moduleId} ${version} doesn't start: ${cause}\n`;
  }

  public static formatModuleBlockedUnavailable(dependency: string, platformName: string): string {
    return `It depends on ${dependency}, which doesn't run on ${platformName}.`;
  }

  public static formatModuleOtherVersion(dependency: string, version: string, needed: string): string {
    return `It depends on ${dependency} ${needed}, and the app has ${dependency} ${version}.`;
  }

  public static formatEventWithdrawn(name: string): string {
    return `The event ${name} is no longer declared.`;
  }

  public static formatEventNotSent(name: string, reason: string): string {
    return `The runtime sent the event ${name} to no client: ${reason}\n`;
  }

  public static formatRequestFailed(method: string, reason: string): string {
    return `The runtime failed to handle a ${method} request: ${reason}\n`;
  }

  public static formatWebViewFailed(kind: string): string {
    return `The web view call failed: ${kind}.`;
  }

  public static formatWebViewsNotListed(moduleId: string, reason: string): string {
    return `The runtime could not list the web views of the module ${moduleId}: ${reason}\n`;
  }

  public static formatSecretsNeedApp(productName: string): string {
    return `Open ${productName} to use secrets on this machine: only its main process reaches this machine's secret store.`;
  }

  public static formatSecretsUnprotected(productName: string): string {
    return `This machine has no secret store that ${productName} can keep a secret in safely, such as a keyring on Linux, so nothing was saved.`;
  }

  public static formatSecretUnreadable(productName: string, name: string): string {
    return `This machine has no secret store that ${productName} can read the secret ${name} from safely, such as a keyring on Linux, so it was not read.`;
  }

  public static formatSecretsNoDevice(productName: string): string {
    return `${productName}'s main process has no device identity for this machine, so it can't keep secrets.`;
  }

  public static formatSecretUndecryptable(name: string): string {
    return `This machine's secret store can't decrypt the secret ${name}; save it again.`;
  }

  public static formatSecretNotOwn(moduleId: string, name: string): string {
    return `The module ${moduleId} may only use its own secrets, not ${name}.`;
  }

  public static formatWebViewEventNotHeard(moduleId: string, reason: string): string {
    return `A listener of the module ${moduleId} failed to hear a web view event: ${reason}\n`;
  }

  public static formatAppSurfaceNotHeard(list: string, reason: string): string {
    return `A part failed to hear that the app's ${list} changed: ${reason}\n`;
  }

  public static formatClosureNotHeard(connection: number, window: number | null, reason: string): string {
    const closed = Object.isNull(window) ? `connection ${connection}` : `window ${window} of connection ${connection}`;
    return `A part failed to hear that ${closed} closed: ${reason}\n`;
  }

  public static formatWindowClosed(window: number): string {
    return `Window ${window} of this connection has closed, so the runtime takes no more requests from it.`;
  }

  public static formatUnknownMethod(name: string): string {
    return `The method ${name} is not registered.`;
  }

  public static formatDuplicateRequest(id: string): string {
    return `A request with the id ${id} is already running on this connection.`;
  }

  public static formatNoAnswer(method: string): string {
    return `The runtime did not answer ${method} in time.`;
  }

  public static formatUnreachable(endpoint: string): string {
    return `The runtime at ${endpoint} cannot be reached.`;
  }

  public static formatHandover(productName: string, productVersion: string, executablePath: string): string {
    return `${productName} ${productVersion} at ${executablePath} owns this data directory and is newer; open that ${productName} instead.`;
  }

  public static formatNoRuntime(root: string): string {
    return `No runtime is running for ${root}.`;
  }

  public static formatUpdating(productName: string): string {
    return `${productName} is preparing to install an update.`;
  }

  public static formatQuitKept(productName: string): string {
    return `${productName} stayed open: it was kept open while work was in progress.`;
  }

  public static formatQuitSaveFailed(productName: string): string {
    return `${productName} stayed open: a window could not save.`;
  }

  public static formatQuitUnanswered(productName: string): string {
    return `${productName} did not say whether it quit: its main process's connection ended before it answered.`;
  }

  public static formatQuitInterrupted(productName: string): string {
    return `${productName} did not say whether it quit: its runtime stopped before the main process answered.`;
  }

  public static formatClientNotAnswered(client: string): string {
    return `A ${client} client did not answer in time.`;
  }

  public static formatUpdateInProgress(productName: string): string {
    return `${productName} is installing an update.`;
  }

  public static formatUpdateUnfinished(productName: string): string {
    return `An update of ${productName} may still be installing, or it did not finish. Open ${productName} to settle it.`;
  }

  public static formatBuildMismatch(productName: string, productVersion: string, executablePath: string): string {
    return `${productName} ${productVersion} at ${executablePath} owns this data directory; it is another build, and taking it over was not asked for.`;
  }

  public static formatWorkInProgress(descriptions: readonly string[]): string {
    return `Work is in progress: ${descriptions.join("; ")}.`;
  }

  public static formatProductVersionInvalid(version: string): string {
    return `"${version}" is not a product version of the form major.minor.patch.`;
  }

  public static formatStopRefused(message: string): string {
    return `The other build's runtime refused to stop: ${message}`;
  }

  public static formatRuntimeExited(reason: string): string {
    return `The runtime exited while starting: ${reason}`;
  }

  public static formatFolderWatchFallback(folder: string, interval: number, reason: string): string {
    return `The folder ${folder} could not be watched for changes, so the launcher checks it every ${interval} ms instead: ${reason}`;
  }

  public static formatLaunchLimitReached(milliseconds: number): string {
    return `A runtime held the data directory but was not reachable within ${milliseconds / 1000} s.`;
  }

  public static formatStartLogNameInvalid(name: string): string {
    return `"${name}" is not the name of a start log.`;
  }

  public static formatRuntimeLogUnavailable(reason: string): string {
    return `The runtime's log could not be written, so it is no longer written to: ${reason}`;
  }

  public static formatErrorsCapFailed(reason: string): string {
    return `The standard error's size could not be checked: ${reason}\n`;
  }

  public static formatCopyMountFailed(image: string, reason: string): string {
    return `${image} could not be mounted, so the runtime starts from an extraction of it: ${reason}\n`;
  }

  public static formatCopyNotMounted(image: string): string {
    return `${image} could not be mounted, so the runtime starts from an extraction of it.\n`;
  }

  public static formatCopyUnavailable(image: string): string {
    return `${image} could be neither mounted nor extracted, so the runtime cannot start.`;
  }

  public static formatCopyProcessUnlisted(processId: number): string {
    return `The process table does not list process ${processId}, so the runtime's AppImage copy cannot be recorded.`;
  }

  public static formatCopyNotEnded(record: string, reason: string): string {
    return `The runtime could not end the AppImage copy recorded in ${record}, so the record is left: ${reason}\n`;
  }

  public static formatLeftoversNotChecked(folder: string, reason: string): string {
    return `The runtime could not check ${folder} for an interrupted backup's files, so it left them: ${reason}\n`;
  }

  public static formatUnreadableFolderName(file: string, timestamp: string): string {
    return `${file}${Resources.unreadableFolderInfix}${timestamp}`;
  }

  public static formatUnreadableDatabaseMoved(file: string, folder: string): string {
    return `The database ${file} had no first page SQLite could read, so the runtime moved it, with its log if it had one, to ${folder} and created it anew.\n`;
  }

  public static formatNewDatabaseNotFlushed(file: string, reason: string): string {
    return `The runtime could not flush the new database ${file} to disk in the background, so its first write flushes it: ${reason}\n`;
  }

  public static formatLeftoverNotRemoved(file: string, reason: string): string {
    return `The runtime could not remove the interrupted backup's file ${file}, so it is left: ${reason}\n`;
  }

  public static formatOlderBackupsNotChecked(folder: string, reason: string): string {
    return `The runtime could not check ${folder} for older backups, so it kept them: ${reason}\n`;
  }

  public static formatOlderBackupNotRemoved(file: string, reason: string): string {
    return `The runtime could not remove the older backup ${file}, so it is kept: ${reason}\n`;
  }

  public static formatModuleFolderSkipped(folder: string): string {
    return `The update backup skipped ${folder}, since its name is no module's id.\n`;
  }

  public static formatAddonIncomplete(name: string): string {
    return `The runtime's addon native/${name} lacks functions this runtime calls; it comes from another build.`;
  }

  public static formatAddonMissing(target: string, file: string): string {
    return `The runtime has no ${target} build of its addon ${file}: native/${target}/${file} is missing.`;
  }

  public static formatAddonLoadFailed(name: string): string {
    return `The runtime could not load its addon native/${name}.`;
  }

  public static formatAddonUnexpected(name: string): string {
    return `The runtime's addon native/${name} returned a value this runtime does not expect; it comes from another build.`;
  }

  public static formatCopyRecordName(unique: string): string {
    return `${Resources.copyRecordPrefix}${unique}${Resources.startLogExtension}`;
  }

  public static formatStartLogName(unique: string): string {
    return `${Resources.startLogPrefix}${unique}${Resources.startLogExtension}`;
  }

  public static formatStartFailed(executable: string): string {
    return `The program ${executable} could not be started.`;
  }

  public static formatArgumentWithoutValue(name: string): string {
    return `The argument ${name} needs a value.`;
  }

  public static formatPreShellFound(productName: string, location: string): string {
    return `The data directory ${location} holds data from a ${productName} release that predates the shell.`;
  }

  public static formatMoveAsideFailed(message: string): string {
    return `The runtime could not move the old data aside: ${message}`;
  }

  public static formatArgumentInvalid(name: string, value: string): string {
    return `The argument ${name} ${value} is not valid.`;
  }

  public static formatEnvironmentNameInvalid(name: string): string {
    return `${JSON.stringify(name)} is not an environment variable's name.`;
  }

  public static formatOwnFileChanged(file: string): string {
    return `The runtime's own ${file} changed since the runtime read its device and inode.`;
  }

  public static formatProgramNotFound(program: string): string {
    return `${program} was not found, or it is not a program that can be run.`;
  }

  public static formatProgramPathRelative(program: string): string {
    return `${program} is neither a program's name nor an absolute path.`;
  }

  public static formatProcessStartFailed(program: string): string {
    return `${program} could not be started.`;
  }

  public static formatBatchArgumentRefused(program: string): string {
    return `${program} is a batch file whose program could not be traced, and cmd.exe cannot be given an argument that holds %, ", !, a line break or a NUL character.`;
  }

  public static formatProcessTableRowUnreadable(row: string): string {
    return `The process table has a row that could not be read: ${row}`;
  }

  public static formatTerminalNotAbandoned(error: string): string {
    return `Its pseudo-terminal did not start, and it could not be fully ended: ${error}`;
  }

  public static formatExitCodeUnread(error: string): string {
    return `The program ended, but neither its pseudo-terminal library nor Windows gave its exit code, so it ended without a code: ${error}`;
  }

  public static formatExitWaitTimedOut(processId: number, milliseconds: number): string {
    return `Process ${processId} was still running ${milliseconds} ms after its output closed, so its exit code could not be read.`;
  }

  public static formatExitCodeUnreadable(processId: number): string {
    return `Windows gave no exit code for process ${processId}.`;
  }

  public static formatNoJobForExitCode(processId: number): string {
    return `Process ${processId} is in no job of the runtime's, so Windows wasn't asked for its exit code.`;
  }

  public static formatJobClosedBeforeExit(processId: number): string {
    return `The job of process ${processId} closed before its exit code was read.`;
  }

  public static formatJobAssignmentFailed(processId: number, error: number): string {
    return `Process ${processId} could not be put in a job of its own, with Windows error ${error}, so what it starts is found only by its parent.`;
  }

  public static formatProcessesForced(processIds: readonly number[]): string {
    return `It did not end within the grace period, so processes ${processIds.join(", ")} were ended forcefully.`;
  }

  public static formatProcessesRemaining(processIds: readonly number[]): string {
    return `Processes ${processIds.join(", ")} were still running after they were ended forcefully.`;
  }

  public static formatLeftoversEnded(processIds: readonly number[]): string {
    return `An earlier runtime left processes ${processIds.join(", ")} running, so they were ended.`;
  }

  public static formatJobsNotHungUp(failure: string): string {
    return `Its jobs could not all be hung up after it ended: ${failure}`;
  }

  public static formatProcessesLeft(processIds: readonly number[]): string {
    return `It was no longer running, and nothing showed that processes ${processIds.join(", ")} were what it started, so they were left running.`;
  }

  public static formatVerbatimBatchRefused(program: string): string {
    return `${program} is a batch file, and a process request passes its arguments as they are only to a program that isn't one; give cmd.exe the batch file in its arguments instead.`;
  }

  public static formatPseudoTerminalCommandLineRefused(program: string): string {
    return `${program} was given a command line to pass as it is, which a pseudo-terminal takes only on Windows.`;
  }

  public static formatPseudoTerminalCommandLineWithArguments(program: string): string {
    return `${program} was given both a command line to pass as it is and arguments, and a pseudo-terminal takes one or the other.`;
  }

  public static formatPseudoTerminalCommandLineBatchRefused(program: string): string {
    return `${program} is a batch file, and a pseudo-terminal passes a command line as it is only to a program that isn't one; give cmd.exe the batch file in its command line instead.`;
  }

  public static formatPseudoTerminalBatchRefused(program: string): string {
    return `${program} is a batch file whose program could not be traced, and a pseudo-terminal starts no batch file through cmd.exe.`;
  }

  public static formatPseudoTerminalsUndeclared(moduleId: string, program: string): string {
    return `${program} was not started, because the module ${moduleId} does not declare pseudoTerminals.`;
  }

  public static formatSocketMemberMissing(...members: readonly string[]): string {
    return `The connection's socket has no ${members.join(Resources.memberSeparator)}, so the runtime cannot tell which process is on its other end. The Node.js version may have changed how it keeps it.`;
  }

  public static formatPseudoTerminalMemberMissing(...members: readonly string[]): string {
    return `The pseudo-terminal library has no ${members.join(Resources.memberSeparator)}, so the runtime cannot stop or close its output. Its version may have changed how it keeps it.`;
  }

  public static formatModuleDeactivated(moduleId: string): string {
    return `The module ${moduleId} has deactivated, so it opens no new tool session.`;
  }

  public static formatModuleStopping(moduleId: string, program: string): string {
    return `${program} was not started, because the module ${moduleId} is stopping.`;
  }

  public static formatUpdatePreparing(moduleId: string, program: string): string {
    return `${program} was not started for the module ${moduleId}, because the runtime is preparing for an update.`;
  }

  public static formatProcessDiagnostic(moduleId: string, program: string, processId: number, text: string): string {
    return `The module ${moduleId}'s program ${program} (process ${processId}): ${text}\n`;
  }

  public static formatToolDeadlineRange(maximum: number): string {
    return `A tool's deadline needs a whole default of at least 1 ms, within a maximum of at most ${maximum} ms.`;
  }

  public static formatToolLimitInvalid(name: string, ceiling: number): string {
    return `A tool's ${name} limit must be a whole number from 1 to ${ceiling}.`;
  }

  public static formatToolNextToolInvalid(name: string): string {
    return `The tool ${name} must name, as nextTool, one of its module's declared tools, and it needs one unless it is read-only or resumable.`;
  }

  public static formatToolImageType(mimeType: string): string {
    return `An image item must be image/png or image/jpeg, not ${mimeType}.`;
  }

  public static formatToolRegistered(name: string): string {
    return `The tool ${name} is already registered.`;
  }

  public static formatToolScopeTooLong(maximum: number): string {
    return `An agent session's scope must have at most ${maximum} characters.`;
  }

  public static formatToolEndpointHost(port: number): string {
    return `${Resources.loopbackHost}:${port}`;
  }

  public static formatToolEndpointUrl(port: number): string {
    return `http://${Resources.formatToolEndpointHost(port)}/`;
  }

  public static formatToolEndpointValue(type: string): string {
    return `a value of type ${type}, not an error`;
  }

  public static formatToolEndpointFailed(error: string): string {
    return `The tool endpoint's handler failed: ${error}`;
  }

  public static formatToolUnavailable(name: string): string {
    return `The tool ${name} is not registered.`;
  }

  public static formatToolClosed(name: string): string {
    return `The tool ${name} is not available while its module turns off.`;
  }

  public static formatToolCallsInFlight(maximum: number): string {
    return `The agent session already has ${maximum} calls in flight.`;
  }

  public static formatToolDeadlineInvalid(maximum: number): string {
    return `The call's deadline must be a whole number of milliseconds from 1 to ${maximum}.`;
  }

  public static formatToolResourceMissing(resource: string): string {
    return `The call has nothing at ${resource}, which the tool takes turns on.`;
  }

  public static formatToolSchemaKeywordUnsupported(path: string): string {
    return `The schema keyword at ${path} is not one the tool registry checks.`;
  }

  public static formatToolSchemaKeywordInvalid(path: string): string {
    return `The schema keyword at ${path} has a value the tool registry cannot use.`;
  }

  public static formatToolSchemaNotObject(path: string): string {
    return `The schema at ${path} must be a JSON object.`;
  }

  public static formatToolValueMismatch(path: string, keyword: string): string {
    return String.isNullOrWhitespace(path) ? `The value does not fit the schema's ${keyword}.` : `The value at ${path} does not fit the schema's ${keyword}.`;
  }

  public static formatToolHandlerFailed(name: string, detail: string): string {
    return `The tool ${name} failed: ${detail}`;
  }

  public static formatToolFailureCause(name: string, message: string, detail: string): string {
    return `The tool ${name} failed with "${message}", caused by: ${detail}`;
  }

  public static formatToolFailureUnwritable(name: string): string {
    return `The tool ${name} failed, and what it failed with could not be written to the log.`;
  }

  public static formatToolFailedLate(name: string, detail: string): string {
    return `The tool ${name} failed after its call had ended: ${detail}`;
  }

  public static formatAgentControlListenerFailed(detail: string): string {
    return `A listener for stopped or resumed agent control failed: ${detail}`;
  }

  public static formatResumeNotFromApp(client: string): string {
    return `Only the app's window and tray resume agent control; the client ${client} can't.`;
  }

  public static formatSessionStopRefused(moduleId: string): string {
    return `The module ${moduleId} can't stop an agent session's turn while agent control or a session stops; only a command the person runs stops it.`;
  }

  public static formatResumeRefused(moduleId: string): string {
    return `The module ${moduleId} can't resume agent control while it stops or while one of its tool calls runs, even past its abort; only a command the person runs resumes it.`;
  }

  public static formatToolSessionListenerFailed(detail: string): string {
    return `A listener for ended agent sessions failed: ${detail}`;
  }

  public static formatPermissionRiskUnreadable(name: string): string {
    return `A permission request of the tool ${name} has a risk that could not be read, so it counts as high.`;
  }

  public static formatPermissionDenied(action: string, reason: string): string {
    return `The permission request for ${action} was denied: ${reason}`;
  }

  public static formatPermissionActionInvalid(module: string): string {
    return `The action must be ${module}, a dot and a camelCase name.`;
  }

  public static formatPermissionRiskInvalid(maximum: ToolRisk): string {
    return `The risk must be Low, Medium or High, and at most the tool's maximum risk, ${maximum}.`;
  }

  public static formatPermissionUnreadable(detail: string): string {
    return `The request could not be read: ${detail}`;
  }

  public static formatPermissionAnswerInvalid(action: string, decision: string): string {
    return `The answerer's decision ${decision} for ${action} is not one the request offers, so the request is denied.`;
  }

  public static formatPermissionAnswererFailed(action: string, detail: string): string {
    return `The answerer failed for ${action}, so the request is denied: ${detail}`;
  }

  public static formatPermissionReadFailed(action: string, detail: string): string {
    return `A remembered answer for ${action} could not be read, so the answerer decides: ${detail}`;
  }

  public static formatPermissionKeepFailed(action: string, detail: string): string {
    return `The answer for ${action} could not be remembered, so it holds for this call only: ${detail}`;
  }

  public static formatPermissionRevokedListenerFailed(detail: string): string {
    return `A listener for revoked permission answers failed: ${detail}`;
  }

  public static formatPermissionsModuleOnly(module: string): string {
    return `The module ${module} cannot answer permission requests or manage remembered answers; only the module the app names in desktop.product.permissionsModule can.`;
  }

  public static formatAnswererRegistered(module: string): string {
    return `The module ${module} already registered an answerer for permission requests.`;
  }

  public static formatReadWindowState(kind: WindowStateKind): string {
    const column = Resources.windowStateColumns[kind];
    return `SELECT ${column} AS value FROM window_states WHERE device = ? AND window = ?`;
  }

  public static formatWriteWindowState(kind: WindowStateKind): string {
    const column = Resources.windowStateColumns[kind];
    return `INSERT INTO window_states (device, window, ${column}) VALUES (?, ?, ?) ON CONFLICT (device, window) DO UPDATE SET ${column} = excluded.${column}`;
  }
}

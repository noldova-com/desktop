/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

/// <reference types="node" />

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { EventEmitter } from "node:events";
import type { BigIntStats, RmOptions } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import type { DatabaseSync, SQLInputValue, SQLOutputValue, StatementResultingChanges } from "node:sqlite";
import type { Readable, Writable } from "node:stream";

import { type ArgumentException, type ArgumentOutOfRangeException, Exception, type ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type {
  AppShortcut, AppShortcutList, AppWindow, AppWindowList, BuildIdentity, CommandInfo, CommandList, Event, Failure, FailureCode, FileGrant, KeyChord, MainWindow, ModuleStatus, ModuleStatusList, Notification, NotificationList, NotificationPost, PreShellData, ProgramStatus, ProgramStatusList, QualifiedName, Response,
  RunningWork, RuntimeHandover, SettingChange, SettingDefinition, SettingEntry, SettingKey, SettingScope, SettingValue, SettingsSnapshot, StopPolicy, UpdateProcess, WebViewAction,
  WebViewAnswered, WebViewBlockedPorts, WebViewDeclaration, WebViewEvent, WebViewEvents, WebViewFailure, WebViewInfo, WebViewNavigation, WorkReport
} from "@noldova/desktop.protocol";

/**
 * What a data directory holds, judged from its top-level entries other than the
 * shell's own (the ownership database and the discovery, backups, main process,
 * modules, work, logs and staged folders) and from the entries of its `backups` folder
 * other than the shell's own backups.
 */
export declare enum DataDirectoryState {
  /**
   * The directory is missing or holds nothing but the shell's own entries and
   * backups.
   */
  Empty = "Empty",

  /**
   * The directory holds the shell's database, so it uses the current layout.
   */
  Current = "Current",

  /**
   * The directory holds other entries, at its top level or in its `backups`
   * folder, but no shell database: data written by a release that predates the
   * shell.
   */
  PreShell = "PreShell"
}

/**
 * The exception every exception of the runtime package extends, so that a
 * caller can catch any failure the package raises in one place.
 */
export declare class RuntimeException extends Exception {
  /**
   * Creates the exception.
   *
   * @param message What failed.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { RuntimeException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new RuntimeException("The runtime could not finish the request.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a database backup fails its integrity check, or
 * the copy cannot be opened to check it. The copy is never published.
 */
export declare class BackupVerificationException extends RuntimeException {
  /**
   * Creates the exception.
   *
   * @param options The failure that prevented the check, if any.
   * @example
   * ```ts
   * import { BackupVerificationException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new BackupVerificationException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when another process already owns a data directory.
 */
export declare class DataDirectoryOwnedException extends RuntimeException {
  /**
   * The absolute path of the data directory another process owns.
   */
  public readonly root: string;

  /**
   * Creates the exception.
   *
   * @param root The absolute path of the owned data directory.
   * @param options The SQLite failure that reported the ownership, if any.
   * @example
   * ```ts
   * import { DataDirectoryOwnedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DataDirectoryOwnedException("/home/person/.noldova/desktop");
   * }
   * ```
   */
  public constructor(root: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a line is given to a log after it was closed, so the line is refused rather than lost
 * without a trace.
 */
export declare class LogFileClosedException extends RuntimeException {
  /**
   * The absolute path of the closed log.
   */
  public readonly file: string;

  /**
   * Creates the exception.
   *
   * @param file The absolute path of the closed log.
   * @example
   * ```ts
   * import { LogFileClosedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new LogFileClosedException("/data/logs/app.log");
   * }
   * ```
   */
  public constructor(file: string);
}

/**
 * The category of the exceptions thrown when discovery metadata is malformed or has an
 * unsupported format version: {@link DiscoveryUnreadableException},
 * {@link DiscoveryVersionUnsupportedException}, {@link DiscoveryNotObjectException} and
 * {@link DiscoveryFieldInvalidException}. Catch it to handle any of them.
 */
export declare abstract class DiscoveryFormatException extends RuntimeException {
  /**
   * Creates the exception, for a subclass.
   *
   * @param message What is wrong with the metadata.
   * @param options The failure that caused it, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the discovery file is not valid JSON or not valid
 * metadata. Its message names the file and ends with the cause's text.
 */
export declare class DiscoveryUnreadableException extends DiscoveryFormatException {
  /**
   * The discovery file.
   */
  public readonly file: string;

  /**
   * Creates the exception.
   *
   * @param file The discovery file.
   * @param cause The failure that made it unreadable; it becomes the exception's cause.
   * @example
   * ```ts
   * import { DiscoveryUnreadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(error: unknown): never {
   *   throw new DiscoveryUnreadableException("/home/person/.noldova/desktop/runtime.json", error);
   * }
   * ```
   */
  public constructor(file: string, cause: unknown);
}

/**
 * The exception thrown when discovery metadata has a format version this build does not read.
 */
export declare class DiscoveryVersionUnsupportedException extends DiscoveryFormatException {
  /**
   * The format version the metadata has, `undefined` when it has none.
   */
  public readonly version: unknown;

  /**
   * Creates the exception.
   *
   * @param version The format version the metadata has, `undefined` when it has none.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { DiscoveryVersionUnsupportedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DiscoveryVersionUnsupportedException(2);
   * }
   * ```
   */
  public constructor(version: unknown, options?: ExceptionOptions);
}

/**
 * The exception thrown when discovery metadata is not a JSON object.
 */
export declare class DiscoveryNotObjectException extends DiscoveryFormatException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The parse failure, if any.
   * @example
   * ```ts
   * import { DiscoveryNotObjectException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DiscoveryNotObjectException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when a field of discovery metadata is missing or invalid.
 */
export declare class DiscoveryFieldInvalidException extends DiscoveryFormatException {
  /**
   * The missing or invalid field.
   */
  public readonly field: string;

  /**
   * Creates the exception.
   *
   * @param field The missing or invalid field.
   * @param options The parse failure, if any.
   * @example
   * ```ts
   * import { DiscoveryFieldInvalidException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DiscoveryFieldInvalidException("token");
   * }
   * ```
   */
  public constructor(field: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a migration of the shell's or a module's database
 * fails. Its changes and its history row were rolled back together.
 */
export declare class MigrationException extends RuntimeException {
  /**
   * The id of the migration that failed.
   */
  public readonly migrationId: string;

  /**
   * Creates the exception.
   *
   * @param database The database's name in the message, such as `shell database`.
   * @param migrationId The id of the failed migration.
   * @param options The SQLite failure, if any.
   * @example
   * ```ts
   * import { MigrationException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new MigrationException("shell database", "create-settings");
   * }
   * ```
   */
  public constructor(database: string, migrationId: string, options?: ExceptionOptions);
}

/**
 * The exception a module's runtime part throws from its activation to tell the
 * person why the module didn't start; its message becomes the module's cause,
 * shown in the window, so it names no path, secret or error text.
 */
export declare class ModuleActivationException extends RuntimeException {
  /**
   * Creates the exception.
   *
   * @param message Why the module didn't start, as one sentence for the person.
   * @param options The error behind it, if any, which only the log shows.
   * @throws {ArgumentException} When the message is empty or only white space.
   * @example
   * ```ts
   * import { ModuleActivationException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ModuleActivationException("It runs on Windows and macOS.");
   * }
   * ```
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module's runtime part uses a database it does not
 * have, because it declares no migrations.
 */
export declare class ModuleDatabaseException extends RuntimeException {
  /**
   * The id of the module whose runtime part has no database.
   */
  public readonly moduleId: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param moduleId The id of the module whose runtime part declares no migrations.
   * @example
   * ```ts
   * import { ModuleDatabaseException } from "@noldova/desktop.runtime";
   *
   * export const failure: ModuleDatabaseException = new ModuleDatabaseException("notes");
   * ```
   */
  public constructor(moduleId: string);
}

/**
 * The exception thrown when an operation needs the data directory's ownership
 * after it was released.
 */
export declare class OwnershipReleasedException extends RuntimeException {
  /**
   * Creates the exception.
   * @example
   * ```ts
   * import { OwnershipReleasedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new OwnershipReleasedException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the data directory holds data written by a release
 * that predates the shell. Such data is neither migrated nor reset.
 */
export declare class PreShellDataException extends RuntimeException {
  /**
   * The absolute path of the data directory.
   */
  public readonly root: string;

  /**
   * The directory's entries that belong to the earlier release, those of its
   * `backups` folder as `backups/<name>`, sorted.
   */
  public readonly entries: readonly string[];

  /**
   * Creates the exception.
   *
   * @param root The absolute path of the data directory.
   * @param entries The entries that belong to the earlier release; the array
   * is copied.
   * @example
   * ```ts
   * import { PreShellDataException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PreShellDataException("/home/person/.noldova/desktop", ["noldova-desktop.db"]);
   * }
   * ```
   */
  public constructor(root: string, entries: readonly string[]);
}

/**
 * The abstract category of the exceptions thrown when an operating-system
 * command fails, cannot be found or its output cannot be used; catch it to
 * handle any of them. Its subclasses are `CommandFailedException`,
 * `SystemRootMissingException`, `UserIdentityUnreadableException`,
 * `FolderNotPrivateException`, `ForegroundGroupUnreadableException`,
 * `ForegroundGroupReadFailedException`, `ProcessTableRowUnreadableException`,
 * `JobAssignmentFailedException`, `NoJobForExitCodeException`,
 * `JobClosedBeforeExitException`, `ExitWaitTimedOutException` and
 * `ExitCodeUnreadableException`.
 */
export declare abstract class SystemCommandException extends RuntimeException {
  /**
   * Initializes the message and the cause for a derived exception.
   *
   * @param message The complete explanation, kept as given.
   * @param options The failure that caused this one, as its `cause`.
   * Omitted, the exception has no cause.
   * @example
   * ```ts
   * import { SystemCommandException, SystemRootMissingException } from "@noldova/desktop.runtime";
   *
   * const exception = new SystemRootMissingException();
   * exception instanceof SystemCommandException; // true
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an operating-system command fails, cannot be found
 * or does not finish in time. Its message ends with the process failure's
 * message.
 */
export declare class CommandFailedException extends SystemCommandException {
  /**
   * The command that failed.
   */
  public readonly command: string;

  /**
   * Creates the exception.
   *
   * @param command The command that failed.
   * @param cause The process failure; its message ends this exception's message.
   * @example
   * ```ts
   * import { CommandFailedException } from "@noldova/desktop.runtime";
   *
   * export function fail(error: Error): never {
   *   throw new CommandFailedException("icacls.exe", error);
   * }
   * ```
   */
  public constructor(command: string, cause: Error);
}

/**
 * The exception thrown when `SystemRoot` is not set, so the Windows system
 * tools cannot be found.
 */
export declare class SystemRootMissingException extends SystemCommandException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { SystemRootMissingException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SystemRootMissingException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the current user's security identifier cannot be
 * read from the output of the Windows identity command.
 */
export declare class UserIdentityUnreadableException extends SystemCommandException {
  /**
   * The command's output that holds no security identifier.
   */
  public readonly output: string;

  /**
   * Creates the exception.
   *
   * @param output The command's output that holds no security identifier.
   * @example
   * ```ts
   * import { UserIdentityUnreadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(output: string): never {
   *   throw new UserIdentityUnreadableException(output);
   * }
   * ```
   */
  public constructor(output: string);
}

/**
 * The exception thrown when a folder is still open to other users after it was
 * restricted to the current user.
 */
export declare class FolderNotPrivateException extends SystemCommandException {
  /**
   * The folder that is still open to others.
   */
  public readonly folder: string;

  /**
   * The folder's access as the operating system lists it.
   */
  public readonly access: string;

  /**
   * Creates the exception.
   *
   * @param folder The folder that is still open to others.
   * @param access The folder's access as the operating system lists it.
   * @example
   * ```ts
   * import { FolderNotPrivateException } from "@noldova/desktop.runtime";
   *
   * export function fail(folder: string): never {
   *   throw new FolderNotPrivateException(folder, "drwxr-xr-x");
   * }
   * ```
   */
  public constructor(folder: string, access: string);
}

/**
 * The exception thrown when the foreground process group of a process's
 * terminal cannot be read from what the system gave.
 */
export declare class ForegroundGroupUnreadableException extends SystemCommandException {
  /**
   * The process whose terminal was read.
   */
  public readonly processId: number;

  /**
   * What the system gave, which holds no foreground process group.
   */
  public readonly output: string;

  /**
   * Creates the exception.
   *
   * @param processId The process whose terminal was read.
   * @param output What the system gave, which holds no foreground process group.
   * @example
   * ```ts
   * import { ForegroundGroupUnreadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number, output: string): never {
   *   throw new ForegroundGroupUnreadableException(processId, output);
   * }
   * ```
   */
  public constructor(processId: number, output: string);
}

/**
 * The exception thrown when reading the foreground process group of a
 * process's terminal fails. Its message ends with the failure as text.
 */
export declare class ForegroundGroupReadFailedException extends SystemCommandException {
  /**
   * The process whose terminal could not be read.
   */
  public readonly processId: number;

  /**
   * Creates the exception.
   *
   * @param processId The process whose terminal could not be read.
   * @param cause The failure of the read; as text, it ends this exception's message.
   * @example
   * ```ts
   * import { ForegroundGroupReadFailedException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number, error: unknown): never {
   *   throw new ForegroundGroupReadFailedException(processId, error);
   * }
   * ```
   */
  public constructor(processId: number, cause: unknown);
}

/**
 * The exception thrown when a row of the Linux process table cannot be read.
 */
export declare class ProcessTableRowUnreadableException extends SystemCommandException {
  /**
   * The row that could not be read.
   */
  public readonly row: string;

  /**
   * Creates the exception.
   *
   * @param row The row that could not be read.
   * @example
   * ```ts
   * import { ProcessTableRowUnreadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(row: string): never {
   *   throw new ProcessTableRowUnreadableException(row);
   * }
   * ```
   */
  public constructor(row: string);
}

/**
 * The exception thrown when Windows cannot put a process in a job of its own,
 * so what it starts is found only by its parent.
 */
export declare class JobAssignmentFailedException extends SystemCommandException {
  /**
   * The process that could not be put in a job.
   */
  public readonly processId: number;

  /**
   * The Windows error code the assignment failed with.
   */
  public readonly errorCode: number;

  /**
   * Creates the exception.
   *
   * @param processId The process that could not be put in a job.
   * @param errorCode The Windows error code the assignment failed with.
   * @example
   * ```ts
   * import { JobAssignmentFailedException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number): never {
   *   throw new JobAssignmentFailedException(processId, 5);
   * }
   * ```
   */
  public constructor(processId: number, errorCode: number);
}

/**
 * The exception thrown when a process is in no job of the runtime's, so
 * Windows is not asked for its exit code.
 */
export declare class NoJobForExitCodeException extends SystemCommandException {
  /**
   * The process that is in no job.
   */
  public readonly processId: number;

  /**
   * Creates the exception.
   *
   * @param processId The process that is in no job.
   * @example
   * ```ts
   * import { NoJobForExitCodeException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number): never {
   *   throw new NoJobForExitCodeException(processId);
   * }
   * ```
   */
  public constructor(processId: number);
}

/**
 * The exception thrown when a process's job closes before its exit code is
 * read.
 */
export declare class JobClosedBeforeExitException extends SystemCommandException {
  /**
   * The process whose job closed.
   */
  public readonly processId: number;

  /**
   * Creates the exception.
   *
   * @param processId The process whose job closed.
   * @example
   * ```ts
   * import { JobClosedBeforeExitException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number): never {
   *   throw new JobClosedBeforeExitException(processId);
   * }
   * ```
   */
  public constructor(processId: number);
}

/**
 * The exception thrown when a process is still running some time after its
 * output closed, so its exit code cannot be read.
 */
export declare class ExitWaitTimedOutException extends SystemCommandException {
  /**
   * The process that was still running.
   */
  public readonly processId: number;

  /**
   * How long the runtime waited for the process to exit, in milliseconds.
   */
  public readonly milliseconds: number;

  /**
   * Creates the exception.
   *
   * @param processId The process that was still running.
   * @param milliseconds How long the runtime waited for the process to exit, in milliseconds.
   * @example
   * ```ts
   * import { ExitWaitTimedOutException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number): never {
   *   throw new ExitWaitTimedOutException(processId, 2000);
   * }
   * ```
   */
  public constructor(processId: number, milliseconds: number);
}

/**
 * The exception thrown when Windows gives no exit code for a process that
 * ended.
 */
export declare class ExitCodeUnreadableException extends SystemCommandException {
  /**
   * The process without an exit code.
   */
  public readonly processId: number;

  /**
   * Creates the exception.
   *
   * @param processId The process without an exit code.
   * @example
   * ```ts
   * import { ExitCodeUnreadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number): never {
   *   throw new ExitCodeUnreadableException(processId);
   * }
   * ```
   */
  public constructor(processId: number);
}

/**
 * Why a database's schema is not one this build recognizes, as an
 * `UnknownSchemaException` carries it.
 */
export declare enum UnknownSchemaFailure {
  /**
   * The database has tables but no migration history.
   */
  TablesWithoutHistory = "TablesWithoutHistory",

  /**
   * The database's migration history is longer than this build's, so a newer
   * build wrote it.
   */
  HistoryNewer = "HistoryNewer",

  /**
   * The database's migration history is not a prefix of this build's
   * migrations.
   */
  HistoryNotRecognized = "HistoryNotRecognized"
}

/**
 * The exception thrown when the shell database's schema is not one this build
 * recognizes: a migration history that is not a prefix of the known
 * migrations, a longer history from a newer build, or tables without a
 * history. The database is left unchanged. It formats its message from its
 * reason and the database's name.
 */
export declare class UnknownSchemaException extends RuntimeException {
  /**
   * Why the schema is not recognized.
   */
  public readonly reason: UnknownSchemaFailure;

  /**
   * The database's name as messages use it, such as `shell database`.
   */
  public readonly database: string;

  /**
   * Creates the exception.
   *
   * @param reason Why the schema is not recognized.
   * @param database The database's name as messages use it, such as `shell database`.
   * @example
   * ```ts
   * import { UnknownSchemaException, UnknownSchemaFailure } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new UnknownSchemaException(UnknownSchemaFailure.HistoryNewer, "shell database");
   * }
   * ```
   */
  public constructor(reason: UnknownSchemaFailure, database: string);
}

/**
 * Restricts a folder so that only the current user can use it.
 */
export interface IFolderProtector {
  /**
   * Restricts the folder.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once the folder is restricted.
   * @throws {SystemCommandException} The promise rejects when an
   * operating-system command fails.
   * @example
   * ```ts
   * import type { IFolderProtector } from "@noldova/desktop.runtime";
   *
   * export class RecordingProtector implements IFolderProtector {
   *   public readonly folders: string[] = [];
   *
   *   public async protectAsync(folder: string): Promise<void> {
   *     this.folders.push(folder);
   *   }
   * }
   * ```
   */
  protectAsync(folder: string): Promise<void>;
}

/**
 * The plain JSON form of {@link RuntimeDiscovery}, as published in the
 * discovery file.
 */
export interface IRuntimeDiscoveryJson {
  /**
   * The version of this format; currently `1`.
   */
  readonly formatVersion: number;

  /**
   * The local endpoint clients connect to.
   */
  readonly endpoint: string;

  /**
   * The capability token clients authenticate with.
   */
  readonly token: string;

  /**
   * The owner process's id.
   */
  readonly processId: number;

  /**
   * The program the owner process runs from.
   */
  readonly executablePath: string;

  /**
   * The product version of the runtime's build.
   */
  readonly productVersion: string;

  /**
   * The local protocol's version.
   */
  readonly protocolVersion: number;

  /**
   * The fingerprint of the runtime's build.
   */
  readonly build: string;
}

/**
 * The result of inspecting a data directory.
 */
export declare class DataDirectoryInspection {
  /**
   * What the directory holds.
   */
  public readonly state: DataDirectoryState;

  /**
   * The directory's top-level entries other than the runtime's own, and the
   * entries of its `backups` folder other than the shell's own backups, as
   * `backups/<name>`, sorted.
   */
  public readonly entries: readonly string[];

  /**
   * Creates the result.
   *
   * @param state What the directory holds.
   * @param entries The entries other than the runtime's own, those of the
   * `backups` folder as `backups/<name>`; the array is copied.
   * @example
   * ```ts
   * import { DataDirectoryInspection, DataDirectoryState } from "@noldova/desktop.runtime";
   *
   * export const inspection: DataDirectoryInspection = new DataDirectoryInspection(DataDirectoryState.Empty, []);
   * ```
   */
  public constructor(state: DataDirectoryState, entries: readonly string[]);
}

/**
 * One ordered, transactional change to the shell database's schema.
 */
export declare class Migration {
  /**
   * The migration's stable id, recorded in the migration history.
   */
  public readonly id: string;

  /**
   * The SQL statements the migration runs, in order, inside its transaction.
   */
  public readonly statements: readonly string[];

  /**
   * Creates a migration.
   *
   * @param id Lowercase letters and digits separated by single hyphens, such as
   * `create-settings`. It must never change once released.
   * @param statements One or more SQL statements without transaction control;
   * the array is copied.
   * @throws {ArgumentException} When the id is malformed or there are no
   * statements.
   * @example
   * ```ts
   * import { Migration } from "@noldova/desktop.runtime";
   *
   * export const createSettings: Migration = new Migration("create-settings", ["CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT"]);
   * ```
   */
  public constructor(id: string, statements: readonly string[]);
}

/**
 * The discovery metadata a runtime publishes for its clients.
 */
export declare class RuntimeDiscovery {
  /**
   * The local endpoint clients connect to.
   */
  public readonly endpoint: string;

  /**
   * The capability token clients authenticate with.
   */
  public readonly token: string;

  /**
   * The owner process's id.
   */
  public readonly processId: number;

  /**
   * The program the owner process runs from.
   */
  public readonly executablePath: string;

  /**
   * The product version of the runtime's build.
   */
  public readonly productVersion: string;

  /**
   * The local protocol's version.
   */
  public readonly protocolVersion: number;

  /**
   * The fingerprint of the runtime's build.
   */
  public readonly build: string;

  /**
   * Creates the metadata.
   *
   * @param endpoint The local endpoint; not empty or whitespace.
   * @param token The capability token; not empty or whitespace.
   * @param processId The owner process's id; a positive integer.
   * @param executablePath The program the owner runs from; not empty or
   * whitespace.
   * @param productVersion The product version; not empty or whitespace.
   * @param protocolVersion The protocol version; a positive integer.
   * @param build The build fingerprint; not empty or whitespace.
   * @throws {ArgumentException} When a text value is empty or whitespace.
   * @throws {ArgumentOutOfRangeException} When the process id or the protocol
   * version is not a positive integer.
   * @example
   * ```ts
   * import { RuntimeDiscovery } from "@noldova/desktop.runtime";
   *
   * export const discovery: RuntimeDiscovery = new RuntimeDiscovery("127.0.0.1:52000", "capability-token", 4242, "/opt/noldova-desktop/node", "0.0.1", 1, "build-fingerprint");
   * ```
   */
  public constructor(
    endpoint: string,
    token: string,
    processId: number,
    executablePath: string,
    productVersion: string,
    protocolVersion: number,
    build: string);

  /**
   * Reads metadata from its plain JSON form.
   *
   * @param value The parsed JSON; it must be an object with format version
   * `1`, non-empty text values and positive whole numbers.
   * @returns The metadata.
   * @throws {DiscoveryFormatException} When the value is not an object, has an
   * unsupported format version, or a field is missing or invalid; the message
   * names the field.
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { RuntimeDiscovery } from "@noldova/desktop.runtime";
   *
   * export function parseDiscovery(text: string): RuntimeDiscovery {
   *   return RuntimeDiscovery.fromJson(JsonReader.parse(text).toJson());
   * }
   * ```
   */
  public static fromJson(value: unknown): RuntimeDiscovery;

  /**
   * Returns the plain JSON form, with the format version.
   *
   * @returns A new object holding every field.
   * @example
   * ```ts
   * import type { RuntimeDiscovery } from "@noldova/desktop.runtime";
   *
   * export function serializeDiscovery(discovery: RuntimeDiscovery): string {
   *   return JSON.stringify(discovery.toJson());
   * }
   * ```
   */
  public toJson(): IRuntimeDiscoveryJson;
}

/**
 * Runs an operating-system program directly, without a shell.
 */
export declare class SystemCommand {
  /**
   * Runs the program and waits for it to exit. It is stopped after its time
   * limit, 30 seconds by default, and its output is limited to 1 MiB.
   *
   * @param file The program's path.
   * @param commandArguments The arguments, passed without shell
   * interpretation.
   * @param environment The program's environment; the runtime's own by
   * default.
   * @param timeoutMilliseconds How long the program may run before it is
   * stopped; 30 seconds by default.
   * @returns A promise of the program's standard output.
   * @throws {SystemCommandException} The promise rejects when the program
   * cannot start, exits with a nonzero code, times out or writes too much.
   * @example
   * ```ts
   * import { SystemCommand } from "@noldova/desktop.runtime";
   *
   * export function readUserAsync(): Promise<string> {
   *   return new SystemCommand().runAsync("C:\\Windows\\System32\\whoami.exe", ["/user", "/fo", "csv", "/nh"], { SystemRoot: "C:\\Windows" });
   * }
   * ```
   */
  public runAsync(file: string, commandArguments: readonly string[], environment?: NodeJS.ProcessEnv, timeoutMilliseconds?: number): Promise<string>;
}

/**
 * The layout of a data directory: where the ownership database, the shell
 * database, the discovery file, backups and module folders live.
 */
export declare class DataDirectory {
  /**
   * The directory's absolute, normalized path.
   */
  public readonly root: string;

  /**
   * Creates the layout for a directory.
   *
   * @param root The directory's absolute path; it need not exist yet.
   * @throws {ArgumentException} When the path is not absolute.
   * @example
   * ```ts
   * import { DataDirectory } from "@noldova/desktop.runtime";
   *
   * export const directory: DataDirectory = new DataDirectory("/home/person/.noldova/desktop");
   * ```
   */
  public constructor(root: string);

  /**
   * The path of the ownership database, `ownership.sqlite`.
   */
  public get ownershipDatabase(): string;

  /**
   * The path of the shell's database, `desktop.sqlite`, which marks the current
   * layout.
   */
  public get shellDatabase(): string;

  /**
   * The path of the protected discovery folder, `discovery`.
   */
  public get discoveryFolder(): string;

  /**
   * The path of the discovery file, `discovery/runtime.json`.
   */
  public get discoveryFile(): string;

  /**
   * The path of the main process's Electron profile folder, `mainProcess`.
   */
  public get profileFolder(): string;

  /**
   * The path of the running runtime's log, `logs/runtime.log`.
   */
  public get runtimeLog(): string;

  /**
   * The path of the previous run's log, `logs/runtime.previous.log`.
   */
  public get previousRuntimeLog(): string;

  /**
   * The path of the runtime's standard error once a launcher reached it, `logs/runtime.errors.log`: the launcher that started the runtime renames its start log to it.
   */
  public get runtimeErrorsLog(): string;

  /**
   * The path of the earlier standard error, `logs/runtime.previous.errors.log`: the previous runtime's, or this runtime's own text from before its standard error passed its size limit, redacted as the log is.
   */
  public get previousRuntimeErrorsLog(): string;

  /**
   * The path of the main process's log, `logs/main.log`, which the main process owns.
   */
  public get mainProcessLog(): string;

  /**
   * The path of the previous main process start's log, `logs/main.previous.log`.
   */
  public get previousMainProcessLog(): string;

  /**
   * The path of the database backups folder, `backups`.
   */
  public get backupsFolder(): string;

  /**
   * The path of the folder that holds every module's folder, `modules`.
   */
  public get modulesFolder(): string;

  /**
   * The path of the folder for work outside any project, `work`.
   */
  public get workFolder(): string;

  /**
   * The path of the logs folder, `logs`.
   */
  public get logsFolder(): string;

  /**
   * The path of the folder for pasted bytes with no file of their own, such
   * as a pasted image, that a file grant names, `staged`; the runtime empties
   * it when it starts.
   */
  public get stagedFolder(): string;

  /**
   * Returns the path of a module's folder, `modules/<id>`.
   *
   * @param id The module's id: lowercase kebab-case, not `desktop`, and no
   * Windows device name such as `con` or `com1`.
   * @returns The folder's path; the folder is not created.
   * @throws {ArgumentException} When the id is not a module id.
   * @example
   * ```ts
   * import type { DataDirectory } from "@noldova/desktop.runtime";
   *
   * export function locateNotes(directory: DataDirectory): string {
   *   return directory.locateModuleFolder("notes");
   * }
   * ```
   */
  public locateModuleFolder(id: string): string;

  /**
   * Returns the path of a module's folder for work outside any project,
   * `work/<id>`.
   *
   * @param id The module's id: lowercase kebab-case, not `desktop`, and no
   * Windows device name such as `con` or `com1`.
   * @returns The folder's path; the folder is not created.
   * @throws {ArgumentException} When the id is not a module id.
   * @example
   * ```ts
   * import type { DataDirectory } from "@noldova/desktop.runtime";
   *
   * export function locateChatWork(directory: DataDirectory): string {
   *   return directory.locateWorkFolder("chat");
   * }
   * ```
   */
  public locateWorkFolder(id: string): string;

  /**
   * Returns the path of a module's database, `modules/<id>/<id>.sqlite`.
   *
   * @param id The module's id: lowercase kebab-case, not `desktop`, and no
   * Windows device name such as `con` or `com1`.
   * @returns The database's path; nothing is created.
   * @throws {ArgumentException} When the id is not a module id.
   * @example
   * ```ts
   * import type { DataDirectory } from "@noldova/desktop.runtime";
   *
   * export function locateNotesDatabase(directory: DataDirectory): string {
   *   return directory.locateModuleDatabase("notes");
   * }
   * ```
   */
  public locateModuleDatabase(id: string): string;
}

/**
 * Inspects a data directory and moves data written before the shell aside.
 */
export declare class DataDirectoryInspector {
  /**
   * Inspects the directory's top-level entries and the entries of its
   * `backups` folder, ignoring the shell's own entries and backups.
   *
   * @param dataDirectory The directory to inspect; it need not exist.
   * @returns A promise of the directory's state and entries.
   * @example
   * ```ts
   * import { DataDirectoryInspector, DataDirectoryState, type DataDirectory } from "@noldova/desktop.runtime";
   *
   * export async function holdsPreShellDataAsync(directory: DataDirectory): Promise<boolean> {
   *   return (await DataDirectoryInspector.inspectAsync(directory)).state === DataDirectoryState.PreShell;
   * }
   * ```
   */
  public static inspectAsync(dataDirectory: DataDirectory): Promise<DataDirectoryInspection>;

  /**
   * Moves every entry of a directory that holds data written before the
   * shell, except the runtime's own entries, into a new sibling folder named
   * `<directory>-before-shell-<UTC time>`. The entries of its `backups` folder
   * move into that folder's `backups`, except the shell's own update and
   * migration backups and their files, which stay. Nothing is deleted or
   * overwritten.
   *
   * @param lock The held ownership of the directory.
   * @param moment The time that names the new folder; now by default.
   * @returns A promise of the new folder's path, or of `null` when the
   * directory holds no such data.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @throws {Error} The promise rejects when the folder already exists or an
   * entry cannot be moved; entries moved before the failure stay moved.
   * @example
   * ```ts
   * import { DataDirectoryInspector, type OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export function moveAsideAsync(lock: OwnershipLock): Promise<string | null> {
   *   return DataDirectoryInspector.moveAsideAsync(lock, new Date("2026-10-01T12:00:00Z"));
   * }
   * ```
   */
  public static moveAsideAsync(lock: OwnershipLock, moment?: Date): Promise<string | null>;
}

/**
 * A backups folder's guard, a SQLite lock on its `.backup-guard` file that
 * works across processes and ends with the process that holds it. Each running
 * backup holds it shared; removing an interrupted backup's leftovers holds it
 * alone, so it never removes the files of a backup still running in this or
 * another process.
 */
export declare class BackupGuard implements Disposable {
  private constructor();

  /**
   * Holds the guard shared, as a running backup does, creating the folder when
   * missing. It waits for a removal of leftovers to finish.
   *
   * @param folder The backups folder.
   * @param waitMilliseconds How long it waits; 1 second by default.
   * @returns The held guard.
   * @throws {Error} The promise rejects when a removal of leftovers holds the
   * guard for longer, or the folder or the guard file cannot be used.
   * @example
   * ```ts
   * import { BackupGuard } from "@noldova/desktop.runtime";
   *
   * export async function holdWhileAsync(folder: string, action: () => void): Promise<void> {
   *   using guard = await BackupGuard.holdAsync(folder);
   *   action();
   * }
   * ```
   */
  public static holdAsync(folder: string, waitMilliseconds?: number): Promise<BackupGuard>;

  /**
   * Holds the guard alone, creating the folder when missing, once no backup in
   * this or another process holds it. It waits a little, so a guard whose
   * holder just ended is free.
   *
   * @param folder The backups folder.
   * @param waitMilliseconds How long it waits; 250 milliseconds by default.
   * @returns The held guard, or `null` when a backup still holds it.
   * @throws {Error} The promise rejects when the folder or the guard file
   * cannot be used.
   * @example
   * ```ts
   * import { BackupGuard } from "@noldova/desktop.runtime";
   *
   * export async function isBackingUpAsync(folder: string): Promise<boolean> {
   *   using guard = await BackupGuard.holdAloneAsync(folder);
   *   return guard === null;
   * }
   * ```
   */
  public static holdAloneAsync(folder: string, waitMilliseconds?: number): Promise<BackupGuard | null>;

  /**
   * Whether the guard is still held.
   */
  public get isHeld(): boolean;

  /**
   * Releases the guard; releasing again does nothing.
   *
   * @example
   * ```ts
   * import type { BackupGuard } from "@noldova/desktop.runtime";
   *
   * export function releaseGuard(guard: BackupGuard): void {
   *   guard.release();
   * }
   * ```
   */
  public release(): void;

  /**
   * Releases the guard.
   */
  public [Symbol.dispose](): void;
}

/**
 * Makes and verifies SQLite backups that include committed write-ahead-log
 * data.
 */
export declare class DatabaseBackup {
  /**
   * Copies a database with SQLite's online backup, verifies the copy and
   * publishes it under the given name without overwriting anything. The copy
   * is readable and writable only by its owner. It holds the folder's
   * {@link BackupGuard} shared from start to end, so its `<name>.tmp` files
   * are never taken for leftovers while it runs.
   *
   * @param source An open database connection.
   * @param folder The folder for the backup; it is created when missing.
   * @param name The backup's file name.
   * @param waitMilliseconds How long it waits for a removal of leftovers to
   * release the folder; 1 second by default.
   * @param series The name's start that the backups of the same owner and
   * kind share, such as `notes-before-update-`; null by default, which
   * removes nothing. Once the backup is published, and while it still holds
   * the guard, it removes the backups named
   * `<series>[<position>-]<timestamp>.sqlite` whose timestamps are earlier
   * than its own, but the newest 2 of them, each with its `-journal`, `-wal`
   * and `-shm` first; backups dated after it stay. A name outside the series
   * removes nothing.
   * @param diagnostics Where it writes the older backups it could not
   * remove, which never fails the backup; the process's standard error by
   * default.
   * @returns A promise of the published backup's path.
   * @throws {BackupVerificationException} The promise rejects when the copy
   * fails its integrity check.
   * @throws {Error} The promise rejects when a backup with that name already
   * exists, the copy fails, or a removal of leftovers holds the folder for
   * longer than the wait.
   * @example
   * ```ts
   * import { DatabaseBackup } from "@noldova/desktop.runtime";
   *
   * export function backUpAsync(connection: Parameters<typeof DatabaseBackup.createAsync>[0], folder: string): Promise<string> {
   *   return DatabaseBackup.createAsync(connection, folder, "desktop-before-migration-2-20261001T120000Z.sqlite");
   * }
   * ```
   */
  public static createAsync(source: DatabaseSync, folder: string, name: string, waitMilliseconds?: number, series?: string | null, diagnostics?: Writable): Promise<string>;

  /**
   * Removes the leftovers of interrupted backups from a backups folder: each
   * `<name>.sqlite.tmp` and its `-journal`, `-wal` and `-shm`. It holds the
   * folder's {@link BackupGuard} alone while it lists and removes them, and
   * removes nothing while a backup in this or another process holds the guard;
   * a later call removes them then. It is best effort and never throws: when
   * the guard, the folder or a file cannot be used, it leaves the files and
   * writes what it left to the diagnostics.
   *
   * @param folder The backups folder; a missing folder has no leftovers.
   * @param diagnostics Where it writes what it left; the process's standard
   * error by default.
   * @param waitMilliseconds How long it waits for the guard; 250 milliseconds
   * by default.
   * @returns The removed files' names, sorted.
   * @example
   * ```ts
   * import { DatabaseBackup } from "@noldova/desktop.runtime";
   *
   * export function sweepAsync(folder: string): Promise<readonly string[]> {
   *   return DatabaseBackup.removeLeftoversAsync(folder);
   * }
   * ```
   */
  public static removeLeftoversAsync(folder: string, diagnostics?: Writable, waitMilliseconds?: number): Promise<readonly string[]>;

  /**
   * Checks a database file with SQLite's integrity check.
   *
   * @param file The database file's path.
   * @throws {BackupVerificationException} When the file cannot be opened as a
   * database or its integrity check reports a problem.
   * @example
   * ```ts
   * import { BackupVerificationException, DatabaseBackup } from "@noldova/desktop.runtime";
   *
   * export function isSound(file: string): boolean {
   *   try {
   *     DatabaseBackup.verify(file);
   *     return true;
   *   }
   *   catch (error) {
   *     if (error instanceof BackupVerificationException)
   *       return false;
   *     throw error;
   *   }
   * }
   * ```
   */
  public static verify(file: string): void;
}

/**
 * A SQLite database opened in write-ahead-log mode with its owner's migrations applied: the shell's, or a module's.
 * Its migration history lives in the database itself.
 */
export declare class MigratedDatabase implements Disposable {
  /**
   * The ids of the migrations the database holds after opening, in order.
   */
  public readonly appliedMigrations: readonly string[];

  /**
   * Wraps an open connection; the subclasses' `openAsync` methods create it.
   *
   * @param connection The open connection.
   * @param appliedMigrations The ids of the applied migrations, in order.
   * @example
   * ```ts
   * import { MigratedDatabase, Migration } from "@noldova/desktop.runtime";
   *
   * export class ReportsDatabase extends MigratedDatabase {
   *   public static async openAsync(file: string, backups: string): Promise<ReportsDatabase> {
   *     const migrations = [new Migration("create-reports", ["CREATE TABLE reports (id TEXT PRIMARY KEY) STRICT"])];
   *     const [connection, applied] = await MigratedDatabase.migrateAsync(file, "reports database", migrations, backups, "reports", new Date(), process.stderr);
   *     return new ReportsDatabase(connection, applied);
   *   }
   * }
   * ```
   */
  protected constructor(connection: DatabaseSync, appliedMigrations: readonly string[]);

  /**
   * Runs a query and returns its first row. The first statement on a database this opening created waits for the
   * file's flush, as `run` does, so a statement that writes, such as `INSERT ... RETURNING`, is flushed first too.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The first row, or `undefined` when there is none.
   * @throws Error synchronously when the statement fails, the database is closed, or that flush fails; the statement
   *   then ran nothing.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function readBounds(database: ShellDatabase): unknown {
   *   return database.read("SELECT bounds AS value FROM window_states WHERE device = ? AND window = ?", "device-1", "main")?.["value"];
   * }
   * ```
   */
  public read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;

  /**
   * Runs a query and returns all its rows. The first statement on a database this opening created waits for the
   * file's flush, as `run` does, so a statement that writes, such as `INSERT ... RETURNING`, is flushed first too.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The rows, in the query's order.
   * @throws Error synchronously when the statement fails, the database is closed, or that flush fails; the statement
   *   then ran nothing.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function countDevices(database: ShellDatabase): number {
   *   return database.readAll("SELECT DISTINCT device FROM window_states").length;
   * }
   * ```
   */
  public readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[];

  /**
   * Runs a statement that changes the database. The first write to a database this opening created first waits for
   * its file to be flushed to disk, unless the flush the runtime starts after opening has already ended.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns How many rows changed and the last inserted row id.
   * @throws Error synchronously when the statement fails, the database is closed, or the first write's flush fails; the
   *   statement then changed nothing.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function forget(database: ShellDatabase): number {
   *   return Number(database.run("DELETE FROM window_states WHERE device = ?", "device-1").changes);
   * }
   * ```
   */
  public run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges;

  /**
   * Runs an action in one transaction: it commits when the action returns and rolls back when it throws. The action
   * must finish synchronously; an action that returns a promise does not compile, and one that returns a thenable at
   * run time is rolled back and refused, because an awaited step would run after the commit. Its first `run` on a
   * database this opening created waits for the file's flush, as a `run` outside a transaction does.
   *
   * @param action The work; it may read and change the database.
   * @returns What the action returned.
   * @throws {ArgumentException} When the action returned a thenable; nothing was committed.
   * @throws Error synchronously as the action threw it, a first write's failed flush included, after rolling back.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function moveDevice(database: ShellDatabase, from: string, to: string): number {
   *   return database.transaction(() => Number(database.run("UPDATE window_states SET device = ? WHERE device = ?", to, from).changes));
   * }
   * ```
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function refuseAsync(database: ShellDatabase): void {
   *   // @ts-expect-error
   *   database.transaction(async () => 1);
   * }
   * ```
   */
  public transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T;

  /**
   * Closes the database; closing again does nothing.
   *
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function closeDatabase(database: ShellDatabase): void {
   *   database.close();
   * }
   * ```
   */
  public close(): void;

  /**
   * Closes the database.
   */
  public [Symbol.dispose](): void;

  /**
   * Opens a database file and applies its pending migrations, each with its history row in one transaction. The
   * history must be a prefix of the given migrations. Before changing a database that already has migrations, it
   * publishes a verified backup named `<backupOwner>-before-migration-<position>-<time>.sqlite`, and then keeps only
   * the owner's newest 3 migration backups, as {@link DatabaseBackup.createAsync} does with a series. First it removes
   * interrupted backups' leftovers from the backups folder, as {@link DatabaseBackup.removeLeftoversAsync} does.
   *
   * @param file The database file.
   * @param name The database's name in messages, such as `shell database`.
   * @param migrations Every migration its owner knows, in order.
   * @param backupsFolder The folder for backups.
   * @param backupOwner The backup names' prefix: `desktop` or the module's id.
   * @param moment The time that names a backup.
   * @param diagnostics Where it writes the leftovers and older backups it left.
   * @returns A promise of the open connection and the applied migrations' ids.
   * @throws {UnknownSchemaException} The promise rejects when the schema is not one the migrations recognize.
   * @throws {BackupVerificationException} The promise rejects when the backup fails verification; no migration has run.
   * @throws {MigrationException} The promise rejects when a migration fails; earlier migrations stay applied.
   * @example
   * ```ts
   * import { MigratedDatabase, Migration } from "@noldova/desktop.runtime";
   *
   * export class ReportsDatabase extends MigratedDatabase {
   *   public static async openAsync(file: string, backups: string): Promise<ReportsDatabase> {
   *     const migrations = [new Migration("create-reports", ["CREATE TABLE reports (id TEXT PRIMARY KEY) STRICT"])];
   *     const [connection, applied] = await MigratedDatabase.migrateAsync(file, "reports database", migrations, backups, "reports", new Date(), process.stderr);
   *     return new ReportsDatabase(connection, applied);
   *   }
   * }
   * ```
   */
  protected static migrateAsync(
    file: string,
    name: string,
    migrations: readonly Migration[],
    backupsFolder: string,
    backupOwner: string,
    moment: Date,
    diagnostics: Writable): Promise<[DatabaseSync, readonly string[]]>;
}

/**
 * The shell database's migrations, in the order they apply: its window
 * states, then its settings.
 */
export declare class ShellMigrations {
  /**
   * Every migration of the shell's database.
   *
   * @example
   * ```ts
   * import { type OwnershipLock, ShellDatabase, ShellMigrations } from "@noldova/desktop.runtime";
   *
   * export function openAsync(lock: OwnershipLock): Promise<ShellDatabase> {
   *   return ShellDatabase.openAsync(lock, ShellMigrations.all);
   * }
   * ```
   */
  public static readonly all: readonly Migration[];
}

/**
 * The shell's own database, `desktop.sqlite`, which serves the shell's facilities.
 */
export declare class ShellDatabase extends MigratedDatabase {
  /**
   * Opens the shell database of an owned data directory and applies the
   * pending migrations, each with its history row in one transaction. Before
   * changing a database that already has migrations, it publishes a verified
   * backup in the backups folder, and then keeps only the shell's newest 3
   * migration backups. First it removes interrupted backups' leftovers from
   * that folder, as {@link DatabaseBackup.removeLeftoversAsync} does; what it
   * leaves, of these or of older backups, never stops the open.
   *
   * @param lock The held ownership of the data directory.
   * @param migrations Every migration this build knows, in order.
   * @param moment The time that names a backup; now by default.
   * @param diagnostics Where it writes the leftovers and older backups it
   * left; the process's standard error by default.
   * @returns A promise of the open database.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @throws {PreShellDataException} The promise rejects when the directory
   * holds data written before the shell.
   * @throws {UnknownSchemaException} The promise rejects when the schema is
   * not one this build recognizes.
   * @throws {BackupVerificationException} The promise rejects when the backup
   * fails verification; no migration has run.
   * @throws {MigrationException} The promise rejects when a migration fails;
   * earlier migrations stay applied.
   * @example
   * ```ts
   * import { Migration, ShellDatabase, type OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export async function listMigrationsAsync(lock: OwnershipLock): Promise<readonly string[]> {
   *   using database = await ShellDatabase.openAsync(lock, [new Migration("create-settings", ["CREATE TABLE settings (name TEXT PRIMARY KEY) STRICT"])]);
   *   return database.appliedMigrations;
   * }
   * ```
   */
  public static openAsync(lock: OwnershipLock, migrations: readonly Migration[], moment?: Date, diagnostics?: Writable): Promise<ShellDatabase>;
}

/**
 * A module's own database, `modules/<id>/<id>.sqlite` in the data directory. The runtime opens and migrates it before
 * the module's runtime part activates and closes it when the part deactivates; the part reaches it only through its
 * context, as an {@link IModuleDatabase}.
 */
export declare class ModuleDatabase extends MigratedDatabase implements IModuleDatabase {
  /**
   * Opens a module's database, creating its folder and file when missing, and applies its pending migrations as
   * {@link ShellDatabase.openAsync} does; a backup is named after the module, which keeps its newest 3.
   *
   * @param directory The owned data directory.
   * @param moduleId The module's id.
   * @param migrations Every migration the module's runtime part declares, in order.
   * @param moment The time that names a backup; now by default.
   * @param diagnostics Where it writes the leftovers and older backups it left; the process's standard error by default.
   * @returns A promise of the open database.
   * @throws {ArgumentException} When the id is not a module id.
   * @throws {UnknownSchemaException} The promise rejects when the schema is not one the migrations recognize.
   * @throws {BackupVerificationException} The promise rejects when the backup fails verification; no migration has run.
   * @throws {MigrationException} The promise rejects when a migration fails; earlier migrations stay applied.
   * @example
   * ```ts
   * import { Migration, ModuleDatabase, type DataDirectory } from "@noldova/desktop.runtime";
   *
   * export async function openNotesAsync(directory: DataDirectory): Promise<ModuleDatabase> {
   *   return ModuleDatabase.openAsync(directory, "notes", [new Migration("create-notes", ["CREATE TABLE notes (id TEXT PRIMARY KEY) STRICT"])]);
   * }
   * ```
   */
  public static openAsync(directory: DataDirectory, moduleId: string, migrations: readonly Migration[], moment?: Date, diagnostics?: Writable): Promise<ModuleDatabase>;
}

/**
 * Backs up a data directory's databases before an update installs, so an update that changes no schema still leaves a
 * copy to go back to.
 */
export declare class UpdateBackup {
  /**
   * Backs up the shell database and each module's database the data directory holds, one after another, with
   * {@link DatabaseBackup.createAsync} into its `backups` folder, next to the migration backups.
   * Each backup is named `<owner>-before-update-<timestamp>.sqlite`, where the owner is `desktop` for the shell
   * database and the module's id for a module's, and once it is published only the owner's newest 3 update backups
   * are kept. It first removes the leftovers of interrupted backups, and reads each database through a read-only
   * connection, so it changes no database; a database that doesn't exist, or a folder in `modules` whose name is no
   * module's id, is skipped.
   *
   * @param directory The data directory, whose runtime has stopped.
   * @param moment The time that names the backups; now by default.
   * @param diagnostics Where it writes the leftovers and older backups it left and the folders it skipped; the
   * process's standard error by default.
   * @returns A promise of the backups' paths, the shell database's first, then the modules' in order of their ids.
   * @throws {BackupVerificationException} The promise rejects when a backup fails verification; the backups made before
   * it stay.
   * @throws {Error} The promise rejects when a database can't be opened or copied, or a backup with that name exists.
   * @example
   * ```ts
   * import { DataDirectory, UpdateBackup } from "@noldova/desktop.runtime";
   *
   * export function backUpAsync(root: string): Promise<readonly string[]> {
   *   return UpdateBackup.createAsync(new DataDirectory(root));
   * }
   * ```
   */
  public static createAsync(directory: DataDirectory, moment?: Date, diagnostics?: Writable): Promise<readonly string[]>;
}

/**
 * Removes what a diagnostic must not show. The home folder becomes `~`, also percent-encoded as in a `file://` stack
 * frame. The person's user name elsewhere, email addresses, the account in an address such as
 * `https://user:password@host`, and opaque values such as tokens, with or without slashes, become `[redacted]`. The user
 * name is replaced wherever it stands as a word, even where it is also an ordinary word, since privacy comes before the
 * diagnostic's reading, except inside the app's own names, such as its product name, and the company's package scopes,
 * `@noldova-com` and `@noldova`, which the app writes itself; a Windows profile folder's suffix, as in `person.CORP` or
 * `person.000`, is left out of it. A
 * folder whose name only starts with the home folder's, such as `al.old` or `al smith` beside `al`, stays, and so does a
 * user name shorter than three characters or a generic one such as `runner`, which ordinary text could hold.
 */
export declare class DiagnosticRedactor {
  /**
   * Creates the redactor.
   *
   * @param homeFolder The home folder to show as `~`, matched in any case, with either path separator or doubled
   * backslashes, as JSON writes them, percent-encoded, and with its last folder's Windows short name, such as `PERSON~1`
   * or `JURGEN~1`, and only where that folder's name ends; that folder's name is the user name.
   * @param ownNames The app's own names, such as its product name, kept as they are written wherever they stand as
   * whole words, as the company's package scopes always are, so a user name that is one of their words, such as
   * `noldova` in `Noldova Desktop Sample`, stays in them and goes everywhere else, as does a longer name that holds one,
   * such as `Acme2` beside `Acme`; none by default.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DiagnosticRedactor, ProductInfo } from "@noldova/desktop.runtime";
   *
   * export const redactor: DiagnosticRedactor = new DiagnosticRedactor(homedir(), [ProductInfo.current.name]);
   * ```
   */
  public constructor(homeFolder: string, ownNames?: readonly string[]);

  /**
   * Redacts a diagnostic.
   *
   * @param text The diagnostic.
   * @returns The diagnostic with the home folder shown as `~` and the user name, email addresses, accounts in
   * addresses and opaque values replaced.
   * @example
   * ```ts
   * import { DiagnosticRedactor } from "@noldova/desktop.runtime";
   *
   * export function redact(text: string): string {
   *   return new DiagnosticRedactor("/home/person").redact(text);
   * }
   * ```
   */
  public redact(text: string): string;
}

/**
 * A log file whose size is bounded. Each record is stamped with its time and redacted, and the file becomes the
 * previous file, replacing it, when a record would take it over its size limit. Lines are written in the order they
 * were appended, whether they wait for the disk or are written at once.
 */
export declare class LogFile {
  /**
   * Creates the log file, which is not opened yet.
   *
   * @param file The file to write.
   * @param previousFile The file the log becomes when it is opened again or reaches its size limit.
   * @param redactor Redacts every record.
   * @param now Returns the time to stamp a record with; the current time by default.
   * @param limit The most bytes the file holds, 1 MiB by default. A record is cut to a quarter of it.
   * @param writeWait The most milliseconds a line written at once waits for a write already under way to land, so that it lands after it; 2 seconds by default.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DiagnosticRedactor, LogFile } from "@noldova/desktop.runtime";
   *
   * export const log: LogFile = new LogFile("/data/logs/app.log", "/data/logs/app.previous.log", new DiagnosticRedactor(homedir()));
   * ```
   */
  public constructor(file: string, previousFile: string, redactor: DiagnosticRedactor, now?: () => Date, limit?: number, writeWait?: number);

  /**
   * Stamps and redacts a record.
   *
   * @param text The record, possibly of several lines, without its line ending.
   * @returns The line to write: the time, the redacted record, cut to a quarter of the size limit in bytes at a character boundary, and a line ending.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export function line(log: LogFile): string {
   *   return log.format("The runtime started.");
   * }
   * ```
   */
  public format(text: string): string;

  /**
   * Starts an empty file. The existing file, if there is one, becomes the previous file, replacing it. When it cannot, the failure is thrown and the existing file keeps what it holds.
   *
   * @throws {LogFileClosedException} Thrown once the log is closed.
   * @throws {Error} Thrown when the existing file cannot become the previous file or the file cannot be written.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export function start(log: LogFile): void {
   *   log.open();
   * }
   * ```
   */
  public open(): void;

  /**
   * Appends a line at once, as when the process is about to end: first the lines still waiting, as {@link LogFile.flush}
   * writes them, then this one. When it would take the file over its size limit, the file first becomes the previous file.
   *
   * @param line The line from {@link LogFile.format}.
   * @throws {LogFileClosedException} Thrown once the log is closed.
   * @throws {Error} Thrown when the file cannot become the previous file, in which case it keeps what it holds, or cannot be written.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export function note(log: LogFile): void {
   *   log.append(log.format("The runtime started."));
   * }
   * ```
   */
  public append(line: string): void;

  /**
   * Appends a line without waiting for the disk: the line is written after the lines appended before it, with the
   * lines that wait meanwhile written together. When it would take the file over its size limit, the file first becomes
   * the previous file, so no line is lost when the file fills.
   *
   * @param line The line from {@link LogFile.format}.
   * @returns A promise that settles once the line is written; the caller handles its rejection.
   * @throws {LogFileClosedException} Rejected once the log is closed.
   * @throws {Error} Rejected when the file cannot become the previous file, in which case it keeps what it holds, or cannot be written; later lines are still tried.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export function note(log: LogFile): void {
   *   log.appendAsync(log.format("The runtime started.")).catch((failure: unknown) => console.error(failure));
   * }
   * ```
   */
  public appendAsync(line: string): Promise<void>;

  /**
   * Writes the lines still waiting at once, in order, as when the process is about to end. A write already under way
   * is given up to the write wait, 2 seconds by default, to land first, so the lines keep their order; it has landed once
   * its text is in the file past what this log had written before it, whatever another process appended meanwhile, or once the file can't be read. Each
   * waiting line's promise settles as it is written or fails.
   *
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export function finish(log: LogFile): void {
   *   log.flush();
   * }
   * ```
   */
  public flush(): void;

  /**
   * Waits until every line appended so far is written or has failed.
   *
   * @returns A promise that resolves once no line is waiting; it never rejects.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export async function finishAsync(log: LogFile): Promise<void> {
   *   await log.flushAsync();
   * }
   * ```
   */
  public flushAsync(): Promise<void>;

  /**
   * Closes the log: writes the lines still waiting at once, as {@link LogFile.flush} does, then waits until the file is
   * no longer open, a write already under way included, so the folder that holds it can be removed. Once closed, the
   * log refuses every line with a {@link LogFileClosedException}.
   *
   * @returns A promise that resolves once the file is closed; it never rejects.
   * @example
   * ```ts
   * import type { LogFile } from "@noldova/desktop.runtime";
   *
   * export async function endAsync(log: LogFile): Promise<void> {
   *   await log.closeAsync();
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * Prepares text that comes from outside the shell's own code for a log, so it cannot pass for a record of its own.
 */
export declare class LogText {
  /**
   * Splits a text into the lines a log shows.
   *
   * @param text The text, with any line endings.
   * @returns The lines, without the text's trailing white space. Every line ending ends a line: CR LF, LF, CR, vertical tab, form feed, U+0085, U+2028 and U+2029.
   * Each line keeps its tabs and loses every other control character, so terminal escapes do nothing.
   * @example
   * ```ts
   * import { LogText } from "@noldova/desktop.runtime";
   *
   * export const lines: readonly string[] = LogText.lines("Synced\rwith the server\n");
   * ```
   */
  public static lines(text: string): readonly string[];
}

/**
 * Bounds a process's standard error when it is one of the given files: once the file passes its size limit, its last limit's worth of bytes
 * becomes the previous file, redacted and replacing it, and the file is emptied, so later writes start it again. It is checked on a timer
 * that keeps no process running, so between checks the file can pass its limit by what is written in one interval, and what is
 * written while it is cut back can be lost.
 */
export declare class StandardErrorCap implements AsyncDisposable {
  private constructor();

  /**
   * Starts checking a standard error. It acts only when the standard error is one of the given files, by device and file number.
   *
   * @param descriptor The standard error's file descriptor, such as `process.stderr.fd`.
   * @param files The paths the file can have, such as a start log and the name a launcher renames it to.
   * @param previousFile The file the last limit's worth of bytes goes to.
   * @param redactor Redacts what goes to the previous file.
   * @param diagnostics Where a check on the timer that fails for an unexpected reason is reported.
   * @param limit The most bytes the file holds before it is cut back, 1 MiB by default.
   * @param interval The milliseconds between checks, 5 seconds by default.
   * @returns The started cap.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DiagnosticRedactor, StandardErrorCap } from "@noldova/desktop.runtime";
   *
   * export const cap: StandardErrorCap = StandardErrorCap.start(process.stderr.fd, ["/data/logs/errors.log"], "/data/logs/errors.previous.log",
   *   new DiagnosticRedactor(homedir()), process.stdout);
   * ```
   */
  public static start(descriptor: number, files: readonly string[], previousFile: string, redactor: DiagnosticRedactor, diagnostics: Writable, limit?: number,
    interval?: number): StandardErrorCap;

  /**
   * Writes a file's last limit's worth of bytes, redacted, to the previous file, replacing it, and leaves the file as it is.
   *
   * @param file The file to keep.
   * @param previousFile The file its redacted tail goes to.
   * @param redactor Redacts the tail.
   * @param limit The most bytes kept, 1 MiB by default.
   * @returns A promise that settles once the previous file is written.
   * @throws {Error} The promise rejects when the file can't be read or the previous file can't be written.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { DiagnosticRedactor, StandardErrorCap } from "@noldova/desktop.runtime";
   *
   * await StandardErrorCap.keepAsync("/data/logs/errors.log", "/data/logs/errors.previous.log", new DiagnosticRedactor(homedir()));
   * ```
   */
  public static keepAsync(file: string, previousFile: string, redactor: DiagnosticRedactor, limit?: number): Promise<void>;

  /**
   * Checks the standard error once, after any check already running, and cuts it back when it is one of the files and over its limit. A check
   * that fails because a file is missing, refused or closed leaves the file for the next one, and a previous file that can't be written still
   * leaves the file emptied.
   *
   * @returns A promise that settles once the check is done.
   * @throws {Error} The promise rejects when the check fails for any other reason.
   * @example
   * ```ts
   * import type { StandardErrorCap } from "@noldova/desktop.runtime";
   *
   * export async function checkNowAsync(cap: StandardErrorCap): Promise<void> {
   *   await cap.checkAsync();
   * }
   * ```
   */
  public checkAsync(): Promise<void>;

  /**
   * Stops checking, after one last check, so what was written just before is bounded too. A last check that fails for an unexpected reason
   * is reported to the diagnostics, as one on the timer is.
   *
   * @returns A promise that settles once the last check is done.
   */
  public [Symbol.asyncDispose](): Promise<void>;
}

/**
 * Publishes and withdraws a runtime's discovery metadata.
 */
export declare class DiscoveryPublisher {
  /**
   * Creates the publisher.
   *
   * @param lock The held ownership of the data directory.
   * @param protector Restricts the discovery folder when it is created.
   * @param replaceFileAsync Renames a file over another; `fs.promises.rename` by default.
   * @example
   * ```ts
   * import { DiscoveryPublisher, PosixFolderProtector, type OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export function createPublisher(lock: OwnershipLock): DiscoveryPublisher {
   *   return new DiscoveryPublisher(lock, new PosixFolderProtector());
   * }
   * ```
   */
  public constructor(lock: OwnershipLock, protector: IFolderProtector, replaceFileAsync?: (from: string, to: string) => Promise<void>);

  /**
   * Writes the metadata to a new owner-only file in the discovery folder and
   * renames it over the discovery file, so readers see the old or the new
   * metadata, never a partial file. The folder is created and protected when
   * missing. While another process holds the old file open, which on Windows
   * makes the rename fail with `EPERM`, `EACCES` or `EBUSY`, the rename is
   * retried for about two seconds; a rename that still fails removes the new
   * file.
   *
   * @param discovery The metadata to publish.
   * @returns A promise of the discovery file's path.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @throws {Error} The promise rejects with the rename's error when it fails
   * for another reason or the old file stays held.
   * @throws {SystemCommandException} The promise rejects when the folder
   * cannot be protected.
   * @example
   * ```ts
   * import type { DiscoveryPublisher, RuntimeDiscovery } from "@noldova/desktop.runtime";
   *
   * export function publishAsync(publisher: DiscoveryPublisher, discovery: RuntimeDiscovery): Promise<string> {
   *   return publisher.publishAsync(discovery);
   * }
   * ```
   */
  public publishAsync(discovery: RuntimeDiscovery): Promise<string>;

  /**
   * Removes the discovery file when it holds exactly this metadata.
   *
   * @param discovery The metadata this runtime published.
   * @returns A promise of whether the file was removed.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @example
   * ```ts
   * import type { DiscoveryPublisher, RuntimeDiscovery } from "@noldova/desktop.runtime";
   *
   * export function withdrawAsync(publisher: DiscoveryPublisher, discovery: RuntimeDiscovery): Promise<boolean> {
   *   return publisher.withdrawAsync(discovery);
   * }
   * ```
   */
  public withdrawAsync(discovery: RuntimeDiscovery): Promise<boolean>;

  /**
   * Removes the discovery file that an earlier owner left behind, so clients do not reach this runtime with that owner's token.
   *
   * @returns A promise that settles once no discovery file remains.
   * @throws {OwnershipReleasedException} When the ownership was released.
   * @example
   * ```ts
   * import type { DiscoveryPublisher } from "@noldova/desktop.runtime";
   *
   * export async function takeOverAsync(publisher: DiscoveryPublisher): Promise<void> {
   *   await publisher.withdrawEarlierAsync();
   * }
   * ```
   */
  public withdrawEarlierAsync(): Promise<void>;
}

/**
 * Reads the discovery metadata a runtime published.
 */
export declare class DiscoveryReader {
  /**
   * Reads the discovery file of a data directory. Reading needs no ownership;
   * a file whose owner has died stays until a runtime replaces it, so use
   * {@link OwnershipLock.isOwned} to tell a live runtime from a stale file.
   * On Windows, a file the system holds while its owner removes it, which it
   * reports as `EPERM`, `EBUSY` or `EACCES`, is read again every 50 ms, up to
   * 40 times; on other systems those errors are real and reject at once.
   *
   * @param dataDirectory The data directory.
   * @param platform The operating system, as `process.platform` names it, and
   * by default the one this process runs on.
   * @returns A promise of the metadata, or of `null` when there is no
   * discovery file, including one its owner withdraws while it is being read.
   * @throws {DiscoveryFormatException} The promise rejects when the file is not
   * valid JSON or not valid metadata; the message names the file. It rejects
   * with the system's error when the file stays held through every attempt or
   * cannot be read for another reason.
   * @example
   * ```ts
   * import { DiscoveryReader, OwnershipLock, type DataDirectory } from "@noldova/desktop.runtime";
   *
   * export async function findLiveEndpointAsync(directory: DataDirectory): Promise<string | null> {
   *   const discovery = await DiscoveryReader.readAsync(directory);
   *   return discovery === null || !OwnershipLock.isOwned(directory) ? null : discovery.endpoint;
   * }
   * ```
   */
  public static readAsync(dataDirectory: DataDirectory, platform?: string): Promise<RuntimeDiscovery | null>;
}

/**
 * A file the person handed a module's window part, which its runtime part
 * redeemed: an open, read-only handle to it, and never its path.
 */
export declare class GrantedFile implements AsyncDisposable {
  /**
   * The file's name as the person sees it.
   */
  public readonly name: string;

  /**
   * The file's media type, `application/octet-stream` when the main process
   * didn't know it.
   */
  public readonly mediaType: string;

  /**
   * The file's size in bytes, which the redeem checked against the file.
   */
  public readonly size: number;

  /**
   * The open handle, which reads the file from its start; the part reads
   * from it, such as to copy the file into its own folder, and closes it with
   * `closeAsync`.
   */
  public readonly handle: FileHandle;

  /**
   * Creates the file.
   *
   * @param name The file's name.
   * @param mediaType The file's media type.
   * @param size The file's size in bytes.
   * @param handle The open handle.
   * @param staged The path of a staged copy that closing deletes; `null`, the
   * default, for the person's own file.
   *
   * @example
   * ```ts
   * import { open } from "node:fs/promises";
   *
   * import { GrantedFile } from "@noldova/desktop.runtime";
   *
   * export async function openAsync(file: string): Promise<GrantedFile> {
   *   return new GrantedFile("notes.txt", "text/plain", 1_204, await open(file));
   * }
   * ```
   */
  public constructor(name: string, mediaType: string, size: number, handle: FileHandle, staged?: string | null);

  /**
   * Closes the handle and deletes a staged copy; a second call waits for the
   * first.
   *
   * @returns When the handle is closed and any staged copy is gone.
   *
   * @example
   * ```ts
   * import type { GrantedFile } from "@noldova/desktop.runtime";
   *
   * export async function keepAsync(file: GrantedFile, target: string): Promise<void> {
   *   try {
   *     await file.handle.writeFile(target);
   *   }
   *   finally {
   *     await file.closeAsync();
   *   }
   * }
   * ```
   */
  public closeAsync(): Promise<void>;

  /**
   * Closes the file, as `closeAsync` does, at the end of an `await using`.
   *
   * @returns When the file is closed.
   */
  public [Symbol.asyncDispose](): Promise<void>;
}

/**
 * The file grants the main process gives and the files runtime parts share
 * with their window, held in the runtime's memory until a part redeems one,
 * the window part discards it, its page or window ends, its main process
 * connection ends, or its lifetime runs out. A grant is redeemed once, only
 * by its module's runtime part, inside a request of the window and page it
 * was given to, and only while the file is still the regular file it was
 * granted as. A share is resolved any number of times, only by the main
 * process on the connection it was made on. A window's grants and shares count
 * together against its 256. A staged copy is deleted with its grant.
 */
export declare class FileGrantTable {
  /**
   * Creates the table.
   *
   * @param stagedFolder The data directory's staged folder, the only folder
   * whose copies the table deletes.
   * @param closures The closures that end a window's or a connection's grants.
   * @param now The clock, in milliseconds; `performance.now()` by default,
   * so a wall clock set back doesn't keep a grant alive.
   * @param removeAsync What deletes a staged copy and the staged folder;
   * `rm` from `node:fs/promises` by default.
   *
   * @example
   * ```ts
   * import { ClientClosures, DataDirectory, FileGrantTable } from "@noldova/desktop.runtime";
   *
   * export const table: FileGrantTable = new FileGrantTable(new DataDirectory("/home/person/.noldova/desktop").stagedFolder, new ClientClosures(process.stderr));
   * ```
   */
  public constructor(stagedFolder: string, closures: ClientClosures, now?: () => number, removeAsync?: (target: string, options: RmOptions) => Promise<void>);

  /**
   * The number of live grants.
   */
  public get count(): number;

  /**
   * Holds a grant the main process gave on a connection.
   *
   * @param connection The main process's connection.
   * @param file The grant.
   * @throws MethodFailureException synchronously, as `Conflict`, when the grant
   * is already held or its window already holds 256 live grants; no grant is
   * held then.
   *
   * @example
   * ```ts
   * import { FileGrant } from "@noldova/desktop.protocol";
   * import type { FileGrantTable } from "@noldova/desktop.runtime";
   *
   * export function grant(table: FileGrantTable, connection: number): void {
   *   table.issue(connection, new FileGrant("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", "/home/person/notes.txt", "notes.txt", "text/plain", 1_204,
   *     "66306:1311:1204:1761600000000000000", "notes", 3, 1, 600_000, false));
   * }
   * ```
   */
  public issue(connection: number, file: FileGrant): void;

  /**
   * Holds a file a runtime part shares with its window's page, which only
   * `resolve` reads and `redeemAsync` refuses.
   *
   * @param connection The main process's connection the page's request came on.
   * @param file The share, with the file's real path and identity.
   * @throws MethodFailureException synchronously, as `Conflict`, when the grant
   * is already held or its window already holds 256 live grants and shares; no
   * share is held then.
   *
   * @example
   * ```ts
   * import { FileGrant } from "@noldova/desktop.protocol";
   * import type { FileGrantTable } from "@noldova/desktop.runtime";
   *
   * export function share(table: FileGrantTable, connection: number): void {
   *   table.share(connection, new FileGrant("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", "/home/person/.noldova/desktop/modules/notes/photo.png", "photo.png",
   *     "image/png", 1_204, "66306:1311:1204:1761600000000000000", "notes", 3, 1, 600_000, false));
   * }
   * ```
   */
  public share(connection: number, file: FileGrant): void;

  /**
   * Returns a live share for the main process to serve, and keeps it, so a
   * page can load the file again.
   *
   * @param connection The main process's connection that asks.
   * @param grant The share's grant.
   * @returns The share.
   * @throws MethodFailureException synchronously, as `NotFound`, when the
   * grant is unknown, ended, a grant to redeem, or made on another connection.
   *
   * @example
   * ```ts
   * import type { FileGrant } from "@noldova/desktop.protocol";
   * import type { FileGrantTable } from "@noldova/desktop.runtime";
   *
   * export function resolve(table: FileGrantTable, connection: number): FileGrant {
   *   return table.resolve(connection, "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21");
   * }
   * ```
   */
  public resolve(connection: number, grant: string): FileGrant;

  /**
   * Ends the given grants that belong to the request's connection, window and
   * page, and passes over any other.
   *
   * @param request The window's request.
   * @param grants The grants to end.
   *
   * @example
   * ```ts
   * import type { FileGrantTable, RequestContext } from "@noldova/desktop.runtime";
   *
   * export function discard(table: FileGrantTable, request: RequestContext): void {
   *   table.discard(request, ["8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21"]);
   * }
   * ```
   */
  public discard(request: RequestContext, grants: readonly string[]): void;

  /**
   * Ends every grant a window's page was given.
   *
   * @param connection The main process's connection.
   * @param window The window's id.
   * @param page The page's number.
   *
   * @example
   * ```ts
   * import type { FileGrantTable } from "@noldova/desktop.runtime";
   *
   * export function endPage(table: FileGrantTable, connection: number): void {
   *   table.endPage(connection, 3, 1);
   * }
   * ```
   */
  public endPage(connection: number, window: number, page: number): void;

  /**
   * Redeems a grant for a module's runtime part, inside a request of its
   * window part, and ends the grant.
   *
   * @param module The module's id.
   * @param grant The grant the window part passed.
   * @param request The request it passed it in.
   * @returns The open file.
   * @throws MethodFailureException asynchronously: as `NotFound` when the
   * grant is unknown or ended, or was given to another module, window or
   * page, which leaves it as it was; as `InvalidParams` when the file is no
   * longer a regular file; as `Conflict` when it changed or was replaced since
   * it was granted, or can't be read. Each refusal but the first ends the grant.
   *
   * @example
   * ```ts
   * import type { FileGrantTable, GrantedFile, RequestContext } from "@noldova/desktop.runtime";
   *
   * export function redeemAsync(table: FileGrantTable, request: RequestContext): Promise<GrantedFile> {
   *   return table.redeemAsync("notes", "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", request);
   * }
   * ```
   */
  public redeemAsync(module: string, grant: string, request: RequestContext): Promise<GrantedFile>;

  /**
   * Deletes the staged folder and what it holds, as the runtime does when it
   * starts, before any grant is given. It first waits for the staged copies
   * that ended grants are still deleting, and for redeems still opening their
   * file, whose failure deletes the copy, again until none is left, including
   * those that started while it waited, so two deletes of one copy never
   * overlap, which Windows can refuse with `EPERM`. A delete that starts once
   * the folder's own removal has started isn't waited for.
   *
   * @returns When the folder is gone.
   */
  public clearStagedAsync(): Promise<void>;

  /**
   * Ends every grant and stops the table's timer, as the runtime does when it
   * stops. It starts deleting the grants' staged copies without waiting for
   * them; `clearStagedAsync` waits for them.
   */
  public dispose(): void;
}

/**
 * What a file is, from its status: its device, its file number, its size and
 * its modification time in nanoseconds, so that a file swapped in at the same
 * path doesn't pass as the one granted.
 */
export declare class FileIdentity {
  /**
   * Returns a file's identity.
   *
   * @param stats The file's status, read with `bigint: true`.
   * @returns The identity, as `<device>:<file number>:<size>:<modified>`.
   *
   * @example
   * ```ts
   * import { lstat } from "node:fs/promises";
   *
   * import { FileIdentity } from "@noldova/desktop.runtime";
   *
   * export async function identifyAsync(file: string): Promise<string> {
   *   return FileIdentity.of(await lstat(file, { bigint: true }));
   * }
   * ```
   */
  public static of(stats: BigIntStats): string;
}

/**
 * Chooses the folder protection for an operating system.
 */
export declare class FolderProtectorFactory {
  /**
   * Returns the folder protector for a platform.
   *
   * @param platform A Node.js platform name, such as `process.platform`.
   * @param command Runs Windows' system tools, or `ls` on macOS.
   * @param environment Supplies `SystemRoot` on Windows.
   * @returns A {@link WindowsFolderProtector} for `win32`, a
   * {@link MacFolderProtector} for `darwin` that reads the folder's volume
   * through the runtime's POSIX addon, otherwise a
   * {@link PosixFolderProtector}.
   * @example
   * ```ts
   * import { FolderProtectorFactory, SystemCommand, type IFolderProtector } from "@noldova/desktop.runtime";
   *
   * export const protector: IFolderProtector = FolderProtectorFactory.create("linux", new SystemCommand(), {});
   * ```
   */
  public static create(platform: string, command: SystemCommand, environment: NodeJS.ProcessEnv): IFolderProtector;
}

/**
 * Restricts a folder to the current user on macOS: it refuses a folder on a
 * volume mounted with ownership ignored, where every account acts as the
 * owner, then sets POSIX permissions (`0700`) and reads the folder's access
 * back, refusing a folder that an access control entry, such as one inherited
 * from its parent, still opens to anyone else. It never removes such an entry
 * and never changes how a volume is mounted; whoever did decides.
 */
export declare class MacFolderProtector implements IFolderProtector {
  /**
   * Creates the protector.
   *
   * @param command Runs `/bin/ls`.
   * @param addon The runtime's POSIX addon, which reads the folder's volume
   * with `readVolume`.
   * @param user The current user's short name; the process's user by
   * default.
   * @example
   * ```ts
   * import { MacFolderProtector, NativeAddon, SystemCommand, type IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export const protector: MacFolderProtector = new MacFolderProtector(new SystemCommand(),
   *   new NativeAddon<IPosixProcessAddon>(NativeAddon.locate("posix-process.node"), ["readVolume"]));
   * ```
   */
  public constructor(command: SystemCommand, addon: NativeAddon<IPosixProcessAddon>, user?: string);

  /**
   * Reads the folder's volume, then sets the folder's mode to `0700` and reads
   * its access back with `ls -led`. A volume mounted with ownership ignored
   * refuses the folder before anything changes. The folder passes when its
   * mode is `drwx------` and every line after the folder's own is an access
   * control entry that denies something or allows only the current user. A
   * line in another form, or a mode marked `+` with no entry, refuses the
   * folder.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once only the current user has access.
   * @throws {SystemCommandException} The promise rejects when `ls` fails, or
   * the folder is still open to anyone else, for example through an inherited
   * entry, when the message holds the listing, or on a volume mounted with
   * ownership ignored, when the message names the volume.
   * @throws {AddonLoadException} The promise rejects when the addon is missing,
   * fails to load, lacks `readVolume` or returns something other than a volume.
   * @throws {Error} The promise rejects with the addon's error when the system
   * cannot read the folder's volume.
   * @example
   * ```ts
   * import type { MacFolderProtector } from "@noldova/desktop.runtime";
   *
   * export function protectAsync(protector: MacFolderProtector, folder: string): Promise<void> {
   *   return protector.protectAsync(folder);
   * }
   * ```
   */
  public protectAsync(folder: string): Promise<void>;
}

/**
 * Restricts a folder to its owner with POSIX permissions (`0700`).
 */
export declare class PosixFolderProtector implements IFolderProtector {
  /**
   * Sets the folder's mode to `0700`.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once the mode is set.
   * @example
   * ```ts
   * import { PosixFolderProtector } from "@noldova/desktop.runtime";
   *
   * export function protectAsync(folder: string): Promise<void> {
   *   return new PosixFolderProtector().protectAsync(folder);
   * }
   * ```
   */
  public protectAsync(folder: string): Promise<void>;
}

/**
 * Restricts a folder to the current user on Windows: it removes inherited
 * permissions and grants the user full control, inherited by files and folders
 * created inside.
 */
export declare class WindowsFolderProtector implements IFolderProtector {
  /**
   * Creates the protector.
   *
   * @param command Runs `whoami.exe` and `icacls.exe` from
   * `%SystemRoot%\System32`.
   * @param environment Supplies `SystemRoot`.
   * @example
   * ```ts
   * import { SystemCommand, WindowsFolderProtector } from "@noldova/desktop.runtime";
   *
   * export const protector: WindowsFolderProtector = new WindowsFolderProtector(new SystemCommand(), { SystemRoot: "C:\\Windows" });
   * ```
   */
  public constructor(command: SystemCommand, environment: NodeJS.ProcessEnv);

  /**
   * Reads the current user's security identifier and replaces the folder's
   * permissions with full control for that user alone: it resets the folder
   * to the permissions it inherits, which drops every explicit entry, stops
   * inheriting, grants the user full control and reads the result back.
   *
   * @param folder The absolute path of an existing folder.
   * @returns A promise that resolves once only the current user has access.
   * @throws {SystemCommandException} The promise rejects when `SystemRoot` is
   * not set, a tool fails, the identifier cannot be read or the folder is
   * still open to anyone else afterwards.
   * @example
   * ```ts
   * import type { WindowsFolderProtector } from "@noldova/desktop.runtime";
   *
   * export function protectAsync(protector: WindowsFolderProtector, folder: string): Promise<void> {
   *   return protector.protectAsync(folder);
   * }
   * ```
   */
  public protectAsync(folder: string): Promise<void>;
}

/**
 * The exclusive ownership of a data directory, held for the owning process's
 * lifetime by an exclusive transaction in the ownership database. The
 * operating system releases it when the process ends.
 */
export declare class OwnershipLock implements Disposable {
  /**
   * The owned data directory.
   */
  public readonly dataDirectory: DataDirectory;

  private constructor();

  /**
   * Takes the directory's ownership, creating the directory when missing. It
   * waits up to 250 milliseconds for a brief {@link OwnershipLock.isOwned}
   * probe to finish.
   *
   * @param dataDirectory The directory to own.
   * @returns The held ownership.
   * @throws {DataDirectoryOwnedException} When another connection, in this or
   * another process, holds the ownership.
   * @throws {Error} When the ownership database cannot be used.
   * @example
   * ```ts
   * import { DataDirectory, OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export function canOwn(root: string): boolean {
   *   using lock = OwnershipLock.acquire(new DataDirectory(root));
   *   return lock.isHeld;
   * }
   * ```
   */
  public static acquire(dataDirectory: DataDirectory): OwnershipLock;

  /**
   * Tells whether a runtime owns the directory now, without taking the
   * ownership: it tries the exclusive transaction and rolls it back at once.
   * Nothing is created when the directory has no ownership database.
   *
   * @param dataDirectory The directory to probe.
   * @returns `true` when another connection holds the ownership.
   * @throws {Error} When the ownership database cannot be used.
   * @example
   * ```ts
   * import { DataDirectory, OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export const isLive: boolean = OwnershipLock.isOwned(new DataDirectory("/home/person/.noldova/desktop"));
   * ```
   */
  public static isOwned(dataDirectory: DataDirectory): boolean;

  /**
   * Whether the ownership is still held.
   */
  public get isHeld(): boolean;

  /**
   * Confirms that the ownership is still held.
   *
   * @throws {OwnershipReleasedException} When it was released.
   * @example
   * ```ts
   * import type { OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export function ensureOwned(lock: OwnershipLock): void {
   *   lock.requireHeld();
   * }
   * ```
   */
  public requireHeld(): void;

  /**
   * Releases the ownership; releasing again does nothing.
   *
   * @example
   * ```ts
   * import type { OwnershipLock } from "@noldova/desktop.runtime";
   *
   * export function releaseOwnership(lock: OwnershipLock): void {
   *   lock.release();
   * }
   * ```
   */
  public release(): void;

  /**
   * Releases the ownership.
   */
  public [Symbol.dispose](): void;
}

/**
 * How a newer or older build relates to another, judged by product version.
 */
export declare enum BuildRelation {
  /**
   * The build's product version is higher.
   */
  Newer = "Newer",

  /**
   * Both builds have the same product version, as successive development builds do.
   */
  SameVersion = "SameVersion",

  /**
   * The build's product version is lower.
   */
  Older = "Older"
}

/**
 * The transport of a runtime's local endpoint.
 */
export declare enum EndpointKind {
  /**
   * Loopback TCP, used on Windows.
   */
  Tcp = "Tcp",

  /**
   * A local Unix socket, used on macOS and Linux.
   */
  Socket = "Socket"
}

/**
 * The abstract category of the exceptions thrown when a runtime cannot be reached, closes the connection or
 * refuses it; catch it to handle any of them. Its subclasses are `RuntimeUnreachableException`,
 * `HandshakeTimedOutException`, `HandshakeClosedException`, `HandshakeIdentityMismatchException`,
 * `ConnectionRefusedException`, `CallUnansweredException`, `ConnectionClosedException` and
 * `EndpointUnavailableException`.
 */
export declare abstract class ConnectionException extends RuntimeException {
  /**
   * The failure the runtime answered with, a `Disconnected` failure when an established connection has ended,
   * or `null` when the runtime gave none: it could not be reached, did not finish the handshake or did not
   * answer in time.
   */
  public readonly failure: Failure | null;

  /**
   * Initializes the message, the runtime's failure and the cause for a derived exception.
   *
   * @param message The complete explanation, kept as given.
   * @param failure The failure the runtime answered with, or `null` when it gave none.
   * @param options The failure that caused this one, as its `cause`.
   * Omitted, the exception has no cause.
   * @example
   * ```ts
   * import { ConnectionException, HandshakeTimedOutException } from "@noldova/desktop.runtime";
   *
   * const exception = new HandshakeTimedOutException();
   * exception instanceof ConnectionException; // true
   * ```
   */
  protected constructor(message: string, failure: Failure | null, options?: ExceptionOptions);
}

/**
 * The exception thrown when a runtime's endpoint cannot be reached. Its `failure` is `null`.
 */
export declare class RuntimeUnreachableException extends ConnectionException {
  /**
   * The endpoint that could not be reached.
   */
  public readonly endpoint: string;

  /**
   * Creates the exception.
   *
   * @param endpoint The endpoint that could not be reached.
   * @param options The socket error, as the `cause`, if any.
   * @example
   * ```ts
   * import { ExceptionOptions } from "@noldova/context.exceptions";
   * import { RuntimeUnreachableException } from "@noldova/desktop.runtime";
   *
   * export function fail(error: Error): never {
   *   throw new RuntimeUnreachableException("tcp://127.0.0.1:4100", new ExceptionOptions(error));
   * }
   * ```
   */
  public constructor(endpoint: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a runtime does not answer the handshake in time. Its `failure` is `null`.
 */
export declare class HandshakeTimedOutException extends ConnectionException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { HandshakeTimedOutException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new HandshakeTimedOutException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a runtime closes the connection during the handshake without a failure. Its
 * `failure` is `null`.
 */
export declare class HandshakeClosedException extends ConnectionException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { HandshakeClosedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new HandshakeClosedException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a runtime answers the handshake with another build's identity. Its `failure` is
 * `null`.
 */
export declare class HandshakeIdentityMismatchException extends ConnectionException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { HandshakeIdentityMismatchException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new HandshakeIdentityMismatchException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a runtime refuses the connection with a failure. Its message is the failure's
 * message, written by the runtime, and its `failure` is that failure.
 */
export declare class ConnectionRefusedException extends ConnectionException {
  /**
   * Creates the exception.
   *
   * @param failure The failure the runtime refused the connection with.
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/desktop.protocol";
   * import { ConnectionRefusedException } from "@noldova/desktop.runtime";
   *
   * export function refuse(): never {
   *   throw new ConnectionRefusedException(new Failure(FailureCode.Unauthorized, "The capability token is not valid for this runtime."));
   * }
   * ```
   */
  public constructor(failure: Failure);
}

/**
 * The exception thrown when a runtime does not answer a call in time. Its `failure` is `null`.
 */
export declare class CallUnansweredException extends ConnectionException {
  /**
   * The method the runtime did not answer.
   */
  public readonly method: string;

  /**
   * Creates the exception.
   *
   * @param method The method the runtime did not answer.
   * @example
   * ```ts
   * import { CallUnansweredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new CallUnansweredException("desktop.work");
   * }
   * ```
   */
  public constructor(method: string);
}

/**
 * The exception a pending call fails with when the connection to the runtime closes. Its `failure` is a
 * `Disconnected` failure with the same message.
 */
export declare class ConnectionClosedException extends ConnectionException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { ConnectionClosedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ConnectionClosedException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the runtime's local endpoint has no address once it listens. Its `failure` is
 * `null`.
 */
export declare class EndpointUnavailableException extends ConnectionException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { EndpointUnavailableException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new EndpointUnavailableException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The abstract category of the exceptions thrown when a runtime cannot be started, does not start in time, or
 * another build's runtime does not stop; catch it to handle any of them. Its subclasses are
 * `LaunchShellUnavailableException`, `LaunchDescriptorsUnavailableException`, `LaunchStartFailedException`,
 * `AppImageCopyUnavailableException`, `AppImageCopyUnlistedException`, `MoveAsideRefusedException`,
 * `MainProcessRefusedAgainException`, `LaunchTimedOutException`, `LaunchLimitReachedException`,
 * `RuntimeExitedException`, `RuntimeExitedWithoutReasonException`, `StopRefusedException` and
 * `StopTimedOutException`.
 */
export declare abstract class LaunchException extends RuntimeException {
  /**
   * Initializes the message and the cause for a derived exception.
   *
   * @param message The complete explanation, kept as given.
   * @param options The failure that caused this one, as its `cause`.
   * Omitted, the exception has no cause.
   * @example
   * ```ts
   * import { LaunchException, LaunchTimedOutException } from "@noldova/desktop.runtime";
   *
   * const exception = new LaunchTimedOutException();
   * exception instanceof LaunchException; // true
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when Linux has no executable Bash at `/bin/bash` to start a program with.
 */
export declare class LaunchShellUnavailableException extends LaunchException {
  /**
   * Creates the exception.
   *
   * @param options The access check's error, as the `cause`, if any.
   * @example
   * ```ts
   * import { LaunchShellUnavailableException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new LaunchShellUnavailableException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when this process cannot read and traverse `/proc/self/fd` on Linux.
 */
export declare class LaunchDescriptorsUnavailableException extends LaunchException {
  /**
   * Creates the exception.
   *
   * @param options The access check's error, as the `cause`, if any.
   * @example
   * ```ts
   * import { LaunchDescriptorsUnavailableException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new LaunchDescriptorsUnavailableException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when a program that starts the runtime cannot be started.
 */
export declare class LaunchStartFailedException extends LaunchException {
  /**
   * The program that could not be started.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The program that could not be started.
   * @param options The reason the system gave, as the `cause`, if any.
   * @example
   * ```ts
   * import { LaunchStartFailedException } from "@noldova/desktop.runtime";
   *
   * export function fail(program: string): never {
   *   throw new LaunchStartFailedException(program);
   * }
   * ```
   */
  public constructor(program: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an AppImage can be neither mounted nor extracted, so the runtime cannot start.
 */
export declare class AppImageCopyUnavailableException extends LaunchException {
  /**
   * The AppImage that could be neither mounted nor extracted.
   */
  public readonly image: string;

  /**
   * Creates the exception.
   *
   * @param image The AppImage that could be neither mounted nor extracted.
   * @param options The extraction's error, as the `cause`, if any.
   * @example
   * ```ts
   * import { AppImageCopyUnavailableException } from "@noldova/desktop.runtime";
   *
   * export function fail(image: string): never {
   *   throw new AppImageCopyUnavailableException(image);
   * }
   * ```
   */
  public constructor(image: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the process table does not list a process, so the runtime's AppImage copy cannot
 * be recorded.
 */
export declare class AppImageCopyUnlistedException extends LaunchException {
  /**
   * The process the process table does not list.
   */
  public readonly processId: number;

  /**
   * Creates the exception.
   *
   * @param processId The process the process table does not list.
   * @example
   * ```ts
   * import { AppImageCopyUnlistedException } from "@noldova/desktop.runtime";
   *
   * export function fail(processId: number): never {
   *   throw new AppImageCopyUnlistedException(processId);
   * }
   * ```
   */
  public constructor(processId: number);
}

/**
 * The exception thrown when the runtime refuses to move the old data aside. Its message ends with the
 * runtime's failure's message.
 */
export declare class MoveAsideRefusedException extends LaunchException {
  /**
   * The failure the runtime refused with.
   */
  public readonly failure: Failure;

  /**
   * Creates the exception.
   *
   * @param failure The failure the runtime refused with.
   * @example
   * ```ts
   * import type { Failure } from "@noldova/desktop.protocol";
   * import { MoveAsideRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(failure: Failure): never {
   *   throw new MoveAsideRefusedException(failure);
   * }
   * ```
   */
  public constructor(failure: Failure);
}

/**
 * The exception thrown when the runtime refuses the app's main process, also after the app restarted it from
 * its own program.
 */
export declare class MainProcessRefusedAgainException extends LaunchException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { MainProcessRefusedAgainException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new MainProcessRefusedAgainException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when the runtime does not start in time.
 */
export declare class LaunchTimedOutException extends LaunchException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { LaunchTimedOutException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new LaunchTimedOutException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a runtime holds the data directory but is not reachable within the launch limit.
 */
export declare class LaunchLimitReachedException extends LaunchException {
  /**
   * The launch limit that was reached, in milliseconds.
   */
  public readonly milliseconds: number;

  /**
   * Creates the exception.
   *
   * @param milliseconds The launch limit that was reached, in milliseconds; the message gives it in seconds.
   * @example
   * ```ts
   * import { LaunchLimitReachedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new LaunchLimitReachedException(120000);
   * }
   * ```
   */
  public constructor(milliseconds: number);
}

/**
 * The exception thrown when the runtime exits while starting. Its message ends with the end of what the
 * runtime wrote before it exited.
 */
export declare class RuntimeExitedException extends LaunchException {
  /**
   * The end of what the runtime wrote before it exited, redacted.
   */
  public readonly output: string;

  /**
   * Creates the exception.
   *
   * @param output The end of what the runtime wrote before it exited, redacted.
   * @example
   * ```ts
   * import { RuntimeExitedException } from "@noldova/desktop.runtime";
   *
   * export function fail(output: string): never {
   *   throw new RuntimeExitedException(output);
   * }
   * ```
   */
  public constructor(output: string);
}

/**
 * The exception thrown when the runtime exits while starting and leaves no reason.
 */
export declare class RuntimeExitedWithoutReasonException extends LaunchException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { RuntimeExitedWithoutReasonException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new RuntimeExitedWithoutReasonException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when another build's runtime refuses to stop. Its message ends with the runtime's
 * failure's message.
 */
export declare class StopRefusedException extends LaunchException {
  /**
   * The failure the other build's runtime refused with.
   */
  public readonly failure: Failure;

  /**
   * Creates the exception.
   *
   * @param failure The failure the other build's runtime refused with.
   * @example
   * ```ts
   * import type { Failure } from "@noldova/desktop.protocol";
   * import { StopRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(failure: Failure): never {
   *   throw new StopRefusedException(failure);
   * }
   * ```
   */
  public constructor(failure: Failure);
}

/**
 * The exception thrown when another build's runtime does not stop in time.
 */
export declare class StopTimedOutException extends LaunchException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { StopTimedOutException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new StopTimedOutException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The abstract category of the exceptions thrown when the runtime cannot load
 * one of its addons, or loads one from another build; catch it to handle any
 * of them. Its subclasses are `AddonMissingException`,
 * `AddonLoadFailedException`, `AddonIncompleteException` and
 * `AddonUnexpectedValueException`.
 */
export declare abstract class AddonLoadException extends RuntimeException {
  /**
   * Initializes the message and the cause for a derived exception.
   *
   * @param message The complete explanation, kept as given.
   * @param options The failure that caused this one, as its `cause`.
   * Omitted, the exception has no cause.
   * @example
   * ```ts
   * import { AddonIncompleteException, AddonLoadException } from "@noldova/desktop.runtime";
   *
   * const exception = new AddonIncompleteException("win32-x64/windows-process.node");
   * exception instanceof AddonLoadException; // true
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the runtime has no build of an addon for this
 * platform and processor.
 */
export declare class AddonMissingException extends AddonLoadException {
  /**
   * The platform and processor the addon was looked for, such as `linux-x64`.
   */
  public readonly target: string;

  /**
   * The addon's file name.
   */
  public readonly file: string;

  /**
   * Creates the exception.
   *
   * @param target The platform and processor the addon was looked for, such as `linux-x64`.
   * @param file The addon's file name.
   * @example
   * ```ts
   * import { AddonMissingException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new AddonMissingException("linux-riscv64", "posix-process.node");
   * }
   * ```
   */
  public constructor(target: string, file: string);
}

/**
 * The exception thrown when loading one of the runtime's addons raises an
 * error.
 */
export declare class AddonLoadFailedException extends AddonLoadException {
  /**
   * The addon's path under `native`, such as `win32-x64/windows-process.node`.
   */
  public readonly addon: string;

  /**
   * Creates the exception.
   *
   * @param addon The addon's path under `native`.
   * @param options The error that loading it raised, as the `cause`, if any.
   * @example
   * ```ts
   * import { AddonLoadFailedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new AddonLoadFailedException("linux-x64/posix-process.node");
   * }
   * ```
   */
  public constructor(addon: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when one of the runtime's addons lacks functions the
 * runtime calls, because it comes from another build.
 */
export declare class AddonIncompleteException extends AddonLoadException {
  /**
   * The addon's path under `native`, such as `win32-x64/windows-process.node`.
   */
  public readonly addon: string;

  /**
   * Creates the exception.
   *
   * @param addon The addon's path under `native`.
   * @example
   * ```ts
   * import { AddonIncompleteException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new AddonIncompleteException("win32-x64/windows-process.node");
   * }
   * ```
   */
  public constructor(addon: string);
}

/**
 * The exception thrown when one of the runtime's addons returns a value the
 * runtime does not expect, because it comes from another build.
 */
export declare class AddonUnexpectedValueException extends AddonLoadException {
  /**
   * The addon's path under `native`, such as `darwin-arm64/posix-process.node`.
   */
  public readonly addon: string;

  /**
   * Creates the exception.
   *
   * @param addon The addon's path under `native`.
   * @example
   * ```ts
   * import { AddonUnexpectedValueException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new AddonUnexpectedValueException("darwin-arm64/posix-process.node");
   * }
   * ```
   */
  public constructor(addon: string);
}

/**
 * The abstract category of the exceptions thrown when a module's program is not found or cannot be started;
 * catch it to handle any of them. Its subclasses are `ProgramNotFoundException`, `ProgramPathRelativeException`,
 * `ProcessStartFailedException`, `ModuleStoppingException`, `UpdatePreparingException`,
 * `PseudoTerminalsUndeclaredException`, `BatchSystemRootMissingException`, `BatchArgumentRefusedException`,
 * `VerbatimBatchRefusedException`, `PseudoTerminalCommandLineRefusedException`,
 * `PseudoTerminalCommandLineWithArgumentsException`, `PseudoTerminalCommandLineBatchRefusedException` and
 * `PseudoTerminalBatchRefusedException`.
 */
export declare abstract class ProcessStartException extends RuntimeException {
  /**
   * Initializes the message and the cause for a derived exception.
   *
   * @param message The complete explanation, kept as given.
   * @param options The failure that caused this one, as its `cause`.
   * Omitted, the exception has no cause.
   * @example
   * ```ts
   * import { ProcessStartException, ProgramNotFoundException } from "@noldova/desktop.runtime";
   *
   * const exception = new ProgramNotFoundException("git");
   * exception instanceof ProcessStartException; // true
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a program is not found, or is not a program that can be run.
 */
export declare class ProgramNotFoundException extends ProcessStartException {
  /**
   * The program as the module named it.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The program as the module named it.
   * @example
   * ```ts
   * import { ProgramNotFoundException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ProgramNotFoundException("git");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a program is neither a program's name nor an absolute path.
 */
export declare class ProgramPathRelativeException extends ProcessStartException {
  /**
   * The program as the module named it.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The program as the module named it.
   * @example
   * ```ts
   * import { ProgramPathRelativeException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ProgramPathRelativeException("bin/tool");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a module's program cannot be started.
 */
export declare class ProcessStartFailedException extends ProcessStartException {
  /**
   * The program that could not be started.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The program that could not be started.
   * @param options The reason the system gave, as the `cause`, if any.
   * @example
   * ```ts
   * import { ProcessStartFailedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ProcessStartFailedException("/usr/bin/git");
   * }
   * ```
   */
  public constructor(program: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module asks to start a program while it is stopping.
 */
export declare class ModuleStoppingException extends ProcessStartException {
  /**
   * The module that is stopping.
   */
  public readonly moduleId: string;

  /**
   * The program that was not started.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The module that is stopping.
   * @param program The program that was not started.
   * @example
   * ```ts
   * import { ModuleStoppingException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ModuleStoppingException("notes", "git");
   * }
   * ```
   */
  public constructor(moduleId: string, program: string);
}

/**
 * The exception thrown when a module asks to start a program while the runtime prepares for an update.
 */
export declare class UpdatePreparingException extends ProcessStartException {
  /**
   * The module that asked to start the program.
   */
  public readonly moduleId: string;

  /**
   * The program that was not started.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The module that asked to start the program.
   * @param program The program that was not started.
   * @example
   * ```ts
   * import { UpdatePreparingException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new UpdatePreparingException("notes", "git");
   * }
   * ```
   */
  public constructor(moduleId: string, program: string);
}

/**
 * The exception thrown when a module that does not declare `pseudoTerminals` asks to start a program in a
 * pseudo-terminal.
 */
export declare class PseudoTerminalsUndeclaredException extends ProcessStartException {
  /**
   * The module that does not declare `pseudoTerminals`.
   */
  public readonly moduleId: string;

  /**
   * The program that was not started.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The module that does not declare `pseudoTerminals`.
   * @param program The program that was not started.
   * @example
   * ```ts
   * import { PseudoTerminalsUndeclaredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PseudoTerminalsUndeclaredException("terminal", "bash");
   * }
   * ```
   */
  public constructor(moduleId: string, program: string);
}

/**
 * The exception thrown when a batch file is to start through `cmd.exe` but `SystemRoot` is not set, so
 * `cmd.exe` cannot be found.
 */
export declare class BatchSystemRootMissingException extends ProcessStartException {
  /**
   * Creates the exception.
   *
   * @example
   * ```ts
   * import { BatchSystemRootMissingException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new BatchSystemRootMissingException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception thrown when a batch file whose program could not be traced is given an argument `cmd.exe`
 * cannot take.
 */
export declare class BatchArgumentRefusedException extends ProcessStartException {
  /**
   * The batch file.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The batch file.
   * @example
   * ```ts
   * import { BatchArgumentRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new BatchArgumentRefusedException("C:/tools/build.cmd");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a process request asks to pass its arguments as they are to a batch file.
 */
export declare class VerbatimBatchRefusedException extends ProcessStartException {
  /**
   * The batch file.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The batch file.
   * @example
   * ```ts
   * import { VerbatimBatchRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new VerbatimBatchRefusedException("C:/tools/build.cmd");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a pseudo-terminal is given a command line to pass as it is outside Windows.
 */
export declare class PseudoTerminalCommandLineRefusedException extends ProcessStartException {
  /**
   * The program the command line was for.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The program the command line was for.
   * @example
   * ```ts
   * import { PseudoTerminalCommandLineRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PseudoTerminalCommandLineRefusedException("bash");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a pseudo-terminal is given both a command line to pass as it is and arguments.
 */
export declare class PseudoTerminalCommandLineWithArgumentsException extends ProcessStartException {
  /**
   * The program the command line was for.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The program the command line was for.
   * @example
   * ```ts
   * import { PseudoTerminalCommandLineWithArgumentsException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PseudoTerminalCommandLineWithArgumentsException("cmd.exe");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a pseudo-terminal is given a command line to pass as it is to a batch file.
 */
export declare class PseudoTerminalCommandLineBatchRefusedException extends ProcessStartException {
  /**
   * The batch file.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The batch file.
   * @example
   * ```ts
   * import { PseudoTerminalCommandLineBatchRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PseudoTerminalCommandLineBatchRefusedException("C:/tools/build.cmd");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when a pseudo-terminal is asked to start a batch file whose program could not be
 * traced.
 */
export declare class PseudoTerminalBatchRefusedException extends ProcessStartException {
  /**
   * The batch file.
   */
  public readonly program: string;

  /**
   * Creates the exception.
   *
   * @param program The batch file.
   * @example
   * ```ts
   * import { PseudoTerminalBatchRefusedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PseudoTerminalBatchRefusedException("C:/tools/build.cmd");
   * }
   * ```
   */
  public constructor(program: string);
}

/**
 * The exception thrown when the build's product file cannot be read: the file
 * is missing or not JSON, or a field is missing or blank. Its message names
 * the file and the problem.
 */
export declare class ProductFileException extends RuntimeException {
  /**
   * The path of the product file that is not valid.
   */
  public readonly file: string;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param file The path of the product file.
   * @param cause The error that reading or parsing the file gave.
   * @example
   * ```ts
   * import { ProductFileException } from "@noldova/desktop.runtime";
   *
   * export function fail(error: unknown): never {
   *   throw new ProductFileException("/opt/noldova-desktop/product.json", error);
   * }
   * ```
   */
  public constructor(file: string, cause: unknown);
}

/**
 * The exception a method handler throws to answer its request with a specific failure.
 */
export declare class MethodFailureException extends RuntimeException {
  /**
   * The failure the request is answered with.
   */
  public readonly failure: Failure;

  /**
   * Creates the exception.
   *
   * @param failure The failure to answer with; its message becomes the exception's message.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/desktop.protocol";
   * import { MethodFailureException } from "@noldova/desktop.runtime";
   *
   * export function fail(path: string): never {
   *   throw new MethodFailureException(new Failure(FailureCode.NotFound, `The note ${path} does not exist.`, { path }));
   * }
   * ```
   */
  public constructor(failure: Failure, options?: ExceptionOptions);
}

/**
 * The exception a web view call rejects with when the main process refuses or
 * fails it, or can't be reached, as `documents/WEB-VIEWS.md` says.
 */
export declare class WebViewFailureException extends RuntimeException {
  /**
   * The failure: its kind, the engine's code and message for a `Protocol`
   * failure, and the host's message naming the rule for a refusal that has
   * one.
   */
  public readonly failure: WebViewFailure;

  /**
   * Creates the exception.
   *
   * @param failure The failure; its message, or one naming its kind, becomes
   * the exception's message.
   * @example
   * ```ts
   * import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
   * import { WebViewFailureException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new WebViewFailureException(new WebViewFailure(WebViewFailureKind.Unavailable));
   * }
   * ```
   */
  public constructor(failure: WebViewFailure);
}

/**
 * The exception thrown when the data directory holds data from a release that predates the shell. The runtime is refusing until the data is moved aside.
 */
export declare class PreShellDataFoundException extends RuntimeException {
  /**
   * Where the old data is.
   */
  public readonly data: PreShellData;

  /**
   * Creates the exception.
   *
   * @param data Where the old data is.
   * @example
   * ```ts
   * import { PreShellData } from "@noldova/desktop.protocol";
   * import { PreShellDataFoundException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PreShellDataFoundException(new PreShellData("/home/person/.noldova/desktop"));
   * }
   * ```
   */
  public constructor(data: PreShellData);
}

/**
 * The category of the exceptions thrown when the build's module declarations cannot be read:
 * {@link DeclarationsUnreadableException}, {@link DeclarationsVersionUnsupportedException},
 * {@link DeclarationNotObjectException}, {@link DeclarationFieldInvalidException} and
 * {@link ModuleIdDeviceException}. Catch it to handle any of them.
 */
export declare abstract class DeclarationsFormatException extends RuntimeException {
  /**
   * Creates the exception, for a subclass.
   *
   * @param message What is wrong.
   * @param options The cause, when another error led to this one.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the module declarations file is missing, not JSON or not
 * valid declarations. Its message names the file and ends with the cause's text.
 */
export declare class DeclarationsUnreadableException extends DeclarationsFormatException {
  /**
   * The declarations file.
   */
  public readonly file: string;

  /**
   * Creates the exception.
   *
   * @param file The declarations file.
   * @param cause The failure that made it unreadable; it becomes the exception's cause.
   * @example
   * ```ts
   * import { DeclarationsUnreadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(error: unknown): never {
   *   throw new DeclarationsUnreadableException("/opt/app/resources/modules.json", error);
   * }
   * ```
   */
  public constructor(file: string, cause: unknown);
}

/**
 * The exception thrown when the module declarations have a format version this build does not read.
 */
export declare class DeclarationsVersionUnsupportedException extends DeclarationsFormatException {
  /**
   * The format version the declarations have, `undefined` when they have none.
   */
  public readonly version: unknown;

  /**
   * Creates the exception.
   *
   * @param version The format version the declarations have, `undefined` when they have none.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { DeclarationsVersionUnsupportedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DeclarationsVersionUnsupportedException(3);
   * }
   * ```
   */
  public constructor(version: unknown, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module declaration is not a JSON object.
 */
export declare class DeclarationNotObjectException extends DeclarationsFormatException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The parse failure, if any.
   * @example
   * ```ts
   * import { DeclarationNotObjectException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DeclarationNotObjectException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when a field of the declarations or of a module declaration is missing or invalid.
 */
export declare class DeclarationFieldInvalidException extends DeclarationsFormatException {
  /**
   * The missing or invalid field.
   */
  public readonly field: string;

  /**
   * Creates the exception.
   *
   * @param field The missing or invalid field.
   * @param options The parse failure, if any.
   * @example
   * ```ts
   * import { DeclarationFieldInvalidException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new DeclarationFieldInvalidException("id");
   * }
   * ```
   */
  public constructor(field: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a declared module id names a device on Windows, so it is refused on every platform.
 */
export declare class ModuleIdDeviceException extends DeclarationsFormatException {
  /**
   * The refused module id.
   */
  public readonly moduleId: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The refused module id.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ModuleIdDeviceException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ModuleIdDeviceException("con");
   * }
   * ```
   */
  public constructor(moduleId: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module's runtime package does not export a
 * `RuntimePart` class whose instances can activate and deactivate.
 */
export declare class ModuleLoadException extends RuntimeException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { ModuleLoadException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ModuleLoadException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The category of the exceptions thrown when a module asks for a service it may not use,
 * one that is not published, or one that is not of the requested type:
 * {@link ServiceNotAllowedException}, {@link ServiceMissingException} and
 * {@link ServiceTypeMismatchException}. Catch it to handle any of them.
 */
export declare abstract class ServiceAccessException extends RuntimeException {
  /**
   * Creates the exception, for a subclass.
   *
   * @param message What went wrong.
   * @param options The failure that caused it, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module asks for a service that is neither the shell's nor
 * one of a module it depends on.
 */
export declare class ServiceNotAllowedException extends ServiceAccessException {
  /**
   * The asking module.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the service asked for.
   */
  public readonly service: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The asking module.
   * @param service The qualified name of the service asked for.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ServiceNotAllowedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ServiceNotAllowedException("notes", "tasks.store");
   * }
   * ```
   */
  public constructor(moduleId: string, service: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module asks for a service that no one publishes.
 */
export declare class ServiceMissingException extends ServiceAccessException {
  /**
   * The qualified name of the service asked for.
   */
  public readonly service: string;

  /**
   * Creates the exception.
   *
   * @param service The qualified name of the service asked for.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ServiceMissingException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ServiceMissingException("tasks.store");
   * }
   * ```
   */
  public constructor(service: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when the published service a module asks for is not of the requested type.
 */
export declare class ServiceTypeMismatchException extends ServiceAccessException {
  /**
   * The qualified name of the service asked for.
   */
  public readonly service: string;

  /**
   * The name of the requested type.
   */
  public readonly type: string;

  /**
   * Creates the exception.
   *
   * @param service The qualified name of the service asked for.
   * @param type The name of the requested type.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ServiceTypeMismatchException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ServiceTypeMismatchException("tasks.store", "TaskStore");
   * }
   * ```
   */
  public constructor(service: string, type: string, options?: ExceptionOptions);
}

/**
 * The category of the exceptions thrown when a registration is refused: a name registered twice,
 * an event published after it was withdrawn, or a module reaching past its declaration or its own
 * names. Its subclasses are {@link NotContributedException}, {@link ServiceNotOwnedException},
 * {@link CommandRegisteredException}, {@link MethodRegisteredException},
 * {@link EventDeclaredException}, {@link EventWithdrawnException},
 * {@link ServicePublishedException}, {@link ToolRegisteredException},
 * {@link NotificationKindChangedException}, {@link NotificationCommandNotAllowedException},
 * {@link AnswererRegisteredException}, {@link SecretNotOwnedException},
 * {@link SettingNotReadableException}, {@link SettingNotWritableException} and
 * {@link SettingScopeNotOwnedException}. Catch it to handle any of them.
 */
export declare abstract class RegistrationException extends RuntimeException {
  /**
   * Creates the exception, for a subclass.
   *
   * @param message What went wrong.
   * @param options The failure that caused it, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module registers a name its declaration does not contribute.
 */
export declare class NotContributedException extends RegistrationException {
  /**
   * The module that registered the name.
   */
  public readonly moduleId: string;

  /**
   * The kind of contribution, such as `commands`, `tools` or `notifications`.
   */
  public readonly kind: string;

  /**
   * The name the declaration does not contribute.
   */
  public readonly contribution: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The module that registered the name.
   * @param kind The kind of contribution.
   * @param contribution The name the declaration does not contribute.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { NotContributedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new NotContributedException("notes", "commands", "notes.open");
   * }
   * ```
   */
  public constructor(moduleId: string, kind: string, contribution: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module publishes a service under another owner's id.
 */
export declare class ServiceNotOwnedException extends RegistrationException {
  /**
   * The publishing module.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the service.
   */
  public readonly service: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The publishing module.
   * @param service The qualified name of the service.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ServiceNotOwnedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ServiceNotOwnedException("notes", "tasks.store");
   * }
   * ```
   */
  public constructor(moduleId: string, service: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a command is registered twice.
 */
export declare class CommandRegisteredException extends RegistrationException {
  /**
   * The qualified name of the command.
   */
  public readonly command: string;

  /**
   * Creates the exception.
   *
   * @param command The qualified name of the command.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { CommandRegisteredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new CommandRegisteredException("notes.open");
   * }
   * ```
   */
  public constructor(command: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a method is registered twice.
 */
export declare class MethodRegisteredException extends RegistrationException {
  /**
   * The qualified name of the method.
   */
  public readonly method: string;

  /**
   * Creates the exception.
   *
   * @param method The qualified name of the method.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { MethodRegisteredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new MethodRegisteredException("notes.open");
   * }
   * ```
   */
  public constructor(method: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an event is declared twice.
 */
export declare class EventDeclaredException extends RegistrationException {
  /**
   * The qualified name of the event.
   */
  public readonly event: string;

  /**
   * Creates the exception.
   *
   * @param event The qualified name of the event.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { EventDeclaredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new EventDeclaredException("notes.saved");
   * }
   * ```
   */
  public constructor(event: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an event is published after it was withdrawn.
 */
export declare class EventWithdrawnException extends RegistrationException {
  /**
   * The qualified name of the event.
   */
  public readonly event: string;

  /**
   * Creates the exception.
   *
   * @param event The qualified name of the event.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { EventWithdrawnException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new EventWithdrawnException("notes.saved");
   * }
   * ```
   */
  public constructor(event: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a service is published twice.
 */
export declare class ServicePublishedException extends RegistrationException {
  /**
   * The qualified name of the service.
   */
  public readonly service: string;

  /**
   * Creates the exception.
   *
   * @param service The qualified name of the service.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ServicePublishedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ServicePublishedException("notes.store");
   * }
   * ```
   */
  public constructor(service: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a tool is registered twice.
 */
export declare class ToolRegisteredException extends RegistrationException {
  /**
   * The qualified name of the tool.
   */
  public readonly tool: string;

  /**
   * Creates the exception.
   *
   * @param tool The qualified name of the tool.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { ToolRegisteredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new ToolRegisteredException("notes.search");
   * }
   * ```
   */
  public constructor(tool: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when an update gives a notification another kind than the one it was posted with.
 */
export declare class NotificationKindChangedException extends RegistrationException {
  /**
   * The id of the notification.
   */
  public readonly notificationId: string;

  /**
   * The kind the notification was posted with, which an update keeps.
   */
  public readonly kind: string;

  /**
   * Creates the exception.
   *
   * @param notificationId The id of the notification.
   * @param kind The kind the notification was posted with.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { NotificationKindChangedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new NotificationKindChangedException("n-1", "notes.saved");
   * }
   * ```
   */
  public constructor(notificationId: string, kind: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module's notification offers a command that is neither its own nor a dependency's.
 */
export declare class NotificationCommandNotAllowedException extends RegistrationException {
  /**
   * The posting module.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the offered command.
   */
  public readonly command: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The posting module.
   * @param command The qualified name of the offered command.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { NotificationCommandNotAllowedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new NotificationCommandNotAllowedException("notes", "tasks.open");
   * }
   * ```
   */
  public constructor(moduleId: string, command: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module registers a second answerer for permission requests.
 */
export declare class AnswererRegisteredException extends RegistrationException {
  /**
   * The module that already registered an answerer.
   */
  public readonly moduleId: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The module that already registered an answerer.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { AnswererRegisteredException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new AnswererRegisteredException("notes");
   * }
   * ```
   */
  public constructor(moduleId: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module uses a secret that is not its own.
 */
export declare class SecretNotOwnedException extends RegistrationException {
  /**
   * The module that used the secret.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the secret.
   */
  public readonly secret: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The module that used the secret.
   * @param secret The qualified name of the secret.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SecretNotOwnedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SecretNotOwnedException("notes", "tasks.token");
   * }
   * ```
   */
  public constructor(moduleId: string, secret: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module reads a setting that is neither its own, a dependency's nor the shell's.
 */
export declare class SettingNotReadableException extends RegistrationException {
  /**
   * The reading module.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the setting.
   */
  public readonly setting: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The reading module.
   * @param setting The qualified name of the setting.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingNotReadableException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingNotReadableException("notes", "tasks.speed");
   * }
   * ```
   */
  public constructor(moduleId: string, setting: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module changes a setting that is not its own.
 */
export declare class SettingNotWritableException extends RegistrationException {
  /**
   * The changing module.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the setting.
   */
  public readonly setting: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The changing module.
   * @param setting The qualified name of the setting.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingNotWritableException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingNotWritableException("notes", "tasks.speed");
   * }
   * ```
   */
  public constructor(moduleId: string, setting: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module describes a setting scope it does not declare, or names
 * as a parent a scope that is neither its own nor a dependency's.
 */
export declare class SettingScopeNotOwnedException extends RegistrationException {
  /**
   * The describing module.
   */
  public readonly moduleId: string;

  /**
   * The qualified name of the scope.
   */
  public readonly scope: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The describing module.
   * @param scope The qualified name of the scope.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingScopeNotOwnedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingScopeNotOwnedException("notes", "tasks.board");
   * }
   * ```
   */
  public constructor(moduleId: string, scope: string, options?: ExceptionOptions);
}

/**
 * The category of the exceptions thrown when a setting is not declared, does not accept a
 * value or a scope, or is a device setting given no device: {@link SettingUnknownException},
 * {@link SettingValueInvalidException}, {@link SettingScopeNotAllowedException} and
 * {@link SettingNeedsDeviceException}. A method that lets one escape answers with its
 * failure. Catch it to handle any of them.
 */
export declare abstract class SettingException extends MethodFailureException {
  /**
   * Creates the exception, for a subclass.
   *
   * @param failure The failure to answer with; its message becomes the exception's message.
   * @param options The failure that caused it, if any.
   */
  protected constructor(failure: Failure, options?: ExceptionOptions);
}

/**
 * The exception thrown when no setting of the name is declared. Its failure has the code `NotFound`.
 */
export declare class SettingUnknownException extends SettingException {
  /**
   * The qualified name of the setting.
   */
  public readonly setting: string;

  /**
   * Creates the exception.
   *
   * @param setting The qualified name of the setting.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingUnknownException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingUnknownException("clock.speed");
   * }
   * ```
   */
  public constructor(setting: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a setting does not accept a value. Its failure has the code `InvalidParams`.
 */
export declare class SettingValueInvalidException extends SettingException {
  /**
   * The qualified name of the setting.
   */
  public readonly setting: string;

  /**
   * Creates the exception.
   *
   * @param setting The qualified name of the setting.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingValueInvalidException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingValueInvalidException("clock.speed");
   * }
   * ```
   */
  public constructor(setting: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a setting does not list a scope. Its failure has the code `InvalidParams`.
 */
export declare class SettingScopeNotAllowedException extends SettingException {
  /**
   * The qualified name of the setting.
   */
  public readonly setting: string;

  /**
   * The qualified name of the scope the setting does not list.
   */
  public readonly scope: string;

  /**
   * Creates the exception.
   *
   * @param setting The qualified name of the setting.
   * @param scope The qualified name of the scope the setting does not list.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingScopeNotAllowedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingScopeNotAllowedException("clock.speed", "clock.face");
   * }
   * ```
   */
  public constructor(setting: string, scope: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a setting kept per device is given no device. Its failure has the code `InvalidParams`.
 */
export declare class SettingNeedsDeviceException extends SettingException {
  /**
   * The qualified name of the setting.
   */
  public readonly setting: string;

  /**
   * Creates the exception.
   *
   * @param setting The qualified name of the setting.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { SettingNeedsDeviceException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new SettingNeedsDeviceException("clock.speed");
   * }
   * ```
   */
  public constructor(setting: string, options?: ExceptionOptions);
}

/**
 * Thrown when another build's runtime owns the data directory and the client
 * was told not to take it over.
 */
export declare class BuildMismatchException extends RuntimeException {
  /**
   * The running runtime's build identity and the program it runs from.
   */
  public readonly handover: RuntimeHandover;

  /**
   * Creates the exception.
   *
   * @param handover The running runtime's identity and program.
   * @example
   * ```ts
   * import { type BuildIdentity, RuntimeHandover } from "@noldova/desktop.protocol";
   * import { BuildMismatchException } from "@noldova/desktop.runtime";
   *
   * export function refuse(running: BuildIdentity): never {
   *   throw new BuildMismatchException(new RuntimeHandover(running, "/opt/noldova-desktop/noldova-desktop"));
   * }
   * ```
   */
  public constructor(handover: RuntimeHandover);
}

/**
 * Where an installation's update stands in its launch barrier.
 */
export declare enum UpdateBarrierState {
  /**
   * The update is saving and stopping the installation's processes.
   */
  Preparing = "Preparing",

  /**
   * Every runtime has exited, and the installation's main processes quit.
   */
  Closing = "Closing",

  /**
   * Every process has exited, and the update was handed to the installer.
   */
  HandedOff = "HandedOff"
}

/**
 * What an installation's launch barrier means for a client that wants to
 * start a runtime.
 */
export declare enum UpdateBarrierStatus {
  /**
   * No barrier holds, or a barrier left behind was settled and removed.
   */
  None = "None",

  /**
   * An update is under way: the barrier's holder, or the process that took
   * its handoff, still runs.
   */
  Held = "Held",

  /**
   * An update handed off to another version whose handoff process is gone or
   * unknown may have failed or may still be installing, or the barrier cannot
   * be read; it is removed only once the person confirms.
   */
  Unfinished = "Unfinished"
}

/**
 * Thrown when an installation's launch barrier keeps a client from starting
 * a runtime.
 */
export declare class UpdateInProgressException extends RuntimeException {
  /**
   * Whether an update is under way or may not have finished.
   */
  public readonly status: UpdateBarrierStatus;

  /**
   * Creates the exception.
   *
   * @param status `Held` or `Unfinished`.
   * @example
   * ```ts
   * import { UpdateBarrierStatus, UpdateInProgressException } from "@noldova/desktop.runtime";
   *
   * export function refuse(): never {
   *   throw new UpdateInProgressException(UpdateBarrierStatus.Held);
   * }
   * ```
   */
  public constructor(status: UpdateBarrierStatus);
}

/**
 * A closure a runtime part hears through `IRuntimePartContext.onClientClosed`: one window of a connection closed for
 * good, or the whole connection closed.
 */
export declare class ClientClosure {
  /**
   * The connection's number, as requests' `RequestContext.connection` gives it.
   */
  public readonly connection: number;

  /**
   * The window that closed, as its requests' `RequestContext.window` gives it; `null` when the whole connection
   * closed, with every window it had.
   */
  public readonly window: number | null;

  /**
   * Creates the closure.
   *
   * @param connection The connection's number.
   * @param window The window's id, or `null` for the whole connection.
   * @example
   * ```ts
   * import { ClientClosure } from "@noldova/desktop.runtime";
   *
   * export const closed: ClientClosure = new ClientClosure(1, 3);
   * ```
   */
  public constructor(connection: number, window: number | null);
}

/**
 * The app's own windows and shortcuts as the main process reports them, through `desktop.appWindowsChanged` and
 * `desktop.appShortcutsChanged`, for every module's `appWindows` and `shortcuts`. Each list is the whole list its last
 * report gave, and empties when the connection that gave it closes.
 */
export declare class AppSurface {
  /**
   * Creates the lists, both empty, and empties each when the connection that last reported it closes.
   *
   * @param closures The closures that report a connection closing.
   * @param platform The platform keys are matched on, as `process.platform` names it.
   * @param diagnostics Where a listener's failure is written.
   *
   * @example
   * ```ts
   * import { AppSurface, ClientClosures } from "@noldova/desktop.runtime";
   *
   * export const surface: AppSurface = new AppSurface(new ClientClosures(process.stderr), process.platform, process.stderr);
   * ```
   */
  public constructor(closures: ClientClosures, platform: string, diagnostics: Writable);

  /**
   * The app's windows the main process last reported; empty while no main process has reported them.
   */
  public get windows(): readonly AppWindow[];

  /**
   * The app's shortcuts the main process last reported; empty while no main process has reported them.
   */
  public get shortcuts(): readonly AppShortcut[];

  /**
   * The app's main window the main process last reported; null while no main process has reported it.
   */
  public get mainWindow(): MainWindow | null;

  /**
   * Tells whether a key is one of the app's shortcuts, matched as the platform matches keys, so `Mod` and `Ctrl` are
   * one key on Windows and Linux.
   *
   * @param key The key chord.
   * @returns Whether a shortcut has that key.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   * import type { AppSurface } from "@noldova/desktop.runtime";
   *
   * export function isStopKey(surface: AppSurface): boolean {
   *   return surface.hasShortcut(KeyChord.parse("Mod+Shift+Period"));
   * }
   * ```
   */
  public hasShortcut(key: KeyChord): boolean;

  /**
   * Takes the main process's whole list of windows, and tells the listeners when it differs from the last one.
   *
   * @param connection The main process's connection.
   * @param list The windows.
   *
   * @example
   * ```ts
   * import { AppWindow, AppWindowList } from "@noldova/desktop.protocol";
   * import type { AppSurface } from "@noldova/desktop.runtime";
   *
   * export function report(surface: AppSurface): void {
   *   surface.receiveWindows(1, new AppWindowList([new AppWindow(132_406, 4_210)]));
   * }
   * ```
   */
  public receiveWindows(connection: number, list: AppWindowList): void;

  /**
   * Takes the main process's report of its main window, which it keeps until that connection closes.
   *
   * @param connection The main process's connection.
   * @param window The main window.
   *
   * @example
   * ```ts
   * import { MainWindow } from "@noldova/desktop.protocol";
   * import type { AppSurface } from "@noldova/desktop.runtime";
   *
   * export function report(surface: AppSurface): void {
   *   surface.receiveMainWindow(1, new MainWindow("Notes", true, true));
   * }
   * ```
   */
  public receiveMainWindow(connection: number, window: MainWindow): void;

  /**
   * Takes the main process's whole list of shortcuts, and tells the listeners when it differs from the last one.
   *
   * @param connection The main process's connection.
   * @param list The shortcuts.
   *
   * @example
   * ```ts
   * import { AppShortcut, AppShortcutList, KeyChord } from "@noldova/desktop.protocol";
   * import type { AppSurface } from "@noldova/desktop.runtime";
   *
   * export function report(surface: AppSurface): void {
   *   surface.receiveShortcuts(1, new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Q"), null, false)]));
   * }
   * ```
   */
  public receiveShortcuts(connection: number, list: AppShortcutList): void;

  /**
   * Listens for a change to the windows; a listener's failure is written to the diagnostics and reaches no other
   * listener.
   *
   * @param listener Called after each change.
   * @returns The registration, which stops the listening when disposed.
   *
   * @example
   * ```ts
   * import type { AppSurface, Registration } from "@noldova/desktop.runtime";
   *
   * export function watch(surface: AppSurface, report: (count: number) => void): Registration {
   *   return surface.onWindowsChanged(() => report(surface.windows.length));
   * }
   * ```
   */
  public onWindowsChanged(listener: () => void): Registration;

  /**
   * Listens for a change to the shortcuts; a listener's failure is written to the diagnostics and reaches no other
   * listener.
   *
   * @param listener Called after each change.
   * @returns The registration, which stops the listening when disposed.
   *
   * @example
   * ```ts
   * import type { AppSurface, Registration } from "@noldova/desktop.runtime";
   *
   * export function watch(surface: AppSurface, report: (count: number) => void): Registration {
   *   return surface.onShortcutsChanged(() => report(surface.shortcuts.length));
   * }
   * ```
   */
  public onShortcutsChanged(listener: () => void): Registration;
}

/**
 * The listeners that hear when a client's window or connection closes, and the server's report of each closure.
 */
export declare class ClientClosures {
  /**
   * Creates the listeners' list.
   *
   * @param diagnostics Receives a line for each listener that throws or rejects.
   * @example
   * ```ts
   * import { ClientClosures } from "@noldova/desktop.runtime";
   *
   * export const closures: ClientClosures = new ClientClosures(process.stderr);
   * ```
   */
  public constructor(diagnostics: Writable);

  /**
   * Adds a listener until the registration is disposed.
   *
   * @param listener Hears each closure.
   * @returns The registration.
   * @example
   * ```ts
   * import type { ClientClosures, Registration } from "@noldova/desktop.runtime";
   *
   * export function follow(closures: ClientClosures, closed: number[]): Registration {
   *   return closures.listen(t => { closed.push(t.connection); });
   * }
   * ```
   */
  public listen(listener: (closure: ClientClosure) => void | Promise<void>): Registration;

  /**
   * Calls every listener with the closure, at once and in the order they were added; a listener that throws or
   * rejects is logged in the diagnostics, and the others still hear it.
   *
   * @param closure The closure.
   * @example
   * ```ts
   * import { ClientClosure, type ClientClosures } from "@noldova/desktop.runtime";
   *
   * export function closeConnection(closures: ClientClosures): void {
   *   closures.report(new ClientClosure(1, null));
   * }
   * ```
   */
  public report(closure: ClientClosure): void;
}

/**
 * An authenticated connection as the runtime's server lists it.
 */
export declare class ConnectedClient {
  /**
   * The connection's number, unique for the runtime's lifetime.
   */
  public readonly connection: number;

  /**
   * The name the client gave in its handshake, such as `mainProcess` or `cli`.
   */
  public readonly client: string;

  /**
   * Creates the entry.
   *
   * @param connection The connection's number.
   * @param client The client's name.
   * @example
   * ```ts
   * import { ConnectedClient } from "@noldova/desktop.runtime";
   *
   * export const mainProcess: ConnectedClient = new ConnectedClient(1, "mainProcess");
   * ```
   */
  public constructor(connection: number, client: string);
}

/**
 * An installation's launch barrier, `barrier.json` in the installation's
 * folder: who holds it, the version being installed and where the update
 * stands.
 */
export declare class UpdateBarrier {
  /**
   * The main process that coordinates the update, by process id and start.
   */
  public readonly holder: UpdateProcess;

  /**
   * The version being installed.
   */
  public readonly version: string;

  /**
   * Where the update stands.
   */
  public readonly state: UpdateBarrierState;

  /**
   * The process that took the handoff, by process id and start, once the platform gave it; `null` before the handoff
   * or when the platform gives none. While it runs, a barrier handed off to another version still holds.
   */
  public readonly handoff: UpdateProcess | null;

  /**
   * Creates the barrier.
   *
   * @param holder The coordinating main process.
   * @param version The version being installed; not whitespace only.
   * @param state Where the update stands.
   * @param handoff The process that took the handoff, or `null`.
   * @throws {ArgumentException} When the version is empty or whitespace only.
   * @example
   * ```ts
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   * import { UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";
   *
   * export const barrier: UpdateBarrier = new UpdateBarrier(new UpdateProcess(4120, 1500, 1501, "mainProcess"), "0.2.0", UpdateBarrierState.Preparing, null);
   * ```
   */
  public constructor(holder: UpdateProcess, version: string, state: UpdateBarrierState, handoff: UpdateProcess | null);

  /**
   * Reads a barrier from its file's JSON.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The barrier.
   * @throws JsonException When a field is missing or invalid, or another field is present; its path names the field.
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { UpdateBarrier } from "@noldova/desktop.runtime";
   *
   * export function parse(text: string): UpdateBarrier {
   *   return UpdateBarrier.fromJson(JsonReader.parse(text).toJson());
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): UpdateBarrier;

  /**
   * Returns the file's JSON.
   *
   * @returns The `holder`, `version`, `state` and `handoff` fields.
   * @example
   * ```ts
   * import type { UpdateBarrier } from "@noldova/desktop.runtime";
   *
   * export function format(barrier: UpdateBarrier): string {
   *   return JSON.stringify(barrier.toJson());
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One declared debugging protocol event of a web view, as the relay reports it.
 */
export declare class WebViewProtocolEvent {
  /**
   * The view's id.
   */
  public readonly view: string;

  /**
   * The event's method, such as `Page.loadEventFired`.
   */
  public readonly method: string;

  /**
   * The event's parameters.
   */
  public readonly params: JsonObject;

  /**
   * Whether the main process cut the parameters to their limit.
   */
  public readonly isCut: boolean;

  /**
   * Creates the event.
   *
   * @param view The view's id.
   * @param method The event's method.
   * @param params The event's parameters.
   * @param isCut Whether the parameters were cut.
   */
  public constructor(view: string, method: string, params: JsonObject, isCut: boolean);
}

/**
 * The device folder, which keeps what belongs to the device rather than to a
 * data directory: its identity, its last appearance preferences and each
 * installation's record and launch barrier.
 */
export declare class DeviceFolder {
  /**
   * Returns the device folder in the operating system's local application
   * data: `%LOCALAPPDATA%` on Windows, `~/Library/Application Support` on
   * macOS and `$XDG_STATE_HOME`, or `~/.local/state`, on Linux, each with the
   * product's folder for that platform.
   *
   * @param platform The platform, as `process.platform` names it.
   * @param environment The environment variables.
   * @param homeFolder The person's home folder.
   * @returns The folder's path.
   * @example
   * ```ts
   * import os from "node:os";
   *
   * import { DeviceFolder } from "@noldova/desktop.runtime";
   *
   * export const folder: string = DeviceFolder.locate(process.platform, process.env, os.homedir());
   * ```
   */
  public static locate(platform: string, environment: NodeJS.ProcessEnv, homeFolder: string): string;
}

/**
 * One installation's folder in the device folder: the record of the data
 * directories its runtimes have owned and its launch barrier.
 */
export declare class Installation {
  /**
   * The installation's folder.
   */
  public readonly folder: string;

  /**
   * The launch barrier's file, `barrier.json` in the folder.
   */
  public readonly barrierFile: string;

  /**
   * The record's folder, `data-directories` in the folder, with one file for
   * each data directory.
   */
  public readonly recordFolder: string;

  /**
   * The main processes' folder, `mainProcesses` in the folder, with one file for each
   * main process of the installation, named after its process id.
   */
  public readonly mainProcessFolder: string;

  /**
   * Creates the installation.
   *
   * @param folder The installation's folder.
   * @param isRunningAsync Whether a barrier's holder, or a recorded main process,
   * still runs.
   * @example
   * ```ts
   * import { Installation, type ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function open(deviceFolder: string, presence: ProcessPresence): Installation {
   *   return new Installation(Installation.locate(deviceFolder, process.execPath, process.platform), t => presence.isRunningAsync(t));
   * }
   * ```
   */
  public constructor(folder: string, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>);

  /**
   * Returns an installation's folder: `installations/<id>` in the device
   * folder, where the id is the first 16 hexadecimal digits of the SHA-256 of
   * the program's canonical path: its real path with every link resolved,
   * lower-cased on Windows, or its resolved path when the program cannot be
   * found.
   *
   * @param deviceFolder The device folder.
   * @param programPath The program the installation runs, the AppImage file on Linux.
   * @param platform The operating system, as `process.platform` names it.
   * @returns The folder's path.
   * @example
   * ```ts
   * import { Installation } from "@noldova/desktop.runtime";
   *
   * export const folder: string = Installation.locate("/home/person/.local/state/noldova/desktop", "/opt/Noldova Desktop Sample/noldova-desktop", "linux");
   * ```
   */
  public static locate(deviceFolder: string, programPath: string, platform: string): string;

  /**
   * Adds a data directory to the record, replacing its file atomically.
   *
   * @param dataDirectory The data directory's root.
   * @returns A promise that settles once the entry is written.
   * @example
   * ```ts
   * import type { DataDirectory, Installation } from "@noldova/desktop.runtime";
   *
   * export function joinAsync(installation: Installation, directory: DataDirectory): Promise<void> {
   *   return installation.recordAsync(directory.root);
   * }
   * ```
   */
  public recordAsync(dataDirectory: string): Promise<void>;

  /**
   * Lists the data directories in the record, skipping an entry that cannot
   * be read and one whose directory does not exist now, whose entry stays.
   * @returns A promise of the data directories' roots.
   * @example
   * ```ts
   * import type { Installation } from "@noldova/desktop.runtime";
   * export function countAsync(installation: Installation): Promise<number> {
   *   return installation.listDataDirectoriesAsync().then(t => t.length);
   * }
   * ```
   */
  public listDataDirectoriesAsync(): Promise<readonly string[]>;

  /**
   * Records a running main process of the installation, replacing its file
   * atomically, so an update can wait for it to quit.
   *
   * @param mainProcess The main process's process id and start time.
   * @returns A promise that settles once the main process is recorded.
   * @example
   * ```ts
   * import type { UpdateProcess } from "@noldova/desktop.protocol";
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export function joinAsync(installation: Installation, mainProcess: UpdateProcess): Promise<void> {
   *   return installation.recordMainProcessAsync(mainProcess);
   * }
   * ```
   */
  public recordMainProcessAsync(mainProcess: UpdateProcess): Promise<void>;

  /**
   * Lists the recorded main processes that still run, skipping a record that
   * cannot be parsed and removing one whose main process has exited.
   *
   * @returns A promise of the running main processes.
   * @throws Error When a record cannot be read or a main process cannot be looked
   * up.
   * @example
   * ```ts
   * import type { UpdateProcess } from "@noldova/desktop.protocol";
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export function listAsync(installation: Installation): Promise<readonly UpdateProcess[]> {
   *   return installation.listMainProcessesAsync();
   * }
   * ```
   */
  public listMainProcessesAsync(): Promise<readonly UpdateProcess[]>;

  /**
   * Creates the launch barrier, after settling one whose holder no longer
   * runs as {@link Installation.checkAsync} does. It writes the barrier to a
   * temporary file and links it into place, which fails when a barrier
   * exists, so no reader sees it half-written. A temporary file it cannot
   * remove stays.
   * @param barrier The barrier to create.
   * @param version The coordinating main process's product version.
   * @returns A promise of whether the barrier was created; false when another
   * barrier holds or is unfinished, or is created between the settling and
   * the link.
   * @example
   * ```ts
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   * import { type Installation, UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";
   * export function holdAsync(installation: Installation, holder: UpdateProcess): Promise<boolean> {
   *   return installation.holdAsync(new UpdateBarrier(holder, "0.3.0", UpdateBarrierState.Preparing, null), "0.2.0");
   * }
   * ```
   */
  public holdAsync(barrier: UpdateBarrier, version: string): Promise<boolean>;

  /**
   * Replaces the launch barrier through a temporary file and a rename, as its
   * holder moves the update on.
   * @param barrier The barrier's new content.
   * @returns A promise that settles once the barrier is replaced.
   * @example
   * ```ts
   * import { type Installation, UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";
   * export function closeAsync(installation: Installation, barrier: UpdateBarrier): Promise<void> {
   *   return installation.replaceAsync(new UpdateBarrier(barrier.holder, barrier.version, UpdateBarrierState.Closing, null));
   * }
   * ```
   */
  public replaceAsync(barrier: UpdateBarrier): Promise<void>;

  /**
   * Removes the launch barrier, if there is one, for the holder that gives up
   * its update before the handoff.
   *
   * @returns A promise that settles once the barrier is gone.
   * @example
   * ```ts
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export function resumeAsync(installation: Installation): Promise<void> {
   *   return installation.releaseAsync();
   * }
   * ```
   */
  public releaseAsync(): Promise<void>;

  /**
   * Reads the launch barrier for a client that wants to start a runtime.
   * A barrier whose holder no longer runs is removed when the update stopped
   * before the handoff, or when it was handed off for this version. One
   * handed off for another version is `Held` while the process that took the
   * handoff runs and `Unfinished` once it has gone or when none was recorded,
   * and stays, as does one that cannot be parsed. A stale barrier is removed
   * as {@link Installation.removeAsync} removes one, and a barrier that
   * replaced it meanwhile is checked in turn.
   *
   * @param version The client's product version.
   * @returns A promise of the barrier's status.
   * @example
   * ```ts
   * import { type Installation, UpdateBarrierStatus } from "@noldova/desktop.runtime";
   *
   * export async function mayStartAsync(installation: Installation): Promise<boolean> {
   *   return await installation.checkAsync("0.2.0") === UpdateBarrierStatus.None;
   * }
   * ```
   */
  public checkAsync(version: string): Promise<UpdateBarrierStatus>;

  /**
   * Whether the update the launch barrier stands for has ended: the barrier
   * is missing, or its holder has exited before the handoff. A barrier
   * handed off, whatever its holder, stands until it is removed.
   *
   * @returns A promise of whether the update has ended.
   * @throws Error When the barrier cannot be read or parsed for any reason but
   * its absence, or its holder cannot be looked up.
   * @example
   * ```ts
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export function hasEndedAsync(installation: Installation): Promise<boolean> {
   *   return installation.hasEndedAsync();
   * }
   * ```
   */
  public hasEndedAsync(): Promise<boolean>;

  /**
   * Reads the launch barrier.
   *
   * @returns A promise of the barrier, or null when there is none.
   * @throws JsonException When the barrier is not a JSON object or has a missing or invalid field.
   * @example
   * ```ts
   * import { type Installation, UpdateBarrierState } from "@noldova/desktop.runtime";
   *
   * export async function isClosingAsync(installation: Installation): Promise<boolean> {
   *   return (await installation.readAsync())?.state === UpdateBarrierState.Closing;
   * }
   * ```
   */
  public readAsync(): Promise<UpdateBarrier | null>;

  /**
   * Reads the launch barrier's file as it is, parsable or not, so that
   * {@link Installation.removeAsync} can later remove that barrier and no other.
   *
   * @returns A promise of the file's text, or null when there is no barrier.
   * @throws Error When the barrier cannot be read for any reason but its absence.
   * @example
   * ```ts
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export async function hasBarrierAsync(installation: Installation): Promise<boolean> {
   *   return (await installation.readTextAsync()) !== null;
   * }
   * ```
   */
  public readTextAsync(): Promise<string | null>;

  /**
   * Removes the launch barrier only while it is still the one that was read: it
   * moves the barrier aside under a unique name and deletes it when its text is
   * unchanged. A barrier that replaced it is put back, unless yet another one
   * has taken its place meanwhile, in which case the moved one is deleted.
   *
   * @param text The barrier's text, as {@link Installation.readTextAsync} read it.
   * @returns A promise of whether that barrier is gone; `false` when another
   * one replaced it.
   * @throws Error When the barrier cannot be moved, read or put back.
   * @example
   * ```ts
   * import type { Installation } from "@noldova/desktop.runtime";
   *
   * export async function clearAsync(installation: Installation): Promise<boolean> {
   *   const text = await installation.readTextAsync();
   *   return text === null || await installation.removeAsync(text);
   * }
   * ```
   */
  public removeAsync(text: string): Promise<boolean>;
}

/**
 * Finds processes in the operating system's process table, by process id and
 * start, as a runtime identifies the programs it owns.
 */
export declare class ProcessPresence {
  /**
   * Creates the presence with the platform's process table reader. It reads
   * nothing, not even the boot's identity, until it first looks up a process.
   *
   * @param platform The platform, as `process.platform` names it.
   * @param posix Lists the process table on macOS and Linux.
   * {@link ProcessPresence.create} passes the runtime's POSIX addon.
   * @param windows The system calls that read the process table on Windows.
   * {@link ProcessPresence.create} passes the system's own functions, called
   * through the runtime's Windows addon.
   * @example
   * ```ts
   * import { type IWindowsProcessApi, PosixProcessApi, ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function createPresence(windows: IWindowsProcessApi): ProcessPresence {
   *   return new ProcessPresence("win32", PosixProcessApi.create("win32"), windows);
   * }
   * ```
   */
  public constructor(platform: string, posix: IPosixProcessTableApi, windows: IWindowsProcessApi);

  /**
   * Creates the presence a client or runtime runs with, which reads the
   * process table through the runtime's POSIX addon on macOS and Linux and
   * through the system's own functions, called through the runtime's Windows
   * addon, on Windows. It reads nothing, not even the boot's identity, until
   * it first looks up a process, and each addon loads at its first use.
   *
   * @param platform The platform, as `process.platform` names it.
   * @returns The presence.
   * @example
   * ```ts
   * import { ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export const presence: ProcessPresence = ProcessPresence.create(process.platform);
   * ```
   */
  public static create(platform: string): ProcessPresence;

  /**
   * Returns the processes that still run with the range their start falls
   * in, leaving out those the table no longer lists.
   *
   * @param processes Each process's id and role.
   * @returns A promise of the processes found.
   * @example
   * ```ts
   * import type { UpdateProcess } from "@noldova/desktop.protocol";
   * import type { ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function stampAsync(presence: ProcessPresence): Promise<readonly UpdateProcess[]> {
   *   return presence.stampAsync([[process.pid, "cli"]]);
   * }
   * ```
   */
  public stampAsync(processes: readonly (readonly [number, string])[]): Promise<readonly UpdateProcess[]>;

  /**
   * Whether a process still runs: the table lists its id with a start that
   * can fall in the process's range.
   *
   * @param process The process.
   * @returns A promise of whether it runs.
   * @example
   * ```ts
   * import type { UpdateProcess } from "@noldova/desktop.protocol";
   * import type { ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function isGoneAsync(presence: ProcessPresence, process: UpdateProcess): Promise<boolean> {
   *   return presence.isRunningAsync(process).then(t => !t);
   * }
   * ```
   */
  public isRunningAsync(process: UpdateProcess): Promise<boolean>;
}

/**
 * Thrown when no runtime owns the data directory and the client was told not
 * to start one.
 */
export declare class NoRuntimeException extends RuntimeException {
  /**
   * The data directory's root.
   */
  public readonly root: string;

  /**
   * Creates the exception.
   *
   * @param root The data directory's root.
   * @example
   * ```ts
   * import { NoRuntimeException } from "@noldova/desktop.runtime";
   *
   * export function refuse(root: string): never {
   *   throw new NoRuntimeException(root);
   * }
   * ```
   */
  public constructor(root: string);
}

/**
 * The exception thrown when a newer build's runtime owns the data directory, so this older build hands the person over to it.
 */
export declare class RuntimeHandoverException extends RuntimeException {
  /**
   * The newer runtime's build identity and the program it runs from.
   */
  public readonly handover: RuntimeHandover;

  /**
   * Creates the exception.
   *
   * @param handover The newer runtime's identity and program.
   * @example
   * ```ts
   * import { type BuildIdentity, RuntimeHandover } from "@noldova/desktop.protocol";
   * import { RuntimeHandoverException } from "@noldova/desktop.runtime";
   *
   * export function handOver(newer: BuildIdentity): never {
   *   throw new RuntimeHandoverException(new RuntimeHandover(newer, "/opt/noldova-desktop/noldova-desktop"));
   * }
   * ```
   */
  public constructor(handover: RuntimeHandover);
}

/**
 * The exception thrown when an older build's runtime refuses to stop because work is in progress, so the person must choose to wait or stop it.
 */
export declare class WorkInProgressException extends RuntimeException {
  /**
   * The work in progress.
   */
  public readonly work: RunningWork;

  /**
   * Creates the exception.
   *
   * @param work The work the runtime reported.
   * @example
   * ```ts
   * import { RunningWork } from "@noldova/desktop.protocol";
   * import { WorkInProgressException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new WorkInProgressException(new RunningWork(["Indexing the project"]));
   * }
   * ```
   */
  public constructor(work: RunningWork);
}

/**
 * Something whose idleness an {@link IdleMonitor} watches.
 */
export interface IIdleParticipant {
  /**
   * Whether nothing keeps the participant busy.
   */
  readonly isIdle: boolean;

  /**
   * Called when the participant has stayed idle for the monitor's whole grace period.
   * @example
   * ```ts
   * import type { IIdleParticipant } from "@noldova/desktop.runtime";
   *
   * export class Session implements IIdleParticipant {
   *   public isIdle: boolean = true;
   *
   *   public handleIdle(): void {
   *     console.log("The session stayed idle for the whole grace period.");
   *   }
   * }
   * ```
   */
  handleIdle(): void;
}

/**
 * The functions of the runtime's POSIX addon, `native/<platform>-<arch>/posix-process.node`,
 * as a {@link NativeAddon} loads it. Each build exports only its platform's
 * functions, so every member is optional and a caller checks the one it calls;
 * each returns a value the caller checks with {@link NativeAddon.expect}.
 */
export interface IPosixProcessAddon {
  /**
   * Starts a program in a session of its own; every build has it. See
   * {@link IPosixProcessApi.startDetached}.
   *
   * @param file The program's absolute path.
   * @param launchArguments The arguments, each passed as it is.
   * @param environment The program's whole environment, each entry as `NAME=value`.
   * @param errorDescriptor The open descriptor its standard error goes to.
   * @param options The working folder, the output descriptor, the input
   * descriptor and the disclaim function, in that order, up to the last one given.
   * @returns The started program's process id.
   * @throws {TypeError} When given more arguments than it takes.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function start(addon: IPosixProcessAddon): unknown {
   *   return addon.startDetached?.("/usr/bin/env", ["true"], ["PATH=/usr/bin"], 2);
   * }
   * ```
   */
  startDetached?(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, ...options: (string | number | undefined)[]): unknown;

  /**
   * Reads the system's clock ticks a second; Linux builds only.
   *
   * @returns The ticks a second.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readTicks(addon: IPosixProcessAddon): unknown {
   *   return addon.clockTicks?.();
   * }
   * ```
   */
  clockTicks?(): unknown;

  /**
   * Reads the process at the other end of a local socket; Linux builds only.
   *
   * @param descriptor The socket's descriptor.
   * @returns The peer's process id, or 0 when there is none.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readPeer(addon: IPosixProcessAddon, descriptor: number): unknown {
   *   return addon.peerProcessId?.(descriptor);
   * }
   * ```
   */
  peerProcessId?(descriptor: number): unknown;

  /**
   * Lists the process table; macOS builds only. See {@link IPosixProcessTableApi.listProcessesAsync}.
   *
   * @returns One row of six numbers a process.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function list(addon: IPosixProcessAddon): unknown {
   *   return addon.listProcesses?.();
   * }
   * ```
   */
  listProcesses?(): unknown;

  /**
   * Reads the audit token of the process at the other end of a local socket; macOS builds only.
   *
   * @param descriptor The socket's descriptor.
   * @returns The peer's process id and its process id version, or `null` when there is none.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readToken(addon: IPosixProcessAddon, descriptor: number): unknown {
   *   return addon.peerToken?.(descriptor);
   * }
   * ```
   */
  peerToken?(descriptor: number): unknown;

  /**
   * Reads the program a process runs; macOS builds only.
   *
   * @param processId The process.
   * @returns The program's absolute path, or `null` when it cannot be read.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readProgram(addon: IPosixProcessAddon): unknown {
   *   return addon.readProcessPath?.(process.pid);
   * }
   * ```
   */
  readProcessPath?(processId: number): unknown;

  /**
   * Reads a process's responsible process; macOS builds only. See
   * {@link PosixResponsibilityApi.findResponsible}.
   *
   * @param processId The process.
   * @param systemFunction The system function to look up and ask.
   * @returns The responsible process's id, or `null` when there is no answer.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readResponsible(addon: IPosixProcessAddon): unknown {
   *   return addon.readResponsibleProcessId?.(process.pid, "responsibility_get_pid_responsible_for_pid");
   * }
   * ```
   */
  readResponsibleProcessId?(processId: number, systemFunction: string): unknown;

  /**
   * Reads a process's environment; macOS builds only.
   *
   * @param processId The process.
   * @returns Its entries, each as `NAME=value`, or `null` when it cannot be read.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readEnvironment(addon: IPosixProcessAddon): unknown {
   *   return addon.readEnvironment?.(process.pid);
   * }
   * ```
   */
  readEnvironment?(processId: number): unknown;

  /**
   * Reads the volume that holds a folder with `statfs`; macOS builds only.
   *
   * @param folder The folder.
   * @returns The volume's mount point and whether it is mounted with
   * ownership ignored, as `[mountPoint, isOwnershipIgnored]`.
   * @throws {Error} When `statfs` fails, with its `errno` and `syscall`.
   * @example
   * ```ts
   * import type { IPosixProcessAddon } from "@noldova/desktop.runtime";
   *
   * export function readVolume(addon: IPosixProcessAddon): unknown {
   *   return addon.readVolume?.("/Users/person");
   * }
   * ```
   */
  readVolume?(folder: string): unknown;
}

/**
 * The system call {@link ChildProcessStarter} makes outside Windows to start a
 * program in a session of its own. The runtime's POSIX addon makes it.
 */
export interface IPosixProcessApi {
  /**
   * Starts a program in a new session, with its standard input on `/dev/null`,
   * its standard output on the given descriptor or else `/dev/null`, its
   * standard error on the given descriptor, and every other descriptor closed.
   *
   * @param file The program's absolute path.
   * @param launchArguments The arguments, each passed as it is.
   * @param environment The program's whole environment, each entry as `NAME=value`.
   * @param errorDescriptor The open descriptor its standard error goes to.
   * @param workingFolder The folder it starts in; by default this process's own.
   * @param outputDescriptor The open descriptor its standard output goes to;
   * `/dev/null` when omitted.
   * @param inputDescriptor The open descriptor its standard input reads from;
   * `/dev/null` when omitted.
   * @param disclaimFunction On macOS, the name of the system's private
   * function that marks a start as disclaiming responsibility,
   * `responsibility_spawnattrs_setdisclaim`, as Chromium also uses it: the
   * program then becomes its own responsible process, so macOS asks for privacy
   * permissions in its name rather than in the name of what started this
   * process. The addon looks it up when the program starts and, when the
   * system has no such function, starts the program as without it. Ignored
   * elsewhere.
   * @returns The started program's process id.
   * @throws Error when the program cannot start or the folder cannot be entered; its `errno` names the cause and its
   * `syscall` is `"chdir"` for the folder.
   * @example
   * ```ts
   * import type { IPosixProcessApi } from "@noldova/desktop.runtime";
   *
   * export function start(api: IPosixProcessApi, errorDescriptor: number): number {
   *   return api.startDetached("/usr/bin/env", ["true"], ["PATH=/usr/bin"], errorDescriptor);
   * }
   * ```
   */
  startDetached(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, workingFolder?: string,
    outputDescriptor?: number, inputDescriptor?: number, disclaimFunction?: string): number;
}

/**
 * Lists the process table on macOS and Linux without starting a program, as
 * {@link ProcessPresence} and {@link ProcessSupervisor} read it.
 * {@link PosixProcessApi} reads it from `/proc` on Linux and through the
 * runtime's POSIX addon on macOS.
 */
export interface IPosixProcessTableApi {
  /**
   * Lists every process the system shows this one, those of other users, such
   * as root, included.
   *
   * @returns One row a process: its id, its parent's id, its process group's
   * id, its controlling terminal's device number or 0 for none, its start in
   * milliseconds, since boot on Linux and since the epoch on macOS, and
   * optionally 1 when the process has ended and its parent has not reaped it
   * yet, a zombie, or 0 when it runs. A row without the sixth value counts as
   * a running process. Linux lists zombies; macOS leaves them out, so its
   * rows' sixth value is always 0.
   * @throws Error when the table cannot be read.
   * @example
   * ```ts
   * import type { IPosixProcessTableApi } from "@noldova/desktop.runtime";
   *
   * export async function countAsync(api: IPosixProcessTableApi): Promise<number> {
   *   return (await api.listProcessesAsync()).length;
   * }
   * ```
   */
  listProcessesAsync(): Promise<readonly (readonly [number, number, number, number, number, number?])[]>;
}

/**
 * Starts the runtime's process detached, so that it outlives the client that started it.
 */
export interface IProcessStarter {
  /**
   * Starts a program detached, without standard input or output, writing its standard error to a file.
   *
   * @param executable The program to run.
   * @param launchArguments The program's arguments.
   * @param environment The program's environment.
   * @param errorFile The file the program's standard error is appended to.
   * @param workingFolder The folder the program starts in; by default the starter's own.
   * @returns A promise of the started process's id, once the process exists.
   * @throws {LaunchException} Rejected when the program cannot be started.
   * @example
   * ```ts
   * import type { IProcessStarter } from "@noldova/desktop.runtime";
   *
   * export class RecordingStarter implements IProcessStarter {
   *   public readonly started: string[] = [];
   *
   *   public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
   *     this.started.push([executable, ...launchArguments, errorFile].join(" "));
   *     return Object.keys(environment).length;
   *   }
   * }
   * ```
   */
  startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number>;
}

/**
 * What a pseudo-terminal reports when its program exits: node-pty's exit
 * event.
 */
export interface IPseudoTerminalExit {
  /**
   * The exit code, or `undefined` when the program reported none.
   */
  readonly exitCode: number | undefined;

  /**
   * The number of the signal that ended the program, or `undefined` or 0
   * when none did.
   */
  readonly signal?: number | undefined;
}

/**
 * A pseudo-terminal a library started: the part of node-pty's `IPty` the
 * runtime uses.
 */
export interface IPseudoTerminalHandle {
  /**
   * The program's process id.
   */
  readonly pid: number;

  /**
   * Calls the listener with each piece of the program's output.
   *
   * @param listener Receives the output as UTF-8 text.
   * @returns The subscription, which stops the calls when disposed.
   * @example
   * ```ts
   * import type { IPseudoTerminalHandle } from "@noldova/desktop.runtime";
   *
   * export function collect(handle: IPseudoTerminalHandle, output: string[]): void {
   *   handle.onData(t => output.push(t));
   * }
   * ```
   */
  onData(listener: (data: string) => void): IPseudoTerminalSubscription;

  /**
   * Calls the listener once the program exits.
   *
   * @param listener Receives the exit.
   * @returns The subscription, which stops the call when disposed.
   * @example
   * ```ts
   * import type { IPseudoTerminalExit, IPseudoTerminalHandle } from "@noldova/desktop.runtime";
   *
   * export function waitAsync(handle: IPseudoTerminalHandle): Promise<IPseudoTerminalExit> {
   *   return new Promise(resolve => handle.onExit(resolve));
   * }
   * ```
   */
  onExit(listener: (exit: IPseudoTerminalExit) => void): IPseudoTerminalSubscription;

  /**
   * Writes to the program's input.
   *
   * @param data The text to write.
   * @example
   * ```ts
   * import type { IPseudoTerminalHandle } from "@noldova/desktop.runtime";
   *
   * export function interrupt(handle: IPseudoTerminalHandle): void {
   *   handle.write("\u0003");
   * }
   * ```
   */
  write(data: string): void;

  /**
   * Changes the terminal's size.
   *
   * @param columns The number of columns.
   * @param rows The number of rows.
   * @example
   * ```ts
   * import type { IPseudoTerminalHandle } from "@noldova/desktop.runtime";
   *
   * export function widen(handle: IPseudoTerminalHandle): void {
   *   handle.resize(160, 40);
   * }
   * ```
   */
  resize(columns: number, rows: number): void;

  /**
   * Stops reading the program's output until {@link IPseudoTerminalHandle.resume}.
   */
  pause(): void;

  /**
   * Reads the program's output again after {@link IPseudoTerminalHandle.pause}.
   */
  resume(): void;

  /**
   * Ends the program: on Windows it closes the pseudo console, and elsewhere
   * it sends the program the signal.
   *
   * @param signal The signal's name, which Windows ignores; SIGHUP by default.
   * @example
   * ```ts
   * import type { IPseudoTerminalHandle } from "@noldova/desktop.runtime";
   *
   * export function close(handle: IPseudoTerminalHandle): void {
   *   handle.kill();
   * }
   * ```
   */
  kill(signal?: string): void;
}

/**
 * The library that starts pseudo-terminals: the module's own loaded node-pty,
 * which the runtime does not ship.
 */
export interface IPseudoTerminalLibrary {
  /**
   * Starts a program in a new pseudo-terminal.
   *
   * @param file The program's path.
   * @param args The program's arguments, or on Windows its command line as
   * one string, which the library passes after the program as it is.
   * @param options The terminal's name, size, folder and environment.
   * @returns The started pseudo-terminal.
   * @throws {Error} When the program cannot start.
   * @example
   * ```ts
   * import * as pty from "node-pty";
   *
   * import type { IPseudoTerminalLibrary } from "@noldova/desktop.runtime";
   *
   * export const library: IPseudoTerminalLibrary = pty;
   * ```
   */
  spawn(file: string, args: string[] | string, options: IPseudoTerminalOptions): IPseudoTerminalHandle;
}

/**
 * How the runtime asks the library to start a pseudo-terminal: the part of
 * node-pty's options it sets.
 */
export interface IPseudoTerminalOptions {
  /**
   * The terminal's name, which the program reads as TERM.
   */
  readonly name: string;

  /**
   * The number of columns.
   */
  readonly cols: number;

  /**
   * The number of rows.
   */
  readonly rows: number;

  /**
   * The folder the program runs in.
   */
  readonly cwd: string;

  /**
   * The program's whole environment.
   */
  readonly env: Readonly<Record<string, string>>;

  /**
   * Whether Windows uses the pseudo console that comes with the library
   * rather than the system's.
   */
  readonly useConptyDll: boolean;

  /**
   * Whether the Windows pseudo console starts at the terminal's cursor.
   */
  readonly conptyInheritCursor: boolean;
}

/**
 * What a module may add to a pseudo-terminal request.
 */
export interface IPseudoTerminalStartOptions {
  /**
   * On Windows, the command line after the program, which the library passes
   * to it as it is in place of the arguments, so a program such as `cmd.exe`
   * gets its quotes and operators as written; the start refuses it on macOS
   * and Linux, beside arguments, and for a batch file.
   */
  readonly commandLine?: string;

  /**
   * Whether the Windows pseudo console starts at the terminal's cursor;
   * `false` by default.
   */
  readonly inheritCursor?: boolean;

  /**
   * Stops the program when it aborts; while the start waits for the
   * program's process id, it rejects the start with the signal's reason.
   */
  readonly signal?: AbortSignal;
}

/**
 * A subscription to a pseudo-terminal's events.
 */
export interface IPseudoTerminalSubscription {
  /**
   * Stops the subscription.
   */
  dispose(): void;
}

/**
 * A file's Authenticode signature as Windows verifies it.
 */
export interface IWindowsSignature {
  /**
   * The result of `WinVerifyTrust`: 0 when the signature is valid, otherwise its error code, such as `0x800B0100`
   * when the file carries no signature.
   */
  readonly status: number;

  /**
   * Windows' text for the status, or an empty string when Windows has none.
   */
  readonly message: string;

  /**
   * The signer's distinguished name with its common name first, as `CN=…, O=…, C=…`, or `null` when the file carries no
   * signer's certificate.
   */
  readonly subject: string | null;
}

/**
 * The system calls a {@link ProcessSupervisor} makes on Windows to read the
 * process table and end processes, and that the main process makes to hold a file
 * open for reading and to verify its signature. {@link ProcessSupervisor.create}
 * passes the system's own functions, called through the runtime's Windows
 * addon, as {@link WindowsProcessApi} does. Each call but
 * {@link IWindowsProcessApi.verifySignatureAsync} returns at once, and creating
 * an implementation loads nothing, so a supervisor can be created on any platform.
 */
export interface IWindowsProcessApi {
  /**
   * Lists the processes running now, as `CreateToolhelp32Snapshot` sees them.
   *
   * @returns Each process's id and its parent's id.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function listChildren(api: IWindowsProcessApi, parentId: number): number[] {
   *   return api.listProcesses().filter(([, parent]) => parent === parentId).map(([processId]) => processId);
   * }
   * ```
   */
  listProcesses(): readonly (readonly [number, number])[];

  /**
   * Opens a process, as `OpenProcess` does.
   *
   * @param processId The process to open.
   * @param access The access rights asked for.
   * @returns The process's handle, or the Windows error code when it could not be opened: 87 when no process has the id.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function isOpenable(api: IWindowsProcessApi, processId: number): boolean {
   *   const handle = api.openProcess(processId, 0x1000);
   *   if (typeof handle === "number")
   *     return false;
   *   api.closeHandle(handle);
   *   return true;
   * }
   * ```
   */
  openProcess(processId: number, access: number): bigint | number;

  /**
   * Reads when a process was created, as `GetProcessTimes` does.
   *
   * @param handle A handle from {@link IWindowsProcessApi.openProcess}.
   * @returns The creation time in 100-nanosecond units since 1601, or `null` when it could not be read.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function readCreated(api: IWindowsProcessApi, handle: bigint): number | null {
   *   const created = api.readCreationTime(handle);
   *   return created === null ? null : Number(created / 10_000n) - 11_644_473_600_000;
   * }
   * ```
   */
  readCreationTime(handle: bigint): bigint | null;

  /**
   * Reads the full path of the executable a process runs, as `QueryFullProcessImageNameW` does.
   *
   * @param handle A handle from {@link IWindowsProcessApi.openProcess}.
   * @returns The path, or `null` when it could not be read.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function runs(api: IWindowsProcessApi, handle: bigint, executable: string): boolean {
   *   return api.readImagePath(handle)?.toLowerCase() === executable.toLowerCase();
   * }
   * ```
   */
  readImagePath(handle: bigint): string | null;

  /**
   * Ends a process, as `TerminateProcess` does.
   *
   * @param handle A handle from {@link IWindowsProcessApi.openProcess} with the right to terminate.
   * @returns Whether the process was told to end.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function end(api: IWindowsProcessApi, handle: bigint): string {
   *   return api.terminateProcess(handle) ? "ending" : "refused";
   * }
   * ```
   */
  terminateProcess(handle: bigint): boolean;

  /**
   * Checks whether a process has exited, as `WaitForSingleObject` does with no wait.
   *
   * @param handle A handle from {@link IWindowsProcessApi.openProcess} with the right to synchronize.
   * @returns Whether the process has exited.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function countRunning(api: IWindowsProcessApi, handles: readonly bigint[]): number {
   *   return handles.filter(t => !api.hasExited(t)).length;
   * }
   * ```
   */
  hasExited(handle: bigint): boolean;

  /**
   * Reads a process's exit code, as `GetExitCodeProcess` does, as the signed 32-bit number node-pty gives on Windows.
   * Read it only once {@link IWindowsProcessApi.hasExited} says the process has exited: before that it gives 259,
   * `STILL_ACTIVE`, which a process may also exit with.
   *
   * @param handle A handle from {@link IWindowsProcessApi.openProcess} with the right to query limited information.
   * @returns The process's exit code, or `null` when Windows gives none, as for a handle without that right.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function readEndedCode(api: IWindowsProcessApi, handle: bigint): number | null {
   *   return api.hasExited(handle) ? api.readExitCode(handle) : null;
   * }
   * ```
   */
  readExitCode(handle: bigint): number | null;

  /**
   * Opens a file for reading, as `CreateFileW` does with `GENERIC_READ` and
   * `FILE_SHARE_READ` only: while the handle is open, the file can be read and
   * started but not written, renamed or deleted.
   *
   * @param file The file's absolute path.
   * @returns The file's handle, which {@link IWindowsProcessApi.closeHandle} closes, or the Windows error code when it
   * could not be opened: 2 when it doesn't exist, 32 when another handle shares no reading or holds it for writing.
   * @throws {TypeError} When the path holds a null character.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function holdWhile<T>(api: IWindowsProcessApi, file: string, run: () => T): T | null {
   *   const handle = api.openFileForReading(file);
   *   if (typeof handle === "number")
   *     return null;
   *   try {
   *     return run();
   *   }
   *   finally {
   *     api.closeHandle(handle);
   *   }
   * }
   * ```
   */
  openFileForReading(file: string): bigint | number;

  /**
   * Closes a handle, as `CloseHandle` does; closing a job's last handle ends every process in the job.
   *
   * @param handle A handle from {@link IWindowsProcessApi.openProcess}, {@link IWindowsProcessApi.openFileForReading}
   * or {@link IWindowsProcessApi.createJob}, which is not used again.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function closeAll(api: IWindowsProcessApi, handles: readonly bigint[]): void {
   *   for (const handle of handles)
   *     api.closeHandle(handle);
   * }
   * ```
   */
  closeHandle(handle: bigint): void;

  /**
   * Creates an unnamed job object, as `CreateJobObjectW` does, that ends every process in it when its last handle
   * closes.
   *
   * @param holdsDescendants Whether what the job's processes start is in the job too and can't leave it; when false,
   * what they start leaves the job at once, as `JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK` makes it, and outlives the job.
   * @returns The job's handle, which {@link IWindowsProcessApi.closeHandle} closes.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function countEmptyJob(api: IWindowsProcessApi): number {
   *   const job = api.createJob(true);
   *   try {
   *     return api.listJobProcesses(job).length;
   *   }
   *   finally {
   *     api.closeHandle(job);
   *   }
   * }
   * ```
   */
  createJob(holdsDescendants: boolean): bigint;

  /**
   * Puts a process in a job, as `AssignProcessToJobObject` does; what the process starts from then on is in the job
   * too.
   *
   * @param job A handle from {@link IWindowsProcessApi.createJob}.
   * @param handle A handle from {@link IWindowsProcessApi.openProcess} with the rights to set quotas and to terminate.
   * @returns 0 when the process is in the job, or the Windows error code when it could not be put in it.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function isAssigned(api: IWindowsProcessApi, job: bigint, handle: bigint): boolean {
   *   return api.assignProcessToJob(job, handle) === 0;
   * }
   * ```
   */
  assignProcessToJob(job: bigint, handle: bigint): number;

  /**
   * Lists the ids of the processes in a job, as `QueryInformationJobObject` does with
   * `JobObjectBasicProcessIdList`.
   *
   * @param job A handle from {@link IWindowsProcessApi.createJob}.
   * @returns The ids of the processes in the job that have not ended.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function holds(api: IWindowsProcessApi, job: bigint, processId: number): boolean {
   *   return api.listJobProcesses(job).includes(processId);
   * }
   * ```
   */
  listJobProcesses(job: bigint): readonly number[];

  /**
   * Verifies a file's Authenticode signature, as `WinVerifyTrust` does with the generic verify action, no user
   * interface and no revocation check, and reads its signer's name, on a thread of Node's pool so the caller's
   * thread keeps running while Windows hashes the file. The chain must still lead to a trusted root, and Windows may
   * fetch a missing certificate of the chain.
   *
   * @param file The file's absolute path.
   * @returns A promise of the signature's status, its text and its signer's name.
   * @throws {TypeError} When the path holds a null character.
   * @example
   * ```ts
   * import type { IWindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export async function isValidAsync(api: IWindowsProcessApi, file: string): Promise<boolean> {
   *   return (await api.verifySignatureAsync(file)).status === 0;
   * }
   * ```
   */
  verifySignatureAsync(file: string): Promise<IWindowsSignature>;
}

/**
 * One of the runtime's native addons in the package's `native` folder, loaded
 * once, on the first {@link NativeAddon.load}, and checked for the functions
 * the runtime calls, which its type `T` declares.
 */
export declare class NativeAddon<T extends object> {
  /**
   * Creates the addon without loading it.
   *
   * @param file The addon's absolute path.
   * @param functions The functions the runtime calls on it, each a member of
   * `T`; every member `T` does not mark optional must be among them.
   * @example
   * ```ts
   * import { type IPosixProcessAddon, NativeAddon } from "@noldova/desktop.runtime";
   *
   * export const addon: NativeAddon<IPosixProcessAddon> = new NativeAddon<IPosixProcessAddon>(NativeAddon.locate("posix-process.node"), ["startDetached"]);
   * ```
   */
  public constructor(file: string, functions: readonly (keyof T & string)[]);

  /**
   * The addon's build folder and file name, as messages name it, such as `linux-x64/posix-process.node`.
   */
  public get name(): string;

  /**
   * Finds an addon's build for a platform and architecture in the package's `native` folder, at `native/<platform>-<arch>/<name>`.
   *
   * @param name The addon's file name.
   * @param platform The platform, as in `process.platform`; the running one by default.
   * @param architecture The architecture, as in `process.arch`; the running one by default.
   * @returns Its absolute path.
   * @example
   * ```ts
   * import { NativeAddon } from "@noldova/desktop.runtime";
   *
   * export const file: string = NativeAddon.locate("posix-process.node");
   * ```
   */
  public static locate(name: string, platform?: string, architecture?: string): string;

  /**
   * Loads the addon on the first call, checks once that each of the functions
   * it was created with is a function, and gives back the addon, whose members
   * are then called on it.
   *
   * @returns The addon, the same object on every call.
   * @throws {AddonLoadException} When the addon's file is missing, it cannot be
   * loaded, or it lacks one of the functions it was created with, as an addon
   * from another build does.
   * @example
   * ```ts
   * import type { IPosixProcessAddon, NativeAddon } from "@noldova/desktop.runtime";
   *
   * export function start(addon: NativeAddon<IPosixProcessAddon>): unknown {
   *   return addon.load().startDetached?.("/usr/bin/env", ["true"], ["PATH=/usr/bin"], 2);
   * }
   * ```
   */
  public load(): T;

  /**
   * Checks a value the addon returned.
   *
   * @param value The returned value.
   * @param isExpected Whether the value is of the expected kind.
   * @returns The value.
   * @throws {AddonLoadException} When the value is of another kind, as an
   * addon from another build returns.
   * @example
   * ```ts
   * import type { IPosixProcessAddon, NativeAddon } from "@noldova/desktop.runtime";
   *
   * export function readProcessId(addon: NativeAddon<IPosixProcessAddon>, value: unknown): number {
   *   return addon.expect(value, (t): t is number => typeof t === "number");
   * }
   * ```
   */
  public expect<U>(value: unknown, isExpected: (value: unknown) => value is U): U;
}

/**
 * The runtime's POSIX addon, `native/<platform>-<arch>/posix-process.node`,
 * which makes the {@link IPosixProcessApi} system call and lists the
 * {@link IPosixProcessTableApi} process table; it is loaded on the first call.
 */
export declare class PosixProcessApi implements IPosixProcessApi, IPosixProcessTableApi {
  /**
   * Wraps an addon.
   *
   * @param addon The addon that makes the calls: `startDetached`, and
   * `clockTicks` on Linux or `listProcesses` elsewhere.
   * @param platform The platform, as `process.platform` names it; this
   * process's own by default.
   * @param processFolder The folder Linux lists processes in; `/proc` by
   * default.
   * @example
   * ```ts
   * import { type IPosixProcessAddon, NativeAddon, PosixProcessApi } from "@noldova/desktop.runtime";
   *
   * export const api: PosixProcessApi = new PosixProcessApi(new NativeAddon<IPosixProcessAddon>(NativeAddon.locate("posix-process.node"), ["startDetached", "listProcesses"]), "darwin");
   * ```
   */
  public constructor(addon: NativeAddon<IPosixProcessAddon>, platform?: string, processFolder?: string);

  /**
   * Wraps the package's own POSIX addon, without loading it.
   *
   * @param platform The platform, as `process.platform` names it; this
   * process's own by default.
   * @returns The API.
   * @example
   * ```ts
   * import { PosixProcessApi } from "@noldova/desktop.runtime";
   *
   * export const api: PosixProcessApi = PosixProcessApi.create();
   * ```
   */
  public static create(platform?: string): PosixProcessApi;

  /**
   * Starts a program; see {@link IPosixProcessApi.startDetached}.
   *
   * @param file The program's absolute path.
   * @param launchArguments The arguments, each passed as it is.
   * @param environment The program's whole environment, each entry as `NAME=value`.
   * @param errorDescriptor The open descriptor its standard error goes to.
   * @param workingFolder The folder it starts in; by default this process's own.
   * @param outputDescriptor The open descriptor its standard output goes to;
   * `/dev/null` when omitted.
   * @param inputDescriptor The open descriptor its standard input reads from;
   * `/dev/null` when omitted.
   * @param disclaimFunction On macOS, the name of the system's private
   * function that marks a start as disclaiming responsibility,
   * `responsibility_spawnattrs_setdisclaim`, as Chromium also uses it: the
   * program then becomes its own responsible process, so macOS asks for privacy
   * permissions in its name rather than in the name of what started this
   * process. The addon looks it up when the program starts and, when the
   * system has no such function, starts the program as without it. Ignored
   * elsewhere.
   * @returns The started program's process id.
   * @throws {AddonLoadException} When the addon cannot be loaded, lacks the
   * function, or returns anything but a positive whole number.
   * @throws Error when the program cannot start or the folder cannot be entered; its `errno` names the cause and its
   * `syscall` is `"chdir"` for the folder.
   * @example
   * ```ts
   * import { PosixProcessApi } from "@noldova/desktop.runtime";
   *
   * export function start(errorDescriptor: number): number {
   *   return PosixProcessApi.create().startDetached("/usr/bin/env", ["true"], ["PATH=/usr/bin"], errorDescriptor);
   * }
   * ```
   */
  public startDetached(file: string, launchArguments: readonly string[], environment: readonly string[], errorDescriptor: number, workingFolder?: string,
    outputDescriptor?: number, inputDescriptor?: number, disclaimFunction?: string): number;

  /**
   * Lists the process table; see {@link IPosixProcessTableApi.listProcessesAsync}.
   * On Linux it reads each process's `stat` file in the process folder and
   * skips a process that ends while it reads; elsewhere the addon lists them.
   *
   * @returns One row a process: its id, its parent's id, its process group's
   * id, its controlling terminal's device number or 0 for none, its start in
   * milliseconds, since boot on Linux and since the epoch on macOS, and 1 when
   * the process is a zombie, ended and not yet reaped, or 0 when it runs.
   * Linux lists zombies; macOS leaves them out, so there it is always 0.
   * @throws {AddonLoadException} When the addon cannot be loaded, lacks the
   * function, or returns anything but rows of six numbers, or clock ticks
   * that are not a positive whole number.
   * @throws {SystemCommandException} When a Linux `stat` file cannot be read
   * as a process's row.
   * @throws Error when the process folder or a `stat` file cannot be read.
   * @example
   * ```ts
   * import { PosixProcessApi } from "@noldova/desktop.runtime";
   *
   * export async function countAsync(): Promise<number> {
   *   return (await PosixProcessApi.create().listProcessesAsync()).length;
   * }
   * ```
   */
  public listProcessesAsync(): Promise<readonly (readonly [number, number, number, number, number, number?])[]>;
}

/**
 * Reads macOS's responsible processes through the runtime's POSIX addon,
 * `native/<platform>-<arch>/posix-process.node`, loaded on the first call.
 * macOS asks for privacy permissions, such as screen recording or
 * accessibility, in the name of a process's responsible process. The addon
 * reads it through the system's private
 * `responsibility_get_pid_responsible_for_pid`, which it looks up when called,
 * as Chromium also does.
 */
export declare class PosixResponsibilityApi {
  /**
   * Wraps an addon.
   *
   * @param addon The addon that makes the calls: `readResponsibleProcessId`.
   * @example
   * ```ts
   * import { type IPosixProcessAddon, NativeAddon, PosixResponsibilityApi } from "@noldova/desktop.runtime";
   *
   * export const api: PosixResponsibilityApi = new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(NativeAddon.locate("posix-process.node"), ["readResponsibleProcessId"]));
   * ```
   */
  public constructor(addon: NativeAddon<IPosixProcessAddon>);

  /**
   * Wraps the package's own POSIX addon on macOS, without loading it.
   *
   * @param platform The platform, as `process.platform` names it; this
   * process's own by default.
   * @returns The API on macOS, and `null` elsewhere, where no system keeps a
   * responsible process.
   * @example
   * ```ts
   * import { PosixResponsibilityApi } from "@noldova/desktop.runtime";
   *
   * export const api: PosixResponsibilityApi | null = PosixResponsibilityApi.create();
   * ```
   */
  public static create(platform?: string): PosixResponsibilityApi | null;

  /**
   * Reads a process's responsible process.
   *
   * @param processId The process.
   * @param systemFunction The system function to look up and ask;
   * `responsibility_get_pid_responsible_for_pid` by default.
   * @returns The responsible process's id, or `null` when the system has no
   * such function or gives no answer, as for a process that has ended.
   * @throws {AddonLoadException} When the addon cannot be loaded, lacks the
   * function, or returns anything but a positive whole number or `null`.
   * @example
   * ```ts
   * import { PosixResponsibilityApi } from "@noldova/desktop.runtime";
   *
   * export function isOwnResponsible(): boolean {
   *   return PosixResponsibilityApi.create()?.findResponsible(process.pid) === process.pid;
   * }
   * ```
   */
  public findResponsible(processId: number, systemFunction?: string): number | null;

  /**
   * Says why a process is not its own responsible process, for a log.
   *
   * @param processId The process, such as the runtime's own.
   * @returns `null` when the process is its own responsible process, or else
   * a sentence that says programs it starts may ask for privacy permissions
   * in the name of whatever started the app, and whether the system gave no
   * answer or another responsible process.
   * @throws {AddonLoadException} As {@link PosixResponsibilityApi.findResponsible} does.
   * @example
   * ```ts
   * import { PosixResponsibilityApi } from "@noldova/desktop.runtime";
   *
   * export function noteOf(log: (text: string) => void): void {
   *   const note = PosixResponsibilityApi.create()?.describe(process.pid) ?? null;
   *   if (note !== null)
   *     log(note);
   * }
   * ```
   */
  public describe(processId: number): string | null;
}

/**
 * The runtime's Windows addon, `native/<platform>-<arch>/windows-process.node`,
 * loaded on the first call. Each method is {@link IWindowsProcessApi}'s, and
 * each throws {@link AddonLoadException} when the addon cannot be loaded, lacks
 * a function or returns a value of another kind, as an addon from another build
 * does.
 */
export declare class WindowsProcessApi implements IWindowsProcessApi {
  /**
   * Creates the API for a Windows addon file, without loading it.
   *
   * @param file The addon's absolute path; it must export each of
   * {@link IWindowsProcessApi}'s functions.
   * @example
   * ```ts
   * import { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function createApi(file: string): WindowsProcessApi {
   *   return new WindowsProcessApi(file);
   * }
   * ```
   */
  public constructor(file: string);

  /**
   * Creates the API for the package's own addon, without loading it.
   *
   * @returns The API, which loads the addon on its first call.
   * @example
   * ```ts
   * import { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function countProcesses(): number {
   *   return WindowsProcessApi.create().listProcesses().length;
   * }
   * ```
   */
  public static create(): WindowsProcessApi;

  /**
   * Lists the processes running now; see {@link IWindowsProcessApi.listProcesses}.
   *
   * @returns Each process's id and its parent's id.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function count(api: WindowsProcessApi): number {
   *   return api.listProcesses().length;
   * }
   * ```
   */
  public listProcesses(): readonly (readonly [number, number])[];

  /**
   * Opens a process; see {@link IWindowsProcessApi.openProcess}.
   *
   * @param processId The process's id.
   * @param access The access rights to open it with.
   * @returns The process's handle, or the Windows error number when it cannot be opened.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function open(api: WindowsProcessApi, processId: number): bigint | number {
   *   return api.openProcess(processId, 0x1000);
   * }
   * ```
   */
  public openProcess(processId: number, access: number): bigint | number;

  /**
   * Reads when a process was created; see {@link IWindowsProcessApi.readCreationTime}.
   *
   * @param handle The process's handle.
   * @returns Its creation time, or `null` when it cannot be read.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function readCreated(api: WindowsProcessApi, handle: bigint): bigint | null {
   *   return api.readCreationTime(handle);
   * }
   * ```
   */
  public readCreationTime(handle: bigint): bigint | null;

  /**
   * Reads the executable a process runs; see {@link IWindowsProcessApi.readImagePath}.
   *
   * @param handle The process's handle.
   * @returns The executable's path, or `null` when it cannot be read.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function readExecutable(api: WindowsProcessApi, handle: bigint): string | null {
   *   return api.readImagePath(handle);
   * }
   * ```
   */
  public readImagePath(handle: bigint): string | null;

  /**
   * Ends a process; see {@link IWindowsProcessApi.terminateProcess}.
   *
   * @param handle The process's handle.
   * @returns Whether Windows accepted ending it.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function end(api: WindowsProcessApi, handle: bigint): boolean {
   *   return api.terminateProcess(handle);
   * }
   * ```
   */
  public terminateProcess(handle: bigint): boolean;

  /**
   * Checks whether a process has exited; see {@link IWindowsProcessApi.hasExited}.
   *
   * @param handle The process's handle.
   * @returns Whether it has exited.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function hasEnded(api: WindowsProcessApi, handle: bigint): boolean {
   *   return api.hasExited(handle);
   * }
   * ```
   */
  public hasExited(handle: bigint): boolean;

  /**
   * Reads an exited process's exit code; see {@link IWindowsProcessApi.readExitCode}.
   *
   * @param handle The process's handle.
   * @returns Its exit code, or `null` when Windows gives none.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function readCode(api: WindowsProcessApi, handle: bigint): number | null {
   *   return api.hasExited(handle) ? api.readExitCode(handle) : null;
   * }
   * ```
   */
  public readExitCode(handle: bigint): number | null;

  /**
   * Opens a file for reading that stays unwritable while held; see {@link IWindowsProcessApi.openFileForReading}.
   *
   * @param file The file's path.
   * @returns The file's handle, or the Windows error number when it cannot be opened.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function hold(api: WindowsProcessApi, file: string): bigint | number {
   *   return api.openFileForReading(file);
   * }
   * ```
   */
  public openFileForReading(file: string): bigint | number;

  /**
   * Closes a handle; see {@link IWindowsProcessApi.closeHandle}.
   *
   * @param handle A handle from this API.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function close(api: WindowsProcessApi, handle: bigint): void {
   *   api.closeHandle(handle);
   * }
   * ```
   */
  public closeHandle(handle: bigint): void;

  /**
   * Creates a job that ends its processes when it closes; see {@link IWindowsProcessApi.createJob}.
   *
   * @param holdsDescendants Whether what the job's processes start is in the job too and can't leave it.
   * @returns The job's handle.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function create(api: WindowsProcessApi): bigint {
   *   return api.createJob(true);
   * }
   * ```
   */
  public createJob(holdsDescendants: boolean): bigint;

  /**
   * Puts a process in a job; see {@link IWindowsProcessApi.assignProcessToJob}.
   *
   * @param job The job's handle.
   * @param handle The process's handle.
   * @returns 0, or the Windows error number when it could not be put in the job.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function assign(api: WindowsProcessApi, job: bigint, handle: bigint): number {
   *   return api.assignProcessToJob(job, handle);
   * }
   * ```
   */
  public assignProcessToJob(job: bigint, handle: bigint): number;

  /**
   * Lists the processes in a job; see {@link IWindowsProcessApi.listJobProcesses}.
   *
   * @param job The job's handle.
   * @returns The ids of the job's processes.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export function list(api: WindowsProcessApi, job: bigint): readonly number[] {
   *   return api.listJobProcesses(job);
   * }
   * ```
   */
  public listJobProcesses(job: bigint): readonly number[];

  /**
   * Verifies a file's signature; see {@link IWindowsProcessApi.verifySignatureAsync}.
   *
   * @param file The file's path.
   * @returns A promise of the signature's status, its text and its signer's name.
   * @example
   * ```ts
   * import type { WindowsProcessApi } from "@noldova/desktop.runtime";
   *
   * export async function readSignerAsync(api: WindowsProcessApi, file: string): Promise<string | null> {
   *   return (await api.verifySignatureAsync(file)).subject;
   * }
   * ```
   */
  public verifySignatureAsync(file: string): Promise<IWindowsSignature>;
}

/**
 * Handles requests for one registered method.
 */
export interface IMethodHandler {
  /**
   * Handles one request.
   *
   * @param context The request's payload and its cancellation signal, which aborts on cancellation, deadline or disconnect.
   * @returns A promise of the response payload. Reject with {@link MethodFailureException} or a protocol exception to answer with a specific failure; a JSON reading error is answered as invalid parameters, and anything else as an internal failure, whose error and stack go only to the runtime's diagnostics.
   * A payload too large for one frame is answered as `FrameTooLarge`, and one that cannot be written as JSON as an internal
   * failure; the connection stays open.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import type { IMethodHandler, RequestContext } from "@noldova/desktop.runtime";
   *
   * export class EchoHandler implements IMethodHandler {
   *   public async handleAsync(context: RequestContext): Promise<JsonValue> {
   *     context.signal.throwIfAborted();
   *     return { client: context.client, payload: context.payload };
   *   }
   * }
   * ```
   */
  handleAsync(context: RequestContext): Promise<JsonValue>;
}

/**
 * A module's runtime part. A module's runtime package exports it as the class
 * `RuntimePart`, which the runtime constructs without arguments. Its
 * constructor only sets fields: the runtime constructs it before migrating the
 * module's database, so work belongs in {@link IRuntimePart.activateAsync}.
 */
export interface IRuntimePart {
  /**
   * The migrations of the module's database, in order: a fixed list the part
   * declares, never computed from data. The runtime applies the pending ones
   * before activating the part and gives the part the open database through its
   * context. A part without migrations has no database.
   */
  readonly migrations?: readonly Migration[];

  /**
   * Activates the part once, after the modules it depends on: it registers its
   * methods and events, publishes its services and keeps heavy work for later.
   *
   * @param context What the part may register and use.
   * @returns A promise that resolves once the part is active; a rejection
   * marks the module failed and withdraws what it registered. The module's
   * status shows a {@link ModuleActivationException}'s message as its cause,
   * and "Its runtime part failed to activate." for any other rejection, or
   * when that message is no longer text that isn't blank once thrown.
   * @example
   * ```ts
   * import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export class RuntimePart implements IRuntimePart {
   *   public async activateAsync(context: IRuntimePartContext): Promise<void> {
   *     context.registerMethod("notes.list", { handleAsync: async () => [] });
   *   }
   *
   *   public async deactivateAsync(): Promise<void> {
   *   }
   * }
   * ```
   */
  activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Deactivates the part when the runtime stops, before the runtime withdraws
   * what the part registered: it releases its timers, files and processes.
   *
   * @returns A promise that resolves once the part has released everything.
   * @example
   * ```ts
   * import type { IRuntimePart } from "@noldova/desktop.runtime";
   *
   * export function stopAsync(part: IRuntimePart): Promise<void> {
   *   return part.deactivateAsync();
   * }
   * ```
   */
  deactivateAsync(): Promise<void>;
}

/**
 * A module's own database as its runtime part uses it: queries, changes and
 * transactions. The runtime owns its lifetime.
 */
export interface IModuleDatabase {
  /**
   * Runs a query and returns its first row.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The first row, or `undefined` when there is none.
   * @throws Error synchronously when the statement fails.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   *
   * export function readTitle(database: IModuleDatabase, id: string): unknown {
   *   return database.read("SELECT title FROM notes WHERE id = ?", id)?.["title"];
   * }
   * ```
   */
  read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined;

  /**
   * Runs a query and returns all its rows.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns The rows, in the query's order.
   * @throws Error synchronously when the statement fails.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   *
   * export function countNotes(database: IModuleDatabase): number {
   *   return database.readAll("SELECT id FROM notes").length;
   * }
   * ```
   */
  readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[];

  /**
   * Runs a statement that changes the database.
   *
   * @param statement The SQL statement, with `?` placeholders.
   * @param values The placeholders' values, in order.
   * @returns How many rows changed and the last inserted row id.
   * @throws Error synchronously when the statement fails.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   *
   * export function addNote(database: IModuleDatabase, id: string): void {
   *   database.run("INSERT INTO notes (id) VALUES (?)", id);
   * }
   * ```
   */
  run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges;

  /**
   * Runs an action in one transaction, as {@link MigratedDatabase.transaction}
   * does: the action finishes synchronously, and one that returns a promise
   * does not compile.
   *
   * @param action The work.
   * @returns What the action returned.
   * @throws {ArgumentException} When the action returned a thenable; nothing was committed.
   * @throws Error synchronously as the action threw it, after rolling back.
   * @example
   * ```ts
   * import type { IModuleDatabase } from "@noldova/desktop.runtime";
   *
   * export function renameNote(database: IModuleDatabase, from: string, to: string): void {
   *   database.transaction(() => {
   *     database.run("INSERT INTO notes (id) VALUES (?)", to);
   *     database.run("DELETE FROM notes WHERE id = ?", from);
   *   });
   * }
   * ```
   */
  transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T;
}

/**
 * A runtime part's access to settings: it reads its own settings, its
 * dependencies' and the shell's, changes only its own, and describes the
 * setting scopes its declaration lists. Calls are synchronous; values live
 * in the shell's database.
 */
export interface IModuleSettings {
  /**
   * Reads a setting's value in effect: the value set for the scope object,
   * else for each enclosing scope, else for the application, else the
   * default. A device setting reads the given device's value.
   *
   * @param name The setting's name.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device, for a device setting; `null` by default.
   * @returns The value in effect.
   * @throws {RegistrationException} When the setting is another module's that
   * is not a dependency.
   * @throws {SettingException} When no such setting is declared, or the
   * setting does not list the scope.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function readStep(context: IRuntimePartContext): JsonValue {
   *   return context.settings.read("clock.tickStep");
   * }
   * ```
   */
  read(name: string, scope?: SettingScope | null, device?: string | null): JsonValue;

  /**
   * Sets one of the module's own settings for the application, a scope
   * object or, for a device setting, a device.
   *
   * @param name The setting's name.
   * @param value The value; one the setting accepts.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device, for a device setting; `null` by default.
   * @throws {RegistrationException} When the setting is not the module's own.
   * @throws {SettingException} When the setting is unknown, does not accept
   * the value or the scope, or is a device setting given no device.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function slowDown(context: IRuntimePartContext): void {
   *   context.settings.write("clock.tickStep", 1);
   * }
   * ```
   */
  write(name: string, value: JsonValue, scope?: SettingScope | null, device?: string | null): void;

  /**
   * Removes one of the module's own setting values, so the enclosing value
   * or the default takes effect.
   *
   * @param name The setting's name.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device, for a device setting; `null` by default.
   * @throws {RegistrationException} When the setting is not the module's own.
   * @throws {SettingException} As `write` does.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function restore(context: IRuntimePartContext): void {
   *   context.settings.reset("clock.tickStep");
   * }
   * ```
   */
  reset(name: string, scope?: SettingScope | null, device?: string | null): void;

  /**
   * Follows a readable setting: the listener receives each change, a value
   * set or reset for any scope or device, with the value then in effect for
   * that key. It stops when the part deactivates.
   *
   * @param name The setting's name.
   * @param listener Called after each change commits.
   * @throws {RegistrationException} As `read` does.
   * @throws {SettingException} When no such setting is declared.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function follow(context: IRuntimePartContext, apply: (step: number) => void): void {
   *   context.settings.onChanged("clock.tickStep", t => apply(Number(t.value)));
   * }
   * ```
   */
  onChanged(name: string, listener: (change: SettingChange) => void): void;

  /**
   * Records which scope object encloses one of the module's scope objects,
   * such as a conversation's project, or that none does.
   *
   * @param scope One of the module's scope objects.
   * @param parent The enclosing object, of the module's own scopes or a
   * dependency's; `null` when the application encloses it.
   * @throws {RegistrationException} When the scope is not the module's or the
   * parent's scope is neither its own nor a dependency's.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function place(context: IRuntimePartContext, conversation: string, project: string): void {
   *   context.settings.setScopeParent(
   *     new SettingScope(QualifiedName.parse("chat.conversation"), conversation),
   *     new SettingScope(QualifiedName.parse("projects.project"), project));
   * }
   * ```
   */
  setScopeParent(scope: SettingScope, parent: SettingScope | null): void;

  /**
   * Removes the values set for one of the module's scope objects and its
   * enclosure, when the object is deleted.
   *
   * @param scope One of the module's scope objects.
   * @throws {RegistrationException} When the scope is not the module's.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function forget(context: IRuntimePartContext, conversation: string): void {
   *   context.settings.removeScope(new SettingScope(QualifiedName.parse("chat.conversation"), conversation));
   * }
   * ```
   */
  removeScope(scope: SettingScope): void;
}

/**
 * A runtime part's secrets in this machine's secret store: tokens and keys
 * its module keeps by name, which the main process encrypts with the
 * system's keyring, as `documents/MODULES.md` says. A part saves, reads,
 * replaces, removes and checks only its own module's names; each value is
 * kept for this machine alone and never appears in a log, an error, a
 * notification or a settings file. Every call fails as `Unavailable` until
 * the app's main process has connected. `SecretFailures.reasonOf(error.failure)`
 * from `@noldova/desktop.protocol` says why a call failed:
 * `NotConnected`, `NoDevice`, `Unprotected` or, for a read, `Undecryptable`.
 */
export interface IModuleSecrets {
  /**
   * Saves a value under one of the module's own names, replacing any value
   * saved there. Saves and removes of one name take effect in the order they
   * were asked.
   *
   * @param name The name, `<module>.<member>`.
   * @param value The value, from 1 to 16,384 characters, with no lone
   * surrogate.
   * @throws {RegistrationException} asynchronously when the name is another
   * module's.
   * @throws {ArgumentException} asynchronously when the name is not a
   * qualified name, or the value is empty, too long or holds a lone
   * surrogate.
   * @throws {MethodFailureException} asynchronously, as `Unavailable`, when
   * the main process is not connected (`NotConnected`), the app has no device
   * identity (`NoDevice`), or this machine has no keyring to protect the value
   * (`Unprotected`); nothing is saved.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function signInAsync(context: IRuntimePartContext, token: string): Promise<void> {
   *   await context.secrets.saveAsync("notes.syncToken", token);
   * }
   * ```
   */
  saveAsync(name: string, value: string): Promise<void>;

  /**
   * Reads a value back from the main process, which decrypts it for this
   * part alone.
   *
   * @param name The name, `<module>.<member>`.
   * @returns The value, or `null` when none is saved on this machine.
   * @throws {RegistrationException} asynchronously when the name is another
   * module's.
   * @throws {ArgumentException} asynchronously when the name is not a
   * qualified name.
   * @throws {MethodFailureException} asynchronously, as `Unavailable`, when
   * the main process is not connected (`NotConnected`), the app has no device
   * identity (`NoDevice`), this machine has no keyring that protects the value
   * (`Unprotected`), or the main process can't decrypt it (`Undecryptable`).
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function readTokenAsync(context: IRuntimePartContext): Promise<string | null> {
   *   return await context.secrets.readAsync("notes.syncToken");
   * }
   * ```
   */
  readAsync(name: string): Promise<string | null>;

  /**
   * Removes the value saved under a name on this machine, if any, after any
   * save of that name asked before it.
   *
   * @param name The name, `<module>.<member>`.
   * @throws {RegistrationException} asynchronously when the name is another
   * module's.
   * @throws {ArgumentException} asynchronously when the name is not a
   * qualified name.
   * @throws {MethodFailureException} asynchronously, as `Unavailable`, when
   * the runtime doesn't know the device's identity because the main process
   * hasn't connected since it started, or has gone before giving it
   * (`NotConnected`), or when the app has no device identity (`NoDevice`).
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function signOutAsync(context: IRuntimePartContext): Promise<void> {
   *   await context.secrets.removeAsync("notes.syncToken");
   * }
   * ```
   */
  removeAsync(name: string): Promise<void>;

  /**
   * Says whether a value is saved under a name on this machine, without
   * reading it.
   *
   * @param name The name, `<module>.<member>`.
   * @returns Whether a value is saved.
   * @throws {RegistrationException} asynchronously when the name is another
   * module's.
   * @throws {ArgumentException} asynchronously when the name is not a
   * qualified name.
   * @throws {MethodFailureException} asynchronously, as `Unavailable`, when
   * the runtime doesn't know the device's identity because the main process
   * hasn't connected since it started, or has gone before giving it
   * (`NotConnected`), or when the app has no device identity (`NoDevice`).
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function isSignedInAsync(context: IRuntimePartContext): Promise<boolean> {
   *   return await context.secrets.isSetAsync("notes.syncToken");
   * }
   * ```
   */
  isSetAsync(name: string): Promise<boolean>;
}

/**
 * Where secrets are kept: this machine's store is the only one, and a test
 * passes its own to a `ModuleContext` or `ModuleHost`. Names are checked
 * before they reach it.
 */
export interface ISecretBackend {
  /**
   * Saves a value under a name, replacing any value saved there. A backend
   * applies the saves and removes of one name in the order they were asked.
   *
   * @param name The name.
   * @param value The value.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { ISecretBackend } from "@noldova/desktop.runtime";
   *
   * export async function saveAsync(backend: ISecretBackend): Promise<void> {
   *   await backend.saveAsync(QualifiedName.parse("notes.syncToken"), "s3cret");
   * }
   * ```
   */
  saveAsync(name: QualifiedName, value: string): Promise<void>;

  /**
   * Reads the value saved under a name.
   *
   * @param name The name.
   * @returns The value, or `null` when none is saved.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { ISecretBackend } from "@noldova/desktop.runtime";
   *
   * export async function readAsync(backend: ISecretBackend): Promise<string | null> {
   *   return await backend.readAsync(QualifiedName.parse("notes.syncToken"));
   * }
   * ```
   */
  readAsync(name: QualifiedName): Promise<string | null>;

  /**
   * Removes the value saved under a name, if any.
   *
   * @param name The name.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { ISecretBackend } from "@noldova/desktop.runtime";
   *
   * export async function removeAsync(backend: ISecretBackend): Promise<void> {
   *   await backend.removeAsync(QualifiedName.parse("notes.syncToken"));
   * }
   * ```
   */
  removeAsync(name: QualifiedName): Promise<void>;

  /**
   * Says whether a value is saved under a name.
   *
   * @param name The name.
   * @returns Whether a value is saved.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { ISecretBackend } from "@noldova/desktop.runtime";
   *
   * export async function isSetAsync(backend: ISecretBackend): Promise<boolean> {
   *   return await backend.isSetAsync(QualifiedName.parse("notes.syncToken"));
   * }
   * ```
   */
  isSetAsync(name: QualifiedName): Promise<boolean>;
}

/**
 * A module's lines in the runtime's log.
 */
export interface IModuleLog {
  /**
   * Writes a message to `logs/runtime.log`, each of its lines starting with
   * the module's id and redacted, with the home folder shown as `~` and the
   * user name, email addresses, accounts in addresses and tokens removed.
   *
   * @param message The message.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function report(context: IRuntimePartContext, count: number): void {
   *   context.log.write(`Indexed ${count} files.`);
   * }
   * ```
   */
  write(message: string): void;
}

/**
 * What a module's runtime part may register and use. The runtime withdraws
 * everything registered through it when the part deactivates or fails to
 * activate.
 */
export interface IRuntimePartContext {
  /**
   * The module's id.
   */
  readonly moduleId: string;

  /**
   * The module's folder in the data directory, `modules/<id>`, for its
   * database and files; the module creates it when it needs it.
   */
  readonly moduleFolder: string;

  /**
   * The module's own database, migrated and open. Its calls are synchronous
   * and every client shares one runtime, so queries stay short and long work
   * happens outside a database call. The runtime closes it when the part
   * deactivates.
   *
   * @throws {ModuleDatabaseException} When the part declares no migrations.
   */
  readonly database: IModuleDatabase;

  /**
   * The module's access to settings: its own, its dependencies' and the
   * shell's.
   */
  readonly settings: IModuleSettings;

  /**
   * The module's lines in the runtime's log.
   */
  readonly log: IModuleLog;

  /**
   * The tool registry as the module sees it: the tools it offers agents, and the agent sessions an app opens, as
   * `documents/TOOLS.md` says. The runtime withdraws its tools and ends its sessions when the part deactivates.
   */
  readonly tools: IToolsContext;

  /**
   * The permission requests and remembered answers as the module sees it, as `documents/PERMISSIONS.md` says: the
   * module the app names in `desktop.product.permissionsModule` answers the requests and manages the remembered
   * answers, and every module learns when one of its remembered answers is revoked.
   */
  readonly permissions: IPermissionsContext;

  /**
   * The module's own web views, which its window part opens: their list,
   * their navigation, their allowed origins, their profiles, their events and
   * the debugging protocol relay, as `documents/WEB-VIEWS.md` says. The
   * runtime stops reporting their events when the part deactivates.
   */
  readonly webViews: IRuntimeWebViews;

  /**
   * The files the person handed the module's window part, by the grants the
   * window part passes in its requests, as `documents/MODULES.md` says. A
   * part redeems each grant at once, when the person attaches the file, and
   * copies what it keeps into its own folder, since a grant lives at most ten
   * minutes.
   */
  readonly files: IRuntimeFiles;

  /**
   * The module's own secrets in this machine's secret store, by name, as
   * `documents/MODULES.md` says. Only the runtime part reads a value back;
   * the main process decrypts it and sends it to the runtime over the
   * runtime's connection to the main process, and the runtime hands it to
   * this part alone, in its own process.
   */
  readonly secrets: IModuleSecrets;

  /**
   * The app's own windows, with their platform identity and process id, so a module that acts on the screen can
   * leave them alone, as `documents/MODULES.md` says.
   */
  readonly appWindows: IAppWindows;

  /**
   * The app's shortcuts as key chords, so a module that sends keys can refuse them, as `documents/MODULES.md` says.
   */
  readonly shortcuts: IAppShortcuts;

  /**
   * The module's folder in the data directory's `work` folder,
   * `work/<id>`, for work outside any project; the module creates and
   * removes what it puts inside.
   *
   * @returns A promise of the folder, created when it is first asked for.
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function locateScratchAsync(context: IRuntimePartContext, conversation: string): Promise<string> {
   *   return path.join(await context.getWorkFolderAsync(), conversation);
   * }
   * ```
   */
  getWorkFolderAsync(): Promise<string>;

  /**
   * Reports work in progress, which the runtime lists in `desktop.work` and
   * which keeps it from stopping while idle. Noldova Desktop Sample asks the person before
   * quitting while it runs.
   *
   * @param description What the work is, as the person reads it.
   * @returns The work item: its signal aborts when the person stops the
   * work, and disposing it ends the work. Work still open ends when the part
   * deactivates.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function indexAsync(context: IRuntimePartContext, index: (signal: AbortSignal) => Promise<void>): Promise<void> {
   *   using work = context.beginWork("Indexing the project");
   *   await index(work.signal);
   * }
   * ```
   */
  beginWork(description: string): WorkItem;

  /**
   * Reads the person's current environment, as a new terminal would see it,
   * for a program the module starts, such as through {@link startProcessAsync}
   * with the variables as the request's environment. On Windows it is the
   * runtime's inherited environment with the machine's and the person's saved
   * variables laid over it and expanded as Windows does for a new process,
   * read again for each call. On macOS and Linux it is the environment the
   * person's login shell exports, read with a time limit of 10 seconds and
   * kept until one of the shell's profile files changes, in the home folder,
   * in the `ZDOTDIR` folder or where a profile link points; calls during a
   * read share it, and the shell's own `PWD`, `OLDPWD`, `SHLVL` and `_` are
   * left out, also from the runtime's own environment. Noldova Desktop's own variables,
   * `ELECTRON_RUN_AS_NODE` and `ELECTRON_NO_ATTACH_CONSOLE`, are left out,
   * and so is a name {@link ProcessRequest} refuses, such as Windows' `=C:`.
   * When a read fails or runs out of time, the runtime's log says why,
   * without any value, and the call gets the last environment read, or the
   * runtime's own.
   *
   * @returns A promise of the variables by name, which never rejects.
   * @example
   * ```ts
   * import { type IRuntimePartContext, type OwnedProcess, ProcessRequest } from "@noldova/desktop.runtime";
   *
   * export async function startStatusAsync(context: IRuntimePartContext, project: string): Promise<OwnedProcess> {
   *   const environment = await context.readEnvironmentAsync();
   *   return await context.startProcessAsync(new ProcessRequest("git", ["status"], project, environment));
   * }
   * ```
   */
  readEnvironmentAsync(): Promise<Readonly<Record<string, string>>>;

  /**
   * Starts a program the runtime owns on the module's behalf. The program is
   * found on the PATH unless it is an absolute path that names its drive or
   * share on Windows; on Windows each PATHEXT extension among `.com`, `.exe`,
   * `.bat` and `.cmd` is tried, after the name itself when it has one of
   * them, and a `.bat` or `.cmd` file runs through `cmd.exe` with its
   * arguments escaped. The program gets only the system variables
   * {@link ProcessRequest} lists and the ones the request names. The runtime
   * records it, ends it
   * and what it started when the part deactivates or the runtime stops,
   * giving it 3 seconds to exit first, and ends what a crashed runtime left
   * running on its next start. Aborting the request's signal stops the
   * program the same way; a signal already aborted rejects with its reason.
   *
   * @param request The program, its arguments, working folder, environment
   * and abort signal.
   * @returns A promise of the running program, once it has started.
   * @throws {ProcessStartException} Rejected when the program is a relative
   * path, is not found or cannot start, when a batch file's argument holds
   * a line break or a null character, when a batch file is asked for
   * verbatim arguments on Windows, or once the part is deactivating.
   * @example
   * ```ts
   * import { type IRuntimePartContext, type OwnedProcess, ProcessRequest } from "@noldova/desktop.runtime";
   *
   * export function startStatusAsync(context: IRuntimePartContext, project: string): Promise<OwnedProcess> {
   *   return context.startProcessAsync(new ProcessRequest("git", ["status", "--porcelain"], project, { GIT_PAGER: "cat" }, ["SSH_AUTH_SOCK"]));
   * }
   * ```
   */
  startProcessAsync(request: ProcessRequest): Promise<OwnedProcess>;

  /**
   * Starts a program in a pseudo-terminal for the module, through the
   * module's own pseudo-terminal library; the module must declare
   * `pseudoTerminals`. The program gets the request's environment whole and
   * the terminal xterm-256color. The runtime records it and ends it the way
   * {@link IRuntimePartContext.startProcessAsync} does, except that it first
   * resumes the output and then, on Windows, closes the pseudo console, and
   * elsewhere sends the program's process group SIGHUP, and the program
   * itself SIGHUP once more when it still runs a third of the way into the
   * grace period, and once the program has ended, also the process groups of
   * its jobs that still run, since a shell can lose its hangup before it
   * passes it on. Once the program
   * exits, the runtime closes its pseudo console on Windows and stops the
   * library's output reader.
   *
   * @param request The library, program, arguments, working folder, size,
   * environment and options.
   * @returns A promise of the running pseudo-terminal, once its program has
   * started and has a process id.
   * @throws {ProcessStartException} Rejected when the module does not
   * declare `pseudoTerminals`, when the program is a relative path, is not
   * found or cannot start, when it is a batch file that would run through
   * cmd.exe's own parsing, when the request's command line is given on macOS
   * or Linux, beside arguments or for a batch file, or once the part is
   * deactivating.
   * @example
   * ```ts
   * import * as pty from "node-pty";
   *
   * import { type IRuntimePartContext, type PseudoTerminal, PseudoTerminalRequest } from "@noldova/desktop.runtime";
   *
   * export function startShellAsync(context: IRuntimePartContext, project: string, environment: Readonly<Record<string, string>>): Promise<PseudoTerminal> {
   *   return context.startPseudoTerminalAsync(new PseudoTerminalRequest(pty, "bash", ["-l"], project, 80, 24, environment));
   * }
   * ```
   */
  startPseudoTerminalAsync(request: PseudoTerminalRequest): Promise<PseudoTerminal>;

  /**
   * Registers a handler for one of the methods the module's declaration
   * contributes. The signal a call gets also aborts when the module
   * deactivates, such as when its switch setting turns it off.
   *
   * @param name The method's name, `<id>.<name>`.
   * @param handler Its handler.
   * @throws {RegistrationException} When the declaration does not contribute
   * the method or it is already registered.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function serve(context: IRuntimePartContext): void {
   *   context.registerMethod("notes.list", { handleAsync: async () => [] });
   * }
   * ```
   */
  registerMethod(name: string, handler: IMethodHandler): void;

  /**
   * Declares one of the events the module's declaration contributes.
   *
   * @param name The event's name, `<id>.<name>`.
   * @returns The channel the module publishes the event through.
   * @throws {RegistrationException} When the declaration does not contribute
   * the event or it is already declared.
   * @example
   * ```ts
   * import type { EventChannel, IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function announce(context: IRuntimePartContext): EventChannel {
   *   return context.declareEvent("notes.changed");
   * }
   * ```
   */
  declareEvent(name: string): EventChannel;

  /**
   * Registers one of the commands the module's declaration contributes. A
   * window runs it through `desktop.runCommand`; it is withdrawn when the
   * module deactivates.
   *
   * @param command The command, its title, icon, default key and handler.
   * @throws {RegistrationException} When the declaration does not contribute
   * the command or it is already registered.
   * @example
   * ```ts
   * import { type IRuntimePartContext, RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function serveTick(context: IRuntimePartContext): void {
   *   context.registerCommand(new RuntimeCommand("clock.tick", "Tick", "timer", "Mod+Alt+T", { handleAsync: async () => null }));
   * }
   * ```
   */
  registerCommand(command: RuntimeCommand): void;

  /**
   * Hears when a window of a connection closes for good, as `{ connection, window }`, and when a connection closes,
   * as `{ connection, window: null }`, until the module deactivates. A window's reload, including one after a page
   * crash, is not a closure. The listener hears a closure after every request the window or connection sent has reached
   * its handler and those still running are cancelled, and no request from it follows; a connection that reconnects is a
   * new connection.
   *
   * @param listener Hears each closure; one that throws or rejects is logged in the runtime's diagnostics.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function endWithWindows(context: IRuntimePartContext, shells: Map<string, () => void>): void {
   *   context.onClientClosed(t => {
   *     for (const [key, end] of shells)
   *       if (key === `${t.connection}:${t.window}` || (t.window === null && key.startsWith(`${t.connection}:`)))
   *         end();
   *   });
   * }
   * ```
   */
  onClientClosed(listener: (closure: ClientClosure) => void | Promise<void>): void;

  /**
   * Posts a notification of a kind the module's declaration contributes; posting the same kind and key again replaces the
   * earlier one. Its commands must be the module's own or a dependency's. It is dismissed when the module deactivates.
   *
   * @param post What to show.
   * @returns The notification's handle, which updates or dismisses it.
   * @throws {RegistrationException} When the declaration does not contribute the kind, or a command belongs to another
   * module that is not a dependency.
   * @example
   * ```ts
   * import type { IRuntimePartContext, NotificationHandle } from "@noldova/desktop.runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export function announce(context: IRuntimePartContext): NotificationHandle {
   *   return context.postNotification(new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null));
   * }
   * ```
   */
  postNotification(post: NotificationPost): NotificationHandle;

  /**
   * Publishes a service for the modules that depend on this one.
   *
   * @param name The service's name, `<id>.<name>` with the module's own id.
   * @param service The service, an instance of a class the module's API
   * exports.
   * @throws {RegistrationException} When the name has another owner or is
   * already published.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export class NoteStore {
   *   public readonly titles: string[] = [];
   * }
   *
   * export function publish(context: IRuntimePartContext): void {
   *   context.publishService("notes.store", new NoteStore());
   * }
   * ```
   */
  publishService(name: string, service: object): void;

  /**
   * Finds a service of the shell or of a module this one depends on.
   *
   * @param name The service's name, `<owner>.<name>`; the owner is `desktop`
   * or a dependency's id.
   * @param type The class the service is an instance of.
   * @returns The service.
   * @throws {ServiceAccessException} When the owner is neither the shell nor a
   * dependency, nothing is published under the name, or the service is not an
   * instance of the type.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export class TaskStore {
   *   public readonly titles: string[] = [];
   * }
   *
   * export function countTasks(context: IRuntimePartContext): number {
   *   return context.getService("tasks.store", TaskStore).titles.length;
   * }
   * ```
   */
  getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;

  /**
   * Finds a service of the shell, of a dependency or of an optional
   * dependency, which the module may go without. The module takes only types
   * from an optional dependency's packages, with `import type`, since they
   * are missing when that module is; the exact version the module pins is
   * what makes the service the shape it compiled against, and the guard
   * catches another service under the same name.
   *
   * @param name The service's name, `<owner>.<name>`; the owner is `desktop`,
   * a dependency's id or an optional dependency's id.
   * @param guard Tells whether what is published under the name is the
   * service the module expects.
   * @returns The service; `null` while the optional dependency that owns it
   * is not active or is at another version than the module needs, while
   * nothing is published under the name, or when the guard refuses what is,
   * which the module's log says once.
   * @throws {ServiceAccessException} When the owner is neither the shell nor a
   * dependency nor an optional dependency.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * interface IZoneService {
   *   describeAsync(zone: string): Promise<string>;
   * }
   *
   * const isZoneService = (service: object): service is IZoneService => "describeAsync" in service && typeof service.describeAsync === "function";
   *
   * export function findZones(context: IRuntimePartContext): IZoneService | null {
   *   return context.findService("clock.zones", isZoneService);
   * }
   * ```
   */
  findService<T extends object>(name: string, guard: (service: object) => service is T): T | null;

  /**
   * Listens for an optional dependency turning on or off while the module
   * runs, so the module can find its services again. A module's state is
   * settled before the modules that depend on it activate, so the runtime
   * calls the listener only when one changes later: when its switch setting
   * turns it off or on, or when it turns off or on with a module it needs.
   *
   * A listener added once the module deactivated is never called.
   *
   * @param listener Called with the optional dependency's id and whether it
   * is now active at the version the module needs; the module's log reports
   * an error it throws.
   * @returns Stops the listener; the module's deactivation stops it too.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function follow(context: IRuntimePartContext, read: () => void): () => void {
   *   return context.onDependencyChanged(t => {
   *     if (t === "clock")
   *       read();
   *   });
   * }
   * ```
   */
  onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void;
}

/**
 * Loads a module's runtime part from its package.
 */
export interface IRuntimePartLoader {
  /**
   * Loads and constructs the part.
   *
   * @param packageName The module's runtime package.
   * @returns A promise of the part.
   * @throws {ModuleLoadException} Rejected when the package exports no usable
   * `RuntimePart` class; an import failure rejects as it is.
   * @example
   * ```ts
   * import type { IRuntimePart, IRuntimePartLoader } from "@noldova/desktop.runtime";
   *
   * export function loadNotesAsync(loader: IRuntimePartLoader): Promise<IRuntimePart> {
   *   return loader.loadAsync("@noldova/desktop.notes.runtime");
   * }
   * ```
   */
  loadAsync(packageName: string): Promise<IRuntimePart>;
}

/**
 * Receives what a {@link RuntimeClient} learns after its handshake.
 */
export interface IRuntimeClientListener {
  /**
   * Called for each event the runtime publishes to an authenticated connection of the same build.
   *
   * @param event The event.
   * @example
   * ```ts
   * import type { Event, Failure } from "@noldova/desktop.protocol";
   * import type { IRuntimeClientListener } from "@noldova/desktop.runtime";
   *
   * export class WindowListener implements IRuntimeClientListener {
   *   public onEvent(event: Event): void {
   *     console.log(event.name.text, event.payload);
   *   }
   *
   *   public onDisconnected(failure: Failure | null): void {
   *     console.log(failure?.message ?? "The connection to the runtime closed.");
   *   }
   * }
   * ```
   */
  onEvent(event: Event): void;

  /**
   * Called once when an established connection closes.
   *
   * @param failure Why the client ended the connection: `FrameTooLarge` for a frame over the limit, `InvalidMessage` for
   * one that is not a valid message. Null when the runtime or the client's own `close` ended it.
   * @example
   * ```ts
   * import type { Event, Failure } from "@noldova/desktop.protocol";
   * import type { IRuntimeClientListener } from "@noldova/desktop.runtime";
   *
   * export class WindowListener implements IRuntimeClientListener {
   *   public onEvent(event: Event): void {
   *     console.log(event.name.text, event.payload);
   *   }
   *
   *   public onDisconnected(failure: Failure | null): void {
   *     console.log(failure?.message ?? "The connection to the runtime closed.");
   *   }
   * }
   * ```
   */
  onDisconnected(failure: Failure | null): void;
}

/**
 * A runtime's per-start capability token. It is compared through fixed-length digests in constant time.
 */
export declare class CapabilityToken {
  /**
   * The token's text, published only in protected discovery metadata.
   */
  public readonly value: string;

  /**
   * Creates a token from existing text.
   *
   * @param value The token's text.
   * @throws {ArgumentException} When the text is empty or whitespace.
   * @example
   * ```ts
   * import { CapabilityToken } from "@noldova/desktop.runtime";
   *
   * export function isValid(published: string, presented: string): boolean {
   *   return new CapabilityToken(published).matches(presented);
   * }
   * ```
   */
  public constructor(value: string);

  /**
   * Creates a token of 32 random bytes in hexadecimal.
   *
   * @returns A new token.
   * @example
   * ```ts
   * import { CapabilityToken } from "@noldova/desktop.runtime";
   *
   * export const token = CapabilityToken.generate();
   * ```
   */
  public static generate(): CapabilityToken;

  /**
   * Compares a candidate with the token in constant time, whatever its length.
   *
   * @param candidate The text a client presented.
   * @returns `true` when the candidate is the token.
   * @example
   * ```ts
   * import type { CapabilityToken } from "@noldova/desktop.runtime";
   *
   * export function admits(token: CapabilityToken, presented: string): boolean {
   *   return token.matches(presented);
   * }
   * ```
   */
  public matches(candidate: string): boolean;
}

/**
 * A runtime's own copy of the AppImage it runs from on Linux, as its launcher records it in `logs/copy-<id>.log`:
 * who holds the copy, and its extraction folder, or the mount process while the launcher hands a mount over to the
 * runtime. A mount the runtime holds has no record, since it ends with the runtime.
 */
export declare class AppImageCopyRecord {
  /**
   * The process the copy belongs to, by process id and start: the launcher while it starts the runtime, then the
   * runtime.
   */
  public readonly holder: UpdateProcess;

  /**
   * The folder the AppImage was extracted into, directly in the temporary folder, or `null` for a mount.
   */
  public readonly extraction: string | null;

  /**
   * The mount process, by process id and start, while the launcher hands its mount over to the runtime, or `null`.
   */
  public readonly mounter: UpdateProcess | null;

  /**
   * Creates the record.
   *
   * @param holder The process the copy belongs to.
   * @param extraction The extraction folder, or `null` for a mount.
   * @param mounter The mount process the launcher hands over, or `null`, the default.
   * @example
   * ```ts
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   * import { AppImageCopyRecord } from "@noldova/desktop.runtime";
   *
   * export const record: AppImageCopyRecord = new AppImageCopyRecord(new UpdateProcess(4120, 1500, 1501, "runtime"), "/tmp/desktop-runtime-AbC123");
   * ```
   */
  public constructor(holder: UpdateProcess, extraction: string | null, mounter?: UpdateProcess | null);

  /**
   * Reads a record from its file's JSON.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The record.
   * @throws JsonException When a field is missing or invalid, or another field is present; its path names the field.
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { AppImageCopyRecord } from "@noldova/desktop.runtime";
   *
   * export function parse(text: string): AppImageCopyRecord {
   *   return AppImageCopyRecord.fromJson(JsonReader.parse(text).toJson());
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): AppImageCopyRecord;

  /**
   * Reads a record file.
   *
   * @param file The record file.
   * @returns The record, or `null` when the file does not exist.
   * @throws {Error} Rejected when the file cannot be read or holds no valid record.
   * @example
   * ```ts
   * import { AppImageCopyRecord } from "@noldova/desktop.runtime";
   *
   * export async function readExtractionAsync(file: string): Promise<string | null> {
   *   return (await AppImageCopyRecord.readAsync(file))?.extraction ?? null;
   * }
   * ```
   */
  public static readAsync(file: string): Promise<AppImageCopyRecord | null>;

  /**
   * Writes the record to its file with mode 0600, through a temporary file beside it that then replaces the file.
   *
   * @param file The record file.
   * @returns A promise that resolves once the file holds the record.
   * @throws {Error} Rejected when the file cannot be written or replaced.
   * @example
   * ```ts
   * import type { AppImageCopyRecord } from "@noldova/desktop.runtime";
   *
   * export function saveAsync(record: AppImageCopyRecord, file: string): Promise<void> {
   *   return record.writeAsync(file);
   * }
   * ```
   */
  public writeAsync(file: string): Promise<void>;

  /**
   * Returns the file's JSON.
   *
   * @returns The JSON object.
   * @example
   * ```ts
   * import type { AppImageCopyRecord } from "@noldova/desktop.runtime";
   *
   * export function serialize(record: AppImageCopyRecord): string {
   *   return JSON.stringify(record.toJson());
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Starts the runtime on Linux from its own copy of the AppImage its launcher runs from, with no shell, so that the
 * runtime keeps running when the launcher's AppImage mount ends.
 */
export declare class AppImageCopyLaunch {
  /**
   * Creates the launch.
   *
   * @param starter Starts the runtime from an extraction.
   * @param posix Starts the mount, and the runtime from it with the mount's keepalive pipe as its input.
   * @param presence Reads the start of the launcher, the mount process and the runtime for the copy record.
   * @param openKeepalive Opens the read end of a mount process's keepalive pipe, or returns `null`; {@link AppImageKeepalive.open} in a launcher.
   * @param extractAsync Extracts the AppImage into a folder and returns the extracted AppImage folder; {@link AppImageExtraction.extractAsync} in a launcher.
   * @param log Writes a line to the launcher's log; it is told once when the mount's folder cannot be watched, and the launch then checks the mount's output every 100 ms instead.
   * @param mountWait How long the mount has to name its folder, in milliseconds; 10 seconds by default.
   * It reads the mount's output again each time its folder changes, and stops waiting once the mount process ends.
   * @example
   * ```ts
   * import {
   *   AppImageCopyLaunch, AppImageExtraction, AppImageKeepalive, ChildProcessStarter, PosixProcessApi, ProcessPresence
   * } from "@noldova/desktop.runtime";
   *
   * export const launch: AppImageCopyLaunch = new AppImageCopyLaunch(ChildProcessStarter.create(process.platform), PosixProcessApi.create(),
   *   ProcessPresence.create(process.platform), AppImageKeepalive.open, AppImageExtraction.extractAsync, t => console.error(t));
   * ```
   */
  public constructor(starter: IProcessStarter, posix: IPosixProcessApi, presence: ProcessPresence, openKeepalive: (processId: number) => number | null,
    extractAsync: (image: string, extraction: string, environment: NodeJS.ProcessEnv, startLog: string) => Promise<string>, log: (text: string) => void,
    mountWait?: number);

  /**
   * Finds the temporary folder a program started with the environment uses, as Node.js does on Linux: `TMPDIR`, then
   * `TMP`, then `TEMP`, the first that is set and not empty, or else `/tmp`.
   *
   * @param environment The environment.
   * @returns The temporary folder.
   * @example
   * ```ts
   * import { AppImageCopyLaunch } from "@noldova/desktop.runtime";
   *
   * export const temporary: string = AppImageCopyLaunch.findTemporaryFolder(process.env);
   * ```
   */
  public static findTemporaryFolder(environment: NodeJS.ProcessEnv): string;

  /**
   * Starts the runtime from a copy of the AppImage. When the launcher runs from a mount of it, the AppImage is
   * started with `--appimage-mount`, its output going to a file beside the record, and the first line it writes
   * there is the copy's folder. The runtime is started with the read end of the mount process's keepalive pipe as its
   * input, and the mount process is then ended, so the mount lasts exactly as long as the runtime holds the pipe and
   * needs no record. When the launcher runs from an extraction, or the mount names no folder within the wait, ends,
   * cannot start or shows no single pipe to hold, the mount is ended, the start log says so, and the AppImage is
   * extracted with `--appimage-extract` into a new `desktop-runtime-` folder directly in the temporary folder; the
   * record holds the launcher while it extracts and starts the runtime, then the runtime, and an extraction the runtime
   * could not be started from is removed with its record. The program and every argument under the launcher's
   * AppImage folder are moved under the copy's folder, `APPDIR` names the copy, and the runtime is started from it.
   *
   * @param source The AppImage the launcher runs from.
   * @param executablePath The program that runs the runtime, inside the launcher's AppImage folder.
   * @param launchArguments The runtime's arguments.
   * @param environment The environment the mount, the extraction and the runtime are started with.
   * @param startLog The runtime's start log, which the mount, the extraction and the runtime write their errors to.
   * @param record The copy record, `logs/copy-<id>.log` beside the start log.
   * @returns The runtime's process id.
   * @throws {LaunchException} Rejected when the runtime cannot be started from the mount, or, for an extraction, when
   * the process table does not list the launcher or the AppImage cannot be extracted.
   * @throws {Error} Rejected when the record, the extraction folder or the start log cannot be written, or the runtime
   * cannot be started from the extraction.
   * @example
   * ```ts
   * import {
   *   AppImageCopyLaunch, AppImageExtraction, AppImageKeepalive, AppImageSource, ChildProcessStarter, PosixProcessApi, ProcessPresence
   * } from "@noldova/desktop.runtime";
   *
   * export async function startAsync(entryPath: string, startLog: string, record: string): Promise<number | null> {
   *   const source = AppImageSource.find(process.env, process.execPath);
   *   return source === null ? null : new AppImageCopyLaunch(ChildProcessStarter.create(process.platform), PosixProcessApi.create(),
   *     ProcessPresence.create(process.platform), AppImageKeepalive.open, AppImageExtraction.extractAsync, t => console.error(t))
   *     .startAsync(source, process.execPath, [entryPath], process.env, startLog, record);
   * }
   * ```
   */
  public startAsync(source: AppImageSource, executablePath: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv,
    startLog: string, record: string): Promise<number>;
}

/**
 * Finds and opens the keepalive pipe of an AppImage mount process on Linux, the pipe whose last reader closing ends
 * the mount.
 */
export declare class AppImageKeepalive {
  /**
   * Lists the process's open descriptors in `/proc/<id>/fd`, and when exactly one of them is a pipe, opens it for
   * reading without waiting.
   *
   * @param processId The mount process.
   * @returns The opened descriptor, which the caller closes, or `null` when the process holds no pipe or more than one,
   * when it has ended, when the pipe's descriptor closed between the listing and the open, or when the open found
   * another file or pipe than the one listed, which it closes.
   * @throws {Error} When the descriptor folder cannot be listed, the pipe cannot be opened for another reason, or the
   * opened descriptor cannot be checked, which it closes first.
   * @example
   * ```ts
   * import { closeSync } from "node:fs";
   *
   * import { AppImageKeepalive } from "@noldova/desktop.runtime";
   *
   * export function holdsPipe(processId: number): boolean {
   *   const descriptor = AppImageKeepalive.open(processId);
   *   if (descriptor === null)
   *     return false;
   *   closeSync(descriptor);
   *   return true;
   * }
   * ```
   */
  public static open(processId: number): number | null;

  /**
   * Lists the processes in `/proc` whose standard output, descriptor 1, is the file, as a mount process's output is
   * its launcher's `logs/copy-<id>.log.mount`. Processes whose descriptors cannot be read are left out.
   *
   * @param file The file's real path, with no links in it.
   * @returns The process ids.
   * @throws {Error} When `/proc` cannot be listed, as on Windows and macOS, so a caller can tell that from a file no process writes.
   * @example
   * ```ts
   * import { realpath } from "node:fs/promises";
   *
   * import { AppImageKeepalive } from "@noldova/desktop.runtime";
   *
   * export async function findMountersAsync(listing: string): Promise<readonly number[]> {
   *   return AppImageKeepalive.findWriters(await realpath(listing));
   * }
   * ```
   */
  public static findWriters(file: string): readonly number[];
}

/**
 * Extracts an AppImage on Linux, for a runtime that cannot run from a mount of it.
 */
export declare class AppImageExtraction {
  /**
   * Runs the AppImage with `--appimage-extract` in the folder, with no shell, its errors going to the start log.
   *
   * @param image The AppImage file.
   * @param extraction The folder to extract into.
   * @param environment The environment the AppImage is started with.
   * @param startLog The runtime's start log.
   * @returns The extracted AppImage folder, `squashfs-root` in the folder.
   * @throws {LaunchException} Rejected when the AppImage cannot start or ends with an error or a signal.
   * @throws {Error} Rejected when the start log cannot be opened.
   * @example
   * ```ts
   * import { AppImageExtraction } from "@noldova/desktop.runtime";
   *
   * export function extractAsync(image: string, folder: string, startLog: string): Promise<string> {
   *   return AppImageExtraction.extractAsync(image, folder, process.env, startLog);
   * }
   * ```
   */
  public static extractAsync(image: string, extraction: string, environment: NodeJS.ProcessEnv, startLog: string): Promise<string>;
}

/**
 * The Linux AppImage a program runs from, as the AppImage runtime names it in `APPIMAGE` and `APPDIR`.
 */
export declare class AppImageSource {
  /**
   * The AppImage file.
   */
  public readonly file: string;

  /**
   * The folder the program runs from: the AppImage's mount point, or the folder it was extracted to.
   */
  public readonly folder: string;

  /**
   * Reads whether the folder is a mount point, as `/proc/self/mountinfo` lists it; otherwise, or when the system has
   * no such table, the program runs from an extraction.
   *
   * @returns Whether the folder is mounted.
   * @throws {Error} The promise rejects when the mount table exists but cannot be read.
   * @example
   * ```ts
   * import { AppImageSource } from "@noldova/desktop.runtime";
   *
   * export async function isMountedAsync(): Promise<boolean> {
   *   return await AppImageSource.find(process.env, process.execPath)?.isMountedAsync() ?? false;
   * }
   * ```
   */
  public isMountedAsync(): Promise<boolean>;

  private constructor();

  /**
   * Finds the AppImage a program runs from.
   *
   * @param environment The environment the AppImage runtime set.
   * @param executablePath The program.
   * @returns The AppImage, or `null` when `APPIMAGE` or `APPDIR` is not an absolute path or the program is not inside `APPDIR`.
   * @example
   * ```ts
   * import { AppImageSource } from "@noldova/desktop.runtime";
   *
   * export function findFile(): string | null {
   *   return AppImageSource.find(process.env, process.execPath)?.file ?? null;
   * }
   * ```
   */
  public static find(environment: NodeJS.ProcessEnv, executablePath: string): AppImageSource | null;

  /**
   * Names the file that starts a program again: its AppImage when it runs from one, since the AppImage's folder ends with the process that holds it, and the program otherwise.
   *
   * @param environment The environment the AppImage runtime set.
   * @param executablePath The program.
   * @returns The AppImage or the program.
   * @example
   * ```ts
   * import { AppImageSource } from "@noldova/desktop.runtime";
   *
   * export function locate(): string {
   *   return AppImageSource.locateProgram(process.env, process.execPath);
   * }
   * ```
   */
  public static locateProgram(environment: NodeJS.ProcessEnv, executablePath: string): string;
}

/**
 * How {@link RuntimeLauncher.attachAsync} treats a missing runtime and
 * another build's runtime.
 */
export declare class AttachOptions {
  /**
   * Whether to start a runtime when none runs.
   */
  public readonly start: boolean;

  /**
   * Whether to ask an older build's runtime, or another build of the same
   * version, to stop and take its place.
   */
  public readonly takeOver: boolean;

  /**
   * Creates the options.
   *
   * @param start Whether to start a runtime when none runs; yes by default.
   * @param takeOver Whether to take over another build's runtime; yes by
   * default.
   * @example
   * ```ts
   * import { AttachOptions } from "@noldova/desktop.runtime";
   *
   * export const attachOnly: AttachOptions = new AttachOptions(false, false);
   * ```
   */
  public constructor(start?: boolean, takeOver?: boolean);
}

/**
 * Time limits of a {@link RuntimeClient}.
 */
export declare class ClientSettings {
  /**
   * How long the handshake may take, in milliseconds.
   */
  public readonly handshakeTimeout: number;

  /**
   * The default time limit of a call, in milliseconds.
   */
  public readonly callTimeout: number;

  /**
   * How long after a call's time limit the client still waits for the runtime's answer, in milliseconds.
   */
  public readonly answerGrace: number;

  /**
   * The largest frame the client reads or writes, in characters.
   */
  public readonly maximumFrameLength: number;

  /**
   * Creates the settings.
   *
   * @param handshakeTimeout Milliseconds for the handshake. Defaults to 5 seconds.
   * @param callTimeout The default time limit of a call in milliseconds. Defaults to 10 minutes.
   * @param answerGrace Milliseconds to wait for an answer after a call's limit. Defaults to 5 seconds.
   * @param maximumFrameLength The largest frame in characters. Defaults to 16 MiB.
   * @throws {ArgumentOutOfRangeException} When a value is not a positive integer.
   * @example
   * ```ts
   * import { ClientSettings } from "@noldova/desktop.runtime";
   *
   * export const settings = new ClientSettings(2_000, 30_000);
   * ```
   */
  public constructor(handshakeTimeout?: number, callTimeout?: number, answerGrace?: number, maximumFrameLength?: number);
}

/**
 * A runtime's local endpoint: loopback TCP on Windows, a Unix socket elsewhere.
 */
export declare class Endpoint {
  /**
   * The endpoint's transport.
   */
  public readonly kind: EndpointKind;

  /**
   * The loopback port, or `null` for a socket.
   */
  public readonly port: number | null;

  /**
   * The socket's absolute path, or `null` for TCP.
   */
  public readonly path: string | null;

  private constructor();

  /**
   * Creates a loopback TCP endpoint.
   *
   * @param port The port, from 1 to 65535.
   * @returns The endpoint.
   * @throws {ArgumentOutOfRangeException} When the port is out of range.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/desktop.runtime";
   *
   * export const endpoint = Endpoint.tcp(52100);
   * ```
   */
  public static tcp(port: number): Endpoint;

  /**
   * Creates a Unix socket endpoint.
   *
   * @param socketPath The socket's absolute path.
   * @returns The endpoint.
   * @throws {ArgumentException} When the path is not absolute.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/desktop.runtime";
   *
   * export const endpoint = Endpoint.socket("/home/person/.noldova/desktop/discovery/runtime.sock");
   * ```
   */
  public static socket(socketPath: string): Endpoint;

  /**
   * Reads an endpoint from its text in discovery metadata.
   *
   * @param text `tcp://127.0.0.1:<port>` or a socket's absolute path.
   * @returns The endpoint.
   * @throws {ArgumentException} When the text is neither form.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/desktop.runtime";
   *
   * export const port = Endpoint.parse("tcp://127.0.0.1:52100").port;
   * ```
   */
  public static parse(text: string): Endpoint;

  /**
   * Formats the endpoint for discovery metadata.
   *
   * @returns `tcp://127.0.0.1:<port>` or the socket's path.
   * @example
   * ```ts
   * import { Endpoint } from "@noldova/desktop.runtime";
   *
   * export const text = Endpoint.tcp(52100).toString();
   * ```
   */
  public toString(): string;
}

/**
 * A declared event's publishing side. Disposing it withdraws the event.
 */
export declare class EventChannel implements Disposable {
  /**
   * Creates the channel.
   *
   * @param publisher Publishes one payload: to every connection when it gets no connection, and otherwise to that
   * connection alone, for the window it gets, or for none when the window is `null`.
   * @param withdraw Withdraws the event's declaration.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import { EventChannel } from "@noldova/desktop.runtime";
   *
   * export function createChannel(published: JsonValue[], declared: Set<string>): EventChannel {
   *   declared.add("notes.changed");
   *   return new EventChannel(payload => published.push(payload), () => declared.delete("notes.changed"));
   * }
   * ```
   */
  public constructor(publisher: (payload: JsonValue, connection?: number, window?: number | null) => void, withdraw: () => void);

  /**
   * Publishes the event to every authenticated connection of the runtime's build. An event too large for one frame, or
   * one whose payload cannot be written as JSON, reaches no connection and is logged in the runtime's diagnostics.
   *
   * @param payload The event's payload.
   * @throws {RegistrationException} When the event was withdrawn.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { EventRegistry } from "@noldova/desktop.runtime";
   *
   * export function announce(events: EventRegistry, path: string): void {
   *   const channel = events.declare(new QualifiedName("notes", "changed"));
   *   channel.publish({ path });
   *   channel[Symbol.dispose]();
   * }
   * ```
   */
  public publish(payload: JsonValue): void;

  /**
   * Publishes the event to one connection alone, for one of its windows. The event reaches no one when the connection
   * has closed or the window has closed for good; an event too large for one frame, or one whose payload cannot be
   * written as JSON, is logged in the runtime's diagnostics.
   *
   * @param connection The connection's number, as `RequestContext.connection` gives it.
   * @param window The window's id, as `RequestContext.window` gives it, or `null` for a connection without windows,
   * such as the command line's.
   * @param payload The event's payload.
   * @throws {RegistrationException} When the event was withdrawn.
   * @throws {ArgumentOutOfRangeException} When the window is not a positive integer.
   * @example
   * ```ts
   * import type { EventChannel, RequestContext } from "@noldova/desktop.runtime";
   *
   * export function answerTheWindow(channel: EventChannel, context: RequestContext, text: string): void {
   *   channel.publishTo(context.connection, context.window, { text });
   * }
   * ```
   */
  public publishTo(connection: number, window: number | null, payload: JsonValue): void;

  /**
   * Withdraws the event's declaration.
   */
  public [Symbol.dispose](): void;
}

/**
 * How a client starts or attaches to the runtime of one data directory.
 */
export declare class LaunchSettings {
  /**
   * The data directory whose runtime the client uses.
   */
  public readonly dataDirectory: DataDirectory;

  /**
   * The program that runs the runtime's entry, such as Node.js or Electron in Node mode.
   */
  public readonly executablePath: string;

  /**
   * The path of the runtime's entry script, {@link RuntimeEntry.entryPath}.
   */
  public readonly entryPath: string;

  /**
   * The environment a started runtime receives.
   */
  public readonly environment: NodeJS.ProcessEnv;

  /**
   * The platform, as in `process.platform`; on Linux, a client inside an AppImage starts the runtime from its own copy of the AppImage.
   */
  public readonly platform: string;

  /**
   * How long a started runtime stays idle before it stops, in milliseconds.
   */
  public readonly idleGraceMilliseconds: number;

  /**
   * How long attaching may take, in milliseconds, unless the data directory
   * is owned; after a takeover, it starts again.
   */
  public readonly launchTimeout: number;

  /**
   * The settings of the clients the launcher connects.
   */
  public readonly clientSettings: ClientSettings;

  /**
   * How long attaching may take, in milliseconds, while the data directory
   * is owned, by the runtime the launcher started or by another.
   */
  public readonly launchLimit: number;

  /**
   * How long a takeover waits, in milliseconds, for the other build's
   * runtime to stop once it agreed to.
   */
  public readonly stopTimeout: number;

  /**
   * Creates the settings.
   *
   * @param dataDirectory The data directory.
   * @param executablePath The program that runs the entry.
   * @param entryPath The entry script's path.
   * @param environment The started runtime's environment.
   * @param platform The platform, as in `process.platform`.
   * @param idleGraceMilliseconds The idle grace in milliseconds. Defaults to 30 seconds.
   * @param launchTimeout The attach limit in milliseconds. Defaults to 20 seconds.
   * @param clientSettings The clients' settings. Defaults to {@link ClientSettings}' defaults.
   * @param launchLimit The attach limit, in milliseconds, while the data directory is owned.
   * Defaults to 60 seconds, or the launch timeout when that is longer.
   * @param stopTimeout How long a takeover waits for the other build's runtime to stop, in milliseconds.
   * Defaults to {@link ProcessSettings.stopLimit} plus 10 seconds for the rest of the runtime's stop.
   * @throws {ArgumentException} When a path is empty or whitespace.
   * @throws {ArgumentOutOfRangeException} When a duration is not a positive integer, or the
   * launch limit is shorter than the launch timeout.
   * @example
   * ```ts
   * import { DataDirectory, LaunchSettings, RuntimeEntry } from "@noldova/desktop.runtime";
   *
   * export const settings = new LaunchSettings(
   *   new DataDirectory("/home/person/.noldova/desktop"),
   *   process.execPath,
   *   RuntimeEntry.entryPath,
   *   process.env,
   *   process.platform);
   * ```
   */
  public constructor(
    dataDirectory: DataDirectory,
    executablePath: string,
    entryPath: string,
    environment: NodeJS.ProcessEnv,
    platform: string,
    idleGraceMilliseconds?: number,
    launchTimeout?: number,
    clientSettings?: ClientSettings,
    launchLimit?: number,
    stopTimeout?: number);
}

/**
 * The program and arguments that start a detached program that must not keep its starter's descriptors. On Linux it wraps the program in Bash that closes inherited descriptors above standard error, without startup files or inherited options.
 */
export declare class ProcessLaunchCommand {
  /**
   * The program to start.
   */
  public readonly executable: string;

  /**
   * The program's arguments, passed literally.
   */
  public readonly arguments: readonly string[];

  private constructor();

  /**
   * Creates the command, checking on Linux that Bash and the descriptor folder are usable.
   *
   * @param platform The platform, as in `process.platform`.
   * @param executablePath The program to start, such as the one that runs the runtime.
   * @param launchArguments Its arguments; the array is copied.
   * @returns The command.
   * @throws {ArgumentException} The promise rejects when the program's path is empty or whitespace.
   * @throws {LaunchException} The promise rejects on Linux when `/bin/bash` is not executable or `/proc/self/fd` cannot be read.
   * @example
   * ```ts
   * import { spawn } from "node:child_process";
   *
   * import { ProcessLaunchCommand, RuntimeEntry } from "@noldova/desktop.runtime";
   *
   * export async function startAsync(dataDirectory: string): Promise<void> {
   *   const command = await ProcessLaunchCommand.createAsync(process.platform, process.execPath, [RuntimeEntry.entryPath, "--data-dir", dataDirectory]);
   *   spawn(command.executable, command.arguments, { detached: true, stdio: "ignore" }).unref();
   * }
   * ```
   */
  public static createAsync(platform: string, executablePath: string, launchArguments: readonly string[]): Promise<ProcessLaunchCommand>;
}

/**
 * What a refusing runtime answers every handshake with, and the one method a refused connection may call besides `desktop.stop`.
 */
export declare class Refusal {
  /**
   * The failure every handshake is answered with.
   */
  public readonly failure: Failure;

  /**
   * The only method a refused connection may call besides `desktop.stop`, which every connection may call.
   */
  public readonly method: QualifiedName;

  /**
   * Creates the refusal.
   *
   * @param failure The handshake's failure.
   * @param method The method a refused connection may call besides `desktop.stop`.
   * @example
   * ```ts
   * import { Failure, FailureCode, PreShellData, ShellMethods } from "@noldova/desktop.protocol";
   * import { Refusal, type RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function refuseUntilMoved(server: RuntimeServer, root: string): void {
   *   const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", new PreShellData(root).toJson());
   *   server.refuse(new Refusal(failure, ShellMethods.moveAside));
   * }
   * ```
   */
  public constructor(failure: Failure, method: QualifiedName);
}

/**
 * A registered method handler. Disposing it removes the registration.
 */
export declare class Registration implements Disposable {
  /**
   * Creates the registration.
   *
   * @param release Removes the registration.
   * @example
   * ```ts
   * import { Registration } from "@noldova/desktop.runtime";
   *
   * export function track(names: Set<string>, name: string): Registration {
   *   names.add(name);
   *   return new Registration(() => names.delete(name));
   * }
   * ```
   */
  public constructor(release: () => void);

  /**
   * Removes the registration.
   */
  public [Symbol.dispose](): void;
}

/**
 * One request as a method handler sees it.
 */
export declare class RequestContext {
  /**
   * The name the calling client gave in its connection's handshake, such as `mainProcess`.
   */
  public readonly client: string;

  /**
   * The request's payload, which the handler validates.
   */
  public readonly payload: JsonValue;

  /**
   * Aborts when the request is cancelled, reaches its deadline or its connection closes.
   */
  public readonly signal: AbortSignal;

  /**
   * The calling connection's number, unique for the runtime's lifetime, so a handler can tell which connection answered.
   */
  public readonly connection: number;

  /**
   * The window of the main process the request came from, by the id a reload keeps; `null` when no window sent it,
   * such as for the command line, whose `client` is `ShellClients.commandLine`.
   */
  public readonly window: number | null;

  /**
   * The page of that window that sent the request, by the number the main process gives each page the window loads,
   * which a reload changes; `null` when no window sent it. A file grant is redeemed only for the page it was given to.
   */
  public readonly page: number | null;

  /**
   * Creates the context.
   *
   * @param client The calling client's name; it must contain a non-whitespace character.
   * @param payload The payload.
   * @param signal The cancellation signal.
   * @param connection The calling connection's number.
   * @param window The window the request came from; `null` by default.
   * @param page The page of that window that sent it; `null` by default.
   * @throws {ArgumentException} When the client name is empty or whitespace only.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import { type IMethodHandler, RequestContext } from "@noldova/desktop.runtime";
   *
   * export function callDirectlyAsync(handler: IMethodHandler, payload: JsonValue): Promise<JsonValue> {
   *   return handler.handleAsync(new RequestContext("test", payload, AbortSignal.timeout(1_000), 1));
   * }
   * ```
   */
  public constructor(client: string, payload: JsonValue, signal: AbortSignal, connection: number, window?: number | null, page?: number | null);
}

/**
 * The names Windows reserves for devices, which no module id may be on any
 * platform, since a folder or file with such a name cannot be made on Windows.
 */
export declare class WindowsDeviceNames {
  /**
   * The 24 names, lowercase: `con`, `prn`, `aux`, `nul`, `com0` to `com9` and
   * `lpt0` to `lpt9`.
   */
  public static readonly all: readonly string[];

  /**
   * Tells whether a name is one of them. A module id is lowercase, so the
   * comparison is exact.
   *
   * @param name The name to check.
   * @returns `true` when the name is a device name.
   * @example
   * ```ts
   * import { WindowsDeviceNames } from "@noldova/desktop.runtime";
   *
   * export const isDevice: boolean = WindowsDeviceNames.includes("com1");
   * ```
   */
  public static includes(name: string): boolean;
}

/**
 * The path of a file a package keeps outside a packaged app's archive, as its
 * `package.json` names it under `noldovaDesktop.unpacked`.
 *
 * In a packaged app a module's code sits inside `app.asar`, so a path built
 * from `import.meta.url` points inside the archive, where only Electron's own
 * file access reads; another program, such as `osascript`, needs the file's
 * copy in `app.asar.unpacked`.
 */
export declare class PackagedPath {
  /**
   * Gives the path of a file's unpacked copy: the first whole path segment
   * `app.asar` becomes `app.asar.unpacked`, with either separator. A path with
   * no such segment, such as one in a checkout, or one already in
   * `app.asar.unpacked`, comes back unchanged.
   *
   * @param file The file's path, such as one from `import.meta.url`.
   * @returns The path another program can open.
   * @example
   * ```ts
   * import { fileURLToPath } from "node:url";
   *
   * import { PackagedPath } from "@noldova/desktop.runtime";
   *
   * export const script: string = PackagedPath.unpacked(fileURLToPath(new URL("../../jxa/mac-desktop.js", import.meta.url)));
   * ```
   */
  public static unpacked(file: string): string;
}

/**
 * A module as the build declares it to the runtime, read from the build's
 * `declarations.json`.
 */
export declare class ModuleDeclaration {
  /**
   * The module's id.
   */
  public readonly id: string;

  /**
   * The module's own version, `<major>.<minor>.<patch>`.
   */
  public readonly version: string;

  /**
   * The name people see.
   */
  public readonly displayName: string;

  /**
   * What the module does, in a sentence people see.
   */
  public readonly description: string;

  /**
   * The ids of the modules it depends on.
   */
  public readonly dependencies: readonly string[];

  /**
   * The one exact version it needs of each dependency, by id, such as
   * `1.2.3`; a dependency is met only at that version.
   */
  public readonly dependencyVersions: ReadonlyMap<string, string>;

  /**
   * Its runtime package, or `null` when it has no runtime part.
   */
  public readonly runtimePackage: string | null;

  /**
   * The names it contributes, by kind, such as `methods` and `events`.
   */
  public readonly contributions: ReadonlyMap<string, readonly string[]>;

  /**
   * The definitions of the settings it declares.
   */
  public readonly settings: readonly SettingDefinition[];

  /**
   * Its command-line package, or `null` when it has no command-line part.
   */
  public readonly cliPackage: string | null;

  /**
   * Its command-line commands' definitions as the build writes them, which
   * the command line reads.
   */
  public readonly cliCommands: readonly JsonValue[];

  /**
   * Its `webViews.json`: the debugging calls its runtime part may send its web
   * views and the events it reads from them, or `null` when it declares none,
   * so it opens no web views.
   */
  public readonly webViews: WebViewDeclaration | null;

  /**
   * Whether it declares `pseudoTerminals` in `module.json`, so its runtime
   * part may start programs in pseudo-terminals.
   */
  public readonly usesPseudoTerminals: boolean;

  /**
   * The ids of the modules it uses when the app includes them and works
   * without, as `optionalDependencies` declares them.
   */
  public readonly optionalDependencies: readonly string[];

  /**
   * The one exact version it needs of each optional dependency, by id; one at
   * another version is unavailable to it, and never blocks it.
   */
  public readonly optionalDependencyVersions: ReadonlyMap<string, string>;

  /**
   * The name of its `Boolean` setting that turns it on and off, or `null` for
   * a module that is always on.
   */
  public readonly switchSetting: string | null;

  /**
   * The platforms it runs on, each of `windows`, `macos` and `linux` once, or
   * `null` for a module that runs on every platform.
   */
  public readonly platforms: readonly string[] | null;

  /**
   * The Noldova Desktop versions it accepts, `>=<lowest version> <first version
   * refused>`, such as `>=0.0.70 <0.1.0`, or `null` for a module that names
   * none and so runs on any.
   */
  public readonly noldovaDesktop: string | null;

  /**
   * The names its commands and documents had before, by their names now; the
   * runtime moves the person's key binding for a former command name to the
   * command.
   */
  public readonly formerNames: ReadonlyMap<string, readonly string[]>;

  /**
   * Creates the declaration.
   *
   * @param id The module's id: lowercase kebab-case, not `desktop`, and no
   * Windows device name such as `con` or `com1`.
   * @param version Its own version, `<major>.<minor>.<patch>`: three whole
   * numbers of up to nine digits without leading zeros, such as `0.0.1`.
   * @param displayName The name people see; not whitespace only.
   * @param description What the module does; not whitespace only.
   * @param dependencies The modules it depends on: each id mapped to the one
   * exact version it needs, `<major>.<minor>.<patch>`, never a range.
   * @param runtimePackage Its runtime package, or `null`.
   * @param contributions The names it contributes, by kind.
   * @param settings The definitions of its settings, each its own; none by
   * default.
   * @param cliPackage Its command-line package, or `null`, the default.
   * @param cliCommands Its command-line commands' definitions; none by
   * default.
   * @param webViews Its `webViews.json`, or `null`, the default.
   * @param usesPseudoTerminals Whether it declares `pseudoTerminals`; `false`
   * by default.
   * @param optionalDependencies The modules it uses when the app includes
   * them: each id mapped to the one exact version it needs; none by default.
   * @param switchSetting The name of the setting that turns it on and off, one
   * of its own `Boolean` settings with the locality `Shared` and no scopes; or
   * `null`, the default, for a module that is always on.
   * @param platforms The platforms it runs on, at least one, each of
   * `windows`, `macos` and `linux` once; or `null`, the default, for a module
   * that runs on every platform.
   * @param noldovaDesktop The Noldova Desktop versions it accepts, `>=<lowest
   * version> <first version refused>` with the lowest below the first refused,
   * such as `>=0.0.70 <0.1.0`; or `null`, the default, for a module that names
   * none.
   * @param formerNames The names its commands and documents had before, by
   * their names now; left out, none.
   * @throws {ArgumentException} When the id, the version, the display name,
   * the description or a dependency's or optional dependency's version is not valid, a setting
   * belongs to another owner, is of
   * the shell's own kind `KeyBindings`, or is an `Action` whose command the
   * module does not contribute, or the switch setting is not one of its own
   * `Boolean` settings with the locality `Shared` and no scopes, or the
   * platforms are empty, repeat one or name another, or the Noldova Desktop
   * versions are not of that form.
   * @example
   * ```ts
   * import { ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export const notes: ModuleDeclaration = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map(), "@noldova/desktop.notes.runtime", new Map([["methods", ["notes.list"]]]));
   * ```
   */
  public constructor(
    id: string,
    version: string,
    displayName: string,
    description: string,
    dependencies: ReadonlyMap<string, string>,
    runtimePackage: string | null,
    contributions: ReadonlyMap<string, readonly string[]>,
    settings?: readonly SettingDefinition[],
    cliPackage?: string | null,
    cliCommands?: readonly JsonValue[],
    webViews?: WebViewDeclaration | null,
    usesPseudoTerminals?: boolean,
    optionalDependencies?: ReadonlyMap<string, string>,
    switchSetting?: string | null,
    platforms?: readonly string[] | null,
    noldovaDesktop?: string | null,
    formerNames?: ReadonlyMap<string, readonly string[]>);

  /**
   * Reads a declaration from its form in `declarations.json`.
   *
   * @param value The value read from the file.
   * @returns The declaration.
   * @throws {DeclarationsFormatException} When the value is no object or a
   * field is missing or invalid, including a setting's definition or a
   * dependency's version; `dependencies` maps each id to the one exact
   * version it needs, such as `1.2.3`, never a range, as
   * `optionalDependencies` does, and the optional `optionalDependencies`,
   * `cliPackage`, `cliCommands`, `webViews` and `platforms` default to none,
   * `null`, none, `null` and `null`.
   * @example
   * ```ts
   * import { ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export const notes: ModuleDeclaration = ModuleDeclaration.fromJson({ id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: { tasks: "0.0.1" }, runtimePackage: null, contributes: {} });
   * ```
   */
  public static fromJson(value: unknown): ModuleDeclaration;

  /**
   * Whether the module accepts a version of one of its dependencies.
   *
   * @param dependency The dependency's id.
   * @param version The dependency's version, `<major>.<minor>.<patch>`.
   * @returns True when it is the one exact version the module needs of that
   * dependency or optional dependency, or the module does not depend on that id.
   * @throws {ArgumentException} When the version is not a module's version.
   * @example
   * ```ts
   * import type { ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function acceptsTasks(declaration: ModuleDeclaration): boolean {
   *   return declaration.accepts("tasks", "1.2.3");
   * }
   * ```
   */
  public accepts(dependency: string, version: string): boolean;

  /**
   * Whether the module runs on a platform.
   *
   * @param platform The platform as Node.js names it, such as `win32`,
   * `darwin` or `linux`.
   * @returns True when its `platforms` name that platform, or it declares
   * none.
   * @example
   * ```ts
   * import type { ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function runsHere(declaration: ModuleDeclaration): boolean {
   *   return declaration.runsOn(process.platform);
   * }
   * ```
   */
  public runsOn(platform: string): boolean;

  /**
   * Whether the module accepts a Noldova Desktop version.
   *
   * @param version The app's Noldova Desktop version, as the build writes it to
   * `declarations.json`, or `null` when the file names none.
   * @returns True when the module names no Noldova Desktop versions, or the
   * version is within those it names.
   * @example
   * ```ts
   * import type { ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function accepts(declaration: ModuleDeclaration): boolean {
   *   return declaration.acceptsNoldovaDesktop("0.0.70");
   * }
   * ```
   */
  public acceptsNoldovaDesktop(version: string | null): boolean;

  /**
   * Lists the names the module contributes of one kind.
   *
   * @param kind The kind, such as `methods`.
   * @returns The names; empty when it contributes none of the kind.
   * @example
   * ```ts
   * import type { ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function listMethods(declaration: ModuleDeclaration): readonly string[] {
   *   return declaration.listContributions("methods");
   * }
   * ```
   */
  public listContributions(kind: string): readonly string[];
}

/**
 * How a runtime process runs, read from its entry arguments.
 */
export declare class RuntimeOptions {
  /**
   * The data directory the runtime owns.
   */
  public readonly dataDirectory: DataDirectory;

  /**
   * How long the runtime stays without connections and work before it stops, in milliseconds.
   */
  public readonly idleGraceMilliseconds: number;

  /**
   * The server's limits.
   */
  public readonly serverSettings: ServerSettings;

  /**
   * The build's module declarations, `_build/modules/declarations.json` in the
   * repository the runtime package is installed in, unless given.
   */
  public readonly declarationsFile: string;

  /**
   * The name of the start log in the logs folder that the launcher which started this runtime reads, or `null` when no launcher started it. The runtime keeps that file when it removes start logs left behind.
   */
  public readonly startLogName: string | null;

  /**
   * How long a starting runtime keeps trying to take the data directory over from an owner that publishes no discovery file, because it is starting or stopping, in milliseconds.
   */
  public readonly takeoverMilliseconds: number;

  /**
   * The folder of the installation the runtime belongs to, or `null` when no
   * launcher named one.
   */
  public readonly installationFolder: string | null;

  /**
   * Creates the options.
   *
   * @param dataDirectory The data directory.
   * @param idleGraceMilliseconds The idle grace in milliseconds. Defaults to 30 seconds.
   * @param serverSettings The server's limits. Defaults to {@link ServerSettings}' defaults.
   * @param declarationsFile The build's module declarations. Defaults to the build's file beside the installed runtime.
   * @param startLogName The start log's file name, `start-<UUID>.log`, or `null`. Defaults to `null`.
   * @param takeoverMilliseconds How long to keep trying to take over from an owner without a discovery file, in milliseconds. Defaults to 5 seconds.
   * @param installationFolder The folder of the installation the runtime belongs to, whose record it joins and whose launch barrier it checks once it owns the data directory, or `null`. Defaults to `null`.
   * @throws {ArgumentException} When the start log's name is not of that form.
   * @example
   * ```ts
   * import { DataDirectory, RuntimeOptions, ServerSettings } from "@noldova/desktop.runtime";
   *
   * export const options = new RuntimeOptions(new DataDirectory("/home/person/.noldova/desktop"), 60_000, new ServerSettings());
   * ```
   */
  public constructor(dataDirectory: DataDirectory, idleGraceMilliseconds?: number, serverSettings?: ServerSettings, declarationsFile?: string, startLogName?: string | null, takeoverMilliseconds?: number, installationFolder?: string | null);

  /**
   * Reads the options from entry arguments.
   *
   * @param entryArguments `--data-dir <absolute path>`, and optionally `--idle-grace <milliseconds>`, `--start-log <start log name>` and `--installation-dir <folder>`.
   * @returns The options.
   * @throws {ArgumentException} When the data directory is missing or not absolute, or an argument is unknown, lacks its value or is not valid.
   * @example
   * ```ts
   * import { RuntimeOptions } from "@noldova/desktop.runtime";
   *
   * export const options = RuntimeOptions.parse(["--data-dir", "/home/person/.noldova/desktop", "--idle-grace", "60000"]);
   * ```
   */
  public static parse(entryArguments: readonly string[]): RuntimeOptions;
}

/**
 * Limits of a {@link RuntimeServer}.
 */
export declare class ServerSettings {
  /**
   * The largest frame the server reads or writes, in characters.
   */
  public readonly maximumFrameLength: number;

  /**
   * How long a connection may wait before its handshake, in milliseconds.
   */
  public readonly handshakeTimeout: number;

  /**
   * A request's time limit when it names none, in milliseconds.
   */
  public readonly defaultRequestTimeout: number;

  /**
   * The longest time limit a request may ask for, in milliseconds.
   */
  public readonly maximumRequestTimeout: number;

  /**
   * How long the runtime waits for its other clients to save before it
   * answers `desktop.update`, in milliseconds.
   */
  public readonly updateSaveWait: number;

  /**
   * How often the runtime checks that the holder of its installation's launch
   * barrier still runs while it prepares for an update, in milliseconds. The
   * barrier's own changes are seen at once from its folder; only a holder that
   * has gone is seen this way, since Node can't wait for the exit of a process
   * it didn't start.
   */
  public readonly updateBarrierHolderCheckInterval: number;

  /**
   * Creates the settings.
   *
   * @param maximumFrameLength The largest frame in characters. Defaults to 16 MiB.
   * @param handshakeTimeout Milliseconds before a handshake. Defaults to 5 seconds.
   * @param defaultRequestTimeout The default request limit in milliseconds. Defaults to 10 minutes.
   * @param maximumRequestTimeout The longest request limit in milliseconds. Defaults to 1 hour.
   * @param updateSaveWait How long to wait for other clients to save before an update, in milliseconds. Defaults to 6 seconds.
   * @param updateBarrierHolderCheckInterval How often to check that the launch barrier's holder still runs while preparing for an update, in milliseconds. Defaults to 5 seconds.
   * @throws {ArgumentOutOfRangeException} When a value is not a positive integer, or the default limit exceeds the longest.
   * @example
   * ```ts
   * import { ServerSettings } from "@noldova/desktop.runtime";
   *
   * export const settings = new ServerSettings(1024 * 1024, 5_000, 60_000, 600_000);
   * ```
   */
  public constructor(maximumFrameLength?: number, handshakeTimeout?: number, defaultRequestTimeout?: number, maximumRequestTimeout?: number, updateSaveWait?: number, updateBarrierHolderCheckInterval?: number);
}

/**
 * One piece of work in progress that keeps the runtime from idling and that stopping would interrupt. Disposing it ends the work.
 */
export declare class WorkItem implements Disposable {
  /**
   * What the work is, as shown to the person.
   */
  public readonly description: string;

  /**
   * Creates the work item; {@link WorkTracker.begin} creates them.
   *
   * @param description What the work is.
   * @param finish Ends the work.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import { WorkItem } from "@noldova/desktop.runtime";
   *
   * export function createItem(running: Set<WorkItem>): WorkItem {
   *   const item = new WorkItem("Indexing the project", t => running.delete(t));
   *   running.add(item);
   *   return item;
   * }
   * ```
   */
  public constructor(description: string, finish: (item: WorkItem) => void);

  /**
   * Aborts when the runtime stops the work.
   */
  public get signal(): AbortSignal;

  /**
   * Asks the work to stop by aborting its signal.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/desktop.runtime";
   *
   * export function cancelLater(work: WorkTracker): void {
   *   const item = work.begin("Indexing the project");
   *   setTimeout(() => item.cancel(), 1_000);
   * }
   * ```
   */
  public cancel(): void;

  /**
   * Ends the work.
   */
  public [Symbol.dispose](): void;
}

/**
 * A program a module asks the runtime to start. The program's environment
 * holds PATH, TEMP, TMP and TMPDIR, then HOME, LANG and LC_ALL, or on Windows
 * SystemRoot, windir, PATHEXT, ComSpec, USERPROFILE, SystemDrive,
 * LOCALAPPDATA, APPDATA, ProgramData and ProgramFiles, then the runtime's
 * variables the request inherits, then the request's own variables.
 */
export declare class ProcessRequest {
  /**
   * The program: a name searched for on the PATH, or an absolute path.
   */
  public readonly program: string;

  /**
   * The program's arguments.
   */
  public readonly arguments: readonly string[];

  /**
   * The absolute folder the program runs in.
   */
  public readonly workingFolder: string;

  /**
   * The variables set for the program.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * The names of the runtime's variables the program inherits.
   */
  public readonly inherit: readonly string[];

  /**
   * Stops the program when it aborts.
   */
  public readonly signal: AbortSignal | undefined;

  /**
   * Whether, on Windows, the arguments reach the program joined by spaces
   * with no quoting or escaping, after the program's path in quotes, so a
   * program such as `cmd.exe` gets its quotes and operators as written; `false` by default. The start refuses
   * it for a batch file, and on macOS and Linux it changes nothing.
   */
  public readonly isVerbatim: boolean;

  /**
   * Creates the request.
   *
   * @param program A name searched for on the PATH, or an absolute path.
   * @param launchArguments The program's arguments.
   * @param workingFolder The absolute folder the program runs in.
   * @param environment The variables set for the program.
   * @param inherit The names of the runtime's variables the program inherits.
   * @param signal Stops the program when it aborts.
   * @param isVerbatim Whether, on Windows, the arguments reach the program as
   * they are, joined by spaces; `false` by default.
   * @throws {ArgumentException} When the program is empty or whitespace, the
   * working folder is not absolute, or a variable's name is empty or holds
   * `=` or a null character.
   * @example
   * ```ts
   * import { ProcessRequest } from "@noldova/desktop.runtime";
   *
   * export function requestStatus(project: string, signal: AbortSignal): ProcessRequest {
   *   return new ProcessRequest("git", ["status"], project, { GIT_PAGER: "cat" }, ["SSH_AUTH_SOCK"], signal);
   * }
   * ```
   */
  public constructor(
    program: string,
    launchArguments: readonly string[],
    workingFolder: string,
    environment?: Readonly<Record<string, string>>,
    inherit?: readonly string[],
    signal?: AbortSignal,
    isVerbatim?: boolean);
}

/**
 * How long the runtime waits for its modules' programs to end.
 */
export declare class ProcessSettings {
  /**
   * How long a program asked to stop may take to exit before it is killed.
   */
  public readonly graceMilliseconds: number;

  /**
   * How long the runtime waits for killed programs to end before it reports
   * them.
   */
  public readonly endMilliseconds: number;

  /**
   * How often the runtime records that its programs are still running.
   */
  public readonly seenMilliseconds: number;

  /**
   * On macOS and Linux, how often the runtime checks whether a running
   * pseudo-terminal's program is gone.
   */
  public readonly terminalWatchMilliseconds: number;

  /**
   * On macOS and Linux, how long the runtime waits for the pseudo-terminal
   * library to report the exit of a program found gone before the terminal
   * ends without a code.
   */
  public readonly terminalReportMilliseconds: number;

  /**
   * The longest a stop of the runtime's programs takes, in milliseconds,
   * when each of its waits takes as long as it may: the grace, the wait for
   * killed programs to end, on Windows the wait for what they started
   * meanwhile to end, and the wait for the stopped programs to exit.
   * Reading the process table starts no program, so it has no bound of its
   * own.
   */
  public readonly stopLimit: number;

  /**
   * Creates the settings.
   *
   * @param graceMilliseconds How long a program asked to stop may take to
   * exit; 3 seconds by default.
   * @param endMilliseconds How long killed programs may take to end; 5
   * seconds by default.
   * @param seenMilliseconds How often the runtime records that its programs
   * are still running; 5 seconds by default.
   * @param terminalWatchMilliseconds On macOS and Linux, how often the runtime
   * checks whether a running pseudo-terminal's program is gone; 1 second by
   * default.
   * @param terminalReportMilliseconds On macOS and Linux, how long the
   * pseudo-terminal library may take to report the exit of a program found
   * gone; 1 second by default.
   * @throws {ArgumentOutOfRangeException} When a time is not a positive
   * integer.
   * @example
   * ```ts
   * import { ProcessSettings } from "@noldova/desktop.runtime";
   *
   * export function createQuickSettings(): ProcessSettings {
   *   return new ProcessSettings(500, 1_000);
   * }
   * ```
   */
  public constructor(graceMilliseconds?: number, endMilliseconds?: number, seenMilliseconds?: number, terminalWatchMilliseconds?: number, terminalReportMilliseconds?: number);
}

/**
 * The product and build this runtime belongs to, as the build wrote them to
 * `_build/product.json` beside the installed runtime: the product's identity,
 * its version and the build's fingerprint. The runtime, the main process and the
 * command line read it once, at start, instead of having it compiled in.
 */
export declare class ProductInfo {
  /**
   * The product's name, such as the one in messages and window titles.
   */
  public readonly name: string;

  /**
   * The product's slug: its lowercase name for programs, packages and
   * variables.
   */
  public readonly slug: string;

  /**
   * The packaged application's ID.
   */
  public readonly applicationId: string;

  /**
   * The development application's ID, before the checkout's hash is added.
   */
  public readonly developmentApplicationId: string;

  /**
   * The data folder under the home folder, its segments separated by `/`.
   */
  public readonly dataFolder: string;

  /**
   * The per-device folder on Windows, under the local application data
   * folder, its segments separated by `/`.
   */
  public readonly windowsDeviceFolder: string;

  /**
   * The per-device folder on macOS, under `Library/Application Support`, its
   * segments separated by `/`.
   */
  public readonly macosDeviceFolder: string;

  /**
   * The per-device folder on Linux, under the state folder, its segments
   * separated by `/`.
   */
  public readonly linuxDeviceFolder: string;

  /**
   * The environment variable that names another data directory for a
   * development build. A packaged build ignores it and is given another data
   * directory only with `--data-dir=<path>`.
   */
  public readonly dataDirectoryVariable: string;

  /**
   * The environment variable that names the development checkout the command
   * line runs from: the slug in upper case, with `_` for each `-`, followed by
   * `_CHECKOUT`.
   */
  public readonly checkoutVariable: string;

  /**
   * The folder of the product's icons, relative to the repository, its
   * segments separated by `/`.
   */
  public readonly icons: string;

  /**
   * The distinguished name of the publisher whose signature a Windows update
   * must carry, which a signed Windows build takes from the release's
   * `WINDOWS_PUBLISHER` secret; null in an unsigned build, which installs no
   * Windows update.
   */
  public readonly windowsPublisher: string | null;

  /**
   * The URL, ending in `/`, of the update feed a packaged build reads, or
   * `null` for a build that never checks for updates.
   */
  public readonly updateFeed: string | null;

  /**
   * The id of the module that answers permission requests and manages remembered answers, from
   * `desktop.product.permissionsModule`, or `null` when the app names none and every request is denied.
   */
  public readonly permissionsModule: string | null;

  /**
   * The folder the app installs in, beside the maker's other apps, from `desktop.product.installFolder`,
   * or `null` when the app names none and installs on its own.
   */
  public readonly installFolder: string | null;

  /**
   * The product version.
   */
  public readonly version: string;

  /**
   * The build's fingerprint: the same inputs give the same fingerprint, and
   * any change gives another.
   */
  public readonly build: string;

  private constructor();

  /**
   * The product file of the installed runtime's build.
   */
  public static get file(): string;

  /**
   * The installed runtime's product, read from {@link ProductInfo.file} on
   * first use and kept.
   *
   * @throws {ProductFileException} When the file cannot be read or a field is
   * missing or blank.
   * @example
   * ```ts
   * import { ProductInfo } from "@noldova/desktop.runtime";
   *
   * export function describeBuild(): string {
   *   const product = ProductInfo.current;
   *   return `${product.name} ${product.version} (build ${product.build})`;
   * }
   * ```
   */
  public static get current(): ProductInfo;

  /**
   * Reads a product file.
   *
   * @param file The product file.
   * @returns The product it describes.
   * @throws {ProductFileException} When the file cannot be read or a field is
   * missing or blank.
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import { ProductInfo } from "@noldova/desktop.runtime";
   *
   * export function readVersion(checkout: string): string {
   *   return ProductInfo.read(path.join(checkout, "_build", "product.json")).version;
   * }
   * ```
   */
  public static read(file: string): ProductInfo;
}

/**
 * How a program exited: with an exit code, or ended by a signal.
 */
export declare class ProcessExit {
  /**
   * The exit code, or `null` when a signal ended the program.
   */
  public readonly code: number | null;

  /**
   * The signal that ended the program, or `null` when it exited.
   */
  public readonly signal: NodeJS.Signals | null;

  /**
   * Creates the exit.
   *
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @throws {ArgumentException} When both or neither are `null`.
   * @example
   * ```ts
   * import { ProcessExit } from "@noldova/desktop.runtime";
   *
   * export function endedBySignal(): ProcessExit {
   *   return new ProcessExit(null, "SIGTERM");
   * }
   * ```
   */
  public constructor(code: number | null, signal: NodeJS.Signals | null);

  /**
   * Whether the program exited with code 0.
   */
  public get isClean(): boolean;
}

/**
 * A program the runtime runs for a module, as the runtime reports it: never
 * with its arguments or environment.
 */
export declare class RunningProgram {
  /**
   * The module the program runs for.
   */
  public readonly moduleId: string;

  /**
   * The program's path.
   */
  public readonly program: string;

  /**
   * The program's process id.
   */
  public readonly processId: number;

  /**
   * When the program started.
   */
  public readonly started: Date;

  /**
   * Whether the program itself has exited cleanly while the process group
   * it leads, on macOS and Linux, or its job, on Windows, still runs; on
   * macOS and Linux the process id then names that group.
   */
  public readonly hasExited: boolean;

  /**
   * Creates the report.
   *
   * @param moduleId The module the program runs for.
   * @param program The program's path.
   * @param processId The program's process id.
   * @param started When the program started.
   * @param hasExited Whether the program has exited while its process group
   * or job still runs; `false` by default.
   * @example
   * ```ts
   * import { RunningProgram } from "@noldova/desktop.runtime";
   *
   * export function describeGit(): RunningProgram {
   *   return new RunningProgram("git", "/usr/bin/git", 4_210, new Date());
   * }
   * ```
   */
  public constructor(moduleId: string, program: string, processId: number, started: Date, hasExited?: boolean);

  /**
   * Returns what `desktop.programs` reports of the program: never its
   * arguments or environment, which it does not hold.
   *
   * @returns The program's status.
   * @example
   * ```ts
   * import type { ProgramStatus } from "@noldova/desktop.protocol";
   * import { RunningProgram } from "@noldova/desktop.runtime";
   *
   * export const status: ProgramStatus = new RunningProgram("git", "/usr/bin/git", 4_210, new Date()).toStatus();
   * ```
   */
  public toStatus(): ProgramStatus;
}

/**
 * A program the runtime started for a module, with its standard streams.
 */
export declare class OwnedProcess {
  /**
   * The program's process id.
   */
  public readonly processId: number;

  /**
   * The program's path.
   */
  public readonly program: string;

  /**
   * When the program started.
   */
  public readonly started: Date;

  /**
   * Resolves when the program exits.
   */
  public readonly exited: Promise<ProcessExit>;

  /**
   * Creates the process; {@link ProcessSupervisor.startAsync} creates them.
   *
   * @param child The started child process.
   * @param program The program's path.
   * @param started When the program started.
   * @param exited Resolves when the program exits.
   * @param stop Ends the program and what it started.
   * @example
   * ```ts
   * import { once } from "node:events";
   * import { spawn } from "node:child_process";
   *
   * import { OwnedProcess, ProcessExit } from "@noldova/desktop.runtime";
   *
   * export function own(file: string): OwnedProcess {
   *   const child = spawn(file, [], { stdio: "pipe" });
   *   const exited = once(child, "exit").then(([code, signal]) => new ProcessExit(code, signal));
   *   return new OwnedProcess(child, file, new Date(), exited, async () => void child.kill());
   * }
   * ```
   */
  public constructor(child: ChildProcessWithoutNullStreams, program: string, started: Date, exited: Promise<ProcessExit>, stop: (process: OwnedProcess) => Promise<void>);

  /**
   * The program's standard input.
   */
  public get input(): Writable;

  /**
   * The program's standard output; a program whose output is not read
   * blocks once the pipe is full.
   */
  public get output(): Readable;

  /**
   * The program's standard error; a program whose errors are not read
   * blocks once the pipe is full.
   */
  public get errors(): Readable;

  /**
   * Whether the program has exited.
   */
  public get hasExited(): boolean;

  /**
   * Ends the program and what it started: on Windows it closes the program's
   * input, and elsewhere it sends its process group SIGTERM; whatever still
   * runs after the grace period, 3 seconds in the runtime, is killed. Calling
   * it again returns the same promise.
   *
   * @returns A promise of how the program exited.
   * @example
   * ```ts
   * import type { OwnedProcess, ProcessExit } from "@noldova/desktop.runtime";
   *
   * export function cancelAsync(process: OwnedProcess): Promise<ProcessExit> {
   *   return process.stopAsync();
   * }
   * ```
   */
  public stopAsync(): Promise<ProcessExit>;
}

/**
 * A program a module asks the runtime to start in a pseudo-terminal, through
 * the module's own pseudo-terminal library. The program gets the request's
 * environment whole.
 */
export declare class PseudoTerminalRequest {
  /**
   * The library that starts the pseudo-terminal.
   */
  public readonly library: IPseudoTerminalLibrary;

  /**
   * The program: a name searched for on the environment's PATH, or an
   * absolute path. On Windows it must be a console program, because a
   * windowed one, such as Electron run as Node, never attaches to the
   * pseudo console.
   */
  public readonly program: string;

  /**
   * The program's arguments.
   */
  public readonly arguments: readonly string[];

  /**
   * On Windows, the command line passed after the program as it is in place
   * of the arguments, or `undefined`.
   */
  public readonly commandLine: string | undefined;

  /**
   * The absolute folder the program runs in.
   */
  public readonly workingFolder: string;

  /**
   * The terminal's number of columns.
   */
  public readonly columns: number;

  /**
   * The terminal's number of rows.
   */
  public readonly rows: number;

  /**
   * The program's whole environment.
   */
  public readonly environment: Readonly<Record<string, string>>;

  /**
   * Whether the Windows pseudo console starts at the terminal's cursor.
   */
  public readonly inheritsCursor: boolean;

  /**
   * Stops the program when it aborts; while the start waits for the
   * program's process id, it rejects the start with the signal's reason.
   */
  public readonly signal: AbortSignal | undefined;

  /**
   * Creates the request.
   *
   * @param library The module's own pseudo-terminal library.
   * @param program A name searched for on the environment's PATH, or an
   * absolute path.
   * @param launchArguments The program's arguments.
   * @param workingFolder The absolute folder the program runs in.
   * @param columns The terminal's number of columns.
   * @param rows The terminal's number of rows.
   * @param environment The program's whole environment.
   * @param options Whether the Windows pseudo console starts at the cursor,
   * the command line passed as it is on Windows, and the abort signal.
   * @throws {ArgumentException} When the program is empty or whitespace, the
   * working folder is not absolute, a variable's name is empty or holds `=`
   * or a null character, or the columns or rows are not whole numbers of at
   * least 1.
   * @example
   * ```ts
   * import * as pty from "node-pty";
   *
   * import { PseudoTerminalRequest } from "@noldova/desktop.runtime";
   *
   * export function requestShell(project: string, environment: Readonly<Record<string, string>>): PseudoTerminalRequest {
   *   return new PseudoTerminalRequest(pty, "bash", ["-l"], project, 80, 24, environment, { inheritCursor: true });
   * }
   * ```
   */
  public constructor(
    library: IPseudoTerminalLibrary,
    program: string,
    launchArguments: readonly string[],
    workingFolder: string,
    columns: number,
    rows: number,
    environment: Readonly<Record<string, string>>,
    options?: IPseudoTerminalStartOptions);
}

/**
 * How a pseudo-terminal's program ended: with an exit code, by a signal, or
 * with neither when the library reported no code.
 */
export declare class PseudoTerminalExit {
  /**
   * The exit code, or `null` when a signal ended the program or there was
   * no code.
   */
  public readonly code: number | null;

  /**
   * The signal that ended the program, or `null`.
   */
  public readonly signal: NodeJS.Signals | null;

  /**
   * Creates the exit.
   *
   * @param code The exit code, or `null`.
   * @param signal The signal, or `null`.
   * @throws {ArgumentException} When both are set.
   * @example
   * ```ts
   * import { PseudoTerminalExit } from "@noldova/desktop.runtime";
   *
   * export function hungUp(): PseudoTerminalExit {
   *   return new PseudoTerminalExit(null, "SIGHUP");
   * }
   * ```
   */
  public constructor(code: number | null, signal: NodeJS.Signals | null);

  /**
   * Whether the program exited with code 0.
   */
  public get isClean(): boolean;
}

/**
 * The process group that holds a pseudo-terminal, with its leader's program
 * and command line and the terminal program's own, read in one step, so a
 * module can tell whether a command's process has started its program or is
 * still the copy of the shell that forked it.
 */
export declare class ForegroundProcess {
  /**
   * The id of the process group that holds the terminal, which is also its
   * leader's process id.
   */
  public readonly group: number;

  /**
   * The group leader's program, or `null` when the leader exited before it
   * was read: on Linux the path its `/proc/<pid>/exe` link resolves to, and
   * on macOS its `comm`, as `ps` shows it.
   */
  public readonly program: string | null;

  /**
   * The group leader's command line, its arguments joined by spaces, or
   * `null` when the leader exited before it was read: on Linux from
   * `/proc/<pid>/cmdline`, and on macOS its `args`, as `ps` shows them.
   */
  public readonly commandLine: string | null;

  /**
   * The terminal program's own program, read the same way and in the same
   * step.
   */
  public readonly terminalProgram: string;

  /**
   * The terminal program's own command line, read the same way and in the
   * same step.
   */
  public readonly terminalCommandLine: string;

  /**
   * Creates the foreground process.
   *
   * @param group The id of the process group that holds the terminal.
   * @param program The group leader's program, or `null`.
   * @param commandLine The group leader's command line, or `null`.
   * @param terminalProgram The terminal program's own program.
   * @param terminalCommandLine The terminal program's own command line.
   * @example
   * ```ts
   * import { ForegroundProcess } from "@noldova/desktop.runtime";
   *
   * export function atPrompt(processId: number): ForegroundProcess {
   *   return new ForegroundProcess(processId, "/usr/bin/bash", "/bin/bash -i", "/usr/bin/bash", "/bin/bash -i");
   * }
   * ```
   */
  public constructor(group: number, program: string | null, commandLine: string | null, terminalProgram: string, terminalCommandLine: string);

  /**
   * Whether the group leader has the terminal's own program and command
   * line: the program itself at its prompt, or a copy of it that hasn't yet
   * started a command's program. On Linux the programs are compared as the
   * system resolves them, so `/bin/bash` and `/usr/bin/bash` through a link
   * are one program; on macOS as `ps` shows them. A command that runs the
   * terminal's own program, such as `bash x.sh` at a Bash prompt, has its
   * own command line, so it doesn't count. A copy that never starts another
   * program, such as a subshell `( … )` or a part of a pipeline that runs
   * the shell's own code, like `while …; done | tee log`, counts for its whole
   * run, and so does a command run with exactly the terminal's own command
   * line. False when the leader exited before it was read, or, on Linux,
   * when the system won't let the module read its program, as for `sudo`.
   */
  public get isTerminalProgram(): boolean;
}

/**
 * A program the runtime started for a module in a pseudo-terminal.
 */
export declare class PseudoTerminal {
  /**
   * The program's path.
   */
  public readonly program: string;

  /**
   * When the program started.
   */
  public readonly started: Date;

  /**
   * Resolves when the program exits, whenever it is awaited. On macOS and Linux
   * it also resolves, without a code or signal, a second after the program's
   * process is found gone when the library has reported no exit by then, and an
   * exit the library reports later is dropped.
   */
  public readonly exited: Promise<PseudoTerminalExit>;

  /**
   * Creates the pseudo-terminal; {@link ProcessSupervisor.startPseudoTerminalAsync}
   * creates them.
   *
   * @param handle The started pseudo-terminal.
   * @param program The program's path.
   * @param started When the program started.
   * @param stop Ends the program and what it started, resolving whether it
   * ended within the grace period.
   * @param readForegroundGroupAsync Reads the foreground process group of the
   * terminal of the process with the given id and start, or null when that
   * process is no longer the program; by default it answers null.
   * @param readForegroundAsync Reads the same group with its leader's and the
   * terminal program's own program and command line, or null when there's no
   * group; by
   * default it answers null.
   * @example
   * ```ts
   * import { type IPseudoTerminalHandle, PseudoTerminal } from "@noldova/desktop.runtime";
   *
   * export function own(handle: IPseudoTerminalHandle, file: string): PseudoTerminal {
   *   return new PseudoTerminal(handle, file, new Date(), async () => {
   *     handle.kill();
   *     return true;
   *   });
   * }
   * ```
   */
  public constructor(handle: IPseudoTerminalHandle, program: string, started: Date, stop: (terminal: PseudoTerminal) => Promise<boolean>,
    readForegroundGroupAsync?: (processId: number, started: Date) => Promise<number | null>,
    readForegroundAsync?: (processId: number, started: Date) => Promise<ForegroundProcess | null>);

  /**
   * The program's process id, which on Windows node-pty knows only once the
   * pseudo console has started it; the runtime's pseudo-terminals know it.
   */
  public get processId(): number;

  /**
   * Whether the program has exited.
   */
  public get hasExited(): boolean;

  /**
   * Reads the terminal's foreground process group: on Linux and macOS, the id
   * of the process group that holds the terminal, which is the program's own
   * process id while the program itself, such as a shell at its prompt, holds
   * it, and a command's group while a command the shell started holds it. It
   * finds the terminal by the program's process id, and in the same read
   * checks that the process is still the program, since an id can be reused
   * before the exit is reported: from `/proc/<pid>/stat` on Linux, a file
   * read, whose session must be the program's own, and from
   * `ps -o lstart=,tpgid= -p <pid>` on macOS, a process started for each
   * read, whose start must match the program's within a second and the
   * start margin.
   *
   * @returns The process group's id; null on Windows, which has no process
   * groups, once the program has exited, when the process id is no longer
   * the program's, and for a pseudo-terminal built without a reader.
   * @throws {SystemCommandException} When the group of a program that still
   * runs cannot be read, as when `ps` doesn't answer within 1 second.
   * @example
   * ```ts
   * import type { PseudoTerminal } from "@noldova/desktop.runtime";
   *
   * export async function isRunningCommandAsync(terminal: PseudoTerminal): Promise<boolean> {
   *   const group = await terminal.readForegroundProcessGroupAsync();
   *   return group !== null && group !== terminal.processId;
   * }
   * ```
   */
  public readForegroundProcessGroupAsync(): Promise<number | null>;

  /**
   * Reads the terminal's foreground process group as
   * {@link readForegroundProcessGroupAsync} does, with its leader's program
   * and command line and the terminal program's own in the same read: on
   * Linux each one's `/proc/<pid>/exe` link and `/proc/<pid>/cmdline`, and on
   * macOS the `comm` and then the `args` that `ps -o pid=,comm=` and
   * `ps -o pid=,args=` show for both. Each program is read before its command
   * line, so a copy that starts a command's program between the two reads
   * reads as started. A shell gives a command's new process group the terminal right
   * after it forks, before the command's program starts, so for a moment the
   * group's leader is a copy of the shell, with the shell's own handling of
   * Ctrl+C; a module can wait, before it sends one, until
   * {@link ForegroundProcess.isTerminalProgram} is false, for a bounded time:
   * a copy that never starts another program, such as a subshell or a part
   * of a pipeline that runs shell code, reads true for its whole run, so once
   * the bound passes the module sends Ctrl+C anyway.
   *
   * @returns The group with the programs; null on Windows, once the program
   * has exited, when the process id is no longer the program's, while no
   * group holds the terminal, and for a pseudo-terminal built without the
   * reader. The leader's program and command line are null when the leader
   * exited between the reads; on Linux, each is also null when the system
   * won't let the module read it, as for `sudo`, `su` or `ping`, or the
   * leader has exited but isn't yet reaped.
   * @throws {SystemCommandException} When the group or the terminal
   * program's own program cannot be read while it runs, as when `ps` doesn't
   * answer within 1 second, or the leader's cannot for another reason.
   * @example
   * ```ts
   * import type { PseudoTerminal } from "@noldova/desktop.runtime";
   *
   * export async function interruptAsync(terminal: PseudoTerminal, boundMilliseconds: number): Promise<void> {
   *   const deadline = Date.now() + boundMilliseconds;
   *   let foreground = await terminal.readForegroundProcessAsync();
   *   while (foreground !== null && foreground.isTerminalProgram && foreground.group !== terminal.processId && Date.now() < deadline) {
   *     await new Promise(resolve => setTimeout(resolve, 20));
   *     foreground = await terminal.readForegroundProcessAsync();
   *   }
   *   terminal.write(String.fromCharCode(3));
   * }
   * ```
   */
  public readForegroundProcessAsync(): Promise<ForegroundProcess | null>;

  /**
   * Calls the listener with each piece of the program's output. The first
   * listener also receives, in order, all the output that came before it.
   *
   * @param listener Receives the output as UTF-8 text.
   * @returns The registration, which stops the calls when disposed.
   * @example
   * ```ts
   * import type { PseudoTerminal, Registration } from "@noldova/desktop.runtime";
   *
   * export function collect(terminal: PseudoTerminal, output: string[]): Registration {
   *   return terminal.onOutput(t => output.push(t));
   * }
   * ```
   */
  public onOutput(listener: (text: string) => void): Registration;

  /**
   * Writes to the program's input; once the program has ended, even before
   * its exit arrives, it does nothing.
   *
   * @param text The text to write.
   * @example
   * ```ts
   * import type { PseudoTerminal } from "@noldova/desktop.runtime";
   *
   * export function run(terminal: PseudoTerminal, command: string): void {
   *   terminal.write(`${command}\r`);
   * }
   * ```
   */
  public write(text: string): void;

  /**
   * Changes the terminal's size; once the program has ended, even before its
   * exit arrives, it does nothing.
   *
   * @param columns The number of columns.
   * @param rows The number of rows.
   * @throws {ArgumentException} When the columns or rows are not whole
   * numbers of at least 1.
   * @example
   * ```ts
   * import type { PseudoTerminal } from "@noldova/desktop.runtime";
   *
   * export function widen(terminal: PseudoTerminal): void {
   *   terminal.resize(160, 40);
   * }
   * ```
   */
  public resize(columns: number, rows: number): void;

  /**
   * Stops reading the program's output until {@link PseudoTerminal.resume};
   * a program that keeps writing then blocks.
   */
  public pause(): void;

  /**
   * Reads the program's output again after {@link PseudoTerminal.pause}.
   */
  public resume(): void;

  /**
   * Ends the program and what it started: it resumes the output, then on
   * Windows it closes the pseudo console, and elsewhere it sends the
   * program's process group SIGHUP, and the program itself SIGHUP once more
   * when it still runs a third of the way into the grace period, since a
   * shell can lose a hangup before its prompt; whatever still runs after the
   * grace period, 3 seconds in the runtime, is killed. Elsewhere it then
   * hangs up the process groups of the program's jobs that still run.
   * Calling it again returns the same promise.
   *
   * @returns A promise of whether everything ended within the grace period.
   * @example
   * ```ts
   * import type { PseudoTerminal } from "@noldova/desktop.runtime";
   *
   * export function closeAsync(terminal: PseudoTerminal): Promise<boolean> {
   *   return terminal.stopAsync();
   * }
   * ```
   */
  public stopAsync(): Promise<boolean>;
}

/**
 * Compares builds by product version.
 */
export declare class BuildComparer {
  /**
   * Compares one build with another.
   *
   * @param own The build doing the comparing.
   * @param other The other build.
   * @returns How the own build relates to the other.
   * @throws {ArgumentException} When a product version is not of the form major.minor.patch.
   * @example
   * ```ts
   * import type { BuildIdentity } from "@noldova/desktop.protocol";
   * import { BuildComparer, BuildRelation } from "@noldova/desktop.runtime";
   *
   * export function isNewer(own: BuildIdentity, other: BuildIdentity): boolean {
   *   return BuildComparer.compare(own, other) === BuildRelation.Newer;
   * }
   * ```
   */
  public static compare(own: BuildIdentity, other: BuildIdentity): BuildRelation;
}

/**
 * A connection to a runtime. A connection to another build's runtime accepts only {@link RuntimeClient.stopAsync}.
 */
export declare class RuntimeClient {
  /**
   * The client's name, which prefixes its request ids.
   */
  public readonly clientName: string;

  private constructor();

  /**
   * The other build's identity and program when the runtime belongs to another build, or the runtime's own when it refused this client as the
   * main process, otherwise `null`. Either way the connection may only stop the runtime.
   */
  public get handover(): RuntimeHandover | null;

  /**
   * Whether the runtime refused this client as `ShellClients.mainProcess`, such as the same build's main process run from another copy of the
   * program, and answered with its {@link handover} so the client may stop it and start its own.
   */
  public get isRefusedAsMainProcess(): boolean;

  /**
   * Where the data from before the shell is when the runtime refuses until it is moved aside, otherwise `null`.
   */
  public get preShellData(): PreShellData | null;

  /**
   * Whether the connection is open.
   */
  public get isConnected(): boolean;

  /**
   * Connects and performs the handshake.
   *
   * @param endpoint The runtime's endpoint.
   * @param token The capability token from discovery metadata.
   * @param identity The client's build identity.
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param settings The time limits. Defaults to {@link ClientSettings}' defaults.
   * @returns A promise of the connected client; its {@link handover} is set when the runtime belongs to another build, and its {@link preShellData} when the runtime refuses until old data is moved aside.
   * @throws {ArgumentException} Synchronously rejected when the client name is empty or whitespace.
   * @throws {ConnectionException} Rejected when the runtime cannot be reached, closes, refuses the token or does not answer in time.
   * @example
   * ```ts
   * import { Endpoint, type IRuntimeClientListener, RuntimeBuild, RuntimeClient, type RuntimeDiscovery } from "@noldova/desktop.runtime";
   *
   * export function connectAsync(discovery: RuntimeDiscovery, listener: IRuntimeClientListener): Promise<RuntimeClient> {
   *   return RuntimeClient.connectAsync(Endpoint.parse(discovery.endpoint), discovery.token, RuntimeBuild.identity, "mainProcess", listener);
   * }
   * ```
   */
  public static connectAsync(
    endpoint: Endpoint,
    token: string,
    identity: BuildIdentity,
    clientName: string,
    listener: IRuntimeClientListener,
    settings?: ClientSettings): Promise<RuntimeClient>;

  /**
   * Sends a request and waits for its response.
   *
   * @param method The method's qualified name.
   * @param payload The request's payload.
   * @param timeoutMilliseconds The request's time limit in milliseconds. Defaults to the settings' call limit.
   * @param signal Aborting it sends a cancellation; the response then reports it.
   * @param window The window of the main process the request is sent for, by the id a reload keeps; omit it when no
   * window sends it.
   * @param page The serial the main process gave the window's current page; the runtime ends a page's file grants by it.
   * Give it only with a window.
   * @returns A promise of the response, successful or failed. A request too large for one frame is not sent; it fails with
   * `FrameTooLarge`, as an answer too large for one frame does.
   * @throws {ArgumentOutOfRangeException} Synchronously when the time limit, the window or the page is not a positive integer,
   * or a page is given without a window.
   * @throws {TypeError} Synchronously when the payload cannot be written as JSON, such as one that contains itself.
   * @throws {ConnectionException} Rejected with a `Disconnected` failure when the connection is closed or closes, and with none when the runtime does not answer within the limit and its grace.
   * @example
   * ```ts
   * import { QualifiedName, type Response } from "@noldova/desktop.protocol";
   * import type { RuntimeClient } from "@noldova/desktop.runtime";
   *
   * export function openNoteAsync(client: RuntimeClient, path: string, signal: AbortSignal): Promise<Response> {
   *   return client.callAsync(new QualifiedName("notes", "open"), { path }, 30_000, signal);
   * }
   * ```
   */
  public callAsync(method: QualifiedName, payload: JsonValue, timeoutMilliseconds?: number, signal?: AbortSignal, window?: number, page?: number): Promise<Response>;

  /**
   * Asks the runtime to stop; the only request another build may send, and one a refused connection may send.
   *
   * @param policy Whether to stop only when no work is in progress, or to stop the work.
   * @returns A promise of the response: success, or a conflict whose details list the work in progress.
   * @throws {ConnectionException} Rejected as for {@link callAsync}.
   * @example
   * ```ts
   * import { StopPolicy } from "@noldova/desktop.protocol";
   * import type { RuntimeClient } from "@noldova/desktop.runtime";
   *
   * export async function stopIfIdleAsync(client: RuntimeClient): Promise<boolean> {
   *   return !(await client.stopAsync(StopPolicy.IfIdle)).hasFailed;
   * }
   * ```
   */
  public stopAsync(policy: StopPolicy): Promise<Response>;

  /**
   * Asks a refusing runtime to move the data from before the shell aside; with {@link stopAsync}, the only request a refused connection may send.
   *
   * @returns A promise of the response: success, after which the runtime serves new connections normally, or a failure.
   * After a failure before the runtime opened its database, such as a move that could not finish, the next request moves aside again;
   * after a later failure, every request answers with that failure until the runtime stops.
   * @throws {ConnectionException} Rejected as for {@link callAsync}.
   * @example
   * ```ts
   * import type { RuntimeClient } from "@noldova/desktop.runtime";
   *
   * export async function moveAsideAsync(client: RuntimeClient): Promise<boolean> {
   *   return client.preShellData !== null && !(await client.moveAsideAsync()).hasFailed;
   * }
   * ```
   */
  public moveAsideAsync(): Promise<Response>;

  /**
   * Closes the connection.
   * @example
   * ```ts
   * import type { RuntimeClient } from "@noldova/desktop.runtime";
   *
   * export function disconnect(client: RuntimeClient): void {
   *   client.close();
   * }
   * ```
   */
  public close(): void;
}

/**
 * Starts programs detached from the current process: on Windows with Node.js,
 * elsewhere through the runtime's POSIX addon, which starts the program in a
 * session of its own and closes every descriptor the caller left open but its
 * standard ones. Without Linux's `close_range`, it marks the descriptors
 * below the soft limit of open files, and at most below 65,536, to close when
 * the program starts. Its forked processes never call `close()`, so it starts
 * programs from Electron's main process too, whose `close()` aborts a
 * process that closes a descriptor Chromium owns.
 */
export declare class ChildProcessStarter implements IProcessStarter {
  /**
   * Creates a starter for a platform that starts programs outside Windows
   * through the given system call.
   *
   * @param platform The platform it runs on, as `process.platform` names it;
   * the current one by default.
   * @param posix The system call it starts a program with outside Windows;
   * the runtime's POSIX addon, loaded on the first start, by default.
   * @param isHidden Whether a program started on Windows is told to hide its
   * windows, as a console program's should be; `true` by default. A program
   * that shows a window, such as an app, is started with `false`, since the
   * window it opens first would otherwise start hidden.
   * @param disclaimFunction The system function a start outside Windows
   * disclaims responsibility through, as
   * {@link IPosixProcessApi.startDetached} takes it, or `null` for none; on
   * macOS `responsibility_spawnattrs_setdisclaim` by default, so a program it
   * starts, such as the runtime, is its own responsible process, and `null`
   * elsewhere.
   * @example
   * ```ts
   * import { ChildProcessStarter, type IPosixProcessApi } from "@noldova/desktop.runtime";
   *
   * export function createStarter(posix: IPosixProcessApi): ChildProcessStarter {
   *   return new ChildProcessStarter(process.platform, posix);
   * }
   * ```
   */
  public constructor(platform?: string, posix?: IPosixProcessApi, isHidden?: boolean, disclaimFunction?: string | null);

  /**
   * Creates a starter for a platform, without loading the addon.
   *
   * @param platform The platform it runs on, as `process.platform` names it.
   * @param isHidden Whether a program started on Windows is told to hide its
   * windows; `true` by default.
   * @returns The starter, which loads the addon on its first start outside
   * Windows.
   * @example
   * ```ts
   * import { ChildProcessStarter } from "@noldova/desktop.runtime";
   *
   * export function startRuntimeAsync(executable: string, errorFile: string): Promise<number> {
   *   return ChildProcessStarter.create(process.platform).startAsync(executable, ["--runtime"], process.env, errorFile);
   * }
   * ```
   */
  public static create(platform: string, isHidden?: boolean): ChildProcessStarter;

  /**
   * Starts a program detached from the current process, without a shell, and
   * on Windows with its windows hidden unless the starter was created
   * otherwise. Its standard input and output are discarded, and what it
   * writes to standard error is appended to a file, opened before the call
   * returns.
   *
   * @param executable The program's absolute path.
   * @param launchArguments The arguments, each passed as it is.
   * @param environment The program's whole environment.
   * @param errorFile The file its standard error is appended to; it is
   * created if needed, outside Windows with mode 0600, for the person's
   * account only.
   * @param workingFolder The folder the program starts in; by default this
   * process's own.
   * @returns The started program's process id.
   * @throws {LaunchException} Asynchronously when the program cannot start,
   * including when the folder does not exist; the message names it.
   * @throws Error asynchronously when the error file cannot be opened.
   * @example
   * ```ts
   * import { ChildProcessStarter } from "@noldova/desktop.runtime";
   *
   * export function startRuntimeAsync(executable: string, errorFile: string): Promise<number> {
   *   return ChildProcessStarter.create(process.platform).startAsync(executable, ["--runtime"], process.env, errorFile);
   * }
   * ```
   */
  public startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number>;
}

/**
 * The running runtime's log, `logs/runtime.log`. Every line is stamped with its time and redacted, and the log is a {@link LogFile}: it stays within its size limit by becoming `logs/runtime.previous.log` when it fills. Opening it under ownership keeps the previous run's log as `logs/runtime.previous.log` and removes the start logs that launchers left behind.
 */
export declare class RuntimeLog {
  /**
   * The stream the runtime writes its diagnostics to; each write is one record, stamped and redacted like a line, without its trailing line ending. It writes to the log until the log closes, without waiting for the disk.
   */
  public readonly diagnostics: Writable;

  private constructor();

  /**
   * Opens a new log. The current log becomes the previous one, replacing it; when that fails the open is rejected and the current log keeps what it holds. Start logs other than the runtime's own are removed, and those that cannot be removed are left.
   *
   * @param lock The held ownership of the data directory.
   * @param ownStartLogName The start log of the launcher that started this runtime, which is kept, or `null`.
   * @param now Returns the time to stamp a line with; the current time by default.
   * @param error Receives the report when the log can no longer be written; standard error by default.
   * @param homeFolder The home folder the log redacts, with its user name; the current user's by default.
   * @param writeWait The most milliseconds a line written at once waits for a diagnostic already being written to land; 2 seconds by default.
   * @returns A promise of the open log.
   * @throws {OwnershipReleasedException} Rejected when the ownership was released.
   * @example
   * ```ts
   * import { type OwnershipLock, RuntimeLog } from "@noldova/desktop.runtime";
   *
   * export async function noteAsync(lock: OwnershipLock): Promise<void> {
   *   const log = await RuntimeLog.openAsync(lock, null);
   *   log.writeLine("The runtime started.");
   *   await log.closeAsync();
   * }
   * ```
   */
  public static openAsync(lock: OwnershipLock, ownStartLogName: string | null, now?: () => Date, error?: Writable, homeFolder?: string, writeWait?: number): Promise<RuntimeLog>;

  /**
   * Writes one line at once, as when the process is about to end, after the diagnostics still waiting; nothing is written after the log closes. When a line cannot be written, the failure is reported once on the error stream and nothing more is written to the log.
   *
   * @param text The line, without its line ending.
   * @example
   * ```ts
   * import type { RuntimeLog } from "@noldova/desktop.runtime";
   *
   * export function note(log: RuntimeLog, failure: Error): void {
   *   log.writeLine(String(failure.stack));
   * }
   * ```
   */
  public writeLine(text: string): void;

  /**
   * Finishes the diagnostics stream, waits until every diagnostic is written, and closes the log; closing again does nothing.
   *
   * @returns A promise that settles once the log is closed.
   * @throws {Error} Rejected with the failure of the error stream, other than a closed or full stream's, when it could not take the report that a diagnostic could not be written.
   * @example
   * ```ts
   * import type { RuntimeLog } from "@noldova/desktop.runtime";
   *
   * export async function finishAsync(log: RuntimeLog): Promise<void> {
   *   await log.closeAsync();
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * Starts or attaches to the runtime of a data directory, taking over from an older build and handing over to a newer one.
 */
export declare class RuntimeLauncher {
  /**
   * Creates the launcher.
   *
   * @param settings How to start and attach.
   * @param identity The client's build identity.
   * @param installation The installation the client belongs to. Before starting a runtime the launcher checks its launch barrier, and it gives the runtime the installation's folder; when a runtime it started exits before it is found, it checks the barrier again and reports an update in progress rather than the exit.
   * @param log Writes a line to the client's log. When the discovery folder or a mount's folder cannot be watched for changes, it is told once, and the launcher then checks every 100 ms instead of failing.
   * @param starter Starts the runtime's process. Defaults to {@link ChildProcessStarter}; the main process passes one that keeps its own handles out of the runtime on Windows.
   * @param presence Reads the start of the launcher and the runtime for an AppImage extraction's record on Linux. Defaults to the current platform's process table.
   * @example
   * ```ts
   * import { type Installation, type IRuntimeClientListener, type LaunchSettings, RuntimeBuild, type RuntimeClient, RuntimeLauncher } from "@noldova/desktop.runtime";
   *
   * export function attachAsync(settings: LaunchSettings, installation: Installation, listener: IRuntimeClientListener): Promise<RuntimeClient> {
   *   return new RuntimeLauncher(settings, RuntimeBuild.identity, installation, t => console.error(t)).attachAsync("mainProcess", listener);
   * }
   * ```
   */
  public constructor(settings: LaunchSettings, identity: BuildIdentity, installation: Installation, log: (text: string) => void, starter?: IProcessStarter,
    presence?: ProcessPresence);

  /**
   * Returns a connection to the data directory's runtime of this build, starting one when none runs. An older build's runtime is asked to stop and replaced, and so,
   * once, is a runtime of this build that refuses this client as the main process, such as one run from another copy of the program.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress. Defaults to {@link StopPolicy.IfIdle}.
   * @param options Whether to start a runtime when none runs and whether to take over an older build's runtime. Both default to yes.
   * @returns A promise of the connected client.
   * @throws {NoRuntimeException} Rejected when no runtime runs and the options say not to start one.
   * @throws {BuildMismatchException} Rejected when an older build's runtime, another build of the same version, or a runtime that refuses this client as the main process,
   * owns the directory and the options say not to take it over.
   * @throws {RuntimeHandoverException} Rejected when a newer build's runtime owns the directory.
   * @throws {PreShellDataFoundException} Rejected when the runtime refuses until data from before the shell is moved aside.
   * @throws {WorkInProgressException} Rejected when an older runtime has work in progress and the policy is to stop only if idle.
   * @throws {UpdateInProgressException} Rejected when an update holds the installation's launch barrier before a runtime starts, or once a runtime it started exits.
   * @throws {LaunchException} Rejected when the runtime cannot start, exits before it is reachable, does not start in time, holds the directory without becoming reachable within the launch limit, an older runtime refuses to stop or does not stop in time, or the runtime
   * refuses this client as the main process again after the launcher replaced it.
   * @throws {ConnectionException} Rejected when the runtime refuses the connection.
   * @example
   * ```ts
   * import { type Installation, type IRuntimeClientListener, type LaunchSettings, RuntimeBuild, type RuntimeClient, RuntimeLauncher } from "@noldova/desktop.runtime";
   *
   * export function attachAsync(settings: LaunchSettings, installation: Installation, listener: IRuntimeClientListener): Promise<RuntimeClient> {
   *   return new RuntimeLauncher(settings, RuntimeBuild.identity, installation, t => console.error(t)).attachAsync("mainProcess", listener);
   * }
   * ```
   */
  public attachAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy, options?: AttachOptions): Promise<RuntimeClient>;

  /**
   * Like {@link attachAsync}, but first moves data from before the shell aside when the runtime refuses because of it. Call it after the person agreed to the move.
   *
   * @param clientName The client's name.
   * @param listener Receives events and the disconnection.
   * @param policy What to do when an older runtime has work in progress. Defaults to {@link StopPolicy.IfIdle}.
   * @returns A promise of the connected client, once the data is moved aside.
   * @throws {LaunchException} Rejected when the runtime fails to move the data, or as for {@link attachAsync}.
   * @throws {RuntimeHandoverException} Rejected as for {@link attachAsync}.
   * @throws {WorkInProgressException} Rejected as for {@link attachAsync}.
   * @example
   * ```ts
   * import { type IRuntimeClientListener, PreShellDataFoundException, type RuntimeClient, type RuntimeLauncher } from "@noldova/desktop.runtime";
   *
   * export async function attachAsync(
   *   launcher: RuntimeLauncher,
   *   listener: IRuntimeClientListener,
   *   confirmAsync: (location: string) => Promise<boolean>): Promise<RuntimeClient> {
   *   try {
   *     return await launcher.attachAsync("mainProcess", listener);
   *   }
   *   catch (error) {
   *     if (!(error instanceof PreShellDataFoundException) || !await confirmAsync(error.data.location))
   *       throw error;
   *     return launcher.moveAsideAsync("mainProcess", listener);
   *   }
   * }
   * ```
   */
  public moveAsideAsync(clientName: string, listener: IRuntimeClientListener, policy?: StopPolicy): Promise<RuntimeClient>;
}

/**
 * The runtime's endpoint server: handshake, requests routed through a method registry, events, deadlines, cancellation and frame limits.
 */
export declare class RuntimeServer implements IEventSink {
  /**
   * The longest socket path, in bytes, that `listenSocketAsync` accepts: 103, which every supported Unix system can bind.
   */
  public static readonly maximumSocketPathLength: number;

  /**
   * The listeners that hear when an authenticated connection closes, or one of its windows closes for good through
   * `desktop.windowClosed`.
   */
  public readonly closures: ClientClosures;

  /**
   * Creates the server.
   *
   * @param identity The runtime's build identity.
   * @param token The capability token clients must present.
   * @param handover What another build's client receives in its handshake answer.
   * @param methods The registry requests are routed through.
   * @param settings The server's limits.
   * @param changed Called whenever a connection opens or closes.
   * @param diagnostics Receives a line for each event the server could not send, for each connection refused as the main process, and for each request
   * answered as an internal failure, with its method and the error's stack.
   * @param mainProcessCheck Whether a connection that names itself `ShellClients.mainProcess` comes from the app's main process. Defaults to the
   * check of the connection's process: it did not start with `ELECTRON_RUN_AS_NODE` and, on macOS and Windows, runs the runtime's own
   * program file, on Windows started before the connection. On Linux the program is not checked yet. A connection it refuses
   * gets `Unauthorized` with the runtime's handover and, like another build's client, may then only stop the runtime. On macOS a checked
   * connection on which another process sends since is ended. Other client names are not checked.
   * @example
   * ```ts
   * import { RuntimeHandover } from "@noldova/desktop.protocol";
   * import { CapabilityToken, type MethodRegistry, RuntimeBuild, RuntimeServer, ServerSettings } from "@noldova/desktop.runtime";
   *
   * export function createServer(methods: MethodRegistry, changed: () => void): RuntimeServer {
   *   const identity = RuntimeBuild.identity;
   *   return new RuntimeServer(identity, CapabilityToken.generate(), new RuntimeHandover(identity, process.execPath), methods, new ServerSettings(), changed, process.stderr);
   * }
   * ```
   */
  public constructor(
    identity: BuildIdentity,
    token: CapabilityToken,
    handover: RuntimeHandover,
    methods: MethodRegistry,
    settings: ServerSettings,
    changed: () => void,
    diagnostics: Writable,
    mainProcessCheck?: IMainProcessCheck);

  /**
   * The number of open connections, authenticated or not.
   */
  public get sessionCount(): number;

  /**
   * The authenticated connections of the runtime's build, in the order they connected.
   */
  public get clients(): readonly ConnectedClient[];

  /**
   * Counts the authenticated connections other than the one that made a request, whatever names their clients gave.
   *
   * @param context The request's context, as the server passed it to the method handler.
   * @returns The number of such connections; every authenticated connection when the server did not make the context.
   * @example
   * ```ts
   * import type { RequestContext, RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function isShared(server: RuntimeServer, context: RequestContext): boolean {
   *   return server.countOtherClients(context) > 0;
   * }
   * ```
   */
  public countOtherClients(context: RequestContext): number;

  /**
   * Listens on a loopback port the system assigns.
   *
   * @returns A promise of the endpoint.
   * @throws {ConnectionException} Rejected when the server has no address.
   * @example
   * ```ts
   * import type { Endpoint, RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function listenAsync(server: RuntimeServer): Promise<Endpoint> {
   *   return server.listenTcpAsync();
   * }
   * ```
   */
  public listenTcpAsync(): Promise<Endpoint>;

  /**
   * Listens on a Unix socket, replacing a stale socket file.
   *
   * @param socketPath The socket's absolute path, at most `maximumSocketPathLength` bytes.
   * @returns A promise of the endpoint.
   * @throws {ArgumentException} Rejected when the path is not absolute or too long.
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import type { DataDirectory, Endpoint, RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function listenAsync(server: RuntimeServer, directory: DataDirectory): Promise<Endpoint> {
   *   return server.listenSocketAsync(path.join(directory.discoveryFolder, "runtime.sock"));
   * }
   * ```
   */
  public listenSocketAsync(socketPath: string): Promise<Endpoint>;

  /**
   * Starts refusing: every later handshake is answered with the refusal's failure, and the connection may call only the refusal's method and `desktop.stop`.
   *
   * @param refusal The failure and the method allowed.
   * @example
   * ```ts
   * import { Failure, FailureCode, PreShellData, ShellMethods } from "@noldova/desktop.protocol";
   * import { Refusal, type RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function refuseUntilMoved(server: RuntimeServer, root: string): void {
   *   const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", new PreShellData(root).toJson());
   *   server.refuse(new Refusal(failure, ShellMethods.moveAside));
   * }
   * ```
   */
  public refuse(refusal: Refusal): void;

  /**
   * Stops refusing and ends the refused connections, which reconnect. Requests a refused connection sent before it ended stay refused.
   * @example
   * ```ts
   * import type { RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function finishMoving(server: RuntimeServer): void {
   *   server.admit();
   * }
   * ```
   */
  public admit(): void;

  /**
   * Starts preparing for an update: every later handshake is answered with the failure and the connection ends. A
   * connection keeps its requests until {@link refuseAfterSave} names it; it may then call only `desktop.updateSaved`,
   * `desktop.work` and `desktop.stop`, and any other request is answered with the failure.
   *
   * @param failure The `Updating` failure.
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/desktop.protocol";
   * import type { RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function prepare(server: RuntimeServer): void {
   *   server.beginUpdate(new Failure(FailureCode.Updating, "Noldova Desktop Sample is preparing to install an update."));
   * }
   * ```
   */
  public beginUpdate(failure: Failure): void;

  /**
   * Refuses a connection's requests while the update is prepared, as {@link beginUpdate} describes: once it has saved,
   * once the wait for saves ends, and from the start for the connection that asked for the update.
   *
   * @param connection The connection to refuse.
   * @example
   * ```ts
   * import type { RequestContext, RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function saved(server: RuntimeServer, context: RequestContext): void {
   *   server.refuseAfterSave(context.connection);
   * }
   * ```
   */
  public refuseAfterSave(connection: number): void;

  /**
   * Stops preparing for an update, so handshakes and every connection's requests are handled as before.
   * @example
   * ```ts
   * import type { RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function resume(server: RuntimeServer): void {
   *   server.endUpdate();
   * }
   * ```
   */
  public endUpdate(): void;

  /**
   * Sends an event to every authenticated connection of the runtime's build. An event too large for one frame, or one
   * that cannot be written as JSON, reaches no connection; the server writes a line to its diagnostics instead.
   *
   * @param event The event.
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/desktop.protocol";
   * import type { RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function announce(server: RuntimeServer, path: string): void {
   *   server.broadcast(new Event(new QualifiedName("notes", "changed"), { path }));
   * }
   * ```
   */
  public broadcast(event: Event): void;

  /**
   * Sends an event to one authenticated connection, unless it has closed or the event's window has closed for good.
   * An event that cannot be written is logged as `broadcast` logs it.
   *
   * @param event The event, with the window it is for, if any.
   * @param connection The connection's number.
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/desktop.protocol";
   * import type { RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function tellTheWindow(server: RuntimeServer, path: string): void {
   *   server.send(new Event(new QualifiedName("notes", "changed"), { path }, 3), 1);
   * }
   * ```
   */
  public send(event: Event, connection: number): void;

  /**
   * Records that a window of the asking connection closed for good, the first time cancels the window's requests still
   * running and then reports it to `closures`: later requests from the window fail with `NotFound`, and events for it
   * reach no one. `desktop.windowClosed` calls it.
   *
   * @param context The request that told it, from the connection the window belongs to.
   * @param window The window's id.
   * @example
   * ```ts
   * import type { RequestContext, RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function closeTheWindow(server: RuntimeServer, context: RequestContext): void {
   *   server.closeWindow(context, 3);
   * }
   * ```
   */
  public closeWindow(context: RequestContext, window: number): void;

  /**
   * Stops accepting connections, ends the open ones and removes the socket file.
   *
   * @returns A promise that settles once the server has closed.
   * @example
   * ```ts
   * import type { RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export async function shutDownAsync(server: RuntimeServer): Promise<void> {
   *   await server.closeAsync();
   * }
   * ```
   */
  public closeAsync(): Promise<void>;
}

/**
 * Something that delivers events to connected clients.
 */
export interface IEventSink {
  /**
   * Delivers an event.
   *
   * @param event The event.
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/desktop.protocol";
   * import type { IEventSink } from "@noldova/desktop.runtime";
   *
   * export function announce(sink: IEventSink, path: string): void {
   *   sink.broadcast(new Event(new QualifiedName("notes", "changed"), { path }));
   * }
   * ```
   */
  broadcast(event: Event): void;

  /**
   * Delivers an event to one connection alone.
   *
   * @param event The event, with the window it is for, if any.
   * @param connection The connection's number.
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/desktop.protocol";
   * import type { IEventSink } from "@noldova/desktop.runtime";
   *
   * export function tellTheWindow(sink: IEventSink, path: string): void {
   *   sink.send(new Event(new QualifiedName("notes", "changed"), { path }, 3), 1);
   * }
   * ```
   */
  send(event: Event, connection: number): void;
}

/**
 * Tells whether a connection comes from the app's main process, for the {@link RuntimeServer}'s handshake of a client named `ShellClients.mainProcess`.
 */
export interface IMainProcessCheck {
  /**
   * Reads, when the server accepts a connection and before any of its messages, what the later check compares against; on Linux, the start
   * time of the connecting process, so that a process that later gets the same process id doesn't pass. A failure is kept and rejects the check.
   *
   * @param socket The connection, just accepted.
   * @example
   * ```ts
   * import type { Socket } from "node:net";
   *
   * import type { IMainProcessCheck } from "@noldova/desktop.runtime";
   *
   * const accepted = new WeakSet<Socket>();
   *
   * export const acceptedOnly: IMainProcessCheck = {
   *   accept: socket => accepted.add(socket),
   *   isMainProcessAsync: socket => Promise.resolve(accepted.has(socket)),
   *   isSameSender: socket => accepted.has(socket)
   * };
   * ```
   */
  accept?(socket: Socket): void;

  /**
   * Checks the process at the other end of a connection.
   *
   * @param socket The connection, before its handshake is answered.
   * @returns A promise that resolves to whether the connection's process is the app's main process. A rejection refuses it too.
   * @example
   * ```ts
   * import type { IMainProcessCheck } from "@noldova/desktop.runtime";
   *
   * export const refusesEveryone: IMainProcessCheck = { isMainProcessAsync: () => Promise.resolve(false), isSameSender: () => false };
   * ```
   */
  isMainProcessAsync(socket: Socket): Promise<boolean>;

  /**
   * Checks, for each later message, that the process sending on a connection this check accepted is still the one it checked; on macOS,
   * by the peer's audit token, which changes when another process sends or the process runs another program.
   *
   * @param socket The connection, after this check accepted it.
   * @returns Whether the connection was accepted and its sender is the same; the server ends the connection when it is not.
   * @example
   * ```ts
   * import type { IMainProcessCheck } from "@noldova/desktop.runtime";
   *
   * export const acceptsEveryone: IMainProcessCheck = { isMainProcessAsync: () => Promise.resolve(true), isSameSender: () => true };
   * ```
   */
  isSameSender(socket: Socket): boolean;
}

/**
 * Removes the AppImage extractions that runtimes started by launchers left behind on Linux, as their copy records in the logs folder name them.
 */
export declare class AppImageCopyCleanup {
  /**
   * Reads each copy record, `logs/copy-<id>.log`. When the process that holds its copy no longer runs, by process id and start, a recorded mount process is ended if it runs with the recorded id and start, a mount process the record names neither by id nor by extraction, because its launcher ended before it could, is ended if its standard output is still the record's `logs/copy-<id>.log.mount`, which is then removed, the extraction is removed if its folder is a `desktop-runtime-` folder directly in the temporary folder, and the record is removed, unless the extraction lies in another folder, where a runtime with that temporary folder removes it. Records whose holder still runs are left. A record whose file cannot be read, whose holder cannot be looked up, or whose mount process cannot be looked for because the processes cannot be listed is left too, with its `.mount` file; a record whose folder cannot be removed is left without it. Either way, the reason is written to the diagnostics. The logs folder is created when it is missing.
   *
   * @param directory The data directory, whose ownership the runtime holds.
   * @param diagnostics Where a record that is left after a failure is written, with the reason.
   * @param presence Reads which recorded processes still run.
   * @param findWriters Lists the processes whose standard output is a file; {@link AppImageKeepalive.findWriters} by default.
   * @returns A promise that resolves once the leftover copies are ended.
   * @throws {Error} Rejected when the logs folder cannot be created or listed.
   * @example
   * ```ts
   * import { AppImageCopyCleanup, type OwnershipLock, ProcessPresence } from "@noldova/desktop.runtime";
   *
   * export function cleanAsync(lock: OwnershipLock): Promise<void> {
   *   return AppImageCopyCleanup.removeAsync(lock.dataDirectory, process.stderr, ProcessPresence.create(process.platform));
   * }
   * ```
   */
  public static removeAsync(directory: DataDirectory, diagnostics: Writable, presence: ProcessPresence, findWriters?: (file: string) => readonly number[]): Promise<void>;

  /**
   * Removes the runtime's own extraction and copy record when it stops, whoever the record names: the extraction if
   * its folder is a `desktop-runtime-` folder directly in the temporary folder, then the record, unless the extraction
   * lies in another folder. A record that still names a mount process, which a launcher left when it ended before
   * the hand-over did, is left for the next start's cleanup. A missing record is nothing to remove. A record that cannot be read, or whose folder cannot be removed, is left, and the reason is
   * written to the diagnostics.
   *
   * @param file The runtime's copy record, `logs/copy-<id>.log` for its start log `logs/start-<id>.log`.
   * @param diagnostics Where a record that is left is written, with the reason.
   * @returns A promise that resolves once the extraction and the record are removed or left; it never rejects.
   * @example
   * ```ts
   * import { AppImageCopyCleanup } from "@noldova/desktop.runtime";
   *
   * export function removeOwnAsync(record: string): Promise<void> {
   *   return AppImageCopyCleanup.removeOwnAsync(record, process.stderr);
   * }
   * ```
   */
  public static removeOwnAsync(file: string, diagnostics: Writable): Promise<void>;
}

/**
 * Calls its participant once it has stayed idle for a whole grace period.
 */
export declare class IdleMonitor implements Disposable {
  /**
   * Creates the monitor, unarmed.
   *
   * @param graceMilliseconds The grace period in milliseconds.
   * @param participant The participant to watch.
   * @throws {ArgumentOutOfRangeException} When the grace is not a positive integer.
   * @example
   * ```ts
   * import { type IIdleParticipant, IdleMonitor } from "@noldova/desktop.runtime";
   *
   * export function watch(participant: IIdleParticipant): IdleMonitor {
   *   const monitor = new IdleMonitor(30_000, participant);
   *   monitor.check();
   *   return monitor;
   * }
   * ```
   */
  public constructor(graceMilliseconds: number, participant: IIdleParticipant);

  /**
   * Starts the grace period when the participant is idle and none runs, or cancels it when the participant is busy.
   * @example
   * ```ts
   * import { type IIdleParticipant, IdleMonitor } from "@noldova/desktop.runtime";
   *
   * export function watch(participant: IIdleParticipant): IdleMonitor {
   *   const monitor = new IdleMonitor(30_000, participant);
   *   monitor.check();
   *   return monitor;
   * }
   * ```
   */
  public check(): void;

  /**
   * Cancels a running grace period and stops watching; later checks do nothing.
   */
  public [Symbol.dispose](): void;
}

/**
 * The runtime of one data directory: ownership, the shell's database, the endpoint, discovery, registries, work and idle shutdown.
 */
export declare class RuntimeHost implements IIdleParticipant {
  /**
   * The runtime's build identity.
   */
  public readonly identity: BuildIdentity;

  /**
   * The work in progress.
   */
  public readonly work: WorkTracker;

  /**
   * The registry requests are routed through; `desktop.stop` is registered, and `desktop.moveAside` when the runtime started refusing.
   */
  public readonly methods: MethodRegistry;

  /**
   * The commands the modules' runtime parts registered, which `desktop.commands`
   * lists and `desktop.runCommand` runs.
   */
  public readonly commands: CommandRegistry;

  /**
   * The runtime's notifications, which `desktop.notifications` lists and its event follows.
   */
  public readonly notifications: NotificationCenter;

  /**
   * The registry of events published to clients.
   */
  public readonly events: EventRegistry;

  /**
   * The build's modules: activated before discovery is published, or after
   * data from before the shell is moved aside; `desktop.modules` reports where
   * they stand, and they are deactivated when the runtime stops.
   */
  public readonly modules: ModuleHost;

  /**
   * The runtime's log, opened under ownership; its {@link RuntimeLog.diagnostics} stream receives the runtime's diagnostics, such as module failures.
   */
  public readonly log: RuntimeLog;

  private constructor();

  /**
   * Whether the runtime has no connection and no work in progress.
   */
  public get isIdle(): boolean;

  /**
   * The programs the runtime runs for its modules, in the order they started;
   * empty until the modules are activated.
   */
  public get programs(): readonly RunningProgram[];

  /**
   * Takes ownership, opens the shell's database, ends the programs an earlier runtime left running, listens and publishes discovery. When the directory holds data from before the shell, the runtime refuses instead: every handshake is answered with a {@link FailureCode.PreShellData} failure whose details give the location, and only `desktop.moveAside` and `desktop.stop` are served until it has moved the data aside and opened the database. Concurrent `desktop.moveAside` requests share one move, and a request after the move succeeds without moving anything.
   *
   * @param options How the runtime runs.
   * @param platform The platform, as in `process.platform`; Windows listens on loopback TCP, others on a socket in the discovery folder.
   * @param environment The environment the discovery folder's protection uses.
   * @param presence Looks up the processes of an update: the launch barrier's holder and the clients it stamps while
   * preparing; {@link ProcessPresence.create} for the platform.
   * @returns A promise of the running host.
   * @throws {DeclarationsFormatException} Rejected, before taking ownership, when the build's module declarations cannot be read.
   * @throws {DataDirectoryOwnedException} Rejected when another runtime owns the directory and has published its discovery file, or still owns it once the options' takeover time has passed.
   * @example
   * ```ts
   * import { ProcessPresence, RuntimeHost, RuntimeOptions } from "@noldova/desktop.runtime";
   *
   * export async function runAsync(entryArguments: readonly string[]): Promise<string> {
   *   const host = await RuntimeHost.startAsync(RuntimeOptions.parse(entryArguments), process.platform, process.env,
   *     ProcessPresence.create(process.platform));
   *   return host.waitForStopAsync();
   * }
   * ```
   */
  public static startAsync(options: RuntimeOptions, platform: string, environment: NodeJS.ProcessEnv, presence: ProcessPresence): Promise<RuntimeHost>;

  /**
   * Stops the runtime because it stayed idle.
   * @example
   * ```ts
   * import type { RuntimeHost } from "@noldova/desktop.runtime";
   *
   * export function stopAsIfIdle(host: RuntimeHost): void {
   *   host.handleIdle();
   * }
   * ```
   */
  public handleIdle(): void;

  /**
   * Stops the runtime: cancels work, ends connections, withdraws discovery, closes the database and releases ownership. Later calls do nothing.
   *
   * @param reason Why the runtime stops; {@link waitForStopAsync} resolves with it.
   * @example
   * ```ts
   * import type { RuntimeHost } from "@noldova/desktop.runtime";
   *
   * export function stopForUpdate(host: RuntimeHost): void {
   *   host.requestStop("update");
   * }
   * ```
   */
  public requestStop(reason: string): void;

  /**
   * Waits until the runtime has stopped.
   *
   * @returns A promise of the stop's reason, rejected with the error when stopping failed.
   * @example
   * ```ts
   * import { ProcessPresence, RuntimeHost, RuntimeOptions } from "@noldova/desktop.runtime";
   *
   * export async function runAsync(entryArguments: readonly string[]): Promise<string> {
   *   const host = await RuntimeHost.startAsync(RuntimeOptions.parse(entryArguments), process.platform, process.env,
   *     ProcessPresence.create(process.platform));
   *   return host.waitForStopAsync();
   * }
   * ```
   */
  public waitForStopAsync(): Promise<string>;
}

/**
 * What one module's runtime part may register and use; disposing it withdraws
 * everything registered through it, newest first.
 */
export declare class ModuleContext implements IRuntimePartContext, Disposable {
  /**
   * The module's folder in the data directory.
   */
  public readonly moduleFolder: string;

  /**
   * Creates the context.
   *
   * @param declaration The module's declaration.
   * @param dataDirectory The data directory.
   * @param methods The registry its methods join.
   * @param events The registry its events join.
   * @param commands The registry its commands join.
   * @param notifications The runtime's notifications, which its posts join.
   * @param notificationPolicy The rules its posts follow.
   * @param services The registry its services join.
   * @param tools The registry its tools join and its agent sessions call.
   * @param settings The shell's settings, which the module reads and writes
   * within its rights.
   * @param work The runtime's work in progress, which the module's work joins.
   * @param processes The runtime's programs, which the module's programs join.
   * @param diagnostics The runtime's log, which the module's lines join.
   * @param redactor Removes what a diagnostic must not show from the module's lines.
   * @param database The module's open database, when its runtime part declares migrations.
   * @param closures The listeners `onClientClosed` adds to; a list no server reports to by default.
   * @param webViews The web views its `webViews` reaches; a center no main
   * process reaches, so that every call fails as `Unavailable`, by default.
   * @param grants The file grants its `files` redeems; a table in the data
   * directory's staged folder that no main process grants to, by default.
   * @param dependencyStates Where its optional dependencies stand; none
   * active, by default.
   * @param secrets This machine's secret store, which its `secrets` reaches;
   * a store no main process reaches, so that every call fails as
   * `Unavailable`, by default.
   * @param appSurface The app's windows and shortcuts its `appWindows` and
   * `shortcuts` read; lists no main process reports to, so both stay empty,
   * by default.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   * import { homedir } from "node:os";
   *
   * import {
   *   CommandRegistry, DataDirectory, DiagnosticRedactor, EventRegistry, MethodRegistry, ModuleContext, ModuleDeclaration, NotificationCenter, NotificationPolicy,
   *   type ProcessSupervisor, ServiceRegistry, type SettingsService, ToolRegistry, WorkTracker
   * } from "@noldova/desktop.runtime";
   *
   * export function createContext(events: EventRegistry, settings: SettingsService, processes: ProcessSupervisor): ModuleContext {
   *   const notes = new ModuleDeclaration("notes", "0.0.1", "Notes", "Keeps notes.", new Map(), null, new Map());
   *   return new ModuleContext(
   *     notes, new DataDirectory("/home/person/.noldova/desktop"), new MethodRegistry(), events, new CommandRegistry(),
   *     new NotificationCenter(() => undefined, () => new Date(), randomUUID), new NotificationPolicy([notes], () => true), new ServiceRegistry(),
   *     new ToolRegistry(), settings, new WorkTracker(() => undefined), processes, process.stderr, new DiagnosticRedactor(homedir()));
   * }
   * ```
   */
  public constructor(
    declaration: ModuleDeclaration,
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    notificationPolicy: NotificationPolicy,
    services: ServiceRegistry,
    tools: ToolRegistry,
    settings: SettingsService,
    work: WorkTracker,
    processes: ProcessSupervisor,
    diagnostics: Writable,
    redactor: DiagnosticRedactor,
    database?: IModuleDatabase,
    closures?: ClientClosures,
    webViews?: WebViewCenter,
    grants?: FileGrantTable,
    dependencyStates?: DependencyStates,
    secrets?: ISecretBackend,
    appSurface?: AppSurface);

  /**
   * The module's id.
   */
  public get moduleId(): string;

  /**
   * The module's own database.
   *
   * @throws {ModuleDatabaseException} When the module's runtime part declares no migrations.
   */
  public get database(): IModuleDatabase;

  /**
   * The module's access to settings.
   */
  public readonly settings: IModuleSettings;

  /**
   * The module's lines in the runtime's log.
   */
  public readonly log: IModuleLog;

  /**
   * See {@link IRuntimePartContext.tools}.
   */
  public readonly tools: IToolsContext;

  /**
   * See {@link IRuntimePartContext.permissions}.
   */
  public readonly permissions: IPermissionsContext;

  /**
   * See {@link IRuntimePartContext.webViews}.
   */
  public readonly webViews: IRuntimeWebViews;

  /**
   * See {@link IRuntimePartContext.files}.
   */
  public readonly files: IRuntimeFiles;

  /**
   * See {@link IRuntimePartContext.secrets}.
   */
  public readonly secrets: IModuleSecrets;

  /**
   * See {@link IRuntimePartContext.appWindows}.
   */
  public readonly appWindows: IAppWindows;

  /**
   * See {@link IRuntimePartContext.shortcuts}.
   */
  public readonly shortcuts: IAppShortcuts;

  /**
   * See {@link IRuntimePartContext.getWorkFolderAsync}.
   *
   * @returns A promise of the module's folder in `work`, created when it is first asked for.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function prepareAsync(context: ModuleContext): Promise<string> {
   *   return context.getWorkFolderAsync();
   * }
   * ```
   */
  public getWorkFolderAsync(): Promise<string>;

  /**
   * See {@link IRuntimePartContext.beginWork}.
   *
   * @param description What the work is, as the person reads it.
   * @returns The work item.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import type { ModuleContext, WorkItem } from "@noldova/desktop.runtime";
   *
   * export function beginIndexing(context: ModuleContext): WorkItem {
   *   return context.beginWork("Indexing the project");
   * }
   * ```
   */
  public beginWork(description: string): WorkItem;

  /**
   * See {@link IRuntimePartContext.readEnvironmentAsync}.
   *
   * @returns A promise of the variables by name, which never rejects.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export async function readPathAsync(context: ModuleContext): Promise<string | undefined> {
   *   return (await context.readEnvironmentAsync())["PATH"];
   * }
   * ```
   */
  public readEnvironmentAsync(): Promise<Readonly<Record<string, string>>>;

  /**
   * See {@link IRuntimePartContext.startProcessAsync}.
   *
   * @param request The program to start.
   * @returns A promise of the running program.
   * @throws {ProcessStartException} Rejected when the program cannot start.
   * @example
   * ```ts
   * import { type ModuleContext, type OwnedProcess, ProcessRequest } from "@noldova/desktop.runtime";
   *
   * export function startStatusAsync(context: ModuleContext, project: string): Promise<OwnedProcess> {
   *   return context.startProcessAsync(new ProcessRequest("git", ["status"], project));
   * }
   * ```
   */
  public startProcessAsync(request: ProcessRequest): Promise<OwnedProcess>;

  /**
   * See {@link IRuntimePartContext.startPseudoTerminalAsync}.
   *
   * @param request The program to start in a pseudo-terminal.
   * @returns A promise of the running pseudo-terminal.
   * @throws {ProcessStartException} Rejected when the module does not
   * declare `pseudoTerminals` or the program cannot start.
   * @example
   * ```ts
   * import * as pty from "node-pty";
   *
   * import { type ModuleContext, type PseudoTerminal, PseudoTerminalRequest } from "@noldova/desktop.runtime";
   *
   * export function startShellAsync(context: ModuleContext, project: string, environment: Readonly<Record<string, string>>): Promise<PseudoTerminal> {
   *   return context.startPseudoTerminalAsync(new PseudoTerminalRequest(pty, "bash", [], project, 80, 24, environment));
   * }
   * ```
   */
  public startPseudoTerminalAsync(request: PseudoTerminalRequest): Promise<PseudoTerminal>;

  /**
   * See {@link IRuntimePartContext.registerMethod}.
   *
   * @param name The method's name.
   * @param handler Its handler.
   * @throws {RegistrationException} When the declaration does not contribute
   * the method or it is already registered.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function serve(context: ModuleContext): void {
   *   context.registerMethod("notes.list", { handleAsync: async () => [] });
   * }
   * ```
   */
  public registerMethod(name: string, handler: IMethodHandler): void;

  /**
   * See {@link IRuntimePartContext.declareEvent}.
   *
   * @param name The event's name.
   * @returns The event's channel.
   * @throws {RegistrationException} When the declaration does not contribute
   * the event or it is already declared.
   * @example
   * ```ts
   * import type { EventChannel, ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function announce(context: ModuleContext): EventChannel {
   *   return context.declareEvent("notes.changed");
   * }
   * ```
   */
  public declareEvent(name: string): EventChannel;

  /**
   * See {@link IRuntimePartContext.registerCommand}.
   *
   * @param command The command.
   * @throws {RegistrationException} When the declaration does not contribute
   * the command or it is already registered.
   * @example
   * ```ts
   * import { type ModuleContext, RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function serveTick(context: ModuleContext): void {
   *   context.registerCommand(new RuntimeCommand("clock.tick", "Tick", null, null, { handleAsync: async () => null }));
   * }
   * ```
   */
  public registerCommand(command: RuntimeCommand): void;

  /**
   * See {@link IRuntimePartContext.onClientClosed}.
   *
   * @param listener Hears each closure until the module deactivates.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function follow(context: ModuleContext, closed: number[]): void {
   *   context.onClientClosed(t => { closed.push(t.connection); });
   * }
   * ```
   */
  public onClientClosed(listener: (closure: ClientClosure) => void | Promise<void>): void;

  /**
   * See {@link IRuntimePartContext.postNotification}.
   *
   * @param post What to show.
   * @returns The notification's handle.
   * @throws {RegistrationException} When the declaration does not contribute the kind, or a command belongs to another
   * module that is not a dependency.
   * @example
   * ```ts
   * import type { ModuleContext, NotificationHandle } from "@noldova/desktop.runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export function announce(context: ModuleContext): NotificationHandle {
   *   return context.postNotification(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Saved", null, NotificationSeverity.Success, null, [], null));
   * }
   * ```
   */
  public postNotification(post: NotificationPost): NotificationHandle;

  /**
   * See {@link IRuntimePartContext.publishService}.
   *
   * @param name The service's name under the module's own id.
   * @param service The service.
   * @throws {RegistrationException} When the name has another owner or is
   * already published.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function publish(context: ModuleContext): void {
   *   context.publishService("notes.store", new Map<string, string>());
   * }
   * ```
   */
  public publishService(name: string, service: object): void;

  /**
   * See {@link IRuntimePartContext.getService}.
   *
   * @param name The service's name.
   * @param type The class the service is an instance of.
   * @returns The service.
   * @throws {ServiceAccessException} When the module may not use the service,
   * it is not published, or it is not an instance of the type.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function countTasks(context: ModuleContext): number {
   *   return context.getService("tasks.store", Map).size;
   * }
   * ```
   */
  public getService<T extends object>(name: string, type: abstract new (...args: never[]) => T): T;

  /**
   * See {@link IRuntimePartContext.findService}.
   *
   * @param name The service's name.
   * @param guard Tells whether what is published is the service expected.
   * @returns The service, or `null`.
   * @throws {ServiceAccessException} When the module may not use the service.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function findClock(context: ModuleContext): Map<string, string> | null {
   *   return context.findService("clock.zones", (t): t is Map<string, string> => t instanceof Map);
   * }
   * ```
   */
  public findService<T extends object>(name: string, guard: (service: object) => service is T): T | null;

  /**
   * See {@link IRuntimePartContext.onDependencyChanged}.
   *
   * @param listener Called with the optional dependency's id and whether it
   * is now active at the version the module needs.
   * @returns Stops the listener.
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function follow(context: ModuleContext): () => void {
   *   return context.onDependencyChanged((moduleId, isActive) => context.log.write(`${moduleId} is ${isActive ? "on" : "off"}.`));
   * }
   * ```
   */
  public onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void;

  /**
   * Withdraws everything registered through the context, newest first,
   * dismisses the module's notifications, and aborts and ends its work.
   *
   * @example
   * ```ts
   * import type { ModuleContext } from "@noldova/desktop.runtime";
   *
   * export function withdraw(context: ModuleContext): void {
   *   context[Symbol.dispose]();
   * }
   * ```
   */
  public [Symbol.dispose](): void;
}

/**
 * Reads the build's module declarations.
 */
export declare class ModuleDeclarationReader {
  /**
   * Locates the declarations file of the build whose installed runtime starts
   * from the given entry point.
   *
   * @param runtimeEntryPath The installed runtime's entry point.
   * @returns The build's `_build/modules/declarations.json`.
   * @example
   * ```ts
   * import { ModuleDeclarationReader, RuntimeEntry } from "@noldova/desktop.runtime";
   *
   * export const declarationsFile: string = ModuleDeclarationReader.locate(RuntimeEntry.entryPath);
   * ```
   */
  public static locate(runtimeEntryPath: string): string;

  /**
   * Reads the declarations file.
   *
   * @param file The file, as the build writes it.
   * @returns A promise of the declarations, in the build's order.
   * @throws {DeclarationsFormatException} Rejected when the file cannot be read,
   * is not JSON, has another format version or holds an invalid declaration;
   * the message names the file.
   * @example
   * ```ts
   * import { ModuleDeclarationReader, type ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function readAsync(file: string): Promise<readonly ModuleDeclaration[]> {
   *   return ModuleDeclarationReader.readAsync(file);
   * }
   * ```
   */
  public static readAsync(file: string): Promise<readonly ModuleDeclaration[]>;

  /**
   * Reads the app's Noldova Desktop version from the declarations file, which the
   * build writes there as the version of `@noldova/desktop.runtime` it
   * builds with.
   *
   * @param file The file, as the build writes it.
   * @returns A promise of the version, `<major>.<minor>.<patch>`, or `null`
   * when the file names none.
   * @throws {DeclarationsFormatException} Rejected as {@link readAsync} is,
   * and when the version is not of that form.
   * @example
   * ```ts
   * import { ModuleDeclarationReader } from "@noldova/desktop.runtime";
   *
   * export function readNoldovaDesktopAsync(file: string): Promise<string | null> {
   *   return ModuleDeclarationReader.readNoldovaDesktopAsync(file);
   * }
   * ```
   */
  public static readNoldovaDesktopAsync(file: string): Promise<string | null>;
}

/**
 * The shell's own commands that other processes run or bind, and the stop key's default.
 */
export declare class ShellCommands {
  /**
   * Stops all agent control, `desktop.stopAgentControl`.
   */
  public static readonly stopAgentControl: QualifiedName;

  /**
   * Resumes agent control after a stop, `desktop.resumeAgentControl`; only the app's main process, for its window and tray, runs it.
   */
  public static readonly resumeAgentControl: QualifiedName;

  /**
   * The stop command's default key, `Mod+Shift+Period`, which the person's `desktop.keyBindings` can change or remove.
   */
  public static readonly stopAgentControlKey: string;
}

/**
 * The shell's own settings: their names, and their definitions as the runtime declares them on a platform.
 */
export declare class ShellSettings {
  /**
   * The theme, `desktop.theme`.
   */
  public static readonly theme: QualifiedName;

  /**
   * Light, dark or the system's mode, `desktop.mode`.
   */
  public static readonly mode: QualifiedName;

  /**
   * The interface font, `desktop.interfaceFont`.
   */
  public static readonly interfaceFont: QualifiedName;

  /**
   * The code font, `desktop.codeFont`.
   */
  public static readonly codeFont: QualifiedName;

  /**
   * The panels' text size, `desktop.panelSize`.
   */
  public static readonly panelSize: QualifiedName;

  /**
   * The messages' text size, `desktop.messageSize`.
   */
  public static readonly messageSize: QualifiedName;

  /**
   * The code's text size, `desktop.codeSize`.
   */
  public static readonly codeSize: QualifiedName;

  /**
   * The left dock's style, `desktop.leftDockStyle`.
   */
  public static readonly leftDockStyle: QualifiedName;

  /**
   * The right dock's style, `desktop.rightDockStyle`.
   */
  public static readonly rightDockStyle: QualifiedName;

  /**
   * Where the menu bar shows, `desktop.menuBar`.
   */
  public static readonly menuBar: QualifiedName;

  /**
   * Whether opening a document previews it in a tab, `desktop.previewTabs`.
   */
  public static readonly previewTabs: QualifiedName;

  /**
   * Do not disturb, a device setting, `desktop.doNotDisturb`.
   */
  public static readonly doNotDisturb: QualifiedName;

  /**
   * The modules whose notifications are turned off, `desktop.mutedModules`.
   */
  public static readonly mutedModules: QualifiedName;

  /**
   * Whether the main process shows its tray icon, a device setting, `desktop.trayIcon`.
   */
  public static readonly trayIcon: QualifiedName;

  /**
   * The keys chosen for commands, `desktop.keyBindings`.
   */
  public static readonly keyBindings: QualifiedName;

  /**
   * How many recent commands command search lists first, `desktop.recentCommandCount`.
   */
  public static readonly recentCommandCount: QualifiedName;

  /**
   * Whether spelling is checked, `desktop.spellCheck`.
   */
  public static readonly spellCheck: QualifiedName;

  /**
   * The languages spelling is checked in, a device setting, `desktop.spellCheckLanguages`.
   */
  public static readonly spellCheckLanguages: QualifiedName;

  /**
   * When the main process checks for updates by itself, a device setting, `desktop.updateChecks`: `Automatic`, the default, `AtStart` or `OnRequest`.
   */
  public static readonly updateChecks: QualifiedName;

  /**
   * The pattern a time on its own shows in, `desktop.timeFormat`, `h:mm a` by
   * default, which `DatePattern` formats.
   */
  public static readonly timeFormat: QualifiedName;

  /**
   * The pattern a time shows in where the date matters,
   * `desktop.dateTimeFormat`, `MMM d, yyyy, h:mm a` by default, which
   * `DatePattern` formats.
   */
  public static readonly dateTimeFormat: QualifiedName;

  /**
   * The shell's setting definitions, in the order Settings shows them. The tray icon's title names the place the
   * platform shows it, the notification area on Windows, the menu bar on macOS and the tray elsewhere, and it is on
   * by default except on macOS.
   *
   * @param platform The runtime's platform, as `process.platform` names it.
   * @returns The definitions.
   * @example
   * ```ts
   * import type { SettingDefinition } from "@noldova/desktop.protocol";
   * import { ShellSettings } from "@noldova/desktop.runtime";
   *
   * export const definitions: readonly SettingDefinition[] = ShellSettings.definitionsFor(process.platform);
   * ```
   */
  public static definitionsFor(platform: string): readonly SettingDefinition[];
}

/**
 * The shell's settings: the definitions the shell and the modules declare,
 * and their values in the shell's database, per scope object and, for a
 * device setting, per device. A stored value that no longer fits its
 * definition is kept, ignored and reported once to the diagnostics.
 */
export declare class SettingsService {
  /**
   * Creates the service over an open shell database.
   *
   * @param database The shell's database, migrated with the shell's
   * migrations.
   * @param definitions Every setting's definition.
   * @param diagnostics Where an ignored stored value is reported.
   * @example
   * ```ts
   * import type { ShellDatabase } from "@noldova/desktop.runtime";
   * import { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function createSettings(database: ShellDatabase): SettingsService {
   *   return new SettingsService(database, [], process.stderr);
   * }
   * ```
   */
  public constructor(database: ShellDatabase, definitions: readonly SettingDefinition[], diagnostics: Writable);

  /**
   * Finds a setting's definition.
   *
   * @param name The setting's name.
   * @returns The definition.
   * @throws {SettingException} When no such setting is declared.
   * @example
   * ```ts
   * import { QualifiedName, type SettingDefinition } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function defineMode(settings: SettingsService): SettingDefinition {
   *   return settings.define(QualifiedName.parse("desktop.mode"));
   * }
   * ```
   */
  public define(name: QualifiedName): SettingDefinition;

  /**
   * Reads the value in effect for a key: the value set for its scope
   * object, else each enclosing scope's, else the application's, else the
   * default. A device setting reads the key's device, and its default when
   * the key names none.
   *
   * @param key Which value.
   * @returns The value in effect.
   * @throws {SettingException} When no such setting is declared, or the
   * setting does not list the key's scope.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import { QualifiedName, SettingKey } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function readMode(settings: SettingsService): JsonValue {
   *   return settings.read(new SettingKey(QualifiedName.parse("desktop.mode")));
   * }
   * ```
   */
  public read(key: SettingKey): JsonValue;

  /**
   * Reads the value in effect for a key as `read` does, and whether a value
   * is stored for the key itself. It validates the key as `write` does: a
   * device setting needs the key's device.
   *
   * @param key Which value.
   * @returns The setting's name, the value in effect and whether a value is
   * stored for the key, `false` when the value comes from an enclosing
   * scope, the application or the default.
   * @throws {SettingException} When no such setting is declared, the
   * setting does not list the key's scope, or a device setting's key names
   * no device.
   * @example
   * ```ts
   * import { QualifiedName, type SettingEntry, SettingKey, SettingScope } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function readMute(settings: SettingsService): SettingEntry {
   *   return settings.readEntry(new SettingKey(QualifiedName.parse("chat.muted"), new SettingScope(QualifiedName.parse("chat.conversation"), "c42")));
   * }
   * ```
   */
  public readEntry(key: SettingKey): SettingEntry;

  /**
   * Reads a device setting's application values on every device that set
   * one; a device without one is at the default.
   *
   * @param name The setting's name.
   * @returns The values by device.
   * @throws {SettingException} When no such setting is declared.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function readQuiet(settings: SettingsService): ReadonlyMap<string, JsonValue> {
   *   return settings.readDevices(QualifiedName.parse("desktop.doNotDisturb"));
   * }
   * ```
   */
  public readDevices(name: QualifiedName): ReadonlyMap<string, JsonValue>;

  /**
   * Describes every setting and its value for the application on a device.
   *
   * @param device The device whose device settings it gives, or `null` for
   * their defaults.
   * @returns The snapshot.
   * @example
   * ```ts
   * import type { SettingsSnapshot } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function describe(settings: SettingsService): SettingsSnapshot {
   *   return settings.snapshot(null);
   * }
   * ```
   */
  public snapshot(device: string | null): SettingsSnapshot;

  /**
   * Sets a value and tells the listeners. A shared setting ignores the
   * key's device.
   *
   * @param write The key and the value.
   * @throws {SettingException} When the setting is unknown, does not accept
   * the value or the scope, or is a device setting given no device or a
   * scope.
   * @example
   * ```ts
   * import { QualifiedName, SettingKey, SettingValue } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function darken(settings: SettingsService): void {
   *   settings.write(new SettingValue(new SettingKey(QualifiedName.parse("desktop.mode")), "Dark"));
   * }
   * ```
   */
  public write(write: SettingValue): void;

  /**
   * Removes a value, so the enclosing value or the default takes effect,
   * and tells the listeners the value now in effect.
   *
   * @param key Which value.
   * @throws {SettingException} As `write` does.
   * @example
   * ```ts
   * import { QualifiedName, SettingKey } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function restore(settings: SettingsService): void {
   *   settings.reset(new SettingKey(QualifiedName.parse("desktop.mode")));
   * }
   * ```
   */
  public reset(key: SettingKey): void;

  /**
   * Records which scope object encloses another, or that none does.
   *
   * @param scope The enclosed object.
   * @param parent The enclosing object, or `null` for the application.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function release(settings: SettingsService): void {
   *   settings.setScopeParent(new SettingScope(QualifiedName.parse("chat.conversation"), "c42"), null);
   * }
   * ```
   */
  public setScopeParent(scope: SettingScope, parent: SettingScope | null): void;

  /**
   * Removes a scope object's values and its enclosure, in one transaction.
   *
   * @param scope The object.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function forget(settings: SettingsService): void {
   *   settings.removeScope(new SettingScope(QualifiedName.parse("chat.conversation"), "c42"));
   * }
   * ```
   */
  public removeScope(scope: SettingScope): void;

  /**
   * Follows every change: each value set or reset, with the value then in
   * effect for its key, after the change commits.
   *
   * @param listener Called for each change.
   * @returns What stops the listener when disposed.
   * @example
   * ```ts
   * import type { SettingsService } from "@noldova/desktop.runtime";
   *
   * export function watch(settings: SettingsService, report: (name: string) => void): Disposable {
   *   return settings.onChanged(t => report(t.key.name.text));
   * }
   * ```
   */
  public onChanged(listener: (change: SettingChange) => void): Disposable;
}

/**
 * Where the modules a module optionally depends on stand, for its context:
 * whether each is available to it, and who listens for a change.
 */
export declare class DependencyStates {
  /**
   * Creates the states.
   *
   * @param readStatus Reads a module's status by id; `undefined` for a module
   * the app doesn't include or that hasn't activated yet.
   * @example
   * ```ts
   * import { DependencyStates } from "@noldova/desktop.runtime";
   *
   * export const none: DependencyStates = new DependencyStates(() => undefined);
   * ```
   */
  public constructor(readStatus: (moduleId: string) => ModuleStatus | undefined);

  /**
   * Whether a dependency is active at the version the module needs.
   *
   * @param declaration The module's declaration.
   * @param dependency The dependency's id.
   * @returns True when it is active at that version.
   * @example
   * ```ts
   * import type { DependencyStates, ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function hasClock(states: DependencyStates, notes: ModuleDeclaration): boolean {
   *   return states.isAvailable(notes, "clock");
   * }
   * ```
   */
  public isAvailable(declaration: ModuleDeclaration, dependency: string): boolean;

  /**
   * Listens, for a module, for its optional dependencies changing.
   *
   * @param declaration The module's declaration.
   * @param listener Called with the dependency's id and whether it is now
   * available to the module.
   * @returns Stops the listener.
   * @example
   * ```ts
   * import type { DependencyStates, ModuleDeclaration } from "@noldova/desktop.runtime";
   *
   * export function follow(states: DependencyStates, notes: ModuleDeclaration, changed: (moduleId: string, isActive: boolean) => void): () => void {
   *   return states.listen(notes, changed);
   * }
   * ```
   */
  public listen(declaration: ModuleDeclaration, listener: (moduleId: string, isActive: boolean) => void): () => void;

  /**
   * Tells the modules that optionally depend on a module that its state
   * changed; each listener gets whether it is now available to its module.
   *
   * @param moduleId The module whose state changed.
   * @example
   * ```ts
   * import type { DependencyStates } from "@noldova/desktop.runtime";
   *
   * export function clockChanged(states: DependencyStates): void {
   *   states.announce("clock");
   * }
   * ```
   */
  public announce(moduleId: string): void;
}

/**
 * Runs the build's modules in the runtime: it activates them after their
 * dependencies, records where each stands and deactivates them in reverse.
 */
export declare class ModuleHost {
  /**
   * The services the modules publish.
   */
  public readonly services: ServiceRegistry;

  /**
   * The rules notifications follow: a kind its module declares, a module that is active for a window's post, and commands
   * that are the module's own or a dependency's.
   */
  public readonly notificationPolicy: NotificationPolicy;

  /**
   * The tool registry every module's runtime part shares.
   */
  public readonly tools: ToolRegistry;

  /**
   * Creates the host.
   *
   * @param declarations The build's module declarations.
   * @param dataDirectory The data directory.
   * @param methods The registry the modules' methods join.
   * @param events The registry the modules' events join.
   * @param commands The registry the modules' commands join.
   * @param notifications The runtime's notifications; a module's are dismissed when it deactivates.
   * @param loader Loads runtime parts.
   * @param diagnostics Receives the full error of each part that cannot be
   * loaded, activated or deactivated, which the module statuses leave out,
   * and the lines the modules log.
   * @param work The runtime's work in progress; a module's is aborted and ended when it deactivates.
   * @param redactor Removes what a diagnostic must not show from the lines the modules log.
   * @param closures The listeners every module's `onClientClosed` adds to, which the runtime's server reports to; a list
   * no server reports to by default.
   * @param webViews The web views every module's `webViews` reaches, which the
   * runtime connects to its main process; a center no main process reaches,
   * so that every call fails as `Unavailable`, by default.
   * @param permissions Carries the tools' permission requests; a center that names no permissions module, so that every
   * request is denied, by default.
   * @param grants The file grants every module's `files` redeems, which the runtime's main process grants to; a table
   * in the data directory's staged folder that no main process grants to, by default.
   * @param secrets This machine's secret store, which every module's `secrets` reaches and the runtime connects to its
   * main process; a store no main process reaches, so that every call fails as `Unavailable`, by default.
   * @param appSurface The app's windows and shortcuts every module's `appWindows` and `shortcuts` read, which the
   * runtime's main process reports to; lists no main process reports to, so both stay empty, by default.
   * @param platform The platform the app runs on, as Node.js names it; a module whose `platforms` don't name it is
   * unavailable, starts no part and offers no setting. The current process's platform by default.
   * @param noldovaDesktop The app's Noldova Desktop version, as
   * {@link ModuleDeclarationReader.readNoldovaDesktopAsync} reads it; a module whose
   * `noldovaDesktop` doesn't accept it fails before any of its code runs, with a
   * cause that names both, and the modules that depend on it are blocked. `null`
   * by default, which only a module that names no `noldovaDesktop` accepts.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   * import { homedir } from "node:os";
   *
   * import {
   *   CommandRegistry, DataDirectory, DiagnosticRedactor, type EventRegistry, MethodRegistry, ModuleHost, NotificationCenter, PackageRuntimePartLoader, WorkTracker
   * } from "@noldova/desktop.runtime";
   *
   * export function createHost(events: EventRegistry): ModuleHost {
   *   return new ModuleHost(
   *     [], new DataDirectory("/home/person/.noldova/desktop"), new MethodRegistry(), events, new CommandRegistry(),
   *     new NotificationCenter(() => undefined, () => new Date(), randomUUID), new PackageRuntimePartLoader(), process.stderr,
   *     new WorkTracker(() => undefined), new DiagnosticRedactor(homedir()));
   * }
   * ```
   */
  public constructor(
    declarations: readonly ModuleDeclaration[],
    dataDirectory: DataDirectory,
    methods: MethodRegistry,
    events: EventRegistry,
    commands: CommandRegistry,
    notifications: NotificationCenter,
    loader: IRuntimePartLoader,
    diagnostics: Writable,
    work: WorkTracker,
    redactor: DiagnosticRedactor,
    closures?: ClientClosures,
    webViews?: WebViewCenter,
    permissions?: PermissionCenter,
    grants?: FileGrantTable,
    secrets?: ISecretBackend,
    appSurface?: AppSurface,
    platform?: string,
    noldovaDesktop?: string | null);

  /**
   * Where every module stands, in activation order, as `desktop.modules`
   * answers. A module is active when its runtime part, if any, and all its
   * dependencies activated; failed when its part could not be loaded or
   * failed to activate; blocked when a dependency is not active, is off or
   * is unavailable, which its cause names; off while its switch setting is
   * `false`; unavailable when its `platforms` don't name the platform, with
   * no switch setting. Causes are safe to show and hold no error text.
   */
  public get report(): ModuleStatusList;

  /**
   * Resolves once every change of a switch setting heard so far has turned
   * its module off or on. Changes run one at a time, in the order they come;
   * each reads the setting's value when it runs, so changes in a row settle on
   * the value the setting ends with.
   *
   * @example
   * ```ts
   * import type { ModuleHost } from "@noldova/desktop.runtime";
   *
   * export async function settledAsync(host: ModuleHost): Promise<number> {
   *   await host.switching;
   *   return host.report.modules.length;
   * }
   * ```
   */
  public get switching(): Promise<void>;

  /**
   * Activates the modules once, each after the modules it depends on; a
   * dependency the build does not include or a cycle blocks the modules that
   * need it. A part that fails to activate has the programs it started
   * ended. A module whose switch setting is `false` stays off, and is neither
   * loaded nor migrated.
   *
   * It then follows the switch settings. When one turns to `false`, the
   * module and every active module that needs it deactivate, dependents
   * first, as `deactivateAsync` does, and a method call in flight to one of
   * them sees its signal abort; the module is off and those dependents are
   * blocked. When one turns to `true`, the module activates, then each
   * module it alone blocked, in dependency order. No other module restarts.
   * After each change, the modules that name a changed module as an optional
   * dependency hear it, and `desktop.modulesChanged` carries the report.
   *
   * @param settings The shell's settings, which the modules read and write.
   * @param processes The runtime's programs, which the modules' programs join.
   * @returns A promise that resolves once every module is active, failed or
   * blocked.
   * @example
   * ```ts
   * import type { ModuleHost, ProcessSupervisor, SettingsService } from "@noldova/desktop.runtime";
   *
   * export async function startAsync(host: ModuleHost, settings: SettingsService, processes: ProcessSupervisor): Promise<number> {
   *   await host.activateAsync(settings, processes);
   *   return host.report.modules.length;
   * }
   * ```
   */
  public activateAsync(settings: SettingsService, processes: ProcessSupervisor): Promise<void>;

  /**
   * The definitions of the settings every declared module declares, in
   * module order, leaving out an unavailable module's.
   *
   * @example
   * ```ts
   * import type { SettingDefinition } from "@noldova/desktop.protocol";
   * import type { ModuleHost } from "@noldova/desktop.runtime";
   *
   * export function listSettings(host: ModuleHost): readonly SettingDefinition[] {
   *   return host.settingDefinitions;
   * }
   * ```
   */
  public get settingDefinitions(): readonly SettingDefinition[];

  /**
   * Stops following the switch settings, waits for a change already running,
   * then deactivates the active runtime parts in reverse order. Once a part is
   * deactivated, even when its deactivation fails, the programs it started
   * end, without holding up the next part, so the programs of every part end
   * together; then what it registered is withdrawn.
   *
   * @returns A promise that resolves once every part is deactivated and its programs ended.
   * @throws {AggregateError} Rejected after all parts are deactivated and
   * their programs ended when one or more parts failed to deactivate or to
   * end their programs; it holds their errors.
   * @example
   * ```ts
   * import type { ModuleHost } from "@noldova/desktop.runtime";
   *
   * export function stopAsync(host: ModuleHost): Promise<void> {
   *   return host.deactivateAsync();
   * }
   * ```
   */
  public deactivateAsync(): Promise<void>;
}

/**
 * Loads a module's runtime part by importing its installed package.
 */
export declare class PackageRuntimePartLoader implements IRuntimePartLoader {
  /**
   * Imports the package and constructs its `RuntimePart` without arguments.
   *
   * @param packageName The module's runtime package.
   * @returns A promise of the part.
   * @throws {ModuleLoadException} Rejected when the package exports no
   * `RuntimePart` class whose instances have `activateAsync` and
   * `deactivateAsync`; an import failure rejects as it is.
   * @example
   * ```ts
   * import { PackageRuntimePartLoader, type IRuntimePart } from "@noldova/desktop.runtime";
   *
   * export function loadNotesAsync(): Promise<IRuntimePart> {
   *   return new PackageRuntimePartLoader().loadAsync("@noldova/desktop.notes.runtime");
   * }
   * ```
   */
  public loadAsync(packageName: string): Promise<IRuntimePart>;
}

/**
 * The services modules publish, by name.
 */
export declare class ServiceRegistry {
  /**
   * Publishes a service.
   *
   * @param name The service's qualified name.
   * @param service The service.
   * @returns The registration; disposing it withdraws the service.
   * @throws {RegistrationException} When the name is published.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { Registration, ServiceRegistry } from "@noldova/desktop.runtime";
   *
   * export function publish(services: ServiceRegistry): Registration {
   *   return services.publish(new QualifiedName("notes", "store"), new Map<string, string>());
   * }
   * ```
   */
  public publish(name: QualifiedName, service: object): Registration;

  /**
   * Finds a service.
   *
   * @param name The service's qualified name.
   * @returns The service, or `undefined` when none is published.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { ServiceRegistry } from "@noldova/desktop.runtime";
   *
   * export function isPublished(services: ServiceRegistry): boolean {
   *   return services.find(new QualifiedName("notes", "store")) !== undefined;
   * }
   * ```
   */
  public find(name: QualifiedName): object | undefined;
}

/**
 * Routes requests to the handlers registered for their methods.
 */
export declare class MethodRegistry {
  /**
   * Registers a handler.
   *
   * @param name The method's qualified name.
   * @param handler Its handler.
   * @returns The registration; disposing it removes the handler.
   * @throws {RegistrationException} When the name is registered.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { MethodRegistry, Registration } from "@noldova/desktop.runtime";
   *
   * export function serveEcho(methods: MethodRegistry): Registration {
   *   return methods.register(new QualifiedName("notes", "echo"), { handleAsync: context => Promise.resolve(context.payload) });
   * }
   * ```
   */
  public register(name: QualifiedName, handler: IMethodHandler): Registration;

  /**
   * Finds a method's handler.
   *
   * @param name The method's qualified name.
   * @returns The handler, or `undefined` when none is registered.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { MethodRegistry } from "@noldova/desktop.runtime";
   *
   * export function isServed(methods: MethodRegistry): boolean {
   *   return methods.find(new QualifiedName("notes", "open")) !== undefined;
   * }
   * ```
   */
  public find(name: QualifiedName): IMethodHandler | undefined;
}

/**
 * A command a runtime part registers: its title, icon and default key, which
 * windows show and bind, and the handler that runs it. The handler receives
 * the command's arguments as the request context's payload.
 */
export declare class RuntimeCommand {
  /**
   * Runs the command.
   */
  public readonly handler: IMethodHandler;

  /**
   * The only client kind that may run the command, or `null` for any.
   * `desktop.commands` leaves the command out of every other client's list.
   */
  public readonly onlyFor: string | null;

  /**
   * Creates the command, enabled.
   *
   * @param name The command's name, `<module id>.<name>`.
   * @param title What menus and search show; not whitespace only.
   * @param icon A Material Symbols name, not whitespace only, or `null`.
   * @param defaultKey The key the command asks for, such as `Mod+Alt+T`, or
   * `null`; see `KeyChord.parseDefault` for the keys a default may use.
   * @param handler Runs the command.
   * @param isChecked Whether the command starts checked, which makes it a
   * checkbox or radio row in menus, or `null`, the default, for a command
   * that is never checked.
   * @param onlyFor The only client kind that may run the command, such as
   * `ShellClients.mainProcess`, or `null`, the default, for any. The handler
   * still checks its request's client; this keeps the command out of other
   * clients' lists.
   * @throws {ArgumentException} When the name, title, icon or default key is
   * invalid; the parameter names which.
   * @example
   * ```ts
   * import { RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export const tick: RuntimeCommand = new RuntimeCommand("clock.tick", "Tick", "timer", "Mod+Alt+T", { handleAsync: async context => context.payload });
   * export const pause: RuntimeCommand = new RuntimeCommand("clock.pause", "Pause", null, null, { handleAsync: async () => null }, false);
   * ```
   */
  public constructor(name: string, title: string, icon: string | null, defaultKey: string | null, handler: IMethodHandler, isChecked?: boolean | null,
    onlyFor?: string | null);

  /**
   * The command's name, title, icon, default key and state, as
   * `desktop.commands` reports them. The state is one for all arguments.
   */
  public get info(): CommandInfo;

  /**
   * Enables or disables the command. A disabled command's menu rows are
   * disabled, command search leaves it out, its key is left alone and
   * `desktop.runCommand` refuses it. Windows follow the change through
   * `desktop.commandsChanged`; setting the state it has changes nothing.
   *
   * @param isEnabled Whether the command can run.
   * @example
   * ```ts
   * import type { RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function pauseTicks(tick: RuntimeCommand): void {
   *   tick.setEnabled(false);
   * }
   * ```
   */
  public setEnabled(isEnabled: boolean): void;

  /**
   * Follows the command's state: the listener is called after each change.
   *
   * @param listener Called after the command is enabled or disabled.
   * @returns The registration; disposing it stops the listener.
   * @example
   * ```ts
   * import type { Registration, RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function watch(command: RuntimeCommand, report: (isEnabled: boolean) => void): Registration {
   *   return command.onChanged(() => report(command.info.isEnabled));
   * }
   * ```
   */
  public onChanged(listener: () => void): Registration;
}

/**
 * A posted notification as its runtime part holds it.
 */
export declare class NotificationHandle {
  /**
   * The notification's id, which no other notification has, in this run of the runtime or any other.
   */
  public readonly id: string;

  /**
   * Creates the handle.
   *
   * @param id The notification's id.
   * @param change Replaces the notification's post and returns whether the notification was still there.
   * @param remove Dismisses the notification.
   * @example
   * ```ts
   * import { NotificationHandle } from "@noldova/desktop.runtime";
   *
   * export const handle: NotificationHandle = new NotificationHandle(crypto.randomUUID(), () => true, () => undefined);
   * ```
   */
  public constructor(id: string, change: (post: NotificationPost) => boolean, remove: () => void);

  /**
   * Replaces the notification's post, keeping its place, time and whether it was read; the kind stays the same.
   *
   * @param post The new post.
   * @returns Whether the notification was still there. False means it is gone: the person dismissed it, it was cleared, or
   * it was dropped from a full list; the part posts it again when it still matters.
   * @throws {RegistrationException} When the post's kind or commands are not allowed, or its kind differs.
   * @example
   * ```ts
   * import type { NotificationHandle } from "@noldova/desktop.runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export function finish(handle: NotificationHandle): boolean {
   *   return handle.update(new NotificationPost(QualifiedName.parse("clock.sync"), null, "Synced", null, NotificationSeverity.Success, null, [], 1));
   * }
   * ```
   */
  public update(post: NotificationPost): boolean;

  /**
   * Dismisses the notification; dismissing it again does nothing.
   *
   * @example
   * ```ts
   * import type { NotificationHandle } from "@noldova/desktop.runtime";
   *
   * export function withdraw(handle: NotificationHandle): void {
   *   handle.dismiss();
   * }
   * ```
   */
  public dismiss(): void;
}

/**
 * The runtime's notifications, newest first, for the runtime's life. It keeps at most 100, dropping the oldest that report
 * no work in progress, and reports every change.
 */
export declare class NotificationCenter {
  /**
   * Creates the center.
   *
   * @param publish Receives the whole list after every change.
   * @param now The clock that times new posts.
   * @param createId Creates the id of each new notification, one that no notification had before, such as `randomUUID`.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   *
   * import { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export const notifications: NotificationCenter = new NotificationCenter(t => console.log(t.notifications.length), () => new Date(), randomUUID);
   * ```
   */
  public constructor(publish: (list: NotificationList) => void, now: () => Date, createId: () => string);

  /**
   * The notifications, newest first.
   */
  public get list(): NotificationList;

  /**
   * The sequence of the latest post, or 0 before any. Each post and re-post takes the next number; an update keeps it.
   */
  public get sequence(): number;

  /**
   * Finds a notification by its id.
   *
   * @param id The notification's id.
   * @returns The notification, or `undefined` when it is gone.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export function isPosted(notifications: NotificationCenter, id: string): boolean {
   *   return notifications.find(id) !== undefined;
   * }
   * ```
   */
  public find(id: string): Notification | undefined;

  /**
   * Adds a notification at the top, unread, with a new id and the next sequence. One with the same kind and key is replaced
   * and keeps its id.
   *
   * @param post What was posted, already allowed.
   * @returns The notification's id.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export function announce(notifications: NotificationCenter): string {
   *   return notifications.post(new NotificationPost(QualifiedName.parse("clock.alarm"), "morning", "Alarm", null, NotificationSeverity.Info, null, [], null));
   * }
   * ```
   */
  public post(post: NotificationPost): string;

  /**
   * Replaces a notification's post, keeping its place, sequence, time and whether it was read.
   *
   * @param id The notification's id.
   * @param post The new post, already allowed.
   * @returns Whether the notification was there.
   * @throws {RegistrationException} When the post's kind differs from the notification's.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   * import type { NotificationPost } from "@noldova/desktop.protocol";
   *
   * export function change(notifications: NotificationCenter, id: string, post: NotificationPost): boolean {
   *   return notifications.update(id, post);
   * }
   * ```
   */
  public update(id: string, post: NotificationPost): boolean;

  /**
   * Reports the list again unchanged, for a change the list does not hold, such as a device's Do not disturb.
   *
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export function announceQuiet(notifications: NotificationCenter): void {
   *   notifications.republish();
   * }
   * ```
   */
  public republish(): void;

  /**
   * Marks every notification read; nothing is reported when all already were.
   *
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export function open(notifications: NotificationCenter): void {
   *   notifications.markAllRead();
   * }
   * ```
   */
  public markAllRead(): void;

  /**
   * Removes every notification that reports no work in progress; those still in progress stay, because their modules update
   * them.
   *
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export function clearAll(notifications: NotificationCenter): void {
   *   notifications.clearFinished();
   * }
   * ```
   */
  public clearFinished(): void;

  /**
   * Removes a notification; one that is gone is ignored.
   *
   * @param id The notification's id.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export function remove(notifications: NotificationCenter, id: string): void {
   *   notifications.dismiss(id);
   * }
   * ```
   */
  public dismiss(id: string): void;

  /**
   * Removes every notification of a module's kinds.
   *
   * @param moduleId The module's id.
   * @example
   * ```ts
   * import type { NotificationCenter } from "@noldova/desktop.runtime";
   *
   * export function clear(notifications: NotificationCenter): void {
   *   notifications.dismissOwnedBy("clock");
   * }
   * ```
   */
  public dismissOwnedBy(moduleId: string): void;
}

/**
 * The notification settings in effect: which devices have Do not disturb on and which modules are muted. Before the
 * shell's database is open there are no settings, and it reports none.
 */
export declare class NotificationSettings {
  /**
   * Creates it over the settings.
   *
   * @param settings The shell's settings, or `null` while the shell's database is not open.
   * @example
   * ```ts
   * import { NotificationSettings } from "@noldova/desktop.runtime";
   *
   * export const none: NotificationSettings = new NotificationSettings(null);
   * ```
   */
  public constructor(settings: SettingsService | null);

  /**
   * The devices with `desktop.doNotDisturb` stored as on, sorted.
   */
  public get quietDevices(): readonly string[];

  /**
   * The modules `desktop.mutedModules` names, which still post into the list but show no toast or operating system
   * notification.
   */
  public get mutedModules(): readonly string[];

  /**
   * Tells whether Do not disturb is on for a device.
   *
   * @param device The device's id.
   * @returns `true` when the device's `desktop.doNotDisturb` is on.
   * @example
   * ```ts
   * import type { NotificationSettings } from "@noldova/desktop.runtime";
   *
   * export function shouldShow(settings: NotificationSettings, device: string): boolean {
   *   return !settings.isQuiet(device);
   * }
   * ```
   */
  public isQuiet(device: string): boolean;

  /**
   * Tells whether a setting changes the notification state, so the runtime republishes it.
   *
   * @param name The setting's name.
   * @returns `true` for `desktop.doNotDisturb` and `desktop.mutedModules`.
   * @example
   * ```ts
   * import type { NotificationSettings } from "@noldova/desktop.runtime";
   *
   * export function affectsNotifications(settings: NotificationSettings): boolean {
   *   return settings.isNotificationSetting("desktop.mutedModules");
   * }
   * ```
   */
  public isNotificationSetting(name: string): boolean;
}

/**
 * The rules a notification follows before the runtime holds it.
 */
export declare class NotificationPolicy {
  /**
   * Creates the policy.
   *
   * @param declarations The build's module declarations.
   * @param isActive Whether a module is active.
   * @example
   * ```ts
   * import { NotificationPolicy } from "@noldova/desktop.runtime";
   *
   * export const policy: NotificationPolicy = new NotificationPolicy([], () => true);
   * ```
   */
  public constructor(declarations: readonly ModuleDeclaration[], isActive: (moduleId: string) => boolean);

  /**
   * Checks a window's post: its kind's module is active and declares the kind, and its commands are that module's own
   * or a dependency's. A kind of the shell's own, from `ShellNotifications`, runs only the shell's commands, and
   * `desktop.saveFailed` and `desktop.saveUnfinished` run none.
   *
   * @param post The post.
   * @returns Why the post is refused, safe to show, or `null` when it is allowed.
   * @example
   * ```ts
   * import type { NotificationPolicy } from "@noldova/desktop.runtime";
   * import type { NotificationPost } from "@noldova/desktop.protocol";
   *
   * export function isAllowed(policy: NotificationPolicy, post: NotificationPost): boolean {
   *   return policy.findRefusal(post) === null;
   * }
   * ```
   */
  public findRefusal(post: NotificationPost): string | null;

  /**
   * Checks a runtime part's post: the declaration contributes its kind, and its commands are the module's own or a
   * dependency's.
   *
   * @param declaration The posting module's declaration.
   * @param post The post.
   * @throws {RegistrationException} When either does not hold.
   * @example
   * ```ts
   * import type { ModuleDeclaration, NotificationPolicy } from "@noldova/desktop.runtime";
   * import type { NotificationPost } from "@noldova/desktop.protocol";
   *
   * export function check(policy: NotificationPolicy, clock: ModuleDeclaration, post: NotificationPost): void {
   *   policy.requireDeclared(clock, post);
   * }
   * ```
   */
  public requireDeclared(declaration: ModuleDeclaration, post: NotificationPost): void;
}

/**
 * The commands the runtime parts registered, in registration order.
 */
export declare class CommandRegistry {
  /**
   * Creates the registry.
   *
   * @param changed Receives the whole list after each registration, removal
   * and state change, each with the next sequence; nothing by default.
   * @example
   * ```ts
   * import { CommandRegistry, type EventChannel } from "@noldova/desktop.runtime";
   *
   * export function createCommands(changed: EventChannel): CommandRegistry {
   *   return new CommandRegistry(t => changed.publish(t.toJson()));
   * }
   * ```
   */
  public constructor(changed?: (list: CommandList) => void);

  /**
   * The registered commands and their state, in registration order, as
   * `desktop.commandsChanged` carries them; its sequence counts the changes
   * so far.
   */
  public get list(): CommandList;

  /**
   * The commands a client may run, and their state, in registration order,
   * as `desktop.commands` answers that client: every command but those
   * created only for another client. Its sequence is the whole list's.
   *
   * @param client The client's kind, as its handshake names it, such as
   * `ShellClients.mainProcess`.
   * @example
   * ```ts
   * import { type CommandList, ShellClients } from "@noldova/desktop.protocol";
   * import type { CommandRegistry } from "@noldova/desktop.runtime";
   *
   * export function listForTheApp(commands: CommandRegistry): CommandList {
   *   return commands.listFor(ShellClients.mainProcess);
   * }
   * ```
   */
  public listFor(client: string): CommandList;

  /**
   * Registers a command.
   *
   * @param command The command.
   * @returns The registration; disposing it removes the command.
   * @throws {RegistrationException} When a command with its name is
   * registered.
   * @example
   * ```ts
   * import { type CommandRegistry, type Registration, RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function serveTick(commands: CommandRegistry): Registration {
   *   return commands.register(new RuntimeCommand("clock.tick", "Tick", null, null, { handleAsync: async () => null }));
   * }
   * ```
   */
  public register(command: RuntimeCommand): Registration;

  /**
   * Finds a command.
   *
   * @param name The command's name.
   * @returns The command, or `undefined` when none is registered.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { CommandRegistry } from "@noldova/desktop.runtime";
   *
   * export function isRegistered(commands: CommandRegistry): boolean {
   *   return commands.find(QualifiedName.parse("clock.tick")) !== undefined;
   * }
   * ```
   */
  public find(name: QualifiedName): RuntimeCommand | undefined;
}

/**
 * Declares the events a runtime publishes.
 */
export declare class EventRegistry {
  /**
   * Creates the registry.
   *
   * @param sink Delivers published events.
   * @example
   * ```ts
   * import { EventRegistry, type RuntimeServer } from "@noldova/desktop.runtime";
   *
   * export function createEvents(server: RuntimeServer): EventRegistry {
   *   return new EventRegistry(server);
   * }
   * ```
   */
  public constructor(sink: IEventSink);

  /**
   * Declares an event.
   *
   * @param name The event's qualified name.
   * @returns The channel that publishes it; disposing it withdraws the event.
   * @throws {RegistrationException} When the name is declared.
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   * import type { EventRegistry } from "@noldova/desktop.runtime";
   *
   * export function announce(events: EventRegistry, path: string): void {
   *   const channel = events.declare(new QualifiedName("notes", "changed"));
   *   channel.publish({ path });
   *   channel[Symbol.dispose]();
   * }
   * ```
   */
  public declare(name: QualifiedName): EventChannel;
}

/**
 * The runtime process's entry.
 */
export declare class RuntimeEntry {
  /**
   * The entry script's path, to start the runtime with.
   */
  public static get entryPath(): string;

  /**
   * Runs the runtime until it stops.
   *
   * @param entryArguments The entry arguments, as {@link RuntimeOptions.parse} reads them.
   * @param platform The platform, as in `process.platform`.
   * @param environment The environment.
   * @param signals Emits `SIGINT`, `SIGTERM` and `SIGHUP`, which stop the runtime.
   * @param error Receives usage and failure messages, as does every module's console in the runtime's process. A failure of the stream, a write that throws, such as on a full disk or quota, or a later `error` event, such as a broken pipe, never ends the runtime: a write that throws fails like any other failed write, so the stream keeps no later write in memory.
   * @param responsibility On macOS, reads whether the runtime is its own
   * responsible process; once it has started, the runtime logs once why it is
   * not, when it is not. The runtime's POSIX addon on macOS by default, and
   * `null`, which logs nothing, elsewhere.
   * @returns A promise of the exit code: 0 after a stop, 1 when the runtime failed to start, 2 for invalid arguments and 3 when another runtime owns the directory.
   * @example
   * ```ts
   * import { RuntimeEntry } from "@noldova/desktop.runtime";
   *
   * export async function mainAsync(): Promise<void> {
   *   process.exitCode = await RuntimeEntry.runAsync(process.argv.slice(2), process.platform, process.env, process, process.stderr);
   * }
   * ```
   */
  public static runAsync(entryArguments: readonly string[], platform: string, environment: NodeJS.ProcessEnv, signals: EventEmitter, error: Writable,
    responsibility?: PosixResponsibilityApi | null): Promise<number>;

  /**
   * Sets the exit code a run ends with; a run that rejects is written to `error` and exits with 1. The entry
   * script settles its run this way instead of awaiting it at the top level, because a module's runtime part that
   * imports this package's values is loaded while the run is still going.
   *
   * @param run The run, as {@link RuntimeEntry.runAsync} returns it.
   * @param error Receives the rejection.
   * @param exit Receives the exit code, as `process` does.
   * @returns A promise that resolves once the exit code is set; it never rejects.
   * @example
   * ```ts
   * import { RuntimeEntry } from "@noldova/desktop.runtime";
   *
   * export function main(): void {
   *   void RuntimeEntry.settleAsync(RuntimeEntry.runAsync(process.argv.slice(2), process.platform, process.env, process, process.stderr), process.stderr, process);
   * }
   * ```
   */
  public static settleAsync(run: Promise<number>, error: Writable, exit: Pick<NodeJS.Process, "exitCode">): Promise<void>;
}

/**
 * Tracks the work in progress.
 */
export declare class WorkTracker {
  /**
   * Creates the tracker.
   *
   * @param changed Called whenever work begins or ends.
   * @example
   * ```ts
   * import { type IdleMonitor, WorkTracker } from "@noldova/desktop.runtime";
   *
   * export function createTracker(idle: IdleMonitor): WorkTracker {
   *   return new WorkTracker(() => idle.check());
   * }
   * ```
   */
  public constructor(changed: () => void);

  /**
   * Whether no work is in progress.
   */
  public get isEmpty(): boolean;

  /**
   * The descriptions of the work in progress, in the order it began.
   */
  public get descriptions(): readonly string[];

  /**
   * The work in progress as `desktop.work` reports it, with its sequence: how
   * many times work has begun or ended.
   */
  public get report(): WorkReport;

  /**
   * Begins work.
   *
   * @param description What the work is, as shown to the person.
   * @param owner The module whose work it is, or empty for the shell's own.
   * @returns The work item; disposing it ends the work.
   * @throws {ArgumentException} When the description is empty or whitespace.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/desktop.runtime";
   *
   * export async function indexAsync(work: WorkTracker, index: (signal: AbortSignal) => Promise<void>): Promise<void> {
   *   const item = work.begin("Indexing the project", "notes");
   *   try {
   *     await index(item.signal);
   *   }
   *   finally {
   *     item[Symbol.dispose]();
   *   }
   * }
   * ```
   */
  public begin(description: string, owner?: string): WorkItem;

  /**
   * Asks all work in progress to stop by aborting each item's signal.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/desktop.runtime";
   *
   * export function cancelEverything(work: WorkTracker): void {
   *   work.cancelAll();
   * }
   * ```
   */
  public cancelAll(): void;

  /**
   * Aborts and ends every item a module owns, as its runtime part
   * deactivates.
   *
   * @param owner The module's id.
   * @example
   * ```ts
   * import type { WorkTracker } from "@noldova/desktop.runtime";
   *
   * export function endNotesWork(work: WorkTracker): void {
   *   work.endOwnedBy("notes");
   * }
   * ```
   */
  public endOwnedBy(owner: string): void;
}

/**
 * The clock the runtime times its programs' starts with, and the boot it
 * runs in. On Linux the clock counts from boot, as the process table does
 * there, and the boot is the kernel's boot id; elsewhere the clock is the
 * wall clock, as the process table's start times are, and the boot is when
 * the system started, in seconds. On Linux a change of the wall clock does
 * not affect the clock; elsewhere a record notes the clock's offset, which
 * shows a later change.
 */
export declare class ProcessClock {
  /**
   * The boot the clock runs in.
   */
  public readonly boot: string;

  /**
   * Creates the clock.
   *
   * @param boot The boot the clock runs in.
   * @param isBootRelative Whether the clock counts from boot, which makes
   * the boot an exact id; otherwise it is a time in seconds compared within
   * a minute.
   * @example
   * ```ts
   * import { ProcessClock } from "@noldova/desktop.runtime";
   *
   * export function createLinuxClock(bootId: string): ProcessClock {
   *   return new ProcessClock(bootId, true);
   * }
   * ```
   */
  public constructor(boot: string, isBootRelative: boolean);

  /**
   * Creates the clock for a platform.
   *
   * @param platform The platform, as in `process.platform`.
   * @param bootIdFile The file that holds the kernel's boot id on Linux;
   * `/proc/sys/kernel/random/boot_id` by default.
   * @returns The clock.
   * @throws {Error} On Linux, when the boot id file cannot be read.
   * @example
   * ```ts
   * import { ProcessClock } from "@noldova/desktop.runtime";
   *
   * export function createClock(): ProcessClock {
   *   return ProcessClock.create(process.platform);
   * }
   * ```
   */
  public static create(platform: string, bootIdFile?: string): ProcessClock;

  /**
   * Reads the clock.
   *
   * @returns The time in milliseconds.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/desktop.runtime";
   *
   * export function elapsed(clock: ProcessClock, since: number): number {
   *   return clock.now() - since;
   * }
   * ```
   */
  public now(): number;

  /**
   * Reads how far the wall clock is from the time since boot.
   *
   * @returns The offset in milliseconds; always 0 for a clock that counts
   * from boot.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/desktop.runtime";
   *
   * export function noteOffset(clock: ProcessClock): number {
   *   return clock.offset();
   * }
   * ```
   */
  public offset(): number;

  /**
   * Whether the wall clock was changed since a recorded offset, by more than
   * 1.5 seconds against the time since boot.
   *
   * @param offset The recorded offset.
   * @returns Whether the times recorded with the offset can no longer be
   * compared with this clock's.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/desktop.runtime";
   *
   * export function isComparable(clock: ProcessClock, offset: number): boolean {
   *   return !clock.hasStepped(offset);
   * }
   * ```
   */
  public hasStepped(offset: number): boolean;

  /**
   * Whether a recorded boot is this clock's.
   *
   * @param boot The recorded boot.
   * @returns Whether it is the same boot.
   * @example
   * ```ts
   * import type { ProcessClock } from "@noldova/desktop.runtime";
   *
   * export function isCurrent(clock: ProcessClock, boot: string): boolean {
   *   return clock.isSameBoot(boot);
   * }
   * ```
   */
  public isSameBoot(boot: string): boolean;
}

/**
 * Starts, records and ends the programs the runtime runs for its modules. On
 * Windows a program's tree is found in the process table; elsewhere each
 * program leads its own process group. Each program's record in the shell's
 * database lets the next runtime end what a crashed one left running; while
 * the program runs, the record's time it was last seen running is renewed at
 * the settings' interval.
 */
export declare class ProcessSupervisor {
  /**
   * Creates the supervisor.
   *
   * @param database The shell's database, which holds the records.
   * @param platform The platform, as in `process.platform`.
   * @param environment The runtime's environment, which programs inherit from.
   * @param posix Lists the process table on macOS and Linux.
   * {@link ProcessSupervisor.create} passes the runtime's POSIX addon.
   * @param diagnostics The runtime's log, which receives the programs that
   * had to be killed or could not be ended.
   * @param windows The system calls the supervisor makes on Windows to read
   * the process table and end processes. {@link ProcessSupervisor.create}
   * passes the system's own functions, called through the runtime's Windows
   * addon.
   * @param settings How long programs may take to end.
   * @param clock The clock that times programs' starts and names the boot;
   * {@link ProcessClock.create} for the platform this process runs on by
   * default.
   * @example
   * ```ts
   * import { type IWindowsProcessApi, PosixProcessApi, ProcessSettings, ProcessSupervisor, type ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function createSupervisor(database: ShellDatabase, windows: IWindowsProcessApi): ProcessSupervisor {
   *   return new ProcessSupervisor(database, process.platform, process.env, PosixProcessApi.create(process.platform), process.stderr, windows, new ProcessSettings());
   * }
   * ```
   */
  public constructor(
    database: ShellDatabase,
    platform: string,
    environment: NodeJS.ProcessEnv,
    posix: IPosixProcessTableApi,
    diagnostics: Writable,
    windows: IWindowsProcessApi,
    settings?: ProcessSettings,
    clock?: ProcessClock);

  /**
   * Creates the supervisor the runtime runs with, which reads the process
   * table through the runtime's POSIX addon on macOS and Linux, and on
   * Windows reads it and ends processes through the system's own functions,
   * called through the runtime's Windows addon. Each addon loads at its first
   * use, and a call throws an {@link AddonLoadException} when it cannot load
   * or returns a value this runtime does not expect.
   *
   * @param database The shell's database, which holds the records.
   * @param platform The platform, as in `process.platform`.
   * @param environment The runtime's environment, which programs inherit from.
   * @param diagnostics The runtime's log, which receives the programs that
   * had to be killed or could not be ended.
   * @param settings How long programs may take to end.
   * @param clock The clock that times programs' starts and names the boot;
   * {@link ProcessClock.create} for the platform this process runs on by
   * default.
   * @returns The supervisor.
   * @example
   * ```ts
   * import { ProcessSupervisor, type ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function createSupervisor(database: ShellDatabase): ProcessSupervisor {
   *   return ProcessSupervisor.create(database, process.platform, process.env, process.stderr);
   * }
   * ```
   */
  public static create(
    database: ShellDatabase,
    platform: string,
    environment: NodeJS.ProcessEnv,
    diagnostics: Writable,
    settings?: ProcessSettings,
    clock?: ProcessClock): ProcessSupervisor;

  /**
   * The programs running, in the order they started, then the programs that
   * exited cleanly while their process group still runs, in the order they
   * exited.
   */
  public get programs(): readonly RunningProgram[];

  /**
   * The programs as `desktop.programs` reports them, with the count of changes
   * to them so far as the sequence.
   */
  public get status(): ProgramStatusList;

  /**
   * Follows the programs: the listener is called once after each change, so
   * after a program starts, after a program exits and it is known whether its
   * process group still runs, and after programs begin to be stopped. A
   * clean exit that leaves the group running and the group's end are
   * separate changes.
   *
   * @param listener Called after each change.
   * @returns The registration; disposing it stops the listener.
   * @example
   * ```ts
   * import type { ProcessSupervisor, Registration } from "@noldova/desktop.runtime";
   *
   * export function watch(processes: ProcessSupervisor, report: (count: number) => void): Registration {
   *   return processes.onChanged(() => report(processes.programs.length));
   * }
   * ```
   */
  public onChanged(listener: () => void): Registration;

  /**
   * The programs running and those whose process group still runs, as
   * processes an update must see exit, each started between its request and
   * the return of the call that started it.
   */
  public get updateProcesses(): readonly UpdateProcess[];

  /**
   * Refuses to start programs while the runtime prepares for an update.
   *
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function prepare(supervisor: ProcessSupervisor): void {
   *   supervisor.pause();
   * }
   * ```
   */
  public pause(): void;

  /**
   * Starts programs again once an update the runtime prepared for has
   * stopped.
   *
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function resume(supervisor: ProcessSupervisor): void {
   *   supervisor.resume();
   * }
   * ```
   */
  public resume(): void;

  /**
   * Starts a program for a module; see
   * {@link IRuntimePartContext.startProcessAsync}. When a program that is
   * not on Windows exits with an error, the rest of its process group is
   * ended; after a clean exit the group is left until the module's programs
   * are stopped.
   *
   * @param moduleId The module the program runs for.
   * @param request The program to start.
   * @returns A promise of the running program, once it has started and is
   * recorded.
   * @throws {ProcessStartException} Rejected when the program cannot start or
   * is a batch file asked for verbatim arguments on Windows, or once the
   * module's programs or all programs are being stopped.
   * @example
   * ```ts
   * import { type OwnedProcess, ProcessRequest, type ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function startStatusAsync(processes: ProcessSupervisor, project: string): Promise<OwnedProcess> {
   *   return processes.startAsync("notes", new ProcessRequest("git", ["status"], project));
   * }
   * ```
   */
  public startAsync(moduleId: string, request: ProcessRequest): Promise<OwnedProcess>;

  /**
   * Starts a program in a pseudo-terminal for a module; see
   * {@link IRuntimePartContext.startPseudoTerminalAsync}. It does not check
   * the module's declaration, which {@link ModuleContext} does.
   *
   * @param moduleId The module the program runs for.
   * @param request The program to start in a pseudo-terminal.
   * @returns A promise of the running pseudo-terminal, once it has started
   * and is recorded.
   * @throws {ProcessStartException} Rejected when the program cannot start or
   * is a batch file that would run through cmd.exe's own parsing, when the
   * request's command line is given on macOS or Linux, beside arguments or for
   * a batch file, or once the module's programs or all programs are being
   * stopped.
   * @example
   * ```ts
   * import * as pty from "node-pty";
   *
   * import { type ProcessSupervisor, type PseudoTerminal, PseudoTerminalRequest } from "@noldova/desktop.runtime";
   *
   * export function startShellAsync(processes: ProcessSupervisor, project: string, environment: Readonly<Record<string, string>>): Promise<PseudoTerminal> {
   *   return processes.startPseudoTerminalAsync("terminal", new PseudoTerminalRequest(pty, "bash", [], project, 80, 24, environment));
   * }
   * ```
   */
  public startPseudoTerminalAsync(moduleId: string, request: PseudoTerminalRequest): Promise<PseudoTerminal>;

  /**
   * Refuses the module's further starts, then ends every program it runs and
   * what they left running, giving them the settings' grace period to exit
   * before killing them. A process group whose program has exited is ended
   * only while a process listed in it when the program exited still runs in
   * it; otherwise the runtime's log names the group's processes and they are
   * left running.
   *
   * @param moduleId The module's id.
   * @returns A promise that resolves once they have ended or the runtime's
   * log says which could not be.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function stopNotesAsync(processes: ProcessSupervisor): Promise<void> {
   *   return processes.stopOwnedByAsync("notes");
   * }
   * ```
   */
  public stopOwnedByAsync(moduleId: string): Promise<void>;

  /**
   * Reads the person's current environment for the programs modules start,
   * as {@link IRuntimePartContext.readEnvironmentAsync} says.
   *
   * @returns A promise of the variables by name, which never rejects.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function readEnvironmentAsync(processes: ProcessSupervisor): Promise<Readonly<Record<string, string>>> {
   *   return processes.readEnvironmentAsync();
   * }
   * ```
   */
  public readEnvironmentAsync(): Promise<Readonly<Record<string, string>>>;

  /**
   * Refuses every further start, ends the reading of the current environment,
   * then ends every program still running, as {@link stopOwnedByAsync} does
   * for one module.
   *
   * @returns A promise that resolves once they have ended or the runtime's
   * log says which could not be.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function stopEverythingAsync(processes: ProcessSupervisor): Promise<void> {
   *   return processes.stopAllAsync();
   * }
   * ```
   */
  public stopAllAsync(): Promise<void>;

  /**
   * Kills what the recorded programs of an earlier runtime left running and
   * removes their records. Only a recorded program still running is ended,
   * with its tree on Windows or its process group elsewhere; a process whose
   * id was reused since, as its start time or, on Windows, its executable
   * shows, is left alone. A record from another boot is removed without
   * ending anything, and so is a record whose clock offset shows that the
   * wall clock changed since, which the runtime's log notes. When a recorded
   * program is no longer running, its process group is ended while a process
   * in it certainly started between the request for the program and the time
   * it was last seen running, given the process table's precision; on Windows
   * its children that started in that time are ended with their trees, and
   * only those that started before a process that now holds its id count.
   * Otherwise nothing is ended, and the runtime's log names the processes in
   * its group, or on Windows its children that started after that time.
   *
   * @returns A promise that resolves once the leftovers have ended or the
   * runtime's log says which could not be.
   * @example
   * ```ts
   * import type { ProcessSupervisor } from "@noldova/desktop.runtime";
   *
   * export function recoverAsync(processes: ProcessSupervisor): Promise<void> {
   *   return processes.cleanUpAsync();
   * }
   * ```
   */
  public cleanUpAsync(): Promise<void>;
}

/**
 * Chooses the data directory a main process or CLI uses.
 */
export declare class DataDirectoryLocator {
  /**
   * Chooses the data directory: the explicit one when given; otherwise `~/.noldova/desktop` for a packaged build; otherwise `NOLDOVA_DESKTOP_DATA_DIR` or, without it, `_build/data` in the checkout, so development and test runs never use the person's directory.
   *
   * @param isPackaged Whether this is a packaged build.
   * @param environment The environment that may set `NOLDOVA_DESKTOP_DATA_DIR`.
   * @param homeFolder The person's home folder.
   * @param checkoutRoot The repository checkout a development build runs from.
   * @param explicit A data directory the person or a test gave, if any; empty or whitespace counts as none.
   * @returns The data directory.
   * @throws {ArgumentException} When the chosen path is not absolute.
   * @example
   * ```ts
   * import { homedir } from "node:os";
   *
   * import { type DataDirectory, DataDirectoryLocator } from "@noldova/desktop.runtime";
   *
   * export function locate(isPackaged: boolean, checkoutRoot: string): DataDirectory {
   *   return DataDirectoryLocator.locate(isPackaged, process.env, homedir(), checkoutRoot);
   * }
   * ```
   */
  public static locate(isPackaged: boolean, environment: NodeJS.ProcessEnv, homeFolder: string, checkoutRoot: string, explicit?: string): DataDirectory;
}

/**
 * This build of the runtime and its clients.
 */
export declare class RuntimeBuild {
  /**
   * The build's identity: the product version and the build fingerprint from {@link ProductInfo.current}, and the supported protocol version,
   * made on first use and kept.
   *
   * @throws {ProductFileException} When the build's product file cannot be read or a field is missing or blank.
   */
  public static get identity(): BuildIdentity;
}

/**
 * How much a tool's call may change, which the app shows and never changes.
 */
export declare enum ToolRisk {
  /**
   * The call changes little or nothing.
   */
  Low = "Low",

  /**
   * The call changes something the person can undo.
   */
  Medium = "Medium",

  /**
   * The call changes something the person can't easily undo.
   */
  High = "High"
}

/**
 * The failures every tool shares, as `documents/TOOLS.md` lists them.
 */
export declare enum ToolFailureCode {
  /**
   * The input is invalid or over its limit, or the module refuses the action without asking.
   */
  Refused = "Refused",

  /**
   * The person or the app's policy said no, or the request couldn't be raised.
   */
  Denied = "Denied",

  /**
   * Nobody answered the permission request in time.
   */
  Expired = "Expired",

  /**
   * The call was aborted while its permission request waited.
   */
  Withdrawn = "Withdrawn",

  /**
   * The agent or the app cancelled the call, or its session ended.
   */
  Cancelled = "Cancelled",

  /**
   * The person stopped the call, or took over.
   */
  Stopped = "Stopped",

  /**
   * What the person allowed changed before the module acted, so nothing ran.
   */
  Stale = "Stale",

  /**
   * The deadline passed.
   */
  TimedOut = "TimedOut",

  /**
   * A call of a tool that isn't resumable ended after its point of no return, for any reason.
   */
  OutcomeUncertain = "OutcomeUncertain",

  /**
   * A result is over its limit even after the module cut it.
   */
  TooLarge = "TooLarge",

  /**
   * The tool, its target or its module can't answer: switched off, crashed, gone, or held by another session.
   */
  Unavailable = "Unavailable"
}

/**
 * Why a call's signal aborted.
 */
export declare enum ToolAbortReason {
  /**
   * Agent control stopped.
   */
  Stopped = "Stopped",

  /**
   * The agent or the app cancelled the call.
   */
  Cancelled = "Cancelled",

  /**
   * The call's agent session ended.
   */
  SessionEnded = "SessionEnded",

  /**
   * The tool was released or switched off.
   */
  SwitchedOff = "SwitchedOff",

  /**
   * The call's deadline passed.
   */
  DeadlineReached = "DeadlineReached"
}

/**
 * What a content item of a result holds.
 */
export declare enum ToolContentKind {
  /**
   * Text.
   */
  Text = "Text",

  /**
   * A PNG or JPEG image, as base64.
   */
  Image = "Image"
}

/**
 * The exception thrown when an app's tool endpoint is closed: when it is asked to admit a session after it closed, or
 * when the part deactivated while the endpoint was opening.
 */
export declare class ToolEndpointException extends RuntimeException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @example
   * ```ts
   * import { ToolEndpointException } from "@noldova/desktop.runtime";
   *
   * export function refuseClosed(): never {
   *   throw new ToolEndpointException();
   * }
   * ```
   */
  public constructor();
}

/**
 * The exception a tool's handler throws to end its call with a specific failure.
 */
export declare class ToolFailureException extends RuntimeException {
  /**
   * The failure the call ends with.
   */
  public readonly failure: ToolFailure;

  /**
   * Creates the exception.
   *
   * @param failure The failure to end the call with; its message becomes the exception's message.
   * @param options The error that caused the failure, if any, which the registry writes to the module's log and
   * never passes to the agent.
   * @example
   * ```ts
   * import { ToolFailure, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
   *
   * export function refuse(path: string): never {
   *   throw new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, `The note ${path} is outside the notebook.`, "notes.outsideNotebook"));
   * }
   *
   * export function failToRead(path: string, error: unknown): never {
   *   throw new ToolFailureException(new ToolFailure(ToolFailureCode.Unavailable, `The note ${path} couldn't be read.`, "notes.unreadable"), { cause: error });
   * }
   * ```
   */
  public constructor(failure: ToolFailure, options?: ExceptionOptions);
}

/**
 * The hints a tool passes on to the agents unchanged.
 */
export interface IToolHints {
  /**
   * Whether the tool only reads; a read-only tool has no point of no return.
   */
  readonly isReadOnly?: boolean;

  /**
   * Whether the tool may destroy something.
   */
  readonly isDestructive?: boolean;

  /**
   * Whether the tool reaches things outside the person's machine, such as the web.
   */
  readonly isOpenWorld?: boolean;
}

/**
 * A tool's risk: what it usually is and the most it can be.
 */
export interface IToolRiskRange {
  /**
   * The usual risk, at most the maximum.
   */
  readonly default: ToolRisk;

  /**
   * The most a call can risk.
   */
  readonly maximum: ToolRisk;
}

/**
 * Checks tool schemas, and the arguments and structured fields they describe; the registry takes one, and the
 * {@link ToolSchemaValidator} by default.
 */
export interface IToolSchemaValidator {
  /**
   * Checks a tool's schema when the tool registers.
   *
   * @param schema The input or output schema.
   * @param parameterName The descriptor field that holds it.
   * @throws {ArgumentException} When the schema can't be used.
   * @example
   * ```ts
   * import type { IToolSchemaValidator } from "@noldova/desktop.runtime";
   *
   * export function checkInput(validator: IToolSchemaValidator): void {
   *   validator.checkSchema({ type: "object" }, "inputSchema");
   * }
   * ```
   */
  checkSchema(schema: JsonObject, parameterName: string): void;

  /**
   * Finds what keeps a value from fitting its schema.
   *
   * @param schema The input or output schema.
   * @param value A call's arguments, or a result's structured fields.
   * @returns A message for the agent, or `null` when the value fits.
   * @example
   * ```ts
   * import type { IToolSchemaValidator } from "@noldova/desktop.runtime";
   *
   * export function fits(validator: IToolSchemaValidator): boolean {
   *   return validator.findProblem({ type: "object" }, { query: "plans" }) === null;
   * }
   * ```
   */
  findProblem(schema: JsonObject, value: JsonObject): string | null;
}

/**
 * A tool's deadline, in milliseconds.
 */
export interface IToolDeadline {
  /**
   * The deadline of a call that names none: a whole number from 1 to the maximum.
   */
  readonly default: number;

  /**
   * The longest deadline a call may name: a whole number of at most 120,000.
   */
  readonly maximum: number;
}

/**
 * A tool's own result limits, each a whole number of at least 1 and within the registry's.
 */
export interface IToolLimits {
  /**
   * The most characters a text item holds, at most 262,144.
   */
  readonly textCharacters?: number;

  /**
   * The most bytes an image item holds before base64, at most 1,048,576.
   */
  readonly imageBytes?: number;

  /**
   * The longest edge of an image, in pixels.
   */
  readonly imageLongEdge?: number;

  /**
   * The most pixels an image holds.
   */
  readonly imagePixels?: number;
}

/**
 * What a module's runtime part says about a tool it registers, as `documents/TOOLS.md` describes it.
 */
export interface IToolDescriptor {
  /**
   * The tool's declared name, among the module's `contributes.tools`.
   */
  readonly name: string;

  /**
   * A short name people see; not blank.
   */
  readonly title?: string;

  /**
   * What the tool does, for the agent; not blank.
   */
  readonly description: string;

  /**
   * A JSON Schema object for the arguments.
   */
  readonly inputSchema: JsonObject;

  /**
   * A JSON Schema object for the result's structured fields; a tool with one always answers with them.
   */
  readonly outputSchema?: JsonObject;

  /**
   * The hints passed on to the agents.
   */
  readonly hints?: IToolHints;

  /**
   * The tool's risk.
   */
  readonly risk: IToolRiskRange;

  /**
   * Whether a later call can safely finish what an interrupted one began; `false` when absent.
   */
  readonly isResumable?: boolean;

  /**
   * Whether the handler reports its point of no return with {@link ToolCall.markSending}; `false` when absent, and
   * then a call reaches the point when its handler starts.
   */
  readonly marksSending?: boolean;

  /**
   * The tool's deadline.
   */
  readonly deadline: IToolDeadline;

  /**
   * What calls take turns on: a JSON Pointer into the arguments, such as `/item_id`, or `binding:<name>` for a
   * target the app binds to the session.
   */
  readonly resource?: string;

  /**
   * The tool's own result limits.
   */
  readonly limits?: IToolLimits;

  /**
   * One of the module's declared tools that tells the agent where things stand, which a call that ends as
   * `OutcomeUncertain` names; a tool that is neither read-only nor resumable needs one.
   */
  readonly nextTool?: string;
}

/**
 * An app's tool endpoint on `127.0.0.1`, which {@link IToolsContext.openEndpointAsync} opens. It answers 421 to a
 * request whose `Host` header isn't exactly `127.0.0.1:<port>`, 403 to one with an `Origin` header, and 401 to one
 * without the bearer token of an open agent session; none of these answers has a body. Tokens live only in its memory,
 * and it never writes one to a log.
 */
export interface IToolEndpoint extends Disposable {
  /**
   * The endpoint's address, `http://127.0.0.1:<port>/`, which the app gives its agents with their tokens.
   */
  readonly url: string;

  /**
   * Gives an agent session its bearer token, 32 random bytes in base64url, which the agent sends as
   * `Authorization: Bearer <token>`. The session's earlier token stops working, and so does the token when the session
   * ends or the endpoint closes. The app hands the token to its agent and never stores or logs it.
   *
   * @param session An open agent session that the endpoint's part opened.
   * @returns The token.
   * @throws {ToolEndpointException} When the endpoint is closed.
   * @throws {ArgumentException} When the session has ended or another part opened it.
   * @example
   * ```ts
   * import type { IToolEndpoint, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function connect(endpoint: IToolEndpoint, session: ToolSession): Readonly<Record<string, string>> {
   *   return { url: endpoint.url, authorization: `Bearer ${endpoint.admit(session)}` };
   * }
   * ```
   */
  admit(session: ToolSession): string;

  /**
   * Closes the endpoint: it forgets every token, stops listening and closes its open connections. The part's
   * deactivation does it too.
   *
   * @example
   * ```ts
   * import type { IToolEndpoint } from "@noldova/desktop.runtime";
   *
   * export function stopServing(endpoint: IToolEndpoint): void {
   *   endpoint[Symbol.dispose]();
   * }
   * ```
   */
  [Symbol.dispose](): void;
}

/**
 * Answers the requests an app's agents send to its tool endpoint, in whatever agent protocol the app speaks, such as
 * the Model Context Protocol over HTTP.
 */
export interface IToolEndpointHandler {
  /**
   * Answers one request that passed every check of the endpoint: addressed to `127.0.0.1:<port>`, without an `Origin`
   * header, and carrying the bearer token of an open agent session. The request's body is the handler's to read and to
   * bound, since the endpoint caps only its headers; the handler reaches tools only through `session`, and answers with
   * `response`, which it may keep open to stream, such as with server-sent events. The endpoint sends the handler no
   * signal of its own: when the endpoint closes, `response` closes, and the handler stops at its `close` event; when
   * the session ends, its calls in flight abort and its new calls fail as `Unavailable`.
   *
   * @param request The request, its body unread.
   * @param response The response, not yet started.
   * @param session The agent session whose token the request carries.
   * @returns A promise that settles when the handler is done with the request. A rejection's name, message and stack
   * go to the module's log, never its other properties; the endpoint then answers 500 with no body, or closes the
   * connection when the response has already started.
   * @example
   * ```ts
   * import type { IncomingMessage, ServerResponse } from "node:http";
   *
   * import type { IToolEndpointHandler, ToolSession } from "@noldova/desktop.runtime";
   *
   * export const listing: IToolEndpointHandler = {
   *   handleAsync(request: IncomingMessage, response: ServerResponse, session: ToolSession): Promise<void> {
   *     request.resume();
   *     response.writeHead(200, { "content-type": "application/json" });
   *     response.end(JSON.stringify(session.listTools().map(t => t.name)));
   *     return Promise.resolve();
   *   }
   * };
   * ```
   */
  handleAsync(request: IncomingMessage, response: ServerResponse, session: ToolSession): Promise<void>;
}

/**
 * Handles the calls of one tool.
 */
export interface IToolHandler {
  /**
   * Handles one call. The handler watches `call.signal`, and stops its work when the signal aborts.
   *
   * @param call The call, with its session, scope, bindings, checked arguments, deadline and signal.
   * @returns A promise of the result. A rejection with a {@link ToolFailureException} ends the call with its
   * failure; any other rejection ends it as `Unavailable` with the module code `<id>.internal`, and its message
   * goes only to the log.
   * @example
   * ```ts
   * import { type IToolHandler, type ToolCall, ToolContent, ToolResult } from "@noldova/desktop.runtime";
   *
   * export const search: IToolHandler = {
   *   handleAsync(call: ToolCall): Promise<ToolResult> {
   *     return Promise.resolve(new ToolResult([ToolContent.fromText(`Nothing matches ${String(call.arguments["query"])}.`, null)]));
   *   }
   * };
   * ```
   */
  handleAsync(call: ToolCall): Promise<ToolResult>;
}

/**
 * The options of one call.
 */
export interface IToolCallOptions {
  /**
   * The call's deadline in milliseconds, a whole number from 1 to the tool's maximum; the tool's default when absent.
   */
  readonly deadlineMilliseconds?: number;

  /**
   * Cancels the call when it aborts.
   */
  readonly signal?: AbortSignal;
}

/**
 * What answers a {@link ToolSession}'s calls; the {@link ToolRegistry} is the one the runtime uses.
 */
export interface IToolSessionHost {
  /**
   * Lists the registered tools that take calls.
   *
   * @returns The registered tools' descriptors, in the order they were registered, without those of a module whose tools are closed.
   * @example
   * ```ts
   * import type { IToolSessionHost } from "@noldova/desktop.runtime";
   *
   * export function listNames(host: IToolSessionHost): readonly string[] {
   *   return host.listTools().map(t => t.name);
   * }
   * ```
   */
  listTools(): readonly ToolDescriptor[];

  /**
   * Calls a tool for a session.
   *
   * @param session The calling session.
   * @param name The tool's name.
   * @param input The call's arguments.
   * @param options The call's deadline and signal.
   * @returns A promise of the result or the failure; it never rejects.
   * @example
   * ```ts
   * import type { IToolSessionHost, ToolFailure, ToolResult, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function searchAsync(host: IToolSessionHost, session: ToolSession): Promise<ToolResult | ToolFailure> {
   *   return host.callAsync(session, "notes_search", { query: "plans" }, {});
   * }
   * ```
   */
  callAsync(session: ToolSession, name: string, input: JsonObject, options: IToolCallOptions): Promise<ToolResult | ToolFailure>;

  /**
   * Ends a session: its calls in flight abort with `SessionEnded`, and every part that listens learns of it. Ending a
   * session again does nothing.
   *
   * @param session The session.
   * @example
   * ```ts
   * import type { IToolSessionHost, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function close(host: IToolSessionHost, session: ToolSession): void {
   *   host.end(session);
   * }
   * ```
   */
  end(session: ToolSession): void;
}

/**
 * The tool registry as a module's runtime part sees it, as `documents/TOOLS.md` says.
 */
export interface IToolsContext {
  /**
   * Whether agent control is stopped, by any part or by the person, so a part switched on after a stop shows it as the
   * calls do: true from the stop until the person resumes, and already so in the `onStopped` and `onResumed` listeners.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function followAgentControl(context: IRuntimePartContext, show: (isStopped: boolean) => void): Registration[] {
   *   show(context.tools.isStopped);
   *   return [context.tools.onStopped(() => show(true)), context.tools.onResumed(() => show(false))];
   * }
   * ```
   */
  readonly isStopped: boolean;

  /**
   * Registers one of the module's declared tools while the part is active.
   *
   * @param descriptor What the tool is and how its calls run.
   * @param handler Handles its calls.
   * @returns The registration; disposing it withdraws the tool and ends its calls in flight with the abort reason
   * `SwitchedOff`. The part's deactivation disposes it too.
   * @throws {RegistrationException} When the module doesn't declare the name, or the name is already registered.
   * @throws {ArgumentException} When the descriptor breaks a rule of {@link IToolDescriptor}.
   * @example
   * ```ts
   * import { type IRuntimePartContext, type IToolHandler, type Registration, ToolRisk } from "@noldova/desktop.runtime";
   *
   * export function offerSearch(context: IRuntimePartContext, handler: IToolHandler): Registration {
   *   return context.tools.register({
   *     name: "notes_search",
   *     description: "Searches the notes.",
   *     inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
   *     hints: { isReadOnly: true },
   *     risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
   *     deadline: { default: 5_000, maximum: 30_000 }
   *   }, handler);
   * }
   * ```
   */
  register(descriptor: IToolDescriptor, handler: IToolHandler): Registration;

  /**
   * Opens an agent session, which the app does for each agent's use of the tools.
   *
   * @param scope The app's opaque name for what the session acts for, such as a conversation; at most 256 characters.
   * @param bindings What the app attaches to the session, by binding name, such as a folder.
   * @returns The session, open until it ends or the part deactivates.
   * @throws {ArgumentOutOfRangeException} When the scope is longer than 256 characters.
   * @example
   * ```ts
   * import type { IRuntimePartContext, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function openConversation(context: IRuntimePartContext, conversation: string): ToolSession {
   *   return context.tools.openSession(conversation, { folder: "/home/person/notes" });
   * }
   * ```
   */
  openSession(scope: string, bindings: JsonObject): ToolSession;

  /**
   * Listens for the end of every agent session, so the part drops the session's references, holds and requests
   * within 5 seconds. A listener that throws is written to the module's log and stops no other listener.
   *
   * @param listener Called with the ended session's id.
   * @returns The listening; disposing it stops it, and the part's deactivation disposes it too.
   * @example
   * ```ts
   * import type { IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function forgetEnded(context: IRuntimePartContext, holds: Map<string, string>): Registration {
   *   return context.tools.onSessionEnded(t => holds.delete(t));
   * }
   * ```
   */
  onSessionEnded(listener: (session: string) => void): Registration;

  /**
   * Opens a tool endpoint, the one way an app serves its agents' tools over the network, such as for an agent that
   * takes no server on its standard input and output. It listens on `127.0.0.1` alone, never `::1` or `0.0.0.0`, at a
   * port the system picks when it opens, and admits only the agent sessions this part opened, each by a bearer token
   * that {@link IToolEndpoint.admit} gives. A module that offers tools opens none, as `documents/TOOLS.md` says.
   *
   * @param handler Answers the requests that pass the endpoint's checks.
   * @returns A promise of the endpoint, open until it is disposed or the part deactivates.
   * @throws {ToolEndpointException} As a rejection, when the part deactivates while the endpoint opens.
   * @throws {Error} As a rejection, when the system refuses the listening, such as when it has no loopback address.
   * @example
   * ```ts
   * import type { IRuntimePartContext, IToolEndpoint, IToolEndpointHandler } from "@noldova/desktop.runtime";
   *
   * export function serveAgentsAsync(context: IRuntimePartContext, handler: IToolEndpointHandler): Promise<IToolEndpoint> {
   *   return context.tools.openEndpointAsync(handler);
   * }
   * ```
   */
  openEndpointAsync(handler: IToolEndpointHandler): Promise<IToolEndpoint>;

  /**
   * Stops all agent control, such as when the person takes over or the part misses its own heartbeat: every call in
   * flight ends with `Stopped`, every waiting permission request is withdrawn, every part's `onStopped` listeners hear
   * the reason, and every later call fails with `Stopped` until the person resumes. Sessions stay open, and a stop while
   * stopped does nothing.
   *
   * @param reason Why, for the parts' listeners: one line that isn't blank, of at most 200 characters.
   * @throws {ArgumentException} When the reason is blank, longer than 200 characters or more than one line.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function takeOver(context: IRuntimePartContext): void {
   *   context.tools.stopAll("The person took over the browser.");
   * }
   * ```
   */
  stopAll(reason: string): void;

  /**
   * Stops one agent session's turn, from a command the person runs, such as a page's Stop or Take over: every call of
   * the session in flight ends with `Stopped`, which withdraws its waiting permission request, and every part's
   * `onSessionStopped` listeners hear the session and the reason, so that the app ends the agent's turn and says so in
   * its reply. The session stays open, and its later calls run as usual; a session that isn't open does nothing.
   * The part runs it only from a command whose request's client it checks is `ShellClients.mainProcess`, as for
   * {@link IToolsContext.resumeAll}, but unlike a resume it runs while the part's own calls run, since a stop only takes
   * power away from an agent and the person's Stop comes while that session's call acts.
   *
   * @param session The session's id, as a tool call's `session` gives it.
   * @param reason Why, for the parts' listeners: one line that isn't blank, of at most 200 characters.
   * @throws {ArgumentException} When the reason is blank, longer than 200 characters or more than one line.
   * @throws {AgentControlException} While agent control or a session's turn is stopping, as in an `onStopped` or
   * `onSessionStopped` listener or a call's abort listener.
   * @example
   * ```ts
   * import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
   * import { type IRuntimePartContext, MethodFailureException, type Registration, RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function offerStop(context: IRuntimePartContext, actingSession: () => string | null): Registration {
   *   return context.registerCommand(new RuntimeCommand("notes.stopAgent", "Stop the agent", null, null, {
   *     handleAsync: async request => {
   *       if (request.client !== ShellClients.mainProcess)
   *         throw new MethodFailureException(new Failure(FailureCode.Unauthorized, "Only the person stops an agent's turn."));
   *       const session = actingSession();
   *       if (session !== null)
   *         context.tools.stopSession(session, "The person stopped the agent in Notes.");
   *       return null;
   *     }
   *   }));
   * }
   * ```
   */
  stopSession(session: string, reason: string): void;

  /**
   * Listens for a part stopping one agent session's turn; the part that opened the session, the app's, ends the agent's
   * turn then. A listener that throws is written to the module's log and stops no other listener.
   *
   * @param listener Called with the session's id and the stop's reason.
   * @returns The listening; disposing it stops it, and the part's deactivation disposes it too.
   * @example
   * ```ts
   * import type { IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function endTurns(context: IRuntimePartContext, endTurn: (session: string, reason: string) => void): Registration {
   *   return context.tools.onSessionStopped(endTurn);
   * }
   * ```
   */
  onSessionStopped(listener: (session: string, reason: string) => void): Registration;

  /**
   * Resumes agent control, from a command the person runs, which checks that its request comes from the app's main
   * process so that the command line can't run it; every part's `onResumed` listeners hear it, until one of them stops
   * agent control again. A resume while running does nothing. The check rests on the client kind the connection's handshake names, so it keeps out other clients,
   * not other programs running as the same person.
   *
   * @throws {AgentControlException} When one of the part's own tool calls runs, until its handler returns even past its
   * abort, or while agent control or a session's turn is stopping, as in an `onStopped` or `onSessionStopped` listener
   * or a call's abort listener, so that an agent can't resume itself.
   * @example
   * ```ts
   * import { Failure, FailureCode, ShellClients } from "@noldova/desktop.protocol";
   * import { type IRuntimePartContext, MethodFailureException, type Registration, RuntimeCommand } from "@noldova/desktop.runtime";
   *
   * export function offerResume(context: IRuntimePartContext): Registration {
   *   return context.registerCommand(new RuntimeCommand("notes.resumeAgents", "Resume agents", null, null, {
   *     handleAsync: async request => {
   *       if (request.client !== ShellClients.mainProcess)
   *         throw new MethodFailureException(new Failure(FailureCode.Unauthorized, "Only the app resumes agents."));
   *       context.tools.resumeAll();
   *       return null;
   *     }
   *   }));
   * }
   * ```
   */
  resumeAll(): void;

  /**
   * Listens for agent control stopping, by any part or by the person. A listener that throws is written to the
   * module's log and stops no other listener.
   *
   * @param listener Called with the stop's reason.
   * @returns The listening; disposing it stops it, and the part's deactivation disposes it too.
   * @example
   * ```ts
   * import type { IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function showStopped(context: IRuntimePartContext, show: (reason: string) => void): Registration {
   *   return context.tools.onStopped(show);
   * }
   * ```
   */
  onStopped(listener: (reason: string) => void): Registration;

  /**
   * Listens for the person resuming agent control. A listener that throws is written to the module's log and stops no
   * other listener; one that stops agent control again ends the resume there, so the later listeners don't hear it.
   *
   * @param listener Called when agent control resumes.
   * @returns The listening; disposing it stops it, and the part's deactivation disposes it too.
   * @example
   * ```ts
   * import type { IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function hideStopped(context: IRuntimePartContext, hide: () => void): Registration {
   *   return context.tools.onResumed(hide);
   * }
   * ```
   */
  onResumed(listener: () => void): Registration;
}

/**
 * An answer a person may give a permission request, as `documents/PERMISSIONS.md` says.
 */
export declare enum PermissionOption {
  /**
   * The call may act.
   */
  AllowOnce = "AllowOnce",

  /**
   * The call may act, and later calls with the same module, action, subject and scope may too.
   */
  AllowAlways = "AllowAlways",

  /**
   * The call may not act.
   */
  Deny = "Deny",

  /**
   * The call may not act, and later calls with the same module, action, subject and scope may not either.
   */
  DenyAlways = "DenyAlways",

  /**
   * The call may not act, and the person takes the action over, such as typing into a field themselves; the request must label it.
   */
  TakeOver = "TakeOver"
}

/**
 * The decision a permission request resolves with, as `documents/PERMISSIONS.md` says.
 */
export declare enum PermissionDecision {
  /**
   * This call may act.
   */
  AllowedOnce = "AllowedOnce",

  /**
   * This call may act, and the answer is kept for later calls.
   */
  AllowedAlways = "AllowedAlways",

  /**
   * This call may not act.
   */
  Denied = "Denied",

  /**
   * This call may not act, and the answer is kept for later calls.
   */
  DeniedAlways = "DeniedAlways",

  /**
   * Nobody answered within the request's wait.
   */
  Expired = "Expired",

  /**
   * The call was aborted before an answer.
   */
  Withdrawn = "Withdrawn",

  /**
   * This call may not act, and the person takes the action over; the module hands it to them, and nothing is kept.
   */
  TakenOver = "TakenOver"
}

/**
 * How the window shows one item of a permission request's details.
 */
export declare enum PermissionDetailKind {
  /**
   * Plain text.
   */
  Text = "Text",

  /**
   * Text shown exactly, such as a command or a path.
   */
  Code = "Code",

  /**
   * A value shown hidden.
   */
  Secret = "Secret",

  /**
   * Words the agent wrote, shown as such.
   */
  AgentText = "AgentText"
}

/**
 * One labeled item of a permission request's details.
 */
export interface IPermissionDetail {
  /**
   * The item's label, not blank.
   */
  readonly label: string;

  /**
   * How the window shows the value.
   */
  readonly kind: PermissionDetailKind;

  /**
   * The value.
   */
  readonly value: string;
}

/**
 * What a tool's call asks the person before it acts, as `documents/PERMISSIONS.md` says.
 */
export interface IPermissionRequest {
  /**
   * The action's name, the module's id, a dot and a camelCase name, such as `notes.deleteItem`.
   */
  readonly action: string;

  /**
   * An opaque name, at most 1,024 characters, of what the action is on; remembered answers match it exactly.
   */
  readonly subject?: string | undefined;

  /**
   * One line, at most 200 characters, that tells the person what the agent wants to do.
   */
  readonly title: string;

  /**
   * At most 64 labeled items, at most 80 KiB as JSON, that show the action's exact input.
   */
  readonly details: readonly IPermissionDetail[];

  /**
   * The action's risk, within the tool's maximum risk.
   */
  readonly risk: ToolRisk;

  /**
   * `false` when the module would let the app's policy answer without asking the person; `true` when absent.
   */
  readonly isAsking?: boolean | undefined;

  /**
   * The answers the person may give, distinct and not empty; a High-risk request that gives labels or offers `TakeOver` offers neither `AllowAlways` nor `DenyAlways`.
   */
  readonly options: readonly PermissionOption[];

  /**
   * The module's own words for an offered `AllowAlways` or `TakeOver` option, each one line that isn't blank, of at most 40 characters, such as
   * "Allow for this chat" or "I'll type it myself"; `TakeOver` requires one, the answerer gets them exactly as given, and an empty object counts as none.
   */
  readonly labels?: Readonly<Partial<Record<PermissionOption.AllowAlways | PermissionOption.TakeOver, string>>> | undefined;

  /**
   * When `true`, only a remembered answer decides, and without one the request is denied without asking anyone.
   */
  readonly isRememberedOnly?: boolean | undefined;
}

/**
 * What carries a {@link ToolCall}'s permission requests; the tool registry gives each call one, and a module's
 * tests may give a call their own.
 */
export interface IToolCallPermissions {
  /**
   * Resolves one request of the call.
   *
   * @param request The request.
   * @param signal The call's signal; its abort withdraws the request.
   * @returns A promise of the decision; it never rejects.
   * @example
   * ```ts
   * import { type IToolCallPermissions, PermissionDecision, PermissionOutcome } from "@noldova/desktop.runtime";
   *
   * export const allowAll: IToolCallPermissions = {
   *   requestAsync: () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce))
   * };
   * ```
   */
  requestAsync(request: IPermissionRequest, signal: AbortSignal): Promise<PermissionOutcome>;
}

/**
 * What answers permission requests for the app: its card or its policy, as `documents/PERMISSIONS.md` says.
 */
export interface IPermissionAnswerer {
  /**
   * Answers one request that no remembered answer decides.
   *
   * @param question The request, with the module that raised it and the call's session and scope.
   * @param signal Aborts when the answer is no longer wanted: the request expired after 5 minutes, or its call was
   * aborted, so the answerer removes its card.
   * @returns A promise of the decision. An allowing or remembered decision counts only when the request offers its
   * option; any other answer, a rejection or a throw denies the request, and `Expired` expires it.
   * @example
   * ```ts
   * import { type IPermissionAnswerer, PermissionDecision, ToolRisk } from "@noldova/desktop.runtime";
   *
   * export const policy: IPermissionAnswerer = {
   *   answerAsync: t => Promise.resolve(t.request.risk === ToolRisk.Low ? PermissionDecision.AllowedOnce : PermissionDecision.Denied)
   * };
   * ```
   */
  answerAsync(question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision>;
}

/**
 * The permission requests and remembered answers as a module's runtime part sees them, as
 * `documents/PERMISSIONS.md` says. Only the module the app names in `desktop.product.permissionsModule` may
 * register the answerer, list remembered answers and revoke them.
 */
export interface IPermissionsContext {
  /**
   * Registers the app's answerer while the part is active.
   *
   * @param answerer Answers each request that no remembered answer decides.
   * @returns The registration; disposing it removes the answerer, and the part's deactivation disposes it too.
   * Without an answerer, every request that no remembered answer decides is denied, and the requesting module's log
   * says why.
   * @throws {PermissionAccessException} When the module isn't the app's permissions module.
   * @throws {RegistrationException} When an answerer is already registered.
   * @example
   * ```ts
   * import type { IPermissionAnswerer, IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function answer(context: IRuntimePartContext, answerer: IPermissionAnswerer): Registration {
   *   return context.permissions.registerAnswerer(answerer);
   * }
   * ```
   */
  registerAnswerer(answerer: IPermissionAnswerer): Registration;

  /**
   * Lists every module's remembered answers.
   *
   * @returns The answers, oldest first.
   * @throws {PermissionAccessException} When the module isn't the app's permissions module, or Noldova Desktop's
   * database isn't open.
   * @example
   * ```ts
   * import { type IRuntimePartContext, PermissionDecision } from "@noldova/desktop.runtime";
   *
   * export function countAllowed(context: IRuntimePartContext): number {
   *   return context.permissions.listRemembered().filter(t => t.decision === PermissionDecision.AllowedAlways).length;
   * }
   * ```
   */
  listRemembered(): readonly RememberedPermission[];

  /**
   * Removes one remembered answer, so the next request with its module, action, subject and scope goes to the
   * answerer; a call that already has its decision keeps it. The module whose answer it was learns of it through
   * {@link onRevoked}.
   *
   * @param id The answer's id.
   * @returns Whether there was such an answer.
   * @throws {PermissionAccessException} When the module isn't the app's permissions module, or Noldova Desktop's
   * database isn't open.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function revokeAll(context: IRuntimePartContext): void {
   *   for (const answer of context.permissions.listRemembered())
   *     context.permissions.revoke(answer.id);
   * }
   * ```
   */
  revoke(id: string): boolean;

  /**
   * Listens for the revocation of the module's own remembered answers, so the part brings what it shows up to
   * date. A listener that throws is written to the module's log and stops no other listener.
   *
   * @param listener Called with the revoked answer's action, subject and scope.
   * @returns The listening; disposing it stops it, and the part's deactivation disposes it too.
   * @example
   * ```ts
   * import type { IRuntimePartContext, Registration } from "@noldova/desktop.runtime";
   *
   * export function forgetRevoked(context: IRuntimePartContext, allowed: Set<string>): Registration {
   *   return context.permissions.onRevoked(t => allowed.delete(`${t.action} ${String(t.subject)}`));
   * }
   * ```
   */
  onRevoked(listener: (revocation: PermissionRevocation) => void): Registration;
}

/**
 * The decision of one permission request.
 */
export declare class PermissionOutcome {
  /**
   * The decision.
   */
  public readonly decision: PermissionDecision;

  /**
   * Whether a remembered answer gave the decision.
   */
  public readonly isRemembered: boolean;

  /**
   * The request's id, the same as its {@link PermissionQuestion.id} and its {@link PermissionRecord.id}; `null` for an
   * outcome made without a request, such as a module's own fake.
   */
  public readonly id: string | null;

  /**
   * Creates the outcome.
   *
   * @param decision The decision.
   * @param isRemembered Whether a remembered answer gave it; `false` by default.
   * @param id The request's id; `null` by default.
   * @example
   * ```ts
   * import { PermissionDecision, PermissionOutcome } from "@noldova/desktop.runtime";
   *
   * export const remembered = new PermissionOutcome(PermissionDecision.AllowedAlways, true);
   * ```
   */
  public constructor(decision: PermissionDecision, isRemembered?: boolean, id?: string | null);

  /**
   * Whether the call may act: `AllowedOnce` or `AllowedAlways`.
   */
  public get isAllowed(): boolean;
}

/**
 * A permission request as the answerer receives it.
 */
export declare class PermissionQuestion {
  /**
   * The id of the module whose tool raised the request.
   */
  public readonly module: string;

  /**
   * The id of the agent session that made the call.
   */
  public readonly session: string;

  /**
   * The session's scope.
   */
  public readonly scope: string;

  /**
   * A frozen copy of the checked request.
   */
  public readonly request: IPermissionRequest;

  /**
   * The request's id, unique in the runtime. The call's {@link PermissionOutcome} and the {@link PermissionRecord} on
   * its result carry the same id, so an answerer can tie its own approval to the call.
   */
  public readonly id: string;

  /**
   * Creates the question.
   *
   * @param module The module's id.
   * @param session The session's id.
   * @param scope The session's scope.
   * @param request The request.
   * @param id The request's id; a new random one by default.
   * @example
   * ```ts
   * import { PermissionOption, PermissionQuestion, ToolRisk } from "@noldova/desktop.runtime";
   *
   * export const question = new PermissionQuestion("notes", "session-1", "conversation-1", {
   *   action: "notes.deleteItem", title: "Delete a note", details: [], risk: ToolRisk.Medium, options: [PermissionOption.AllowOnce]
   * });
   * ```
   */
  public constructor(module: string, session: string, scope: string, request: IPermissionRequest, id?: string);
}

/**
 * A permission request one tool call raised, and how it was decided, as the call's {@link ToolResult} or
 * {@link ToolFailure} lists it.
 */
export declare class PermissionRecord {
  /**
   * The request's id, the same as its {@link PermissionQuestion.id} and its {@link PermissionOutcome.id}.
   */
  public readonly id: string;

  /**
   * The request's risk; `High` for a request whose risk can't be read or isn't a {@link ToolRisk}.
   */
  public readonly risk: ToolRisk;

  /**
   * The decision.
   */
  public readonly decision: PermissionDecision;

  /**
   * Whether a remembered answer gave the decision, without asking the answerer.
   */
  public readonly isRemembered: boolean;

  /**
   * Creates the record.
   *
   * @param id The request's id.
   * @param risk The request's risk.
   * @param decision The decision.
   * @param isRemembered Whether a remembered answer gave it.
   * @example
   * ```ts
   * import { PermissionDecision, PermissionRecord, ToolRisk } from "@noldova/desktop.runtime";
   *
   * export const record = new PermissionRecord("request-1", ToolRisk.Medium, PermissionDecision.AllowedOnce, false);
   * ```
   */
  public constructor(id: string, risk: ToolRisk, decision: PermissionDecision, isRemembered: boolean);

  /**
   * Writes the record as JSON.
   *
   * @returns The record's JSON, with `id`, `risk`, `decision` and `isRemembered`.
   * @example
   * ```ts
   * import { PermissionDecision, PermissionRecord, ToolRisk } from "@noldova/desktop.runtime";
   *
   * export const json = new PermissionRecord("request-1", ToolRisk.Low, PermissionDecision.Denied, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a revoked remembered answer was about, as its module learns it.
 */
export declare class PermissionRevocation {
  /**
   * The action.
   */
  public readonly action: string;

  /**
   * The subject, or `null` for an answer without one.
   */
  public readonly subject: string | null;

  /**
   * The scope.
   */
  public readonly scope: string;

  /**
   * Creates the revocation.
   *
   * @param action The action.
   * @param subject The subject, or `null`.
   * @param scope The scope.
   * @example
   * ```ts
   * import { PermissionRevocation } from "@noldova/desktop.runtime";
   *
   * export const revocation = new PermissionRevocation("notes.deleteItem", "item-1", "conversation-1");
   * ```
   */
  public constructor(action: string, subject: string | null, scope: string);
}

/**
 * A remembered answer, kept in Noldova Desktop's database until it is revoked.
 */
export declare class RememberedPermission {
  /**
   * The answer's id.
   */
  public readonly id: string;

  /**
   * The id of the module whose tool raised the request.
   */
  public readonly module: string;

  /**
   * The action.
   */
  public readonly action: string;

  /**
   * The subject, or `null` for an answer without one.
   */
  public readonly subject: string | null;

  /**
   * The scope.
   */
  public readonly scope: string;

  /**
   * `AllowedAlways` or `DeniedAlways`.
   */
  public readonly decision: PermissionDecision;

  /**
   * When the answer was given.
   */
  public readonly remembered: Date;

  /**
   * Creates the answer.
   *
   * @param id The id.
   * @param module The module's id.
   * @param action The action.
   * @param subject The subject, or `null`.
   * @param scope The scope.
   * @param decision The decision.
   * @param remembered When it was given.
   * @example
   * ```ts
   * import { PermissionDecision, RememberedPermission } from "@noldova/desktop.runtime";
   *
   * export const answer = new RememberedPermission(
   *   "answer-1", "notes", "notes.deleteItem", null, "conversation-1", PermissionDecision.AllowedAlways, new Date("2026-10-21T12:00:00Z"));
   * ```
   */
  public constructor(id: string, module: string, action: string, subject: string | null, scope: string, decision: PermissionDecision, remembered: Date);
}

/**
 * Keeps remembered answers in the shell's database, by module, action, subject and scope.
 */
export declare class RememberedPermissionStore {
  /**
   * Creates the store.
   *
   * @param database The shell's database, migrated with {@link ShellMigrations.all}.
   * @param createId Creates each answer's id; a random UUID by default.
   * @param now Gives the time an answer is kept; the clock by default.
   * @example
   * ```ts
   * import { RememberedPermissionStore, type ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function createStore(database: ShellDatabase): RememberedPermissionStore {
   *   return new RememberedPermissionStore(database);
   * }
   * ```
   */
  public constructor(database: ShellDatabase, createId?: () => string, now?: () => Date);

  /**
   * Finds the answer with exactly these four; a `null` subject matches only an answer without one.
   *
   * @param module The module's id.
   * @param action The action.
   * @param subject The subject, or `null`.
   * @param scope The scope.
   * @returns `AllowedAlways` or `DeniedAlways`, or `null` when no answer it can read matches.
   * @example
   * ```ts
   * import type { PermissionDecision, RememberedPermissionStore } from "@noldova/desktop.runtime";
   *
   * export function find(store: RememberedPermissionStore): PermissionDecision | null {
   *   return store.find("notes", "notes.deleteItem", "item-1", "conversation-1");
   * }
   * ```
   */
  public find(module: string, action: string, subject: string | null, scope: string): PermissionDecision | null;

  /**
   * Keeps an answer in place of any with the same four.
   *
   * @param module The module's id.
   * @param action The action.
   * @param subject The subject, or `null`.
   * @param scope The scope.
   * @param decision `AllowedAlways` or `DeniedAlways`.
   * @example
   * ```ts
   * import { PermissionDecision, type RememberedPermissionStore } from "@noldova/desktop.runtime";
   *
   * export function allow(store: RememberedPermissionStore): void {
   *   store.remember("notes", "notes.deleteItem", "item-1", "conversation-1", PermissionDecision.AllowedAlways);
   * }
   * ```
   */
  public remember(module: string, action: string, subject: string | null, scope: string, decision: PermissionDecision): void;

  /**
   * Lists the answers it can read.
   *
   * @returns The answers, oldest first.
   * @example
   * ```ts
   * import type { RememberedPermission, RememberedPermissionStore } from "@noldova/desktop.runtime";
   *
   * export function list(store: RememberedPermissionStore): readonly RememberedPermission[] {
   *   return store.list();
   * }
   * ```
   */
  public list(): readonly RememberedPermission[];

  /**
   * Removes one answer.
   *
   * @param id The answer's id.
   * @returns The removed answer, or `null` when there was none or it couldn't be read.
   * @example
   * ```ts
   * import type { RememberedPermission, RememberedPermissionStore } from "@noldova/desktop.runtime";
   *
   * export function forget(store: RememberedPermissionStore, id: string): RememberedPermission | null {
   *   return store.forget(id);
   * }
   * ```
   */
  public forget(id: string): RememberedPermission | null;
}

/**
 * Carries permission requests from tool calls to the app's answerer, keeps remembered answers, and applies the
 * wait and the fail-closed rules of `documents/PERMISSIONS.md`; it never decides an action itself.
 */
export declare class PermissionCenter {
  /**
   * Creates the center, whose remembered answers can't be read or kept until {@link open} gives it a store.
   *
   * @param permissionsModule The id of the module that may answer and manage remembered answers, from
   * `desktop.product.permissionsModule`; `null` by default, so that every request is denied.
   * @param waitMilliseconds How long a request waits for its answer before it expires; 5 minutes by default.
   * @example
   * ```ts
   * import { PermissionCenter } from "@noldova/desktop.runtime";
   *
   * export const center = new PermissionCenter("notes");
   * ```
   */
  public constructor(permissionsModule?: string | null, waitMilliseconds?: number);

  /**
   * Gives the center the store of remembered answers, once the shell's database is open.
   *
   * @param store The store.
   * @example
   * ```ts
   * import { type PermissionCenter, RememberedPermissionStore, type ShellDatabase } from "@noldova/desktop.runtime";
   *
   * export function open(center: PermissionCenter, database: ShellDatabase): void {
   *   center.open(new RememberedPermissionStore(database));
   * }
   * ```
   */
  public open(store: RememberedPermissionStore): void;

  /**
   * Resolves one request of a tool's call: a remembered answer decides it, or else the answerer within the wait.
   *
   * @param moduleId The id of the module whose tool raised it.
   * @param descriptor The tool's descriptor, whose maximum risk bounds the request's.
   * @param log The module's log, which says why a request is denied without an answer.
   * @param session The call's session, whose scope the request takes.
   * @param input The request as the module sent it; it is read as JSON, and a value
   * that is not a well-formed request denies it with the reason in the module's log.
   * @param signal The call's signal; its abort withdraws the request.
   * @param id The request's id, which the question and the outcome carry; a new random one by default.
   * @returns A promise of the decision; it never rejects.
   * @example
   * ```ts
   * import type { IModuleLog, IPermissionRequest, PermissionCenter, PermissionOutcome, ToolDescriptor, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function askAsync(
   *   center: PermissionCenter, descriptor: ToolDescriptor, log: IModuleLog, session: ToolSession, request: IPermissionRequest): Promise<PermissionOutcome> {
   *   return center.requestAsync("notes", descriptor, log, session, request, new AbortController().signal);
   * }
   * ```
   */
  public requestAsync(
    moduleId: string,
    descriptor: ToolDescriptor,
    log: IModuleLog,
    session: ToolSession,
    input: unknown,
    signal: AbortSignal,
    id?: string): Promise<PermissionOutcome>;

  /**
   * Withdraws every waiting request, as stopping all agent control does.
   *
   * @example
   * ```ts
   * import type { PermissionCenter } from "@noldova/desktop.runtime";
   *
   * export function stopAll(center: PermissionCenter): void {
   *   center.withdrawAll();
   * }
   * ```
   */
  public withdrawAll(): void;

  /**
   * See {@link IPermissionsContext.registerAnswerer}.
   *
   * @param module The id of the registering module.
   * @param answerer The answerer.
   * @param log The registering module's log, which the answerer's failures go to.
   * @returns The registration.
   * @throws {PermissionAccessException} When the module isn't the permissions module.
   * @throws {RegistrationException} When an answerer is already registered.
   * @example
   * ```ts
   * import type { IModuleLog, IPermissionAnswerer, PermissionCenter, Registration } from "@noldova/desktop.runtime";
   *
   * export function answer(center: PermissionCenter, answerer: IPermissionAnswerer, log: IModuleLog): Registration {
   *   return center.registerAnswerer("notes", answerer, log);
   * }
   * ```
   */
  public registerAnswerer(module: string, answerer: IPermissionAnswerer, log: IModuleLog): Registration;

  /**
   * See {@link IPermissionsContext.listRemembered}.
   *
   * @param module The id of the asking module.
   * @returns The answers, oldest first.
   * @throws {PermissionAccessException} When the module isn't the permissions module, or no store is open.
   * @example
   * ```ts
   * import type { PermissionCenter, RememberedPermission } from "@noldova/desktop.runtime";
   *
   * export function list(center: PermissionCenter): readonly RememberedPermission[] {
   *   return center.listRemembered("notes");
   * }
   * ```
   */
  public listRemembered(module: string): readonly RememberedPermission[];

  /**
   * See {@link IPermissionsContext.revoke}.
   *
   * @param module The id of the asking module.
   * @param id The answer's id.
   * @returns Whether there was such an answer.
   * @throws {PermissionAccessException} When the module isn't the permissions module, or no store is open.
   * @example
   * ```ts
   * import type { PermissionCenter } from "@noldova/desktop.runtime";
   *
   * export function revoke(center: PermissionCenter, id: string): boolean {
   *   return center.revoke("notes", id);
   * }
   * ```
   */
  public revoke(module: string, id: string): boolean;

  /**
   * See {@link IPermissionsContext.onRevoked}.
   *
   * @param module The id of the listening module, whose answers it hears of.
   * @param listener Called with each revoked answer's action, subject and scope.
   * @param log The module's log, which a listener's failure goes to.
   * @returns The listening; disposing it stops it.
   * @example
   * ```ts
   * import type { IModuleLog, PermissionCenter, Registration } from "@noldova/desktop.runtime";
   *
   * export function listen(center: PermissionCenter, log: IModuleLog): Registration {
   *   return center.onRevoked("notes", t => log.write(`Revoked ${t.action}.`), log);
   * }
   * ```
   */
  public onRevoked(module: string, listener: (revocation: PermissionRevocation) => void, log: IModuleLog): Registration;
}

/**
 * Which agent control step a runtime part was refused.
 */
export declare enum AgentControlFailure {
  /**
   * The part stopped an agent session's turn while agent control or a session stops.
   */
  SessionStopRefused = "SessionStopRefused",

  /**
   * The part resumed agent control while it stops or while one of the part's tool calls runs, even past its abort.
   */
  ResumeRefused = "ResumeRefused"
}

/**
 * The exception thrown when a runtime part resumes agent control while one of its own tool calls runs, until its
 * handler returns even past its abort, or while agent control is stopping, or stops a session's turn while agent
 * control or a session stops: only a command the person runs resumes or stops it.
 */
export declare class AgentControlException extends RuntimeException {
  /**
   * Which step the part was refused.
   */
  public readonly reason: AgentControlFailure;

  /**
   * The module whose runtime part was refused.
   */
  public readonly moduleId: string;

  /**
   * Creates the exception, with its message from the package's own text for the reason.
   *
   * @param reason Which step the part was refused.
   * @param moduleId The module whose runtime part was refused.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { AgentControlException, AgentControlFailure } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new AgentControlException(AgentControlFailure.ResumeRefused, "notes");
   * }
   * ```
   */
  public constructor(reason: AgentControlFailure, moduleId: string, options?: ExceptionOptions);
}

/**
 * The category of the exceptions thrown when a module that isn't the app's permissions module
 * reaches for the answerer or the remembered answers, or when Noldova Desktop's database isn't
 * open for them: {@link PermissionsClosedException} and {@link PermissionsModuleOnlyException}.
 * Catch it to handle either.
 */
export declare abstract class PermissionAccessException extends RuntimeException {
  /**
   * Creates the exception, for a subclass.
   *
   * @param message What went wrong.
   * @param options The failure that caused it, if any.
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a module reaches for the answerer or the remembered answers while
 * Noldova Desktop's database is not open.
 */
export declare class PermissionsClosedException extends PermissionAccessException {
  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { PermissionsClosedException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PermissionsClosedException();
   * }
   * ```
   */
  public constructor(options?: ExceptionOptions);
}

/**
 * The exception thrown when a module that isn't the one the app names in
 * `desktop.product.permissionsModule` reaches for the answerer or the remembered answers.
 */
export declare class PermissionsModuleOnlyException extends PermissionAccessException {
  /**
   * The refused module.
   */
  public readonly moduleId: string;

  /**
   * Creates the exception.
   *
   * @param moduleId The refused module.
   * @param options The failure that caused it, if any.
   * @example
   * ```ts
   * import { PermissionsModuleOnlyException } from "@noldova/desktop.runtime";
   *
   * export function fail(): never {
   *   throw new PermissionsModuleOnlyException("notes");
   * }
   * ```
   */
  public constructor(moduleId: string, options?: ExceptionOptions);
}

/**
 * How a module's runtime part shares one of its own files with its window
 * part, as `IRuntimeFiles.shareAsync` takes it.
 */
export interface IFileShareOptions {
  /**
   * The media type the main process serves the file as when it is on its
   * allow-list of raster images, `image/png`, `image/jpeg`, `image/gif` and
   * `image/webp`; `application/octet-stream` otherwise, and by default.
   */
  readonly mediaType?: string;

  /**
   * How long the share lives, in milliseconds, from 1 to 600000; ten minutes
   * by default.
   */
  readonly lifetime?: number;
}

/**
 * The app's own windows as a runtime part sees them, so a module that acts on the screen can leave them alone. Any
 * window of a listed window's process is the app's too, its dialogs, menus and tooltips among them.
 */
export interface IAppWindows {
  /**
   * Lists the app's windows.
   *
   * @returns The windows, in the order they opened; empty while the app's main process isn't connected.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function processIds(context: IRuntimePartContext): readonly number[] {
   *   return [...new Set(context.appWindows.list().map(t => t.processId))];
   * }
   * ```
   */
  list(): readonly AppWindow[];

  /**
   * Listens for a change to the list: a window opening or closing, or the main process connecting or going, even with no window open.
   * The runtime withdraws the listener when the part deactivates.
   *
   * @param listener Called after each change.
   * @returns A function that stops the listening.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function watch(context: IRuntimePartContext, report: (count: number) => void): () => void {
   *   return context.appWindows.onChanged(() => report(context.appWindows.list().length));
   * }
   * ```
   */
  onChanged(listener: () => void): () => void;
}

/**
 * The app's shortcuts as a runtime part sees them, so a module that sends keys can refuse them: the window's
 * shortcuts as the person bound them, the stop key, and on macOS the app and window menus' keys.
 */
export interface IAppShortcuts {
  /**
   * Lists the app's shortcuts.
   *
   * @returns The shortcuts; empty while the app's main process isn't connected.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function globalKeys(context: IRuntimePartContext): readonly string[] {
   *   return context.shortcuts.list().filter(t => t.isGlobal).map(t => t.key.text);
   * }
   * ```
   */
  list(): readonly AppShortcut[];

  /**
   * Tells whether a key is one of the app's shortcuts, matched as the platform matches keys, so `Mod` and `Ctrl` are
   * one key on Windows and Linux.
   *
   * @param key The key chord.
   * @returns Whether a shortcut has that key.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function maySend(context: IRuntimePartContext, key: string): boolean {
   *   return !context.shortcuts.has(KeyChord.parse(key));
   * }
   * ```
   */
  has(key: KeyChord): boolean;

  /**
   * Listens for a change to the list: a binding, a module's commands, the stop key, or the main process connecting
   * or going. The runtime withdraws the listener when the part deactivates.
   *
   * @param listener Called after each change.
   * @returns A function that stops the listening.
   *
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export function watch(context: IRuntimePartContext, report: (count: number) => void): () => void {
   *   return context.shortcuts.onChanged(() => report(context.shortcuts.list().length));
   * }
   * ```
   */
  onChanged(listener: () => void): () => void;
}

/**
 * What a module's runtime part does with files and its window part: it
 * redeems each grant the window part passes, once, and shares its own files
 * for the window part to load by address.
 */
export interface IRuntimeFiles {
  /**
   * Redeems a grant inside the window part's request that passed it, and
   * ends the grant. Redeem it at once, when the person attaches the file, and
   * copy what the part keeps into its own folder: a grant lives at most ten
   * minutes, and ends when its page reloads or its window closes.
   *
   * @param grant The grant the window part passed.
   * @param request The window part's request.
   * @returns The open file, which the part closes.
   * @throws MethodFailureException asynchronously, as
   * `FileGrantTable.redeemAsync` says, when the grant is unknown, ended,
   * another module's or another page's, or the file changed or is no longer a
   * regular file.
   *
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import { JsonReader, type JsonValue } from "@noldova/context.json";
   * import type { IRuntimePartContext, RequestContext } from "@noldova/desktop.runtime";
   *
   * export async function attachAsync(context: IRuntimePartContext, request: RequestContext): Promise<JsonValue> {
   *   await using file = await context.files.redeemAsync(JsonReader.fromValue(request.payload).readString("grant"), request);
   *   await file.handle.writeFile(path.join(await context.getWorkFolderAsync(), file.name));
   *   return file.size;
   * }
   * ```
   */
  redeemAsync(grant: string, request: RequestContext): Promise<GrantedFile>;

  /**
   * Shares a regular file in the module's own data or work folder with the
   * page of the window part's request that asks for it, and answers its
   * grant, which the window part turns into an address with
   * `IWindowPartContext.fileAddressOf`. The page loads the file by that
   * address as often as it needs, and nothing passes through the protocol as
   * text. A share ends when the window part discards it or is withdrawn, its
   * page reloads, its window closes, or its lifetime runs out; the main
   * process serves nothing for a file changed or replaced since it was
   * shared.
   *
   * @param file The file's path; a link is followed, and the file it leads
   * to must be in the module's data folder or work folder too.
   * @param request The window part's request.
   * @param options The media type and lifetime.
   * @returns The share's grant, 32 lowercase hexadecimal digits.
   * @throws MethodFailureException asynchronously: `Unauthorized` outside a
   * request from a window's page, `InvalidParams` for a file outside the
   * module's folders or one that is not a regular file, `NotFound` for one
   * that can't be read, and `Conflict` when the window holds 256 live grants
   * and shares.
   * @throws ArgumentOutOfRangeException asynchronously when the lifetime is
   * not a whole number from 1 to 600000.
   * @throws ArgumentException asynchronously when the media type is blank.
   *
   * @example
   * ```ts
   * import path from "node:path";
   *
   * import type { JsonValue } from "@noldova/context.json";
   * import type { IRuntimePartContext, RequestContext } from "@noldova/desktop.runtime";
   *
   * export async function showAsync(context: IRuntimePartContext, request: RequestContext): Promise<JsonValue> {
   *   return await context.files.shareAsync(path.join(context.moduleFolder, "photo.png"), request, { mediaType: "image/png" });
   * }
   * ```
   */
  shareAsync(file: string, request: RequestContext, options?: IFileShareOptions): Promise<string>;
}

/**
 * What a module's runtime part does with its own web views, by their ids, as
 * `documents/WEB-VIEWS.md` says; it never reaches another module's.
 */
export interface IRuntimeWebViews {
  /**
   * The debugging protocol relay to the module's views.
   */
  readonly relay: IWebViewRelay;

  /**
   * Lists the module's open views, each with its id, pane and profile key.
   *
   * @returns The views.
   */
  list(): readonly WebViewInfo[];

  /**
   * Loads an address in a view, after the origin check.
   *
   * @param id The view's id.
   * @param url The address.
   * @returns A promise of the answer: `Started`, or `Refused` with the origin.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  navigateAsync(id: string, url: string): Promise<WebViewNavigation>;

  /**
   * Moves a view back or forward, or reloads or stops it.
   *
   * @param id The view's id.
   * @param action `Back`, `Forward`, `Reload` or `Stop`.
   * @returns A promise of the answer: `Started`, `Refused` with the origin, or
   * `NoHistory`.
   * @throws {ArgumentException} The promise rejects for any other action.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  actAsync(id: string, action: WebViewAction): Promise<WebViewNavigation>;

  /**
   * Sets the origins a view may load, from the person's answers and the
   * app's settings, never from a tool's arguments alone.
   *
   * @param id The view's id.
   * @param origins The origins.
   * @returns A promise that settles once the main process applied them.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  setAllowedOriginsAsync(id: string, origins: readonly string[]): Promise<void>;

  /**
   * Marks whether an agent controls a view. While it does, the window keeps the view painted even while it is hidden, so a
   * page it loads there draws and takes the relay's clicks and keys, behind the shown content and out of the person's reach;
   * when control ends, a hidden view hides again. The main process keeps the mark for the view until the view closes, which
   * ends it. The runtime part marks the whole span, from the agent's first call or its opening the view until it closes the
   * view, the person takes over or stops it, or the session ends.
   *
   * @param id The view's id.
   * @param isControlled Whether an agent controls the view.
   * @returns A promise that settles once the main process applied it.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  setControlledAsync(id: string, isControlled: boolean): Promise<void>;

  /**
   * Clears a profile's cookies, storage and cache, and ends the pending calls
   * of its views.
   *
   * @param profileKey The profile's key.
   * @returns A promise that settles once the profile is cleared.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  clearProfileAsync(profileKey: string): Promise<void>;

  /**
   * Reports every event of the module's views but the relay's.
   *
   * @param listener Hears each event, with its view's id.
   * @returns A release.
   * @example
   * ```ts
   * import type { IRuntimePart, IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export class BrowserRuntimePart implements IRuntimePart {
   *   public activateAsync(context: IRuntimePartContext): Promise<void> {
   *     context.webViews.onViewEvent(t => context.log.write(`${t.view} ${t.kind}`));
   *     return Promise.resolve();
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  onViewEvent(listener: (event: WebViewEvent) => void): () => void;
}

/**
 * Carries the debugging protocol calls and events a module declares in its
 * `webViews.json` to and from its own views.
 */
export interface IWebViewRelay {
  /**
   * Sends one declared call to a view.
   *
   * @param id The view's id.
   * @param method The method, such as `Page.captureScreenshot`.
   * @param params Its parameters, within the declared bounds.
   * @param timeout The milliseconds the main process waits for the reply, at
   * most 10 000.
   * @returns A promise of the reply.
   * @throws {ArgumentException} The promise rejects when the method, the
   * parameters or the timeout isn't valid.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  sendAsync(id: string, method: string, params: JsonObject, timeout: number): Promise<JsonValue>;

  /**
   * Reports a view's declared events.
   *
   * @param id The view's id.
   * @param listener Hears each event.
   * @returns A release.
   */
  onProtocolEvent(id: string, listener: (event: WebViewProtocolEvent) => void): () => void;
}

/**
 * One item of a tool's result or failure: text or an image, marked when it holds content from outside the module.
 */
export declare class ToolContent {
  /**
   * What the item holds.
   */
  public readonly kind: ToolContentKind;

  /**
   * The text, or the image's base64 data.
   */
  public readonly value: string;

  /**
   * The image's type, `image/png` or `image/jpeg`; `null` for text.
   */
  public readonly mimeType: string | null;

  /**
   * Where untrusted content came from: a web origin such as `https://example.com`, or `<id>:<label>`, such as
   * `notes:import` or `notes:opaque`; `null` for the module's own content.
   */
  public readonly origin: string | null;

  private constructor();

  /**
   * Whether the item holds content from outside the module.
   */
  public get isUntrusted(): boolean;

  /**
   * Creates a text item.
   *
   * @param text The text; the registry refuses more than 256 KiB of UTF-8, or more than the tool's own limit.
   * @param origin Where untrusted text came from, at most 1,024 characters; `null` for the module's own text.
   * @returns The item.
   * @throws {ArgumentException} When the origin is blank or too long.
   * @example
   * ```ts
   * import { ToolContent } from "@noldova/desktop.runtime";
   *
   * export function quote(page: string, origin: string): ToolContent {
   *   return ToolContent.fromText(page, origin);
   * }
   * ```
   */
  public static fromText(text: string, origin: string | null): ToolContent;

  /**
   * Creates an image item.
   *
   * @param data The image as base64; the registry refuses more than 1 MiB before base64, or more than the tool's own
   * limits.
   * @param mimeType `image/png` or `image/jpeg`, which the data must be.
   * @param origin Where an untrusted image came from, at most 1,024 characters; `null` for the module's own image.
   * @returns The item.
   * @throws {ArgumentException} When the type isn't PNG or JPEG, the data isn't base64, or the origin is blank or
   * too long.
   * @example
   * ```ts
   * import { ToolContent } from "@noldova/desktop.runtime";
   *
   * export function capture(png: Buffer, origin: string): ToolContent {
   *   return ToolContent.fromImage(png.toString("base64"), "image/png", origin);
   * }
   * ```
   */
  public static fromImage(data: string, mimeType: string, origin: string | null): ToolContent;

  /**
   * Writes the item as JSON, with its mark: `isUntrusted`, and the origin when it is untrusted.
   *
   * @returns The item's JSON.
   * @example
   * ```ts
   * import { ToolContent } from "@noldova/desktop.runtime";
   *
   * export const item = ToolContent.fromText("Saved.", null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A tool's result: its content items, and the structured fields its output schema describes.
 */
export declare class ToolResult {
  /**
   * Always `false`, which tells a result from a {@link ToolFailure}.
   */
  public readonly isFailure: false;

  /**
   * The content items.
   */
  public readonly content: readonly ToolContent[];

  /**
   * The structured fields, which always count as untrusted; `null` for a tool without an output schema.
   */
  public readonly structured: JsonObject | null;

  /**
   * The permission requests the call raised and that were decided, in the order raised; none when it raised none.
   * The registry fills them in on the result a call returns, whatever the module gave.
   */
  public readonly requests: readonly PermissionRecord[];

  /**
   * Creates the result.
   *
   * @param content The content items.
   * @param structured The structured fields, which a tool with an output schema always gives; `null` by default.
   * @param requests The call's permission requests; none by default.
   * @example
   * ```ts
   * import { ToolContent, ToolResult } from "@noldova/desktop.runtime";
   *
   * export function found(count: number): ToolResult {
   *   return new ToolResult([ToolContent.fromText(`Found ${count} notes.`, null)], { count });
   * }
   * ```
   */
  public constructor(content: readonly ToolContent[], structured?: JsonObject | null, requests?: readonly PermissionRecord[]);

  /**
   * Writes the result as JSON.
   *
   * @returns The result's JSON, with `isFailure`, `content`, `structured` and `requests`.
   * @example
   * ```ts
   * import { ToolResult } from "@noldova/desktop.runtime";
   *
   * export const empty = new ToolResult([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * How a call failed, as `documents/TOOLS.md` says.
 */
export declare class ToolFailure {
  /**
   * Always `true`, which tells a failure from a {@link ToolResult}.
   */
  public readonly isFailure: true;

  /**
   * The shared code.
   */
  public readonly code: ToolFailureCode;

  /**
   * The message for the agent.
   */
  public readonly message: string;

  /**
   * The module's own code, `<id>.<camelCase>`, such as `notes.indexBusy`; `null` when there is none.
   */
  public readonly moduleCode: string | null;

  /**
   * Content items, such as the output a command printed before it failed.
   */
  public readonly content: readonly ToolContent[];

  /**
   * One of the module's tools that tells the agent where things stand, which `OutcomeUncertain` always names; `null`
   * when there is none.
   */
  public readonly nextTool: string | null;

  /**
   * The permission requests the call raised and that were decided, in the order raised; none when it raised none.
   * The registry fills them in on the failure a call returns, whatever the module gave.
   */
  public readonly requests: readonly PermissionRecord[];

  /**
   * Creates the failure.
   *
   * @param code The shared code.
   * @param message The message for the agent; not blank.
   * @param moduleCode The module's own code, or `null`, by default.
   * @param content Content items; none by default.
   * @param nextTool One of the module's tools that tells the agent where things stand, or `null`, by default.
   * @param requests The call's permission requests; none by default.
   * @throws {ArgumentException} When the message is empty or whitespace.
   * @example
   * ```ts
   * import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
   *
   * export const busy = new ToolFailure(ToolFailureCode.Unavailable, "The index is being rebuilt.", "notes.indexBusy");
   * ```
   */
  public constructor(
    code: ToolFailureCode,
    message: string,
    moduleCode?: string | null,
    content?: readonly ToolContent[],
    nextTool?: string | null,
    requests?: readonly PermissionRecord[]);

  /**
   * Writes the failure as JSON.
   *
   * @returns The failure's JSON, with `isFailure`, `code`, `message`, `moduleCode`, `content`, `nextTool` and `requests`.
   * @example
   * ```ts
   * import { ToolFailure, ToolFailureCode } from "@noldova/desktop.runtime";
   *
   * export const json = new ToolFailure(ToolFailureCode.Refused, "The query is empty.").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A registered tool's descriptor, checked against the rules of {@link IToolDescriptor}.
 */
export declare class ToolDescriptor {
  /**
   * The tool's name.
   */
  public readonly name: string;

  /**
   * The short name people see; `null` when there is none.
   */
  public readonly title: string | null;

  /**
   * What the tool does, for the agent.
   */
  public readonly description: string;

  /**
   * The JSON Schema object for the arguments.
   */
  public readonly inputSchema: JsonObject;

  /**
   * The JSON Schema object for the structured fields; `null` when there is none.
   */
  public readonly outputSchema: JsonObject | null;

  /**
   * The hints, as the module gave them.
   */
  public readonly hints: IToolHints;

  /**
   * The risk.
   */
  public readonly risk: IToolRiskRange;

  /**
   * Whether a later call can safely finish what an interrupted one began.
   */
  public readonly isResumable: boolean;

  /**
   * Whether the handler reports its point of no return.
   */
  public readonly marksSending: boolean;

  /**
   * The deadline.
   */
  public readonly deadline: IToolDeadline;

  /**
   * What calls take turns on; `null` when calls run in parallel.
   */
  public readonly resource: string | null;

  /**
   * The tool's own result limits.
   */
  public readonly limits: IToolLimits;

  /**
   * The tool that tells the agent where things stand; `null` for a read-only or resumable tool without one.
   */
  public readonly nextTool: string | null;

  /**
   * Checks and copies a descriptor.
   *
   * @param descriptor The descriptor.
   * @param tools The module's declared tools, which `nextTool` must be among.
   * @throws {ArgumentException} When the description or the title is blank, the default risk is above the maximum,
   * the resource is neither a JSON Pointer nor `binding:<name>`, or `nextTool` is missing or undeclared.
   * @throws {ArgumentOutOfRangeException} When the deadline or a limit is out of its range.
   * @example
   * ```ts
   * import { ToolDescriptor, ToolRisk } from "@noldova/desktop.runtime";
   *
   * export const search = new ToolDescriptor({
   *   name: "notes_search",
   *   description: "Searches the notes.",
   *   inputSchema: { type: "object" },
   *   hints: { isReadOnly: true },
   *   risk: { default: ToolRisk.Low, maximum: ToolRisk.Low },
   *   deadline: { default: 5_000, maximum: 30_000 }
   * }, ["notes_search"]);
   * ```
   */
  public constructor(descriptor: IToolDescriptor, tools: readonly string[]);

  /**
   * Whether the tool only reads.
   */
  public get isReadOnly(): boolean;

  /**
   * Whether a call can end as `OutcomeUncertain`: the tool is neither read-only nor resumable.
   */
  public get canBeUncertain(): boolean;

  /**
   * Writes the descriptor as JSON, leaving out what is absent.
   *
   * @returns The descriptor's JSON, which the app passes on to its agents.
   * @example
   * ```ts
   * import type { ToolSession } from "@noldova/desktop.runtime";
   *
   * export function describe(session: ToolSession): readonly object[] {
   *   return session.listTools().map(t => t.toJson());
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One call as a tool's handler sees it.
 */
export declare class ToolCall {
  /**
   * The id of the agent session that made the call.
   */
  public readonly session: string;

  /**
   * The app's name for what the session acts for.
   */
  public readonly scope: string;

  /**
   * What the app attached to the session, by binding name.
   */
  public readonly bindings: JsonObject;

  /**
   * The call's arguments.
   */
  public readonly arguments: JsonObject;

  /**
   * When the call's deadline passes, in milliseconds since the epoch. Each permission request's wait moves it later,
   * since the deadline doesn't run while a request waits, so a handler reads it when it needs it and keeps no copy.
   */
  public get deadline(): number;

  /**
   * Aborts with a {@link ToolAbortReason} when the call is stopped, cancelled, ends with its session, is switched
   * off or reaches its deadline.
   */
  public readonly signal: AbortSignal;

  /**
   * Creates the call.
   *
   * @param session The session's id.
   * @param scope The session's scope.
   * @param bindings The session's bindings.
   * @param input The call's arguments.
   * @param deadline When the deadline passes, in milliseconds since the epoch.
   * @param signal The call's signal.
   * @param permissions Carries the call's permission requests; without it, as in a module's own tests, every request
   * is denied.
   * @param now Reads the time, in milliseconds since the epoch, to move the deadline by a permission request's wait; by
   * default, `Date.now`.
   * @example
   * ```ts
   * import { PermissionDecision, PermissionOutcome, ToolCall } from "@noldova/desktop.runtime";
   *
   * export function createCall(signal: AbortSignal): ToolCall {
   *   return new ToolCall("session-1", "conversation-1", {}, { query: "plans" }, Date.now() + 5_000, signal, {
   *     requestAsync: () => Promise.resolve(new PermissionOutcome(PermissionDecision.AllowedOnce))
   *   });
   * }
   * ```
   */
  public constructor(session: string, scope: string, bindings: JsonObject, input: JsonObject, deadline: number, signal: AbortSignal, permissions?: IToolCallPermissions, now?: () => number);

  /**
   * Whether the handler has reported its point of no return.
   */
  public get hasMarkedSending(): boolean;

  /**
   * Whether the handler has reported, since it last marked sending, that nothing of the call reached the outside.
   */
  public get hasMarkedNothingSent(): boolean;

  /**
   * Reports the call's point of no return, the first step that may change something outside the module, for a tool
   * that declares `marksSending`. When the call has already been aborted, it throws the signal's reason instead, so
   * nothing more runs.
   *
   * @example
   * ```ts
   * import type { ToolCall } from "@noldova/desktop.runtime";
   *
   * export async function sendAsync(call: ToolCall, send: () => Promise<void>): Promise<void> {
   *   call.markSending();
   *   await send();
   * }
   * ```
   */
  public markSending(): void;

  /**
   * Reports that nothing of the call reached the outside, such as when the step after {@link ToolCall.markSending}
   * checked its target and refused before it sent anything. The registry then ends the call as before its point of
   * no return: a failure keeps its own code, such as `Stale` or `Refused`, rather than `OutcomeUncertain`, and an
   * abort ends it with the abort's own code, also when the handler calls it within the grace after the abort. A
   * handler calls it only when it knows that no input of the call was sent, and a later {@link ToolCall.markSending}
   * undoes it. It counts only for a tool whose descriptor sets `marksSending`; any other tool passes its point of no
   * return when its handler starts.
   *
   * @example
   * ```ts
   * import { type ToolCall, ToolFailure, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";
   *
   * export async function clickAsync(call: ToolCall, post: () => Promise<boolean>): Promise<void> {
   *   call.markSending();
   *   if (!await post()) {
   *     call.markNothingSent();
   *     throw new ToolFailureException(new ToolFailure(ToolFailureCode.Stale, "The window moved before the click.", "pointer.windowMoved"));
   *   }
   * }
   * ```
   */
  public markNothingSent(): void;

  /**
   * Asks whether this call may take one action on one subject, as `documents/PERMISSIONS.md` says, with the
   * session and the scope from the call. A call has one request waiting at a time, and its deadline doesn't run
   * while one waits. The handler acts only on {@link PermissionOutcome.isAllowed}, fails the call as `Denied`,
   * `Expired` or `Withdrawn` otherwise, and fails it as `Stale` when what the person allowed changed before it acts.
   *
   * @param request The action, subject, title, details, risk and options.
   * @returns A promise of the decision; it never rejects. A request that is invalid or over a limit, a second one
   * while one waits, one raised after the call ended, and every request while the app has no answerer are
   * `Denied`, and the module's log says why; a request raised after the call was aborted is `Withdrawn`.
   * @example
   * ```ts
   * import {
   *   PermissionDetailKind, PermissionOption, ToolCall, ToolFailure, ToolFailureCode, ToolFailureException, ToolResult, ToolRisk
   * } from "@noldova/desktop.runtime";
   *
   * export async function deleteAsync(call: ToolCall, id: string, remove: () => Promise<void>): Promise<ToolResult> {
   *   const outcome = await call.requestPermissionAsync({
   *     action: "notes.deleteItem",
   *     subject: id,
   *     title: "Delete a note",
   *     details: [{ label: "Note", kind: PermissionDetailKind.Text, value: id }],
   *     risk: ToolRisk.Medium,
   *     options: [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny]
   *   });
   *   if (!outcome.isAllowed)
   *     throw new ToolFailureException(new ToolFailure(ToolFailureCode.Denied, "The person did not allow it."));
   *   await remove();
   *   return new ToolResult([]);
   * }
   * ```
   */
  public requestPermissionAsync(request: IPermissionRequest): Promise<PermissionOutcome>;
}

/**
 * An agent session: one agent's use of the app's tools, which the app opens and ends.
 */
export declare class ToolSession {
  /**
   * The session's id.
   */
  public readonly id: string;

  /**
   * The app's name for what the session acts for.
   */
  public readonly scope: string;

  /**
   * What the app attached to the session, by binding name.
   */
  public readonly bindings: JsonObject;

  /**
   * Creates the session; the app opens one through {@link IToolsContext.openSession}.
   *
   * @param id The session's id.
   * @param scope The app's name for what the session acts for.
   * @param bindings What the app attaches to the session.
   * @param host What answers the session's calls.
   * @example
   * ```ts
   * import { ToolRegistry, ToolSession } from "@noldova/desktop.runtime";
   *
   * export const session = new ToolSession("session-1", "conversation-1", {}, new ToolRegistry());
   * ```
   */
  public constructor(id: string, scope: string, bindings: JsonObject, host: IToolSessionHost);

  /**
   * Lists the registered tools.
   *
   * @returns Their descriptors; the app decides which ones its agent sees.
   * @example
   * ```ts
   * import type { ToolSession } from "@noldova/desktop.runtime";
   *
   * export function listNames(session: ToolSession): readonly string[] {
   *   return session.listTools().map(t => t.name);
   * }
   * ```
   */
  public listTools(): readonly ToolDescriptor[];

  /**
   * Calls a tool. The registry checks the arguments, the deadline and the session's calls in flight, runs the call
   * in its resource's turn, ends it at its deadline even if the handler hasn't returned, and checks the result
   * against its limits and marks. An aborted call whose handler has started is answered after up to one second, with
   * the handler's own failure's message, module code and content when the handler rejects with one in that time,
   * under the code and next tool the abort gives.
   *
   * @param name The tool's name.
   * @param input The arguments, at most 64 KiB as JSON.
   * @param options The deadline and the signal; none by default.
   * @returns A promise of the result or the failure; it never rejects.
   * @example
   * ```ts
   * import type { ToolFailure, ToolResult, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function searchAsync(session: ToolSession, signal: AbortSignal): Promise<ToolResult | ToolFailure> {
   *   return session.callAsync("notes_search", { query: "plans" }, { deadlineMilliseconds: 10_000, signal });
   * }
   * ```
   */
  public callAsync(name: string, input: JsonObject, options?: IToolCallOptions): Promise<ToolResult | ToolFailure>;

  /**
   * Ends the session: its calls in flight abort with `SessionEnded`, and every part that listens learns of it.
   *
   * @example
   * ```ts
   * import type { ToolSession } from "@noldova/desktop.runtime";
   *
   * export function finish(session: ToolSession): void {
   *   session.end();
   * }
   * ```
   */
  public end(): void;
}

/**
 * The runtime's tool registry: the tools modules register, the agent sessions apps open, and their calls, as
 * `documents/TOOLS.md` says.
 */
export declare class ToolRegistry implements IToolSessionHost {
  /**
   * Creates the registry.
   *
   * @param createId Creates each session's id; a random UUID by default.
   * @param schemas Checks the tools' schemas, a call's arguments and a result's structured fields; a
   * {@link ToolSchemaValidator} by default.
   * @param permissions Carries the calls' permission requests; a center that names no permissions module, so that
   * every request is denied, by default.
   * @param endGraceMilliseconds How long a call that was stopped or passed its deadline may still answer before it
   * ends without its handler's answer; a positive whole number, 1000 by default.
   * @throws {ArgumentOutOfRangeException} When `endGraceMilliseconds` isn't a positive whole number.
   * @example
   * ```ts
   * import { randomUUID } from "node:crypto";
   *
   * import { PermissionCenter, ToolRegistry, ToolSchemaValidator } from "@noldova/desktop.runtime";
   *
   * export const registry = new ToolRegistry(randomUUID, new ToolSchemaValidator(), new PermissionCenter("notes"));
   * ```
   */
  public constructor(createId?: () => string, schemas?: IToolSchemaValidator, permissions?: PermissionCenter, endGraceMilliseconds?: number);

  /**
   * Carries the calls' permission requests and keeps their remembered answers.
   */
  public readonly permissions: PermissionCenter;

  /**
   * Registers a tool.
   *
   * @param moduleId The id of the module that offers it.
   * @param descriptor The checked descriptor.
   * @param handler Handles its calls.
   * @param moduleTools The module's declared tools.
   * @param log The module's log, which a handler's internal failures go to.
   * @returns The registration; disposing it withdraws the tool and ends its calls in flight with `SwitchedOff`.
   * @throws {RegistrationException} When the name is already registered.
   * @throws {ArgumentException} When the schema validator refuses its input or output schema.
   * @example
   * ```ts
   * import type { IModuleLog, IToolHandler, Registration, ToolDescriptor, ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function offer(registry: ToolRegistry, descriptor: ToolDescriptor, handler: IToolHandler, log: IModuleLog): Registration {
   *   return registry.register("notes", descriptor, handler, [descriptor.name], log);
   * }
   * ```
   */
  public register(moduleId: string, descriptor: ToolDescriptor, handler: IToolHandler, moduleTools: readonly string[], log: IModuleLog): Registration;

  /**
   * See {@link IToolsContext.onSessionEnded}.
   *
   * @param listener Called with the ended session's id.
   * @param log The listening module's log, which takes a listener's failure.
   * @returns The listening; disposing it stops it.
   * @example
   * ```ts
   * import type { IModuleLog, Registration, ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function forgetEnded(registry: ToolRegistry, holds: Map<string, string>, log: IModuleLog): Registration {
   *   return registry.onSessionEnded(t => holds.delete(t), log);
   * }
   * ```
   */
  public onSessionEnded(listener: (session: string) => void, log: IModuleLog): Registration;

  /**
   * See {@link IToolsContext.openSession}.
   *
   * @param scope The app's name for what the session acts for; at most 256 characters.
   * @param bindings What the app attaches to the session.
   * @returns The session.
   * @throws {ArgumentOutOfRangeException} When the scope is longer than 256 characters.
   * @example
   * ```ts
   * import type { ToolRegistry, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function openConversation(registry: ToolRegistry, conversation: string): ToolSession {
   *   return registry.openSession(conversation, {});
   * }
   * ```
   */
  public openSession(scope: string, bindings: JsonObject): ToolSession;

  /**
   * Whether an agent session is open: opened by the registry and not yet ended.
   *
   * @param session The session.
   * @returns True from its opening until it ends.
   * @example
   * ```ts
   * import type { ToolRegistry, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function canCall(registry: ToolRegistry, session: ToolSession): boolean {
   *   return registry.isOpen(session);
   * }
   * ```
   */
  public isOpen(session: ToolSession): boolean;

  /**
   * See {@link IToolSessionHost.listTools}.
   *
   * @returns The registered tools' descriptors, without those of a module whose tools are closed.
   * @example
   * ```ts
   * import type { ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function count(registry: ToolRegistry): number {
   *   return registry.listTools().length;
   * }
   * ```
   */
  public listTools(): readonly ToolDescriptor[];

  /**
   * Closes a module's tools to new calls as its runtime part's deactivation starts: they leave
   * {@link listTools}, and a new call of one, or a call still waiting for its resource's turn, fails
   * as `Unavailable` without reaching the handler; calls already running go on. Closing is final for
   * the registry's life, so tools the module registers again stay closed.
   *
   * @param moduleId The module's id.
   * @example
   * ```ts
   * import type { ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function closeNotes(registry: ToolRegistry): void {
   *   registry.close("notes");
   * }
   * ```
   */
  public close(moduleId: string): void;

  /**
   * See {@link ToolSession.callAsync}.
   *
   * @param session The calling session; an ended one gets `Unavailable`.
   * @param name The tool's name; an unregistered one, or one of a module whose tools are closed, gets `Unavailable`.
   * @param input The arguments.
   * @param options The deadline and the signal.
   * @returns A promise of the result or the failure; it never rejects.
   * @example
   * ```ts
   * import type { ToolFailure, ToolRegistry, ToolResult, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function searchAsync(registry: ToolRegistry, session: ToolSession): Promise<ToolResult | ToolFailure> {
   *   return registry.callAsync(session, "notes_search", { query: "plans" }, {});
   * }
   * ```
   */
  public callAsync(session: ToolSession, name: string, input: JsonObject, options: IToolCallOptions): Promise<ToolResult | ToolFailure>;

  /**
   * See {@link IToolSessionHost.end}.
   *
   * @param session The session.
   * @example
   * ```ts
   * import type { ToolRegistry, ToolSession } from "@noldova/desktop.runtime";
   *
   * export function close(registry: ToolRegistry, session: ToolSession): void {
   *   registry.end(session);
   * }
   * ```
   */
  public end(session: ToolSession): void;

  /**
   * Whether agent control is stopped, so that every call fails with `Stopped`.
   */
  public get isStopped(): boolean;

  /**
   * Whether any agent session is open, from `openSession` until its `end`.
   */
  public get isActing(): boolean;

  /**
   * See {@link IToolsContext.onStopped}.
   *
   * @param listener Called with the stop's reason.
   * @param log The listening module's log, which takes a listener's failure.
   * @returns The listening; disposing it stops it.
   * @example
   * ```ts
   * import type { IModuleLog, Registration, ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function showStopped(registry: ToolRegistry, show: (reason: string) => void, log: IModuleLog): Registration {
   *   return registry.onStopped(show, log);
   * }
   * ```
   */
  public onStopped(listener: (reason: string) => void, log: IModuleLog): Registration;

  /**
   * See {@link IToolsContext.onResumed}.
   *
   * @param listener Called when agent control resumes.
   * @param log The listening module's log, which takes a listener's failure.
   * @returns The listening; disposing it stops it.
   * @example
   * ```ts
   * import type { IModuleLog, Registration, ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function hideStopped(registry: ToolRegistry, hide: () => void, log: IModuleLog): Registration {
   *   return registry.onResumed(hide, log);
   * }
   * ```
   */
  public onResumed(listener: () => void, log: IModuleLog): Registration;

  /**
   * See {@link IToolsContext.onSessionStopped}.
   *
   * @param listener Called with the session's id and the stop's reason.
   * @param log The listening module's log, which takes a listener's failure.
   * @returns The listening; disposing it stops it.
   * @example
   * ```ts
   * import type { IModuleLog, Registration, ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function endTurns(registry: ToolRegistry, endTurn: (session: string, reason: string) => void, log: IModuleLog): Registration {
   *   return registry.onSessionStopped(endTurn, log);
   * }
   * ```
   */
  public onSessionStopped(listener: (session: string, reason: string) => void, log: IModuleLog): Registration;

  /**
   * Listens for any change of `isStopped` or `isActing`, for the runtime's own report of agent control.
   *
   * @param listener Called after each change.
   * @returns The listening; disposing it stops it.
   * @example
   * ```ts
   * import type { Registration, ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function watch(registry: ToolRegistry, report: (isStopped: boolean) => void): Registration {
   *   return registry.onControlChanged(() => report(registry.isStopped));
   * }
   * ```
   */
  public onControlChanged(listener: () => void): Registration;

  /**
   * See {@link IToolsContext.stopAll}.
   *
   * @param reason Why: one line that isn't blank, of at most 200 characters.
   * @throws {ArgumentException} When the reason is blank, longer than 200 characters or more than one line.
   * @example
   * ```ts
   * import type { ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function stop(registry: ToolRegistry): void {
   *   registry.stopAll("The person stopped agent control.");
   * }
   * ```
   */
  public stopAll(reason: string): void;

  /**
   * See {@link IToolsContext.stopSession}.
   *
   * @param moduleId The id of the module whose part stops the session's turn.
   * @param session The session's id.
   * @param reason Why: one line that isn't blank, of at most 200 characters.
   * @throws {ArgumentException} When the reason is blank, longer than 200 characters or more than one line.
   * @throws {AgentControlException} While agent control or a session's turn is stopping.
   * @example
   * ```ts
   * import type { ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function stopTurn(registry: ToolRegistry, session: string): void {
   *   registry.stopSession("notes", session, "The person stopped the agent in Notes.");
   * }
   * ```
   */
  public stopSession(moduleId: string, session: string, reason: string): void;

  /**
   * See {@link IToolsContext.resumeAll}.
   *
   * @param moduleId The id of the module whose part resumes, which is refused while one of its tool calls runs and
   * while agent control is stopping; null for the person's own command.
   * @throws {AgentControlException} When a tool call of that module runs, until its handler returns even past its
   * abort, or while agent control is stopping.
   * @example
   * ```ts
   * import type { ToolRegistry } from "@noldova/desktop.runtime";
   *
   * export function resume(registry: ToolRegistry): void {
   *   registry.resumeAll(null);
   * }
   * ```
   */
  public resumeAll(moduleId: string | null): void;
}

/**
 * The registry's default schema validator, for the JSON Schema 2020-12 subset that `documents/TOOLS.md` lists: it
 * refuses a schema that uses any other keyword, and checks values against the subset.
 */
export declare class ToolSchemaValidator implements IToolSchemaValidator {
  /**
   * See {@link IToolSchemaValidator.checkSchema}.
   *
   * @param schema The input or output schema.
   * @param parameterName The descriptor field that holds it.
   * @throws {ArgumentException} When the schema's `type` isn't `object`, or it uses a keyword outside the subset or a
   * value a keyword can't take.
   * @example
   * ```ts
   * import { ToolSchemaValidator } from "@noldova/desktop.runtime";
   *
   * new ToolSchemaValidator().checkSchema({ type: "object" }, "inputSchema");
   * ```
   */
  public checkSchema(schema: JsonObject, parameterName: string): void;

  /**
   * See {@link IToolSchemaValidator.findProblem}.
   *
   * @param schema The input or output schema, checked by {@link ToolSchemaValidator.checkSchema}.
   * @param value A call's arguments, or a result's structured fields.
   * @returns A message that names the first value that doesn't fit, by its JSON Pointer, and the keyword it fails,
   * or `null` when the value fits.
   * @example
   * ```ts
   * import { ToolSchemaValidator } from "@noldova/desktop.runtime";
   *
   * export const problem = new ToolSchemaValidator().findProblem(
   *   { type: "object", properties: { query: { type: "string", maxLength: 200 } }, required: ["query"] },
   *   { query: "plans" });
   * ```
   */
  public findProblem(schema: JsonObject, value: JsonObject): string | null;
}

/**
 * Carries a module's web view calls to the main process over its connection,
 * matches each answer to its call, and mirrors each module's open views from
 * the main process's events, as `documents/WEB-VIEWS.md` says. Calls fail as
 * `Unavailable` while no main process is connected, and the ones in flight
 * fail so when its connection ends; its views then close.
 */
export declare class WebViewCenter {
  /**
   * Creates the center.
   *
   * @param diagnostics The runtime's log, for a listener that fails and a list
   * the main process can't give.
   * @param channel The `desktop.webViewCommand` event the calls go out on; with
   * none, no main process is ever reached.
   * @param portsChannel The `desktop.webViewBlockedPorts` event each change of
   * the blocked loopback ports goes out on; with none, a block waits for no
   * acknowledgement.
   * @example
   * ```ts
   * import { ShellEvents } from "@noldova/desktop.protocol";
   * import { type EventRegistry, WebViewCenter } from "@noldova/desktop.runtime";
   *
   * export function createCenter(events: EventRegistry): WebViewCenter {
   *   return new WebViewCenter(process.stderr, events.declare(ShellEvents.webViewCommand), events.declare(ShellEvents.webViewBlockedPorts));
   * }
   * ```
   */
  public constructor(diagnostics: Writable, channel?: EventChannel | null, portsChannel?: EventChannel | null);

  /**
   * Starts a module's mirror, listing its open views when a main process is
   * connected.
   *
   * @param moduleId The module's id.
   * @returns A registration whose disposal ends the mirror and its listeners.
   */
  public attach(moduleId: string): Registration;

  /**
   * Lists a module's open views, as the main process last reported them.
   *
   * @param moduleId The module's id.
   * @returns The views, empty for a module that isn't attached.
   */
  public list(moduleId: string): readonly WebViewInfo[];

  /**
   * Reports every event of a module's views, including the closing of each
   * when the main process's connection ends.
   *
   * @param moduleId The module's id.
   * @param listener Hears each event; one that throws is logged.
   * @returns A release.
   */
  public listen(moduleId: string, listener: (event: WebViewEvent) => void): () => void;

  /**
   * Sends one call to the main process.
   *
   * @param moduleId The calling module's id.
   * @param action The call.
   * @param view The view's id, `null` for `List` and `ClearProfile`.
   * @param value The call's value, as `WebViewCommand` takes it.
   * @returns A promise of the answer's value.
   * @throws {ArgumentException} The promise rejects when the call isn't a
   * valid `WebViewCommand`.
   * @throws {WebViewFailureException} The promise rejects when the main
   * process refuses or fails the call, or can't be reached.
   */
  public commandAsync(moduleId: string, action: WebViewAction, view?: string | null, value?: JsonValue): Promise<JsonValue>;

  /**
   * Settles the call an answer names, when the connection it came on is the
   * one the call went to; any other answer is ignored.
   *
   * @param connection The connection the answer came on.
   * @param answered The answer.
   */
  public answer(connection: number, answered: WebViewAnswered): void;

  /**
   * Adds a loopback port that no web view may reach, such as the runtime's own
   * endpoint or a tool endpoint's, and sends the new list to the connected main
   * process.
   *
   * @param port The port.
   * @returns The new list's serial, which {@link WebViewCenter.waitForPortsAsync}
   * takes.
   */
  public blockPort(port: number): number;

  /**
   * Waits until the connected main process acknowledges a list at least as new
   * as a serial, so that its web views refuse the ports in it; it settles at once
   * when no main process is connected, since no web view is open then, and when
   * the main process goes.
   *
   * @param serial The serial {@link WebViewCenter.blockPort} returned.
   * @param signal Stops the wait.
   * @returns A promise that settles once the list is acknowledged.
   * @throws {Error} The promise rejects with the signal's reason when the signal
   * aborts.
   */
  public waitForPortsAsync(serial: number, signal: AbortSignal): Promise<void>;

  /**
   * Removes a loopback port once its endpoint has closed, and sends the new list
   * to the connected main process; a port it doesn't hold changes nothing.
   *
   * @param port The port.
   */
  public unblockPort(port: number): void;

  /**
   * Reads the blocked loopback ports for the connected main process.
   *
   * @param connection The connection that asks.
   * @returns The list, or `null` for any connection but the main process's.
   */
  public readPorts(connection: number): WebViewBlockedPorts | null;

  /**
   * Settles every wait the main process's acknowledgement covers, when it came
   * on the main process's connection; any other is ignored.
   *
   * @param connection The connection the acknowledgement came on.
   * @param blocked The list the main process acknowledges.
   */
  public answerPorts(connection: number, blocked: WebViewBlockedPorts): void;

  /**
   * Passes a batch of events on to their modules, when it came from the
   * connected main process.
   *
   * @param connection The connection the batch came on.
   * @param events The batch.
   */
  public receive(connection: number, events: WebViewEvents): void;

  /**
   * Follows the main process's connection: when it changes, fails the calls
   * in flight, closes the mirrored views, and lists each module's views again
   * from the new one.
   *
   * @param connection The main process's connection, `null` when none is
   * connected.
   */
  public check(connection: number | null): void;
}

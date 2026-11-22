/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonObject, JsonReader, JsonValue } from "@noldova/context.json";

/**
 * The kinds of message the local protocol carries. A message's `kind` field
 * on the wire holds one of these values.
 */
export declare enum WireMessageKind {
  /**
   * The first message of a connection: the client's build identity and its
   * capability token.
   */
  Handshake = "Handshake",

  /**
   * A call of a method, answered by one response with the same id.
   */
  Request = "Request",

  /**
   * The answer to a handshake or a request.
   */
  Response = "Response",

  /**
   * A notification to connected clients; it is not answered.
   */
  Event = "Event",

  /**
   * Asks the runtime to stop an unanswered request.
   */
  Cancel = "Cancel"
}

/**
 * Why a request, a handshake or a connection failed.
 */
export declare enum FailureCode {
  /**
   * A frame is not a valid message.
   */
  InvalidMessage = "InvalidMessage",

  /**
   * A frame exceeds the connection's maximum length. A frame received over the limit closes the connection; a request or
   * answer over the limit is never sent, and only its call fails.
   */
  FrameTooLarge = "FrameTooLarge",

  /**
   * The client speaks another protocol version than the runtime.
   */
  UnsupportedVersion = "UnsupportedVersion",

  /**
   * The client comes from another build than the runtime. The failure's
   * details are a `RuntimeHandover`.
   */
  BuildMismatch = "BuildMismatch",

  /**
   * The data directory holds data written by a release that predates the
   * shell, which the runtime refuses to open. The failure's details are a
   * `PreShellData`; `desktop.moveAside` moves that data aside at the person's
   * request.
   */
  PreShellData = "PreShellData",

  /**
   * The handshake's capability token is wrong, or the connection has not
   * completed its handshake.
   */
  Unauthorized = "Unauthorized",

  /**
   * No active part registered the requested method.
   */
  UnknownMethod = "UnknownMethod",

  /**
   * The request's payload breaks the method's contract.
   */
  InvalidParams = "InvalidParams",

  /**
   * The request names something that does not exist.
   */
  NotFound = "NotFound",

  /**
   * The request conflicts with the current state.
   */
  Conflict = "Conflict",

  /**
   * The request was cancelled before it completed.
   */
  Cancelled = "Cancelled",

  /**
   * The request did not complete within its time limit.
   */
  DeadlineExceeded = "DeadlineExceeded",

  /**
   * The runtime cannot serve the request now, such as while it shuts down.
   */
  Unavailable = "Unavailable",

  /**
   * The client has no connection to the runtime, or the connection ended
   * before the answer. Clients produce it; the runtime never sends it.
   */
  Disconnected = "Disconnected",

  /**
   * The runtime is preparing for an update, so it accepts no new client and
   * no request other than `desktop.updateSaved`, `desktop.work` and `desktop.stop`.
   */
  Updating = "Updating",

  /**
   * The runtime failed unexpectedly.
   */
  Internal = "Internal"
}

/**
 * How serious a notification is; each severity has its own icon.
 */
export declare enum NotificationSeverity {
  /**
   * Something the person may want to know.
   */
  Info = "Info",

  /**
   * Something that finished well.
   */
  Success = "Success",

  /**
   * Something the person should look at.
   */
  Warning = "Warning",

  /**
   * Something that failed.
   */
  Error = "Error"
}

/**
 * Where a module stands in the runtime, as `desktop.modules` reports it.
 */
export declare enum ModuleState {
  /**
   * The module's runtime part, if any, and all its dependencies activated.
   */
  Active = "Active",

  /**
   * The module's runtime part could not be loaded or failed to activate.
   */
  Failed = "Failed",

  /**
   * A module the module depends on is not active, so it was not activated.
   */
  Blocked = "Blocked",

  /**
   * The module's switch setting is `false`, so no host activates it.
   */
  Off = "Off",

  /**
   * The module's `platforms` don't name the platform the app runs on, so no
   * host activates it and the runtime offers none of its settings.
   */
  Unavailable = "Unavailable"
}

/**
 * How a runtime asked to stop by `desktop.stop` treats work in progress.
 */
export declare enum StopPolicy {
  /**
   * Stop only when no work is in progress; otherwise answer with a
   * `Conflict` failure whose details are the running work.
   */
  IfIdle = "IfIdle",

  /**
   * Stop the work in progress, then stop.
   */
  StopWork = "StopWork"
}

/**
 * How a `desktop.quit` ended when the main process did not stay open.
 */
export declare enum QuitResult {
  /**
   * The main process saved and quit, as its Quit Noldova Desktop Sample does.
   */
  Quit = "Quit",

  /**
   * No main process was connected to the runtime, so nothing quit.
   */
  NoMainProcess = "NoMainProcess"
}

/**
 * A main process's answer to `desktop.quitting` when it stays open. A main process that
 * quits sends none: the runtime counts its accepted `desktop.stop` as its
 * answer, since that stop can end the runtime at once.
 */
export declare enum QuitAnswer {
  /**
   * The person kept Noldova Desktop Sample open when it asked about the work in progress.
   */
  Stayed = "Stayed",

  /**
   * A window part's save failed, so Noldova Desktop Sample stayed open.
   */
  SaveFailed = "SaveFailed"
}

/**
 * What the runtime asks the main process to do with this machine's secret store, in a `SecretCommand`.
 */
export declare enum SecretAction {
  /**
   * Name this machine's device; the command carries no value, and the answer's value is the device's id.
   */
  Device = "Device",

  /**
   * Encrypt the command's value; the answer's value is the ciphertext, in base64.
   */
  Encrypt = "Encrypt",

  /**
   * Decrypt the command's value, a ciphertext in base64 that `Encrypt` gave on this machine; the answer's value is the secret.
   */
  Decrypt = "Decrypt"
}

/**
 * Why the main process couldn't answer a `SecretCommand`.
 */
export declare enum SecretFailureKind {
  /**
   * The main process has no device identity to give.
   */
  NoDevice = "NoDevice",

  /**
   * This machine has no secret store that protects a value, such as Linux without a keyring, so nothing is encrypted or decrypted.
   */
  Unprotected = "Unprotected",

  /**
   * This machine's store can't decrypt the value, such as when its key changed since the value was saved.
   */
  Undecryptable = "Undecryptable"
}

/**
 * Why a module's secret call failed, which `SecretFailures.reasonOf` reads from the call's `Unavailable` failure, so a
 * module can tell the person what to do without reading the message.
 */
export declare enum SecretFailureReason {
  /**
   * The app's main process isn't connected to the runtime, because it hasn't connected yet or has gone; the call
   * works once it connects.
   */
  NotConnected = "NotConnected",

  /**
   * The app's main process has no device identity, so no value can be kept for this machine.
   */
  NoDevice = "NoDevice",

  /**
   * This machine has no secret store that protects a value, such as Linux without a keyring; a save keeps nothing,
   * and a read gives nothing back.
   */
  Unprotected = "Unprotected",

  /**
   * This machine's store can't decrypt the saved value, such as when its key changed since the value was saved; the
   * module saves the value again.
   */
  Undecryptable = "Undecryptable"
}

/**
 * The kind of value a setting holds.
 */
export declare enum SettingKind {
  /**
   * `true` or `false`.
   */
  Boolean = "Boolean",

  /**
   * One of a list of named options, held as the option's value.
   */
  Choice = "Choice",

  /**
   * A number from a minimum to a maximum, in whole steps from the minimum.
   */
  Number = "Number",

  /**
   * A string up to a maximum length.
   */
  Text = "Text",

  /**
   * A list of distinct module ids.
   */
  Modules = "Modules",

  /**
   * The person's key bindings: an object from a command's name to the key
   * bound to it, or to `null` when the person removed the command's key.
   * Each key is one `KeyChord.canBind` accepts for its command. Only the
   * shell's `desktop.keyBindings` has this kind.
   */
  KeyBindings = "KeyBindings",

  /**
   * A list of distinct spelling language tags, such as `en-US`, each two or
   * three lowercase letters followed by any number of hyphenated parts of
   * up to eight letters or digits. The window offers the languages whose
   * dictionaries ship with the main process. Only the shell's
   * `desktop.spellCheckLanguages` has this kind.
   */
  Languages = "Languages",

  /**
   * A button that runs a command, such as one that opens a module's own
   * document. It holds no value: its default and only accepted value is
   * `null`, so nothing is stored.
   */
  Action = "Action"
}

/**
 * Where a setting's value is kept.
 */
export declare enum SettingLocality {
  /**
   * One value for each device, never carried to another device.
   */
  Device = "Device",

  /**
   * One value for the data directory, which a later synchronization may
   * carry to other devices.
   */
  Shared = "Shared"
}

/**
 * An edit the window asks the main process to run on its focused contents.
 */
export declare enum EditAction {
  /**
   * Undoes the last edit.
   */
  Undo = "Undo",

  /**
   * Redoes the last undone edit.
   */
  Redo = "Redo",

  /**
   * Cuts the selection to the clipboard.
   */
  Cut = "Cut",

  /**
   * Copies the selection to the clipboard.
   */
  Copy = "Copy",

  /**
   * Pastes the clipboard.
   */
  Paste = "Paste",

  /**
   * Selects all of the focused field or page.
   */
  SelectAll = "SelectAll"
}

/**
 * A window action the window asks the main process to run on its own window.
 */
export declare enum WindowAction {
  /**
   * Minimizes the window.
   */
  Minimize = "Minimize",

  /**
   * Maximizes the window, or restores it while it is maximized.
   */
  ToggleMaximized = "ToggleMaximized",

  /**
   * Closes the window.
   */
  Close = "Close"
}

/**
 * What a runtime part asks of its module's web views in a `WebViewCommand`.
 */
export declare enum WebViewAction {
  /**
   * Lists the module's open views; it names no view and takes no value.
   */
  List = "List",

  /**
   * Loads an address in the view, after the origin check; its value is the address.
   */
  Navigate = "Navigate",

  /**
   * Goes back in the view's history.
   */
  Back = "Back",

  /**
   * Goes forward in the view's history.
   */
  Forward = "Forward",

  /**
   * Reloads the view's page.
   */
  Reload = "Reload",

  /**
   * Stops the view's loading.
   */
  Stop = "Stop",

  /**
   * Sets the origins the view may load; its value is the origins.
   */
  SetAllowedOrigins = "SetAllowedOrigins",

  /**
   * Clears a profile's cookies, storage and cache; it names no view, and its value is the profile key.
   */
  ClearProfile = "ClearProfile",

  /**
   * Sends the view a debugging call the module declares; its value holds `method`, `params` and `timeoutMilliseconds`.
   */
  Send = "Send",

  /**
   * Marks whether an agent controls the view, which keeps it painted while hidden; its value is a boolean.
   */
  SetControlled = "SetControlled"
}

/**
 * The kinds of a web view's event.
 */
export declare enum WebViewEventKind {
  /**
   * The view opened; its details are its `pane` and its `profileKey`.
   */
  Opened = "Opened",

  /**
   * The view closed.
   */
  Closed = "Closed",

  /**
   * The view's `address`, `title`, `isLoading`, `canGoBack` or `canGoForward` changed; its details hold all five.
   */
  State = "State",

  /**
   * A load failed; its details are the `address`, the engine's `code` and its `description`.
   */
  LoadFailed = "LoadFailed",

  /**
   * The origin check refused a navigation of the view's main frame; its details are the `address`, its `origin`, `isRedirect` and `fromPress`.
   * `fromPress` is `true` only for the navigation that is a link's own activation by the person's press: their click on an `a[href]` or `area[href]`
   * in the main frame, whose default the page didn't prevent, to that link's address, within 5 seconds of their own press, read from the same
   * record as `NewWindowRequested.fromLink`; a script's navigation, even right after the person's click on something else, a form, a second
   * navigation for the same click, a redirect and relayed input get `false`.
   * An event without it is accepted until 0.1.0, read as `false`.
   */
  NavigationRefused = "NavigationRefused",

  /**
   * The origin check refused a navigation inside one of the page's frames, and the host shows its own refused page in that frame; its details are the `address`, its `origin`, `isRedirect` and `frameId`, a positive whole number that names the frame for as long as it exists in the view and is never used again.
   * It isn't the page's own refusal: the page stays where it is, and `NavigationRefused` stays the main frame's alone.
   * A module built before this kind ignores it, as it ignores any kind it doesn't know, so it never takes a frame's refusal for the page's.
   */
  FrameNavigationRefused = "FrameNavigationRefused",

  /**
   * The view's page stopped; the view stays empty, and sends no `State`, until it is navigated again.
   */
  Crashed = "Crashed",

  /**
   * The view's profile was cleared; its details are the `profileKey`.
   */
  ProfileCleared = "ProfileCleared",

  /**
   * The host refused something without asking; its details are the `request`, `download`, `newWindow`, `permission`,
   * `fileChooser`, `authentication`, `certificate` or `nestedView`, and the `origin` that asked.
   */
  RequestRefused = "RequestRefused",

  /**
   * A link or a script in the view asked for a new window, and the module's
   * `webViews.json` takes such requests; the host opens no window. Its details
   * are the `address`, `hadRecentInput`, whether the person's own key, mouse or
   * touch input reached the view in the last 5 seconds, relayed input aside,
   * the `origin` of the referrer, or `null` when the engine sends none, and
   * the `disposition` the engine gives the request: `background-tab` for the
   * person's middle or Ctrl or Cmd click on a link, `foreground-tab` for a
   * link's `target="_blank"` or a script's plain `window.open`, `new-window`
   * for a `window.open` that asks for a popup or a Shift click, and `default`
   * or `other` otherwise. The host always sends it; an event without it, such
   * as one a module's tests build, is accepted until 0.1.0. The engine takes
   * the disposition from the event the page is handling, so a page's own
   * `click` or `auxclick` handler running during the person's middle or Ctrl or
   * Cmd click gets `background-tab` for each `window.open` it makes. Last,
   * `fromPress`: `true` for the request that uses up the view's one
   * activation, which each real press of the person's own mouse button, key
   * or touch in the view renews for 5 seconds, as a browser's popup rule does,
   * and `false` for every other request, the second from the same press
   * included; presses don't add up, Escape and a modifier key alone give
   * none, and relayed input never counts. An event without it is accepted
   * until 0.1.0.
   * `fromLink`: `true` only for the request that is a link's own activation
   * by the person's press: a click, a Ctrl or Cmd click or a middle click of
   * the person's on an `a[href]` or `area[href]` in the main frame, whose
   * default the page didn't prevent, to the link's own address, within 5
   * seconds of the person's press with no relayed press since. A page's
   * `window.open`, in any handler of that press, gets `false`, even to the
   * link's address once the page prevented the link's default, and so do a
   * link in a frame, a form and a second request for the same click. It can
   * be `true` when a handler's request took `fromPress` first. An event
   * without it is accepted until 0.1.0, read as `false`.
   */
  NewWindowRequested = "NewWindowRequested",

  /**
   * A debugging event the module declares; its details are its `method`, its `params` and `isCut`.
   */
  Protocol = "Protocol",

  /**
   * The view's backlog overflowed and dropped its oldest events; its details are the `count` dropped.
   */
  Dropped = "Dropped",

  /**
   * The person pressed a key the module declares in the view; its details are the key's `name`. Only the window part gets it.
   */
  Key = "Key",

  /**
   * The view's zoom changed, by the window part's call, the person's keys or the mouse wheel; its details are the `factor`, 1 for 100%. Only the window part gets it.
   */
  Zoom = "Zoom",

  /**
   * A search in the view's page finished; its details are the number of `matches` and the 1-based `active` one, 0 when none. Only the window part gets it.
   */
  Found = "Found",

  /**
   * The page's icon changed; its details are the `image`, a `data:image/png` URL of at most 64 by 64 pixels and 16 KB, or null when the page has none or it can't be read. Only the window part gets it.
   */
  Favicon = "Favicon",

  /**
   * The runtime part marked whether an agent controls the view; its details are `isControlled`. Only the window part gets it.
   */
  Controlled = "Controlled"
}

/**
 * Why a call on a web view failed.
 */
export declare enum WebViewFailureKind {
  /**
   * The view is unknown, or belongs to another module.
   */
  NotOwned = "NotOwned",

  /**
   * The module doesn't declare the call, an event or a parameter, or the host refuses it.
   */
  NotAllowed = "NotAllowed",

  /**
   * A key input's keys are one of the app's shortcuts.
   */
  ShortcutRefused = "ShortcutRefused",

  /**
   * The call's time limit passed.
   */
  TimedOut = "TimedOut",

  /**
   * The reply is over its limit.
   */
  TooLarge = "TooLarge",

  /**
   * The view closed while the call was pending.
   */
  ViewClosed = "ViewClosed",

  /**
   * The view's page stopped while the call was pending.
   */
  Crashed = "Crashed",

  /**
   * The view's profile was cleared while the call was pending.
   */
  ProfileCleared = "ProfileCleared",

  /**
   * The host can't answer, such as while the main process's connection is down, or a view can't be created.
   */
  Unavailable = "Unavailable",

  /**
   * The engine refused the call, with its code and message.
   */
  Protocol = "Protocol"
}

/**
 * How a view answered a load, a move through its history, a reload or a stop.
 */
export declare enum WebViewNavigationKind {
  /**
   * The view started it.
   */
  Started = "Started",

  /**
   * The origin check refused the address it would load; the answer carries that origin.
   */
  Refused = "Refused",

  /**
   * The view has no history entry that way.
   */
  NoHistory = "NoHistory"
}

/**
 * The abstract base of this package's exceptions; catch it to handle any of
 * them.
 */
export declare abstract class DesktopProtocolException extends Exception {
  /**
   * Initializes the message and the cause for a derived exception.
   *
   * @param message The complete explanation, kept as given.
   * @param options The failure that caused this one, as its `cause`.
   * Omitted, the exception has no cause.
   * @example
   * ```ts
   * import { DesktopProtocolException, ProtocolException } from "@noldova/desktop.protocol";
   *
   * const exception = new ProtocolException(16_777_216);
   * exception instanceof DesktopProtocolException; // true
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception thrown when a connection's frames break the protocol: a frame
 * over the maximum length, whose message names that length.
 */
export declare class ProtocolException extends DesktopProtocolException {
  /**
   * Why the protocol was broken, the wire code a response carries:
   * always {@link FailureCode.FrameTooLarge}.
   */
  public readonly code: FailureCode;

  /**
   * The maximum length, in characters, that the frame exceeded.
   */
  public readonly maximumFrameLength: number;

  /**
   * Creates the exception, with its message from the package's own text.
   *
   * @param maximumFrameLength The maximum length, in characters, that the
   * frame exceeded.
   * @param options The preceding failure, if any.
   *
   * @example
   * ```ts
   * import { ProtocolException } from "@noldova/desktop.protocol";
   *
   * export const failure: ProtocolException = new ProtocolException(16_777_216);
   * ```
   */
  public constructor(maximumFrameLength: number, options?: ExceptionOptions);
}

/**
 * A method or event name: an owner, a dot and a member, such as
 * `desktop.handshake` or `notes.capture`. The owner is `desktop` for the
 * shell's own names and a module's id for a module's.
 */
export declare class QualifiedName {
  /**
   * The owner: `desktop` or a module id in lowercase kebab-case.
   */
  public readonly owner: string;

  /**
   * The member: a lowercase letter followed by letters and digits.
   */
  public readonly member: string;

  /**
   * The full name, `owner.member`.
   */
  public readonly text: string;

  /**
   * True when the shell owns the name.
   */
  public get isShell(): boolean;

  /**
   * Creates the name.
   *
   * @param owner `desktop` or a module id: lowercase letters and digits in
   * hyphen-separated words, starting with a letter.
   * @param member A lowercase letter followed by letters and digits.
   * @param parameterName The parameter name a rejection reports; `name` by
   * default.
   * @throws ArgumentException synchronously when the owner or member is not
   * valid.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const capture: QualifiedName = new QualifiedName("notes", "capture");
   * ```
   */
  public constructor(owner: string, member: string, parameterName?: string);

  /**
   * Parses `owner.member` text.
   *
   * @param text The name's text.
   * @param parameterName The parameter name a rejection reports; `text` by
   * default.
   * @returns The name.
   * @throws ArgumentException synchronously when the text has no dot or its
   * owner or member is not valid, including a member with another dot.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   *
   * export function readMethod(text: string): QualifiedName {
   *   return QualifiedName.parse(text, "method");
   * }
   * ```
   */
  public static parse(text: string, parameterName?: string): QualifiedName;

  /**
   * Reads `owner.member` text without throwing, for checks that only need to
   * know whether the text is a name.
   *
   * @param text The name's text.
   * @returns The name, or `null` when `parse` would refuse the text.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const isName: boolean = QualifiedName.find("notes.create") !== null;
   * ```
   */
  public static find(text: string): QualifiedName | null;

  /**
   * Compares two names.
   *
   * @param other The other name.
   * @returns True when both have the same text.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const isStop: boolean = QualifiedName.parse("desktop.stop").equals(new QualifiedName("shell", "stop"));
   * ```
   */
  public equals(other: QualifiedName): boolean;

  /**
   * Returns the full name.
   *
   * @returns `owner.member`.
   *
   * @example
   * ```ts
   * import { QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const text: string = QualifiedName.parse("notes.capture").toString();
   * ```
   */
  public toString(): string;
}

/**
 * What identifies a build to the local protocol: its product version, its
 * protocol version and its fingerprint. A runtime serves only clients of its
 * own build.
 */
export declare class BuildIdentity {
  /**
   * The protocol version this package was built with, stamped by the build
   * from the root manifest.
   */
  public static readonly supportedProtocolVersion: number;

  /**
   * The product version, such as `0.0.1`.
   */
  public readonly productVersion: string;

  /**
   * The protocol version; a positive integer.
   */
  public readonly protocolVersion: number;

  /**
   * The fingerprint of the inputs the build was compiled from.
   */
  public readonly fingerprint: string;

  /**
   * Creates the identity.
   *
   * @param productVersion The product version; not whitespace only.
   * @param protocolVersion The protocol version; a positive integer.
   * @param fingerprint The build fingerprint; not whitespace only.
   * @throws ArgumentException synchronously when the product version or
   * fingerprint is empty or whitespace only.
   * @throws ArgumentOutOfRangeException synchronously when the protocol
   * version is not a positive integer.
   *
   * @example
   * ```ts
   * import { BuildIdentity } from "@noldova/desktop.protocol";
   *
   * export const identity: BuildIdentity = new BuildIdentity("0.0.1", BuildIdentity.supportedProtocolVersion, "9f2c41");
   * ```
   */
  public constructor(productVersion: string, protocolVersion: number, fingerprint: string);

  /**
   * Parses a protocol version stamped as text.
   *
   * @param text The digits of a positive integer, without a sign or leading
   * zeros.
   * @returns The protocol version.
   * @throws ArgumentException synchronously when the text is not a positive
   * integer, such as an unstamped placeholder.
   *
   * @example
   * ```ts
   * import { BuildIdentity } from "@noldova/desktop.protocol";
   *
   * export const version: number = BuildIdentity.parseProtocolVersion("1");
   * ```
   */
  public static parseProtocolVersion(text: string): number;

  /**
   * Reads an identity from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The identity.
   * @throws JsonException synchronously when a field is unknown, missing, has
   * the wrong type or breaks the constructor's rules; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { BuildIdentity } from "@noldova/desktop.protocol";
   *
   * export const identity: BuildIdentity = BuildIdentity.fromJson({ productVersion: "0.0.1", protocolVersion: 1, fingerprint: "9f2c41" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): BuildIdentity;

  /**
   * Checks whether this identity's runtime can serve a client.
   *
   * @param other The client's identity.
   * @returns `UnsupportedVersion` when the protocol versions differ,
   * `BuildMismatch` when the fingerprints or product versions differ, and
   * `null` when the client is served.
   *
   * @example
   * ```ts
   * import { type BuildIdentity, FailureCode } from "@noldova/desktop.protocol";
   *
   * export function canServe(runtime: BuildIdentity, client: BuildIdentity): boolean {
   *   const mismatch: FailureCode | null = runtime.findMismatch(client);
   *   return mismatch === null;
   * }
   * ```
   */
  public findMismatch(other: BuildIdentity): FailureCode | null;

  /**
   * Returns the wire form.
   *
   * @returns The `productVersion`, `protocolVersion` and `fingerprint`
   * fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { BuildIdentity } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new BuildIdentity("0.0.1", 1, "9f2c41").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Why something failed, as a response carries it.
 */
export declare class Failure {
  /**
   * The kind of failure.
   */
  public readonly code: FailureCode;

  /**
   * A sentence a person can read, without secrets.
   */
  public readonly message: string;

  /**
   * Structured data a failure defines, such as the runtime handover of a
   * `BuildMismatch` or the running work of a `Conflict` answer to
   * `desktop.stop`; absent when the failure defines none.
   */
  public readonly details: JsonObject | undefined;

  /**
   * Creates the failure.
   *
   * @param code The kind of failure.
   * @param message A sentence describing it; not whitespace only.
   * @param details The failure's structured data; omit it when the failure
   * defines none.
   * @throws ArgumentException synchronously when the message is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode } from "@noldova/desktop.protocol";
   *
   * export const failure: Failure = new Failure(FailureCode.NotFound, "The conversation does not exist.");
   * ```
   */
  public constructor(code: FailureCode, message: string, details?: JsonObject);

  /**
   * Reads a failure from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure to read reports; `$` by default.
   * @returns The failure.
   * @throws JsonException synchronously when the code is unknown, the
   * message is missing or blank, or `details` is present but not an object;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { Failure } from "@noldova/desktop.protocol";
   *
   * export const failure: Failure = Failure.fromJson({ code: "Conflict", message: "Work is running.", details: { descriptions: ["A reply"] } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Failure;

  /**
   * Returns the wire form.
   *
   * @returns The `code` and `message` fields, and `details` when the
   * failure has them.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { Failure, FailureCode } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new Failure(FailureCode.Unavailable, "The runtime is shutting down.").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Where to find the runtime that owns a data directory: its build and the
 * program it runs from. A `BuildMismatch` failure carries it as its
 * details, so a client of another build can hand the person over to the
 * owner. Its wire form never changes after protocol version 1.
 */
export declare class RuntimeHandover {
  /**
   * The owning runtime's build.
   */
  public readonly identity: BuildIdentity;

  /**
   * The full path of the program the owning runtime runs from.
   */
  public readonly executablePath: string;

  /**
   * Creates the handover.
   *
   * @param identity The owning runtime's build.
   * @param executablePath The program's full path; not whitespace only.
   * @throws ArgumentException synchronously when the path is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { BuildIdentity, RuntimeHandover } from "@noldova/desktop.protocol";
   *
   * export const handover: RuntimeHandover = new RuntimeHandover(new BuildIdentity("0.0.2", 1, "7a10be"), "/Applications/Noldova Desktop Sample.app/Contents/MacOS/Noldova Desktop Sample");
   * ```
   */
  public constructor(identity: BuildIdentity, executablePath: string);

  /**
   * Reads a handover from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The handover.
   * @throws JsonException synchronously when a field is unknown, missing, has
   * the wrong type or breaks the rules, in the handover or its identity; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { type Failure, RuntimeHandover } from "@noldova/desktop.protocol";
   *
   * export function readHandover(failure: Failure): RuntimeHandover | undefined {
   *   return failure.details === undefined ? undefined : RuntimeHandover.fromJson(failure.details, "$.failure.details");
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): RuntimeHandover;

  /**
   * Returns the wire form.
   *
   * @returns The `identity` and `executablePath` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { BuildIdentity, RuntimeHandover } from "@noldova/desktop.protocol";
   *
   * export const details: JsonObject = new RuntimeHandover(new BuildIdentity("0.0.2", 1, "7a10be"), "C:\\Program Files\\Noldova Desktop Sample\\Noldova Desktop Sample.exe").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.stop`, which asks a runtime to stop. Its wire form
 * never changes after protocol version 1: every build reads and writes the
 * form with only `policy`, so any build can stop any earlier one, and a
 * client sends `keepsWhileShared` only to a runtime of its own build.
 */
export declare class StopRequest {
  /**
   * How the runtime treats work in progress.
   */
  public readonly policy: StopPolicy;

  /**
   * Whether the runtime keeps running, its work untouched, while another
   * client is connected, answering with a {@link KeptRuntime} instead of
   * applying the policy.
   */
  public readonly keepsWhileShared: boolean;

  /**
   * Creates the request.
   *
   * @param policy How the runtime treats work in progress.
   * @param keepsWhileShared Whether the runtime keeps running while another
   * client is connected; `false` by default.
   *
   * @example
   * ```ts
   * import { StopPolicy, StopRequest } from "@noldova/desktop.protocol";
   *
   * export const request: StopRequest = new StopRequest(StopPolicy.IfIdle, true);
   * ```
   */
  public constructor(policy: StopPolicy, keepsWhileShared?: boolean);

  /**
   * Reads a request from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request; `keepsWhileShared` is `false` when absent.
   * @throws JsonException synchronously when the policy is missing or
   * unknown, `keepsWhileShared` is not a boolean, or another field is
   * present; its path names the field.
   *
   * @example
   * ```ts
   * import { StopRequest } from "@noldova/desktop.protocol";
   *
   * export const request: StopRequest = StopRequest.fromJson({ policy: "StopWork" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): StopRequest;

  /**
   * Returns the wire form.
   *
   * @returns The `policy` field, and `keepsWhileShared` only when it is `true`.
   *
   * @example
   * ```ts
   * import { Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/desktop.protocol";
   *
   * export const stop: Request = new Request("r1", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to a `desktop.stop` that keeps the runtime running while it is
 * shared: other clients are connected, so it applied no policy and left its
 * work untouched.
 */
export declare class KeptRuntime {
  /**
   * How many other clients are connected; at least 1.
   */
  public readonly keptFor: number;

  /**
   * Creates the answer.
   *
   * @param keptFor How many other clients are connected.
   * @throws ArgumentException synchronously when `keptFor` is not a whole
   * number from 1.
   *
   * @example
   * ```ts
   * import { KeptRuntime } from "@noldova/desktop.protocol";
   *
   * export const kept: KeptRuntime = new KeptRuntime(1);
   * ```
   */
  public constructor(keptFor: number);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when `keptFor` is missing or not a
   * whole number from 1, or another field is present; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { KeptRuntime } from "@noldova/desktop.protocol";
   *
   * export const kept: KeptRuntime = KeptRuntime.fromJson({ keptFor: 2 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): KeptRuntime;

  /**
   * Returns the wire form.
   *
   * @returns The `keptFor` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { KeptRuntime } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new KeptRuntime(1).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to a `desktop.quit` whose main process did not stay open.
 */
export declare class QuitReport {
  /**
   * Whether the main process quit or none was connected.
   */
  public readonly outcome: QuitResult;

  /**
   * Creates the answer.
   *
   * @param outcome Whether the main process quit or none was connected.
   *
   * @example
   * ```ts
   * import { QuitReport, QuitResult } from "@noldova/desktop.protocol";
   *
   * export const report: QuitReport = new QuitReport(QuitResult.Quit);
   * ```
   */
  public constructor(outcome: QuitResult);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when `outcome` is missing or not a
   * `QuitResult`, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { QuitReport } from "@noldova/desktop.protocol";
   *
   * export const report: QuitReport = QuitReport.fromJson({ outcome: "NoMainProcess" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): QuitReport;

  /**
   * Returns the wire form.
   *
   * @returns The `outcome` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QuitReport, QuitResult } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new QuitReport(QuitResult.Quit).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.quitAnswered`: a main process asked to quit by
 * `desktop.quitting` stayed open.
 */
export declare class QuitAnswered {
  /**
   * Why the main process stayed open.
   */
  public readonly answer: QuitAnswer;

  /**
   * Creates the payload.
   *
   * @param answer Why the main process stayed open.
   *
   * @example
   * ```ts
   * import { QuitAnswer, QuitAnswered } from "@noldova/desktop.protocol";
   *
   * export const stayed: QuitAnswered = new QuitAnswered(QuitAnswer.Stayed);
   * ```
   */
  public constructor(answer: QuitAnswer);

  /**
   * Reads a payload from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when `answer` is missing or not a
   * `QuitAnswer`, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { QuitAnswered } from "@noldova/desktop.protocol";
   *
   * export const stayed: QuitAnswered = QuitAnswered.fromJson({ answer: "SaveFailed" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): QuitAnswered;

  /**
   * Returns the wire form.
   *
   * @returns The `answer` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QuitAnswer, QuitAnswered } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new QuitAnswered(QuitAnswer.Stayed).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.update`, which asks a runtime of the same build to
 * prepare for an update.
 */
export declare class UpdateRequest {
  /**
   * The installation's folder in the device folder. While it prepares, the
   * runtime reads the folder's launch barrier every second and goes back to
   * normal once the barrier is gone or its holder no longer runs.
   */
  public readonly installation: string;

  /**
   * Creates the request.
   *
   * @param installation The installation's folder; not whitespace only.
   * @throws ArgumentException synchronously when the folder is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { UpdateRequest } from "@noldova/desktop.protocol";
   *
   * export const request: UpdateRequest = new UpdateRequest("/home/person/.local/state/noldova/desktop/installations/0123456789abcdef");
   * ```
   */
  public constructor(installation: string);

  /**
   * Reads a request from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when the installation is missing or
   * blank, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { UpdateRequest } from "@noldova/desktop.protocol";
   *
   * export const request: UpdateRequest = UpdateRequest.fromJson({ installation: "/tmp/installation" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): UpdateRequest;

  /**
   * Returns the wire form.
   *
   * @returns The `installation` field.
   *
   * @example
   * ```ts
   * import { Request, ShellMethods, UpdateRequest } from "@noldova/desktop.protocol";
   *
   * export const update: Request = new Request("r1", ShellMethods.update, new UpdateRequest("/tmp/installation").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.updateSaved`, a client's answer to `desktop.updating`.
 */
export declare class UpdateSaved {
  /**
   * The client's process id.
   */
  public readonly processId: number;

  /**
   * What kept the client's unsaved state from being saved, such as a module
   * whose save failed or a window that did not answer; empty when everything
   * was saved.
   */
  public readonly problems: readonly string[];

  /**
   * Creates the answer.
   *
   * @param processId The client's process id; a positive integer.
   * @param problems What kept the state from being saved, each not
   * whitespace only; copied.
   * @throws ArgumentOutOfRangeException synchronously when the process id is
   * not a positive integer.
   * @throws ArgumentException synchronously when a problem is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { UpdateSaved } from "@noldova/desktop.protocol";
   *
   * export const saved: UpdateSaved = new UpdateSaved(4120, []);
   * ```
   */
  public constructor(processId: number, problems: readonly string[]);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when a field is missing or invalid,
   * or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { UpdateSaved } from "@noldova/desktop.protocol";
   *
   * export const saved: UpdateSaved = UpdateSaved.fromJson({ processId: 4120, problems: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): UpdateSaved;

  /**
   * Returns the wire form.
   *
   * @returns The `processId` and `problems` fields.
   *
   * @example
   * ```ts
   * import { Request, ShellMethods, UpdateSaved } from "@noldova/desktop.protocol";
   *
   * export const saved: Request = new Request("r2", ShellMethods.updateSaved, new UpdateSaved(4120, []).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A process that must exit before an update replaces the application, as a
 * runtime preparing for the update reports it.
 */
export declare class UpdateProcess {
  /**
   * The process id.
   */
  public readonly processId: number;

  /**
   * The earliest the process can have started, on the clock the operating
   * system's process table uses.
   */
  public readonly earliest: number;

  /**
   * The latest the process can have started, on the same clock.
   */
  public readonly latest: number;

  /**
   * What the process is: a client's kind, such as `mainProcess` or `cli`,
   * `program` for a program a module runs, or `copy` for the mount of an
   * AppImage copy.
   */
  public readonly role: string;

  /**
   * Creates the process.
   *
   * @param processId The process id; a positive integer.
   * @param earliest The earliest start; finite.
   * @param latest The latest start; finite and no earlier than the earliest.
   * @param role What the process is; not whitespace only.
   * @throws ArgumentOutOfRangeException synchronously when the process id is
   * not a positive integer, or a start is not finite or the earliest is later
   * than the latest.
   * @throws ArgumentException synchronously when the role is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   *
   * export const mainProcess: UpdateProcess = new UpdateProcess(4120, 1500.25, 1501.5, "mainProcess");
   * ```
   */
  public constructor(processId: number, earliest: number, latest: number, role: string);

  /**
   * Reads a process from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The process.
   * @throws JsonException synchronously when a field is missing or invalid,
   * or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   *
   * export const program: UpdateProcess = UpdateProcess.fromJson({ processId: 4188, earliest: 1600, latest: 1601, role: "program" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): UpdateProcess;

  /**
   * Returns the wire form.
   *
   * @returns The `processId`, `earliest`, `latest` and `role` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { UpdateProcess } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new UpdateProcess(4188, 1600, 1601, "program").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A runtime's answer to `desktop.update`: whether every client saved its
 * state, and the processes that must exit before the update replaces the
 * application.
 */
export declare class UpdateReady {
  /**
   * What kept a client's state from being saved, or a client that did not
   * answer; empty when the runtime is ready.
   */
  public readonly problems: readonly string[];

  /**
   * Every client, every program the runtime's modules run and the mount of
   * its AppImage copy.
   */
  public readonly processes: readonly UpdateProcess[];

  /**
   * Whether no problem stands in the update's way.
   */
  public get isReady(): boolean;

  /**
   * Creates the answer.
   *
   * @param problems What stands in the update's way, each not whitespace
   * only; copied.
   * @param processes The processes that must exit; copied.
   * @throws ArgumentException synchronously when a problem is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { UpdateProcess, UpdateReady } from "@noldova/desktop.protocol";
   *
   * export const ready: UpdateReady = new UpdateReady([], [new UpdateProcess(4120, 1500.25, 1501.5, "mainProcess")]);
   * ```
   */
  public constructor(problems: readonly string[], processes: readonly UpdateProcess[]);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when a field is missing or invalid,
   * or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { UpdateReady } from "@noldova/desktop.protocol";
   *
   * export const ready: UpdateReady = UpdateReady.fromJson({ problems: [], processes: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): UpdateReady;

  /**
   * Returns the wire form.
   *
   * @returns The `problems` and `processes` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { UpdateReady } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new UpdateReady([], []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.grantFile`: the main process grants one file the
 * person picked, dropped or pasted in a window to the runtime part of the
 * module whose window part asked, for that window's page alone.
 */
export declare class FileGrant {
  /**
   * The longest a grant lives, 600 000 milliseconds, ten minutes; an app may
   * give a shorter lifetime, never a longer one.
   */
  public static readonly maximumLifetime: number;

  /**
   * The grant, 32 lowercase hexadecimal digits the main process draws at
   * random; the window part gets this and never the path.
   */
  public readonly grant: string;

  /**
   * The file's real path, which the runtime opens when the grant is redeemed.
   */
  public readonly path: string;

  /**
   * The file's name as the person sees it.
   */
  public readonly name: string;

  /**
   * The file's media type, `application/octet-stream` when the main process
   * doesn't know it.
   */
  public readonly mediaType: string;

  /**
   * The file's size in bytes when it was granted.
   */
  public readonly size: number;

  /**
   * What the file was when it was granted, its device, file number, size and
   * modification time; a redeem refuses a file that no longer matches it.
   */
  public readonly identity: string;

  /**
   * The id of the module whose runtime part may redeem the grant.
   */
  public readonly module: string;

  /**
   * The window the file was granted in.
   */
  public readonly window: number;

  /**
   * The page of that window the file was granted to.
   */
  public readonly page: number;

  /**
   * How long the grant lives unredeemed, in milliseconds, at most 600 000.
   */
  public readonly lifetime: number;

  /**
   * Whether the file is a copy the main process staged in the app's data
   * folder, such as a pasted image, which the runtime deletes with the grant.
   */
  public readonly isStaged: boolean;

  /**
   * Creates the payload.
   *
   * @param grant The grant, 32 lowercase hexadecimal digits.
   * @param path The file's real path; not whitespace only.
   * @param name The file's name; not whitespace only.
   * @param mediaType The file's media type; not whitespace only.
   * @param size The file's size in bytes, a whole number, zero or more.
   * @param identity The file's identity; not whitespace only.
   * @param module The module's id, in lowercase kebab-case and not `desktop`.
   * @param window The window's id, a positive integer.
   * @param page The page's number, a positive integer.
   * @param lifetime The grant's lifetime in milliseconds, from 1 to 600 000.
   * @param isStaged Whether the file is a staged copy.
   * @throws ArgumentException synchronously when the grant, a text or the
   * module breaks its rule.
   * @throws ArgumentOutOfRangeException synchronously when the size, the
   * window, the page or the lifetime is out of its range.
   *
   * @example
   * ```ts
   * import { FileGrant } from "@noldova/desktop.protocol";
   *
   * export const grant: FileGrant = new FileGrant("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", "/home/person/notes.txt", "notes.txt", "text/plain",
   *   1_204, "66306:1311:1204:1761600000000000000", "notes", 3, 1, 600_000, false);
   * ```
   */
  public constructor(grant: string, path: string, name: string, mediaType: string, size: number, identity: string, module: string, window: number, page: number,
    lifetime: number, isStaged: boolean);

  /**
   * Reads a payload from its wire form, whose staged flag is `staged`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when a field is missing, has the
   * wrong type or breaks the constructor's rules, or another field is present;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { FileGrant } from "@noldova/desktop.protocol";
   *
   * export const grant: FileGrant = FileGrant.fromJson({
   *   grant: "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", path: "/home/person/notes.txt", name: "notes.txt", mediaType: "text/plain", size: 1_204,
   *   identity: "66306:1311:1204:1761600000000000000", module: "notes", window: 3, page: 1, lifetime: 600_000, staged: false
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): FileGrant;

  /**
   * Returns the wire form.
   *
   * @returns Every field, the staged flag as `staged`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { FileGrant } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new FileGrant("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", "/home/person/notes.txt", "notes.txt", "text/plain", 1_204,
   *   "66306:1311:1204:1761600000000000000", "notes", 3, 1, 600_000, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.endFileGrants`: a window's page ended, so every
 * file grant given to it ends.
 */
export declare class FileGrantsEnded {
  /**
   * The window's id.
   */
  public readonly window: number;

  /**
   * The number of the page that ended.
   */
  public readonly page: number;

  /**
   * Creates the payload.
   *
   * @param window The window's id, a positive integer.
   * @param page The page's number, a positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the window or the
   * page is not a positive integer.
   *
   * @example
   * ```ts
   * import { FileGrantsEnded } from "@noldova/desktop.protocol";
   *
   * export const ended: FileGrantsEnded = new FileGrantsEnded(3, 1);
   * ```
   */
  public constructor(window: number, page: number);

  /**
   * Reads a payload from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when `window` or `page` is missing or
   * not a positive integer, or another field is present; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { FileGrantsEnded } from "@noldova/desktop.protocol";
   *
   * export const ended: FileGrantsEnded = FileGrantsEnded.fromJson({ window: 3, page: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): FileGrantsEnded;

  /**
   * Returns the wire form.
   *
   * @returns The `window` and `page` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { FileGrantsEnded } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new FileGrantsEnded(3, 1).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.discardFileGrants`: the file grants a window part
 * no longer needs.
 */
export declare class FileGrantsDiscard {
  /**
   * The most grants one discard names, 256; a window part discards more in several.
   */
  public static readonly maximumGrants: number;

  /**
   * The grants, each named once.
   */
  public readonly grants: readonly string[];

  /**
   * Creates the payload.
   *
   * @param grants From 1 to 256 grants, each 32 lowercase hexadecimal digits
   * and named once.
   * @throws ArgumentException synchronously when there are none, more than
   * 256, a repeat, or a grant that breaks its rule.
   *
   * @example
   * ```ts
   * import { FileGrantsDiscard } from "@noldova/desktop.protocol";
   *
   * export const discard: FileGrantsDiscard = new FileGrantsDiscard(["8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21"]);
   * ```
   */
  public constructor(grants: readonly string[]);

  /**
   * Reads a payload from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when `grants` is missing, not an
   * array of texts or breaks the constructor's rules, or another field is
   * present; its path names the field.
   *
   * @example
   * ```ts
   * import { FileGrantsDiscard } from "@noldova/desktop.protocol";
   *
   * export const discard: FileGrantsDiscard = FileGrantsDiscard.fromJson({ grants: ["8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): FileGrantsDiscard;

  /**
   * Returns the wire form.
   *
   * @returns The `grants` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { FileGrantsDiscard } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new FileGrantsDiscard(["8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21"]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.resolveFileShare`: the main process asks the runtime
 * which file a grant on its own scheme shares, for each request a page makes
 * for that address. The runtime answers the grant's `FileGrant`.
 */
export declare class FileShareResolve {
  /**
   * The grant, 32 lowercase hexadecimal digits.
   */
  public readonly grant: string;

  /**
   * Creates the payload.
   *
   * @param grant The grant, 32 lowercase hexadecimal digits.
   * @throws ArgumentException synchronously when the grant breaks its rule.
   *
   * @example
   * ```ts
   * import { FileShareResolve } from "@noldova/desktop.protocol";
   *
   * export const resolve: FileShareResolve = new FileShareResolve("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21");
   * ```
   */
  public constructor(grant: string);

  /**
   * Reads a payload from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when `grant` is missing, not a text or
   * breaks the constructor's rule, or another field is present; its path
   * names the field.
   *
   * @example
   * ```ts
   * import { FileShareResolve } from "@noldova/desktop.protocol";
   *
   * export const resolve: FileShareResolve = FileShareResolve.fromJson({ grant: "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): FileShareResolve;

  /**
   * Returns the wire form.
   *
   * @returns The `grant` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { FileShareResolve } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new FileShareResolve("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.windowClosed`: a window of the asking main process
 * closed for good.
 */
export declare class WindowClosed {
  /**
   * The window's id, the one its requests carry.
   */
  public readonly window: number;

  /**
   * Creates the payload.
   *
   * @param window The window's id, a positive integer.
   * @throws ArgumentOutOfRangeException synchronously when the id is not a
   * positive integer.
   *
   * @example
   * ```ts
   * import { WindowClosed } from "@noldova/desktop.protocol";
   *
   * export const closed: WindowClosed = new WindowClosed(3);
   * ```
   */
  public constructor(window: number);

  /**
   * Reads a payload from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when `window` is missing or not a
   * positive integer, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { WindowClosed } from "@noldova/desktop.protocol";
   *
   * export const closed: WindowClosed = WindowClosed.fromJson({ window: 3 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowClosed;

  /**
   * Returns the wire form.
   *
   * @returns The `window` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WindowClosed } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WindowClosed(3).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Which window's state a request reads or writes: the device that recorded
 * it and the window on that device. State tied to a display or a window is
 * kept for the device and window that recorded it.
 */
export declare class WindowStateKey {
  /**
   * The device's identity.
   */
  public readonly device: string;

  /**
   * The window's identity on the device.
   */
  public readonly window: string;

  /**
   * Creates the key.
   *
   * @param device The device's identity; not whitespace only.
   * @param window The window's identity; not whitespace only.
   * @throws ArgumentException synchronously when either is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { WindowStateKey } from "@noldova/desktop.protocol";
   *
   * export const key: WindowStateKey = new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main");
   * ```
   */
  public constructor(device: string, window: string);

  /**
   * Reads a key from its wire form, the payload of `desktop.readWindowBounds`
   * and `desktop.readWindowLayout`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The key.
   * @throws JsonException synchronously when a field is missing, blank or
   * not a string, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { WindowStateKey } from "@noldova/desktop.protocol";
   *
   * export const key: WindowStateKey = WindowStateKey.fromJson({ device: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", window: "main" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowStateKey;

  /**
   * Returns the wire form.
   *
   * @returns The `device` and `window` fields.
   *
   * @example
   * ```ts
   * import { Request, ShellMethods, WindowStateKey } from "@noldova/desktop.protocol";
   *
   * export const read: Request = new Request("r1", ShellMethods.readWindowBounds, new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.writeWindowBounds` and `desktop.writeWindowLayout`:
 * the window's key and the state to keep for it. The shell stores the state
 * as given; its owner, the main process for bounds and the window for layout,
 * defines its form.
 */
export declare class WindowStateWrite {
  /**
   * The window whose state is written.
   */
  public readonly key: WindowStateKey;

  /**
   * The state to keep.
   */
  public readonly value: JsonObject;

  /**
   * Creates the write.
   *
   * @param key The window.
   * @param value The state to keep.
   *
   * @example
   * ```ts
   * import { WindowStateKey, WindowStateWrite } from "@noldova/desktop.protocol";
   *
   * export const write: WindowStateWrite = new WindowStateWrite(new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main"), { width: 1280, height: 800 });
   * ```
   */
  public constructor(key: WindowStateKey, value: JsonObject);

  /**
   * Reads a write from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The write.
   * @throws JsonException synchronously when the key's fields are invalid,
   * the value is missing or not an object, or another field is present;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { WindowStateWrite } from "@noldova/desktop.protocol";
   *
   * export const write: WindowStateWrite = WindowStateWrite.fromJson({ device: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", window: "main", value: { width: 1280 } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowStateWrite;

  /**
   * Returns the wire form.
   *
   * @returns The key's `device` and `window` fields and the `value` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WindowStateKey, WindowStateWrite } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WindowStateWrite(new WindowStateKey("1b4e28ba-2fa1-41d2-883f-0016d3cca427", "main"), { width: 1280 }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to `desktop.readWindowBounds` and `desktop.readWindowLayout`: the
 * state kept for the window, or `null` when none is kept.
 */
export declare class WindowStateValue {
  /**
   * The kept state, or `null`.
   */
  public readonly value: JsonObject | null;

  /**
   * Creates the answer.
   *
   * @param value The kept state, or `null` when none is kept.
   *
   * @example
   * ```ts
   * import { WindowStateValue } from "@noldova/desktop.protocol";
   *
   * export const answer: WindowStateValue = new WindowStateValue(null);
   * ```
   */
  public constructor(value: JsonObject | null);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value is missing or neither
   * an object nor `null`, or another field is present; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { WindowStateValue } from "@noldova/desktop.protocol";
   *
   * export const answer: WindowStateValue = WindowStateValue.fromJson({ value: { width: 1280 } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WindowStateValue;

  /**
   * Returns the wire form.
   *
   * @returns The `value` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WindowStateValue } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WindowStateValue({ width: 1280 }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The work in progress that keeps a runtime from stopping, as a `Conflict`
 * answer to `desktop.stop` carries it in its details. Its wire form never
 * changes after protocol version 1.
 */
export declare class RunningWork {
  /**
   * Sentences describing each piece of work, in the order the runtime lists
   * them.
   */
  public readonly descriptions: readonly string[];

  /**
   * Creates the list.
   *
   * @param descriptions At least one description, none whitespace only. The
   * list keeps its own copy.
   * @throws ArgumentException synchronously when the list is empty or a
   * description is empty or whitespace only.
   *
   * @example
   * ```ts
   * import { RunningWork } from "@noldova/desktop.protocol";
   *
   * export const work: RunningWork = new RunningWork(["A reply in Planning", "A command in a terminal"]);
   * ```
   */
  public constructor(descriptions: readonly string[]);

  /**
   * Reads the list from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `descriptions` is missing, not
   * an array of strings, empty or holds a blank description, or another
   * field is present; its path names the field or item.
   *
   * @example
   * ```ts
   * import { RunningWork } from "@noldova/desktop.protocol";
   *
   * export const work: RunningWork = RunningWork.fromJson({ descriptions: ["A reply in Planning"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RunningWork;

  /**
   * Returns the wire form.
   *
   * @returns The `descriptions` field.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, RunningWork } from "@noldova/desktop.protocol";
   *
   * export const conflict: Failure = new Failure(FailureCode.Conflict, "Work is in progress.", new RunningWork(["A reply in Planning"]).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The work a runtime has in progress, as `desktop.work` answers it. Unlike
 * `RunningWork`, the list may be empty.
 */
export declare class WorkReport {
  /**
   * Sentences describing each piece of work, in the order the runtime lists
   * them.
   */
  public readonly descriptions: readonly string[];

  /**
   * How many times the runtime's work has begun or ended before this report.
   * A client that hears reports both as answers and as `desktop.work` events
   * keeps the one with the higher sequence, since an event may be handled
   * before an answer that preceded it.
   */
  public readonly sequence: number;

  /**
   * Creates the report.
   *
   * @param descriptions The descriptions, possibly none, none whitespace
   * only. The report keeps its own copy.
   * @param sequence The report's sequence, a whole number from 0; 0 by default.
   * @throws ArgumentException synchronously when a description is null,
   * empty or whitespace only, or the sequence is not a whole number from 0.
   *
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/desktop.protocol";
   *
   * export const report: WorkReport = new WorkReport(["Indexing the project"], 3);
   * ```
   */
  public constructor(descriptions: readonly string[], sequence?: number);

  /**
   * Reads the report from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The report.
   * @throws JsonException synchronously when `descriptions` or `sequence` is
   * missing or invalid.
   *
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/desktop.protocol";
   *
   * export const report: WorkReport = WorkReport.fromJson({ descriptions: [], sequence: 0 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WorkReport;

  /**
   * Whether this report is newer than another.
   *
   * @param other The other report, or `null` when there is none.
   * @returns Whether there is no other report or this one's sequence is higher.
   *
   * @example
   * ```ts
   * import { WorkReport } from "@noldova/desktop.protocol";
   *
   * export function newest(current: WorkReport | null, heard: WorkReport): WorkReport | null {
   *   return heard.isNewerThan(current) ? heard : current;
   * }
   * ```
   */
  public isNewerThan(other: WorkReport | null): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The `descriptions` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WorkReport } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WorkReport([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What one parameter of a web view's debugging call may hold, as a module's
 * `webViews.json` declares it: one of its values, a number in its range, a
 * text up to its length, an object of its fields, or, with none of them, any
 * value.
 */
export declare class WebViewParameter {
  /**
   * Whether a call must give the parameter.
   */
  public readonly isRequired: boolean;

  /**
   * The values the parameter may hold, or `null` when it is not held to a
   * list.
   */
  public readonly values: readonly (string | number | boolean)[] | null;

  /**
   * The least number the parameter may hold, or `null`.
   */
  public readonly minimum: number | null;

  /**
   * The greatest number the parameter may hold, or `null`.
   */
  public readonly maximum: number | null;

  /**
   * The longest text the parameter may hold, in UTF-16 code units, or
   * `null`.
   */
  public readonly maxLength: number | null;

  /**
   * The fields of an object the parameter holds, each under its rule, or
   * `null` when it is not held to an object.
   */
  public readonly fields: ReadonlyMap<string, WebViewParameter> | null;

  /**
   * Creates the rule; it gives at most one of values, a range, a maximum
   * length and fields.
   *
   * @param isRequired Whether a call must give the parameter; `false` by
   * default.
   * @param values Distinct texts, finite numbers or booleans, at least one,
   * or `null`, the default.
   * @param minimum A finite least number, or `null`, the default.
   * @param maximum A finite greatest number, no less than the minimum, or
   * `null`, the default.
   * @param maxLength A positive integer, or `null`, the default.
   * @param fields The fields, each named in camelCase, or `null`, the
   * default.
   * @throws ArgumentException synchronously when the rule gives more than one
   * of them, or one of them is invalid.
   *
   * @example
   * ```ts
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const width: WebViewParameter = new WebViewParameter(true, null, 1, 4096);
   * ```
   */
  public constructor(
    isRequired?: boolean,
    values?: readonly (string | number | boolean)[] | null,
    minimum?: number | null,
    maximum?: number | null,
    maxLength?: number | null,
    fields?: ReadonlyMap<string, WebViewParameter> | null);

  /**
   * Reads a rule from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The rule.
   * @throws JsonException synchronously when the value is not a valid rule,
   * or has a field a rule doesn't have.
   *
   * @example
   * ```ts
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const format: WebViewParameter = WebViewParameter.fromJson({ values: ["png", "jpeg"] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewParameter;

  /**
   * Reads an object of named rules, such as a method's parameters.
   *
   * @param reader A reader over the object.
   * @returns The rules by name.
   * @throws JsonException synchronously when a name is not camelCase or a
   * rule is invalid, naming its path.
   *
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const fields: ReadonlyMap<string, WebViewParameter> = WebViewParameter.readFields(JsonReader.fromValue({ width: { maximum: 4096 } }));
   * ```
   */
  public static readFields(reader: JsonReader): ReadonlyMap<string, WebViewParameter>;

  /**
   * Whether a value is an object that holds only the named fields, each as
   * its rule allows, and every required one.
   *
   * @param fields The rules by name.
   * @param value The value.
   * @returns True when the rules allow it.
   *
   * @example
   * ```ts
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const isAllowed: boolean = WebViewParameter.allowsFields(new Map([["width", new WebViewParameter()]]), { width: 10 });
   * ```
   */
  public static allowsFields(fields: ReadonlyMap<string, WebViewParameter>, value: unknown): boolean;

  /**
   * Whether the parameter may hold a value.
   *
   * @param value The value a call gives.
   * @returns True when the rule allows it.
   *
   * @example
   * ```ts
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const isAllowed: boolean = new WebViewParameter(false, null, 0, 100).allows(80);
   * ```
   */
  public allows(value: unknown): boolean;

  /**
   * Writes the rule in its wire form, leaving out what it doesn't give.
   *
   * @returns The rule's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewParameter(false, null, null, null, 64).toJson();
   * ```
   */
  public toJson(): JsonObject;

  /**
   * Writes an object of named rules in its wire form.
   *
   * @param fields The rules by name.
   * @returns The object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = WebViewParameter.fieldsToJson(new Map([["width", new WebViewParameter()]]));
   * ```
   */
  public static fieldsToJson(fields: ReadonlyMap<string, WebViewParameter>): JsonObject;
}

/**
 * A debugging call a module declares in `webViews.json`, with the parameters
 * its runtime part may send, each under its rule. A method that loads or
 * replaces a document, or undoes what the host holds for the view, is
 * refused.
 */
export declare class WebViewMethod {
  /**
   * The method, a debugging protocol domain, a dot and a name, such as
   * `Page.captureScreenshot`.
   */
  public readonly name: string;

  /**
   * The parameters a call may give, by name.
   */
  public readonly parameters: ReadonlyMap<string, WebViewParameter>;

  /**
   * Creates the method.
   *
   * @param name The method.
   * @param parameters Its parameters, each named in camelCase; none by
   * default.
   * @throws ArgumentException synchronously when the name is not a method,
   * the method is refused, or a parameter's name is not camelCase.
   *
   * @example
   * ```ts
   * import { WebViewMethod, WebViewParameter } from "@noldova/desktop.protocol";
   *
   * export const method: WebViewMethod = new WebViewMethod("Page.captureScreenshot", new Map([["format", new WebViewParameter(false, ["png"])]]));
   * ```
   */
  public constructor(name: string, parameters?: ReadonlyMap<string, WebViewParameter>);

  /**
   * Whether the host keeps a method from every module's web views: it loads
   * or replaces a document, so it would pass the origin check, or it undoes
   * what the host holds for the view, such as its file chooser refusal, its
   * downloads, its lifetime or its certificate check.
   *
   * @param name The method, such as `Page.navigate`.
   * @returns True when it is refused.
   *
   * @example
   * ```ts
   * import { WebViewMethod } from "@noldova/desktop.protocol";
   *
   * export const isRefused: boolean = WebViewMethod.isRefused("Target.createTarget");
   * ```
   */
  public static isRefused(name: string): boolean;

  /**
   * Reads a method from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The method.
   * @throws JsonException synchronously when the value is not a valid
   * method, or has a field a method doesn't have.
   *
   * @example
   * ```ts
   * import { WebViewMethod } from "@noldova/desktop.protocol";
   *
   * export const method: WebViewMethod = WebViewMethod.fromJson({ name: "Page.enable" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewMethod;

  /**
   * Whether a call's parameters are an object that holds only the declared
   * parameters, each as its rule allows, and every required one.
   *
   * @param parameters The call's parameters.
   * @returns True when the declaration allows them.
   *
   * @example
   * ```ts
   * import { WebViewMethod } from "@noldova/desktop.protocol";
   *
   * export const isAllowed: boolean = new WebViewMethod("Page.enable").allows({});
   * ```
   */
  public allows(parameters: unknown): boolean;

  /**
   * Writes the method in its wire form, leaving out parameters when it has
   * none.
   *
   * @returns The method's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewMethod } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewMethod("Page.enable").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A key a module's pane takes from its web views, by name, with its keys on
 * Windows and Linux and on macOS. A key needs `Mod`, `Ctrl` or `Alt`, or is a
 * function key, and is never one that editing, the operating system or
 * Noldova Desktop holds on its platform; a loading key may also be `Escape`.
 */
export declare class WebViewKey {
  /**
   * The name the `Key` event holds: a lowercase letter followed by letters
   * and digits.
   */
  public readonly name: string;

  /**
   * Its keys on Windows and Linux.
   */
  public readonly keys: readonly KeyChord[];

  /**
   * Its keys on macOS.
   */
  public readonly macKeys: readonly KeyChord[];

  /**
   * Whether it is a loading key, which the pane takes only while the view's
   * page loads, and which may be `Escape`.
   */
  public readonly isLoadingKey: boolean;

  /**
   * Creates the key.
   *
   * @param name The key's name.
   * @param keys One to four keys on Windows and Linux.
   * @param macKeys One to four keys on macOS; `keys` by default.
   * @param isLoadingKey Whether it is a loading key; `false` by default.
   * @throws ArgumentException synchronously when the name is not a lowercase
   * letter followed by letters and digits, a platform has no keys, more than
   * four or one twice, or a key is a typing key, other than `Escape` for a
   * loading key, or one that editing, the operating system or Noldova
   * Desktop holds on that platform.
   *
   * @example
   * ```ts
   * import { KeyChord, WebViewKey } from "@noldova/desktop.protocol";
   *
   * export const reload: WebViewKey = new WebViewKey("reload", [KeyChord.parse("Mod+R"), KeyChord.parse("F5")], [KeyChord.parse("Mod+R")]);
   * export const stop: WebViewKey = new WebViewKey("stop", [KeyChord.parse("Escape")], undefined, true);
   * ```
   */
  public constructor(name: string, keys: readonly KeyChord[], macKeys?: readonly KeyChord[], isLoadingKey?: boolean);

  /**
   * Reads a key from its wire form; `macKeys` is optional.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @param isLoadingKey Whether it is a loading key; `false` by default.
   * @returns The key.
   * @throws JsonException synchronously when the value is not a valid key,
   * or has a field a key doesn't have.
   *
   * @example
   * ```ts
   * import { WebViewKey } from "@noldova/desktop.protocol";
   *
   * export const newTab: WebViewKey = WebViewKey.fromJson({ name: "newTab", keys: ["Mod+T"] });
   * export const stop: WebViewKey = WebViewKey.fromJson({ name: "stop", keys: ["Escape"] }, undefined, true);
   * ```
   */
  public static fromJson(value: unknown, path?: string, isLoadingKey?: boolean): WebViewKey;

  /**
   * The key's keys on a platform.
   *
   * @param platform The platform, as Node.js names it, such as `darwin`.
   * @returns `macKeys` on macOS and `keys` elsewhere.
   *
   * @example
   * ```ts
   * import type { KeyChord, WebViewKey } from "@noldova/desktop.protocol";
   *
   * export function onMac(key: WebViewKey): readonly KeyChord[] {
   *   return key.keysOn("darwin");
   * }
   * ```
   */
  public keysOn(platform: string): readonly KeyChord[];

  /**
   * Whether a press is one of the key's keys on a platform.
   *
   * @param stroke The press.
   * @param platform The platform, as Node.js names it, such as `win32`.
   * @returns True when one of the platform's keys matches it.
   *
   * @example
   * ```ts
   * import type { IKeyStroke, WebViewKey } from "@noldova/desktop.protocol";
   *
   * export function isPressedOnWindows(key: WebViewKey, stroke: IKeyStroke): boolean {
   *   return key.matches(stroke, "win32");
   * }
   * ```
   */
  public matches(stroke: IKeyStroke, platform: string): boolean;

  /**
   * Writes the key in its wire form.
   *
   * @returns The key's JSON object, with all three fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewKey } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = WebViewKey.fromJson({ name: "newTab", keys: ["Mod+T"] }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A module's `webViews.json`: the debugging calls its runtime part may send
 * its web views, the events it reads from them, and the keys its pane takes
 * from them. Only a module that declares it opens web views.
 */
export declare class WebViewDeclaration {
  /**
   * The methods, each named once.
   */
  public readonly methods: readonly WebViewMethod[];

  /**
   * The events, each a debugging protocol domain, a dot and a name, named
   * once.
   */
  public readonly events: readonly string[];

  /**
   * The keys the module's pane takes from its views, each named once.
   */
  public readonly keys: readonly WebViewKey[];

  /**
   * Whether the module takes its views' new-window requests as
   * `NewWindowRequested` events; the host refuses them otherwise.
   */
  public readonly newWindows: boolean;

  /**
   * The keys the module's pane takes from its views only while their page
   * loads, such as `Escape` to stop it, each named once across these and
   * `keys`.
   */
  public readonly loadingKeys: readonly WebViewKey[];

  /**
   * Creates the declaration.
   *
   * @param methods The methods; none by default.
   * @param events The events; none by default.
   * @param keys The keys; none by default.
   * @param newWindows Whether the module takes new-window requests; `false`
   * by default.
   * @param loadingKeys The loading keys; none by default.
   * @throws ArgumentException synchronously when a method or an event is
   * named twice, an event is not a domain, a dot and a name, a key is named
   * twice across `keys` and `loadingKeys`, a platform's key belongs to two of
   * them, `keys` holds a loading key, or there are more than 32 keys in all.
   *
   * @example
   * ```ts
   * import { WebViewDeclaration, WebViewMethod } from "@noldova/desktop.protocol";
   *
   * export const declaration: WebViewDeclaration = new WebViewDeclaration([new WebViewMethod("Page.enable")], ["Page.loadEventFired"]);
   * ```
   */
  public constructor(methods?: readonly WebViewMethod[], events?: readonly string[], keys?: readonly WebViewKey[], newWindows?: boolean, loadingKeys?: readonly WebViewKey[]);

  /**
   * Reads a declaration from its wire form; every field is optional.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The declaration.
   * @throws JsonException synchronously when the value is not a valid
   * declaration, or has a field a declaration doesn't have.
   *
   * @example
   * ```ts
   * import { WebViewDeclaration } from "@noldova/desktop.protocol";
   *
   * export const declaration: WebViewDeclaration = WebViewDeclaration.fromJson({ methods: [{ name: "Page.enable" }] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewDeclaration;

  /**
   * Whether a call is one the module declares, with its parameters as the
   * declaration allows.
   *
   * @param method The method, such as `Page.captureScreenshot`.
   * @param parameters The call's parameters.
   * @returns True when the declaration allows the call.
   *
   * @example
   * ```ts
   * import { WebViewDeclaration } from "@noldova/desktop.protocol";
   *
   * export const isAllowed: boolean = new WebViewDeclaration().allows("Page.enable", {});
   * ```
   */
  public allows(method: string, parameters: unknown): boolean;

  /**
   * Whether the module reads an event.
   *
   * @param method The event, such as `Page.loadEventFired`.
   * @returns True when the declaration names it.
   *
   * @example
   * ```ts
   * import { WebViewDeclaration } from "@noldova/desktop.protocol";
   *
   * export const isRead: boolean = new WebViewDeclaration([], ["Page.loadEventFired"]).allowsEvent("Page.loadEventFired");
   * ```
   */
  public allowsEvent(method: string): boolean;

  /**
   * The declared key a press is on a platform, a loading key among them only
   * while the view's page loads.
   *
   * @param stroke The press.
   * @param platform The platform, as Node.js names it, such as `darwin`.
   * @param isLoading Whether the view's page is loading; `false` by default.
   * @returns The key's name, or `null` when the press is none of them.
   *
   * @example
   * ```ts
   * import type { IKeyStroke, WebViewDeclaration } from "@noldova/desktop.protocol";
   *
   * export function nameOnMacOS(declaration: WebViewDeclaration, stroke: IKeyStroke): string | null {
   *   return declaration.findKey(stroke, "darwin");
   * }
   *
   * export function nameWhileLoading(declaration: WebViewDeclaration, stroke: IKeyStroke): string | null {
   *   return declaration.findKey(stroke, "linux", true);
   * }
   * ```
   */
  public findKey(stroke: IKeyStroke, platform: string, isLoading?: boolean): string | null;

  /**
   * Writes the declaration in its wire form.
   *
   * @returns The declaration's JSON object, with all three fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewDeclaration } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewDeclaration().toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The view or document a web view shows in: the name of one of its module's own views or documents, `<id>.<name>`, and
 * the document's instance when it has one.
 */
export declare class WebViewPane {
  /**
   * The view's or the document's name.
   */
  public readonly name: QualifiedName;

  /**
   * The document's instance, or `null` for a view.
   */
  public readonly instance: string | null;

  /**
   * Creates the pane.
   *
   * @param name The view's or the document's name.
   * @param instance The document's instance, not whitespace only, or `null`, the default.
   * @throws ArgumentException synchronously when the instance is whitespace only.
   *
   * @example
   * ```ts
   * import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";
   *
   * export const pane: WebViewPane = new WebViewPane(QualifiedName.parse("browser.pane"));
   * ```
   */
  public constructor(name: QualifiedName, instance?: string | null);

  /**
   * Reads a pane from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The pane.
   * @throws JsonException synchronously when the value is not a valid pane.
   *
   * @example
   * ```ts
   * import { WebViewPane } from "@noldova/desktop.protocol";
   *
   * export const pane: WebViewPane = WebViewPane.fromJson({ name: "notes.page", instance: "a1" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewPane;

  /**
   * Whether another pane is the same view or the same document's instance.
   *
   * @param other The other pane.
   * @returns True when both name the same pane.
   *
   * @example
   * ```ts
   * import { WebViewPane } from "@noldova/desktop.protocol";
   *
   * export const isSame: boolean = WebViewPane.fromJson({ name: "browser.pane" }).equals(WebViewPane.fromJson({ name: "browser.pane" }));
   * ```
   */
  public equals(other: WebViewPane): boolean;

  /**
   * Writes the pane in its wire form, leaving out a missing instance.
   *
   * @returns The pane's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewPane } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = WebViewPane.fromJson({ name: "browser.pane" }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An open web view: its id, the module that owns it, its pane and its profile's key.
 */
export declare class WebViewInfo {
  /**
   * The view's id, which the host gives it.
   */
  public readonly id: string;

  /**
   * The id of the module that owns the view.
   */
  public readonly module: string;

  /**
   * The view's pane, one of the module's own.
   */
  public readonly pane: WebViewPane;

  /**
   * The key of the view's profile.
   */
  public readonly profileKey: string;

  /**
   * Creates the information.
   *
   * @param id The view's id; not whitespace only.
   * @param module The module's id, which owns the pane.
   * @param pane The pane.
   * @param profileKey The profile's key, `^[a-z0-9][a-z0-9-]{0,63}$`.
   * @throws ArgumentException synchronously when the id is blank, the module is not the pane's owner, or the key is invalid.
   *
   * @example
   * ```ts
   * import { QualifiedName, WebViewInfo, WebViewPane } from "@noldova/desktop.protocol";
   *
   * export const info: WebViewInfo = new WebViewInfo("1", "browser", new WebViewPane(QualifiedName.parse("browser.pane")), "workspace-1");
   * ```
   */
  public constructor(id: string, module: string, pane: WebViewPane, profileKey: string);

  /**
   * Reads the information from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The information.
   * @throws JsonException synchronously when the value is not valid information about a view.
   *
   * @example
   * ```ts
   * import { WebViewInfo } from "@noldova/desktop.protocol";
   *
   * export const info: WebViewInfo = WebViewInfo.fromJson({ id: "1", module: "browser", pane: { name: "browser.pane" }, profileKey: "workspace-1" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewInfo;

  /**
   * Writes the information in its wire form.
   *
   * @returns Its JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewInfo } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = WebViewInfo.fromJson({ id: "1", module: "browser", pane: { name: "browser.pane" }, profileKey: "a" }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * How a view answered a load, a move through its history, a reload or a stop, as the window bridge and the runtime's
 * controls return it; a refusal carries the origin the check refused, and no other answer does.
 */
export declare class WebViewNavigation {
  /**
   * The answer's kind.
   */
  public readonly kind: WebViewNavigationKind;

  /**
   * The refused origin, or `null`.
   */
  public readonly origin: string | null;

  /**
   * Creates the answer.
   *
   * @param kind The kind.
   * @param origin The refused origin, for a refusal only; `null` by default.
   * @throws ArgumentException synchronously when a refusal lacks its origin, or another kind has one.
   *
   * @example
   * ```ts
   * import { WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
   *
   * export const answer: WebViewNavigation = new WebViewNavigation(WebViewNavigationKind.Refused, "https://example.net");
   * ```
   */
  public constructor(kind: WebViewNavigationKind, origin?: string | null);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value is not a valid answer.
   *
   * @example
   * ```ts
   * import { WebViewNavigation } from "@noldova/desktop.protocol";
   *
   * export const answer: WebViewNavigation = WebViewNavigation.fromJson({ kind: "Started" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewNavigation;

  /**
   * Writes the answer in its wire form.
   *
   * @returns The answer's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewNavigation(WebViewNavigationKind.NoHistory).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One event of a web view, as the host reports it to the window part and the runtime part: its module, its view, its
 * kind and exactly the details of that kind, which `WebViewEventKind` lists.
 */
export declare class WebViewEvent {
  /**
   * The id of the module that owns the view.
   */
  public readonly module: string;

  /**
   * The view's id.
   */
  public readonly view: string;

  /**
   * The event's kind.
   */
  public readonly kind: WebViewEventKind;

  /**
   * The details of its kind.
   */
  public readonly details: JsonObject;

  /**
   * Creates the event.
   *
   * @param module The module's id.
   * @param view The view's id; not whitespace only.
   * @param kind The kind.
   * @param details Exactly the details of the kind, each of its type; none by default.
   * @throws ArgumentException synchronously when the module or the view is invalid, or the details don't fit the kind.
   *
   * @example
   * ```ts
   * import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
   *
   * export const event: WebViewEvent = new WebViewEvent("browser", "1", WebViewEventKind.Crashed);
   * ```
   */
  public constructor(module: string, view: string, kind: WebViewEventKind, details?: JsonObject);

  /**
   * Reads an event from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The event.
   * @throws JsonException synchronously when the value is not a valid event.
   *
   * @example
   * ```ts
   * import { WebViewEvent } from "@noldova/desktop.protocol";
   *
   * export const event: WebViewEvent = WebViewEvent.fromJson({ module: "browser", view: "1", kind: "Closed" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewEvent;

  /**
   * Writes the event in its wire form, leaving out empty details.
   *
   * @returns The event's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewEvent("browser", "1", WebViewEventKind.Closed).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Why a call on a web view failed; a protocol failure carries the engine's code and message, and another kind may carry the host's message naming the rule it broke, never a code.
 */
export declare class WebViewFailure {
  /**
   * The failure's kind.
   */
  public readonly kind: WebViewFailureKind;

  /**
   * The engine's code, or `null`.
   */
  public readonly code: number | null;

  /**
   * The engine's message for a protocol failure, the host's message naming the rule for another kind that has one, or `null`.
   */
  public readonly message: string | null;

  /**
   * Creates the failure.
   *
   * @param kind The kind.
   * @param code The engine's code, a whole number, for a protocol failure only; `null` by default.
   * @param message The engine's message for a protocol failure, or the host's message naming the rule for another kind; `null` by default.
   * @throws ArgumentException synchronously when a protocol failure lacks its code or message, or another kind has a code.
   *
   * @example
   * ```ts
   * import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
   *
   * export const failure: WebViewFailure = new WebViewFailure(WebViewFailureKind.Protocol, -32000, "No node with given id found");
   * ```
   */
  public constructor(kind: WebViewFailureKind, code?: number | null, message?: string | null);

  /**
   * Reads a failure from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The failure.
   * @throws JsonException synchronously when the value is not a valid failure.
   *
   * @example
   * ```ts
   * import { WebViewFailure } from "@noldova/desktop.protocol";
   *
   * export const failure: WebViewFailure = WebViewFailure.fromJson({ kind: "TimedOut" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewFailure;

  /**
   * Writes the failure in its wire form.
   *
   * @returns The failure's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewFailure(WebViewFailureKind.ViewClosed).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A runtime part's call on its module's web views, which the runtime sends one main process in `desktop.webViewCommand`
 * and the main process answers by its call number. Each action takes its own value, as `WebViewAction` says, and every
 * action but `list` and `clearProfile` names a view.
 */
export declare class WebViewCommand {
  /**
   * The call's number, which its answer repeats.
   */
  public readonly call: number;

  /**
   * The id of the module whose runtime part calls.
   */
  public readonly module: string;

  /**
   * What the call asks.
   */
  public readonly action: WebViewAction;

  /**
   * The view's id, or `null` for `list` and `clearProfile`.
   */
  public readonly view: string | null;

  /**
   * The action's value, or `null` when it takes none.
   */
  public readonly value: JsonValue;

  /**
   * Creates the command.
   *
   * @param call A positive integer.
   * @param module The module's id.
   * @param action The action.
   * @param view The view's id, or `null`, the default, for `list` and `clearProfile`.
   * @param value The action's value: an address of at most 32768 characters for `navigate`, an array of texts for
   * `setAllowedOrigins`, a profile key for `clearProfile`, and for `send` an object of `method`, `params` and
   * `timeoutMilliseconds` from 1 to 10000; `null`, the default, for every other action.
   * @throws ArgumentException synchronously when a field is invalid or the value doesn't fit the action.
   *
   * @example
   * ```ts
   * import { WebViewAction, WebViewCommand } from "@noldova/desktop.protocol";
   *
   * export const command: WebViewCommand = new WebViewCommand(1, "browser", WebViewAction.Navigate, "1", "https://example.com/");
   * ```
   */
  public constructor(call: number, module: string, action: WebViewAction, view?: string | null, value?: JsonValue);

  /**
   * Reads a command from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The command.
   * @throws JsonException synchronously when the value is not a valid command.
   *
   * @example
   * ```ts
   * import { WebViewCommand } from "@noldova/desktop.protocol";
   *
   * export const command: WebViewCommand = WebViewCommand.fromJson({ call: 1, module: "browser", action: "List" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewCommand;

  /**
   * Writes the command in its wire form, leaving out a missing view and value.
   *
   * @returns The command's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewAction, WebViewCommand } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewCommand(1, "browser", WebViewAction.List).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The loopback ports a web view may never reach, in `desktop.webViewBlockedPorts` and its acknowledgement
 * `desktop.webViewPortsBlocked`: the runtime's own endpoint on Windows and every open tool endpoint.
 */
export declare class WebViewBlockedPorts {
  /**
   * The list's number, which grows with each change, so that an acknowledgement covers every list up to it.
   */
  public readonly serial: number;

  /**
   * The ports, in ascending order.
   */
  public readonly ports: readonly number[];

  /**
   * Creates the list.
   *
   * @param serial A whole number from 0.
   * @param ports Distinct whole numbers from 1 to 65535, in any order.
   * @throws ArgumentException synchronously when the serial or a port is invalid, or a port repeats.
   *
   * @example
   * ```ts
   * import { WebViewBlockedPorts } from "@noldova/desktop.protocol";
   *
   * export const blocked: WebViewBlockedPorts = new WebViewBlockedPorts(3, [52100, 61230]);
   * ```
   */
  public constructor(serial: number, ports: readonly number[]);

  /**
   * Reads a list from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when the value is not a valid list.
   *
   * @example
   * ```ts
   * import { WebViewBlockedPorts } from "@noldova/desktop.protocol";
   *
   * export const blocked: WebViewBlockedPorts = WebViewBlockedPorts.fromJson({ serial: 3, ports: [52100] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewBlockedPorts;

  /**
   * Writes the list in its wire form.
   *
   * @returns The list's JSON object.
   *
   * @example
   * ```ts
   * import { WebViewBlockedPorts } from "@noldova/desktop.protocol";
   *
   * export const json = new WebViewBlockedPorts(3, [52100]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The main process's answer to a `WebViewCommand`, in `desktop.webViewAnswered`: its value, or why it failed.
 */
export declare class WebViewAnswered {
  /**
   * The number of the call it answers.
   */
  public readonly call: number;

  /**
   * The call's value, or `null` when it has none or failed.
   */
  public readonly value: JsonValue;

  /**
   * Why the call failed, or `null`.
   */
  public readonly failure: WebViewFailure | null;

  /**
   * Creates the answer.
   *
   * @param call A positive integer.
   * @param value The value; `null` by default.
   * @param failure The failure, with no value; `null` by default.
   * @throws ArgumentException synchronously when the call is invalid, or the answer carries both a value and a failure.
   *
   * @example
   * ```ts
   * import { WebViewAnswered } from "@noldova/desktop.protocol";
   *
   * export const answered: WebViewAnswered = new WebViewAnswered(1, { kind: "Started" });
   * ```
   */
  public constructor(call: number, value?: JsonValue, failure?: WebViewFailure | null);

  /**
   * Reads an answer from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value is not a valid answer.
   *
   * @example
   * ```ts
   * import { WebViewAnswered } from "@noldova/desktop.protocol";
   *
   * export const answered: WebViewAnswered = WebViewAnswered.fromJson({ call: 1, failure: { kind: "ViewClosed" } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewAnswered;

  /**
   * Writes the answer in its wire form, leaving out a missing value and failure.
   *
   * @returns The answer's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewAnswered } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new WebViewAnswered(1).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's call on this machine's secret store, in `desktop.secretCommand`, which only the main process gets and answers
 * with a `SecretAnswered`.
 */
export declare class SecretCommand {
  /**
   * The number that the answer names.
   */
  public readonly call: number;

  /**
   * What the main process does.
   */
  public readonly action: SecretAction;

  /**
   * The value to encrypt, or the ciphertext to decrypt, or `null` to name the device.
   */
  public readonly value: string | null;

  /**
   * Creates the command.
   *
   * @param call A positive integer.
   * @param action What the main process does.
   * @param value A value of 1 to 16,384 characters to encrypt, a ciphertext of 1 to 131,072 characters to decrypt, or `null`,
   * the default, to name the device.
   * @throws ArgumentException synchronously when the call is invalid, or the value doesn't suit the action; the message never
   * holds the value.
   *
   * @example
   * ```ts
   * import { SecretAction, SecretCommand } from "@noldova/desktop.protocol";
   *
   * export const command: SecretCommand = new SecretCommand(1, SecretAction.Device);
   * ```
   */
  public constructor(call: number, action: SecretAction, value?: string | null);

  /**
   * Reads a command from its wire form, which accepts no unknown fields.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The command.
   * @throws JsonException synchronously when the value is not a valid command.
   *
   * @example
   * ```ts
   * import { SecretCommand } from "@noldova/desktop.protocol";
   *
   * export const command: SecretCommand = SecretCommand.fromJson({ call: 1, action: "Device" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SecretCommand;

  /**
   * Writes the command in its wire form, leaving out a missing value.
   *
   * @returns The command's JSON object.
   *
   * @example
   * ```ts
   * import { SecretAction, SecretCommand } from "@noldova/desktop.protocol";
   *
   * export const json: string = JSON.stringify(new SecretCommand(1, SecretAction.Device).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The reason a secret call's failure carries: each secret call that fails is `Unavailable`, with a message for the
 * person and, in its `details`, `{ "reason": <SecretFailureReason> }`, which reaches a runtime part, a window part and a
 * command-line part alike.
 */
export declare class SecretFailures {
  /**
   * The `details` of a secret call's failure for a reason.
   *
   * @param reason Why the call failed.
   * @returns `{ "reason": <reason> }`.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
   *
   * export const failure: Failure = new Failure(FailureCode.Unavailable, "Open the app to use its secrets.",
   *   SecretFailures.detailsOf(SecretFailureReason.NotConnected));
   * ```
   */
  public static detailsOf(reason: SecretFailureReason): JsonObject;

  /**
   * Reads why a secret call failed.
   *
   * @param failure The call's failure, such as a `MethodFailureException`'s `failure`.
   * @returns The reason, or `null` for any other failure: one that isn't `Unavailable`, or whose `details` hold no
   * known reason.
   *
   * @example
   * ```ts
   * import { SecretFailureReason, SecretFailures } from "@noldova/desktop.protocol";
   * import { MethodFailureException, type IRuntimePartContext } from "@noldova/desktop.runtime";
   *
   * export async function readTokenAsync(context: IRuntimePartContext): Promise<string | null> {
   *   try {
   *     return await context.secrets.readAsync("notes.syncToken");
   *   }
   *   catch (error) {
   *     if (error instanceof MethodFailureException && SecretFailures.reasonOf(error.failure) === SecretFailureReason.NotConnected)
   *       return null;
   *     throw error;
   *   }
   * }
   * ```
   */
  public static reasonOf(failure: Failure): SecretFailureReason | null;
}

/**
 * The main process's answer to a `SecretCommand`, in `desktop.secretAnswered`: its value, or why it failed.
 */
export declare class SecretAnswered {
  /**
   * The number of the call it answers.
   */
  public readonly call: number;

  /**
   * The device's id, the ciphertext or the secret, or `null` when the call failed.
   */
  public readonly value: string | null;

  /**
   * Why the call failed, or `null`.
   */
  public readonly failure: SecretFailureKind | null;

  /**
   * Creates the answer, which carries exactly one of a value and a failure.
   *
   * @param call A positive integer.
   * @param value The value; `null` by default.
   * @param failure The failure, with no value; `null` by default.
   * @throws ArgumentException synchronously when the call is invalid, or the answer carries both a value and a failure or neither.
   *
   * @example
   * ```ts
   * import { SecretAnswered, SecretFailureKind } from "@noldova/desktop.protocol";
   *
   * export const answered: SecretAnswered = new SecretAnswered(1, null, SecretFailureKind.Unprotected);
   * ```
   */
  public constructor(call: number, value?: string | null, failure?: SecretFailureKind | null);

  /**
   * Reads an answer from its wire form, which accepts no unknown fields.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The answer.
   * @throws JsonException synchronously when the value is not a valid answer.
   *
   * @example
   * ```ts
   * import { SecretAnswered } from "@noldova/desktop.protocol";
   *
   * export const answered: SecretAnswered = SecretAnswered.fromJson({ call: 1, failure: "Unprotected" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SecretAnswered;

  /**
   * Writes the answer in its wire form, leaving out a missing value and failure.
   *
   * @returns The answer's JSON object.
   *
   * @example
   * ```ts
   * import { SecretAnswered, SecretFailureKind } from "@noldova/desktop.protocol";
   *
   * export const json: string = JSON.stringify(new SecretAnswered(1, null, SecretFailureKind.Unprotected).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A module's secret by its name: the payload of `desktop.removeSecret` and `desktop.secretStatus`.
 */
export declare class SecretReference {
  /**
   * The secret's name, `<module>.<name>`, which the module's settings hold in place of the value.
   */
  public readonly name: QualifiedName;

  /**
   * Creates the reference.
   *
   * @param name A module's name, never Noldova Desktop's.
   * @throws ArgumentException synchronously when the name is Noldova Desktop's.
   *
   * @example
   * ```ts
   * import { QualifiedName, SecretReference } from "@noldova/desktop.protocol";
   *
   * export const reference: SecretReference = new SecretReference(QualifiedName.parse("notes.syncToken"));
   * ```
   */
  public constructor(name: QualifiedName);

  /**
   * Reads the reference from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The reference.
   * @throws JsonException synchronously when `name` is missing, isn't a qualified name or is Noldova Desktop's, or a field is
   * unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { SecretReference } from "@noldova/desktop.protocol";
   *
   * export const reference: SecretReference = SecretReference.fromJson({ name: "notes.syncToken" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SecretReference;

  /**
   * Writes the reference in its wire form.
   *
   * @returns The reference's JSON object.
   *
   * @example
   * ```ts
   * import { QualifiedName, SecretReference } from "@noldova/desktop.protocol";
   *
   * export const json: string = JSON.stringify(new SecretReference(QualifiedName.parse("notes.syncToken")).toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A module's secret and its value: the payload of `desktop.saveSecret`.
 */
export declare class SecretValue {
  /**
   * The secret's name, `<module>.<name>`.
   */
  public readonly name: QualifiedName;

  /**
   * The value, which the main process encrypts before the runtime keeps it.
   */
  public readonly value: string;

  /**
   * Creates the secret.
   *
   * @param name A module's name, never Noldova Desktop's.
   * @param value 1 to 16,384 characters, with no lone surrogate, so the value read back is the value saved.
   * @throws ArgumentException synchronously when the name is Noldova Desktop's, or the value is empty, too long or holds a lone surrogate; the message
   * never holds the value.
   *
   * @example
   * ```ts
   * import { QualifiedName, SecretValue } from "@noldova/desktop.protocol";
   *
   * export function secretOf(token: string): SecretValue {
   *   return new SecretValue(QualifiedName.parse("notes.syncToken"), token);
   * }
   * ```
   */
  public constructor(name: QualifiedName, value: string);

  /**
   * Reads the secret from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The secret.
   * @throws JsonException synchronously when `name` or `value` is missing or invalid, or a field is unknown; its path names the
   * field, never the value.
   *
   * @example
   * ```ts
   * import { SecretValue } from "@noldova/desktop.protocol";
   *
   * export function readSecret(payload: unknown): SecretValue {
   *   return SecretValue.fromJson(payload);
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): SecretValue;

  /**
   * Writes the secret in its wire form, value included.
   *
   * @returns The secret's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SecretValue } from "@noldova/desktop.protocol";
   *
   * export function wireOf(token: string): JsonObject {
   *   return new SecretValue(QualifiedName.parse("notes.syncToken"), token).toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The web view events the main process passes the runtime in `desktop.webViewEvents`, in the order they happened.
 */
export declare class WebViewEvents {
  /**
   * The events, at least one.
   */
  public readonly events: readonly WebViewEvent[];

  /**
   * Creates the batch.
   *
   * @param events The events, at least one.
   * @throws ArgumentException synchronously when there are none.
   *
   * @example
   * ```ts
   * import { WebViewEvent, WebViewEventKind, WebViewEvents } from "@noldova/desktop.protocol";
   *
   * export const events: WebViewEvents = new WebViewEvents([new WebViewEvent("browser", "1", WebViewEventKind.Closed)]);
   * ```
   */
  public constructor(events: readonly WebViewEvent[]);

  /**
   * Reads a batch from its wire form.
   *
   * @param value The parsed JSON value.
   * @param path The JSON path a rejection reports; `$` by default.
   * @returns The batch.
   * @throws JsonException synchronously when the value is not a valid batch.
   *
   * @example
   * ```ts
   * import { WebViewEvents } from "@noldova/desktop.protocol";
   *
   * export const events: WebViewEvents = WebViewEvents.fromJson({ events: [{ module: "browser", view: "1", kind: "Crashed" }] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): WebViewEvents;

  /**
   * Writes the batch in its wire form.
   *
   * @returns The batch's JSON object.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WebViewEvents } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = WebViewEvents.fromJson({ events: [{ module: "browser", view: "1", kind: "Crashed" }] }).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One module of the runtime's build: what its declaration says about it and
 * where it stands. An active or off module has no cause; a failed or blocked
 * one has a cause that is safe to show, without a stack or a path outside the
 * data directory, and a blocked one also names the dependency that blocks it.
 * An off module names the switch setting that turns it on.
 */
export declare class ModuleStatus {
  /**
   * The module's id.
   */
  public readonly id: string;

  /**
   * The module's own version, `<major>.<minor>.<patch>`, as it declares it.
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
   * The ids of the modules it depends on, as it declares them.
   */
  public readonly dependencies: readonly string[];

  /**
   * The names it declares, by kind, such as `commands` or `views`.
   */
  public readonly contributions: ReadonlyMap<string, readonly string[]>;

  /**
   * Where the module stands.
   */
  public readonly state: ModuleState;

  /**
   * Why the module is not active; `null` for an active or off module.
   */
  public readonly cause: string | null;

  /**
   * The dependency that is not active, for a blocked module; otherwise
   * `null`.
   */
  public readonly blockedBy: string | null;

  /**
   * The ids of the modules it uses when the app includes them and works
   * without, as it declares them. An optional dependency never blocks it.
   */
  public readonly optionalDependencies: readonly string[];

  /**
   * The name of the `Boolean` setting that turns the module on and off, as
   * its `switchSetting` declares it; `null` for a module that is always on.
   */
  public readonly switchSetting: string | null;

  /**
   * Creates the status.
   *
   * @param id The module's id; not whitespace only.
   * @param version The module's version, `<major>.<minor>.<patch>`: three
   * whole numbers of up to nine digits without leading zeros, such as `0.0.1`.
   * @param displayName The name people see; not whitespace only.
   * @param description What the module does; not whitespace only.
   * @param dependencies The ids of the modules it depends on.
   * @param contributions The names it declares, by kind.
   * @param state Where the module stands.
   * @param cause `null` for an active or off module; otherwise text that is
   * not whitespace only.
   * @param blockedBy For a blocked module, the dependency that blocks it;
   * otherwise `null`, the default.
   * @param optionalDependencies The ids of the modules it uses when the app
   * includes them; none by default.
   * @param switchSetting The setting that turns the module on and off; `null`,
   * the default, for a module that is always on.
   * @throws ArgumentException synchronously when the id, the display name or
   * the description is blank, the version does not have that form, an active or off module has a cause, a failed or
   * blocked or unavailable module has none or a blank one, `blockedBy` is not one of the
   * dependencies of a blocked module, an off module has no switch setting, or
   * the switch setting is blank.
   *
   * @example
   * ```ts
   * import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";
   *
   * export const status: ModuleStatus = new ModuleStatus(
   *   "notes", "0.0.1", "Notes", "Keeps notes.", ["tasks"], new Map([["commands", ["notes.newNote"]]]), ModuleState.Blocked,
   *   "It depends on tasks, which is not active.", "tasks");
   * ```
   */
  public constructor(
    id: string,
    version: string,
    displayName: string,
    description: string,
    dependencies: readonly string[],
    contributions: ReadonlyMap<string, readonly string[]>,
    state: ModuleState,
    cause: string | null,
    blockedBy?: string | null,
    optionalDependencies?: readonly string[],
    switchSetting?: string | null);

  /**
   * Reads the status from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The status.
   * @throws JsonException synchronously when a field is missing or invalid,
   * or `cause`, `blockedBy` or `switchSetting` does not match the state; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { ModuleStatus } from "@noldova/desktop.protocol";
   *
   * export const status: ModuleStatus = ModuleStatus.fromJson({
   *   id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: [], contributes: {}, state: "Active"
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): ModuleStatus;

  /**
   * Lists the names the module declares of one kind.
   *
   * @param kind The kind, such as `commands`.
   * @returns The names, in declared order; none when it declares none.
   *
   * @example
   * ```ts
   * import type { ModuleStatus } from "@noldova/desktop.protocol";
   *
   * export function listCommands(status: ModuleStatus): readonly string[] {
   *   return status.listContributions("commands");
   * }
   * ```
   */
  public listContributions(kind: string): readonly string[];

  /**
   * Returns the same module in another state, with the same declaration.
   *
   * @param state Where the module stands.
   * @param cause `null` for an active or off module; otherwise text that is
   * not whitespace only.
   * @param blockedBy For a blocked module, the dependency that blocks it;
   * otherwise `null`, the default.
   * @returns The new status.
   * @throws ArgumentException synchronously as the constructor does.
   *
   * @example
   * ```ts
   * import { ModuleState, type ModuleStatus } from "@noldova/desktop.protocol";
   *
   * export function fail(status: ModuleStatus): ModuleStatus {
   *   return status.withState(ModuleState.Failed, "Its window part could not be loaded.");
   * }
   * ```
   */
  public withState(state: ModuleState, cause: string | null, blockedBy?: string | null): ModuleStatus;

  /**
   * Returns the wire form.
   *
   * @returns The `id`, `version`, `displayName`, `description`, `dependencies`,
   * `contributes` and `state` fields, and `cause`, `blockedBy`,
   * `optionalDependencies` and `switchSetting` when there are any.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer to `desktop.modules`: every module of the build in activation
 * order, with where it stands.
 */
export declare class ModuleStatusList {
  /**
   * The modules' statuses, in activation order.
   */
  public readonly modules: readonly ModuleStatus[];

  /**
   * Creates the list.
   *
   * @param modules The modules' statuses.
   *
   * @example
   * ```ts
   * import { ModuleState, ModuleStatus, ModuleStatusList } from "@noldova/desktop.protocol";
   *
   * export const list: ModuleStatusList = new ModuleStatusList([new ModuleStatus("notes", "0.0.1", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null)]);
   * ```
   */
  public constructor(modules: readonly ModuleStatus[]);

  /**
   * Reads the list from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `modules` is missing or not a
   * list of objects, or a status in it is invalid; its path names the field.
   *
   * @example
   * ```ts
   * import { ModuleStatusList } from "@noldova/desktop.protocol";
   *
   * export const list: ModuleStatusList = ModuleStatusList.fromJson({
   *   modules: [{ id: "notes", version: "0.0.1", displayName: "Notes", description: "Keeps notes.", dependencies: [], contributes: {}, state: "Active" }]
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): ModuleStatusList;

  /**
   * Returns the wire form.
   *
   * @returns The `modules` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { ModuleStatusList } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new ModuleStatusList([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Where data written by a release that predates the shell was found, as a
 * `PreShellData` failure carries it in its details. Its wire form never
 * changes after protocol version 1.
 */
export declare class PreShellData {
  /**
   * The full path of the data directory that holds the data.
   */
  public readonly location: string;

  /**
   * Creates the details.
   *
   * @param location The data directory's full path; not whitespace only.
   * @throws ArgumentException synchronously when the location is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { PreShellData } from "@noldova/desktop.protocol";
   *
   * export const data: PreShellData = new PreShellData("/home/person/.noldova/desktop");
   * ```
   */
  public constructor(location: string);

  /**
   * Reads the details from their wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The details.
   * @throws JsonException synchronously when `location` is missing, not a
   * string or blank, or another field is present; its path names the field.
   *
   * @example
   * ```ts
   * import { PreShellData } from "@noldova/desktop.protocol";
   *
   * export const data: PreShellData = PreShellData.fromJson({ location: "/home/person/.noldova/desktop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): PreShellData;

  /**
   * Returns the wire form.
   *
   * @returns The `location` field.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, PreShellData } from "@noldova/desktop.protocol";
   *
   * export const failure: Failure = new Failure(FailureCode.PreShellData, "This data folder holds data of an older Noldova Desktop Sample.", new PreShellData("/home/person/.noldova/desktop").toJson());
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One of the app's own windows, so a module that acts on the screen can leave it alone.
 */
export declare class AppWindow {
  /**
   * The window's identity on its platform: its window handle (`HWND`) on Windows, its window number on macOS, and its
   * X11 window on Linux; null under Wayland, which gives a window no identity other programs can see.
   */
  public readonly handle: number | null;

  /**
   * The id of the process that owns the window, the app's main process. That process owns every window the app shows,
   * its dialogs, menus and tooltips among them, so any window of this process is the app's.
   */
  public readonly processId: number;

  /**
   * Creates the window.
   *
   * @param handle The window's identity; null or a whole number from 1.
   * @param processId The owning process's id; a whole number from 1.
   * @throws ArgumentException synchronously when a value is invalid.
   *
   * @example
   * ```ts
   * import { AppWindow } from "@noldova/desktop.protocol";
   *
   * export const main: AppWindow = new AppWindow(132_406, 4_210);
   * ```
   */
  public constructor(handle: number | null, processId: number);

  /**
   * Reads the window from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The window.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { AppWindow } from "@noldova/desktop.protocol";
   *
   * export const main: AppWindow = AppWindow.fromJson({ handle: null, processId: 4210 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AppWindow;

  /**
   * Returns the wire form.
   *
   * @returns The `handle` and `processId` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { AppWindow } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new AppWindow(132_406, 4_210).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The app's own windows: the payload of `desktop.appWindowsChanged`.
 */
export declare class AppWindowList {
  /**
   * The windows, in the order they opened.
   */
  public readonly windows: readonly AppWindow[];

  /**
   * Creates the list.
   *
   * @param windows The windows, copied.
   *
   * @example
   * ```ts
   * import { AppWindow, AppWindowList } from "@noldova/desktop.protocol";
   *
   * export const list: AppWindowList = new AppWindowList([new AppWindow(132_406, 4_210)]);
   * ```
   */
  public constructor(windows: readonly AppWindow[]);

  /**
   * Reads the list from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { AppWindowList } from "@noldova/desktop.protocol";
   *
   * export const list: AppWindowList = AppWindowList.fromJson({ windows: [{ handle: 132406, processId: 4210 }] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AppWindowList;

  /**
   * Returns the wire form.
   *
   * @returns The `windows` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { AppWindowList } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new AppWindowList([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The app's main window as the main process last reported it: the payload of `desktop.mainWindowChanged`, and the
 * answer of `desktop.mainWindow`.
 */
export declare class MainWindow {
  /**
   * The window's title, as its title bar and the platform's window list show it.
   */
  public readonly title: string;

  /**
   * Whether the window is shown: false while it is hidden, such as in the tray, or once it is closed.
   */
  public readonly isVisible: boolean;

  /**
   * Whether the window's page has painted: false until it paints, and still false when the window was shown unpainted
   * after waiting too long for its page.
   */
  public readonly isPainted: boolean;

  /**
   * Creates the report.
   *
   * @param title The window's title.
   * @param isVisible Whether the window is shown.
   * @param isPainted Whether the window's page has painted.
   *
   * @example
   * ```ts
   * import { MainWindow } from "@noldova/desktop.protocol";
   *
   * export const main: MainWindow = new MainWindow("Notes", true, true);
   * ```
   */
  public constructor(title: string, isVisible: boolean, isPainted: boolean);

  /**
   * Reads the report from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The report.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { MainWindow } from "@noldova/desktop.protocol";
   *
   * export const main: MainWindow = MainWindow.fromJson({ title: "Notes", isVisible: true, isPainted: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): MainWindow;

  /**
   * Returns the wire form.
   *
   * @returns The `title`, `isVisible` and `isPainted` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { MainWindow } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new MainWindow("Notes", true, true).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One of the app's shortcuts, so a module that sends keys can refuse it.
 */
export declare class AppShortcut {
  /**
   * The key chord.
   */
  public readonly key: KeyChord;

  /**
   * The command the key runs, or null for a key of the macOS app or window menu, such as Quit, Hide or Minimize.
   */
  public readonly command: string | null;

  /**
   * Whether the key works while another app is in front, as the stop key does while agents act; the others work only
   * while the app's window is focused.
   */
  public readonly isGlobal: boolean;

  /**
   * Creates the shortcut.
   *
   * @param key The key chord.
   * @param command The command's name, or null; not blank.
   * @param isGlobal Whether the key works while another app is in front.
   * @throws ArgumentException synchronously when the command is blank.
   *
   * @example
   * ```ts
   * import { AppShortcut, KeyChord } from "@noldova/desktop.protocol";
   *
   * export const stop: AppShortcut = new AppShortcut(KeyChord.parse("Mod+Shift+Period"), "desktop.stopAgentControl", true);
   * ```
   */
  public constructor(key: KeyChord, command: string | null, isGlobal: boolean);

  /**
   * Reads the shortcut from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The shortcut.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { AppShortcut } from "@noldova/desktop.protocol";
   *
   * export const quit: AppShortcut = AppShortcut.fromJson({ key: "Mod+Q", command: null, isGlobal: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AppShortcut;

  /**
   * Returns the wire form.
   *
   * @returns The `key`, `command` and `isGlobal` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { AppShortcut, KeyChord } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new AppShortcut(KeyChord.parse("Mod+B"), "desktop.toggleLeftDock", false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The app's shortcuts: the payload of `desktop.appShortcutsChanged`.
 */
export declare class AppShortcutList {
  /**
   * The shortcuts.
   */
  public readonly shortcuts: readonly AppShortcut[];

  /**
   * Creates the list.
   *
   * @param shortcuts The shortcuts, copied.
   *
   * @example
   * ```ts
   * import { AppShortcut, AppShortcutList, KeyChord } from "@noldova/desktop.protocol";
   *
   * export const list: AppShortcutList = new AppShortcutList([new AppShortcut(KeyChord.parse("Mod+Q"), null, false)]);
   * ```
   */
  public constructor(shortcuts: readonly AppShortcut[]);

  /**
   * Reads the list from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { AppShortcutList } from "@noldova/desktop.protocol";
   *
   * export const list: AppShortcutList = AppShortcutList.fromJson({ shortcuts: [{ key: "Mod+Q", command: null, isGlobal: false }] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AppShortcutList;

  /**
   * Returns the wire form.
   *
   * @returns The `shortcuts` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { AppShortcutList } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new AppShortcutList([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.agentControlChanged` and the answer of
 * `desktop.agentControl`: whether the person or a runtime part stopped agent
 * control, and whether any agent session is open.
 */
export declare class AgentControlState {
  /**
   * Whether agent control is stopped: every call fails with `Stopped` until
   * the person resumes it.
   */
  public readonly isStopped: boolean;

  /**
   * Whether any agent session is open, from `openSession` until its `end`;
   * the main process takes the stop key system-wide while it is.
   */
  public readonly isActing: boolean;

  /**
   * Creates the payload.
   *
   * @param isStopped Whether agent control is stopped.
   * @param isActing Whether any agent session is open.
   *
   * @example
   * ```ts
   * import { AgentControlState } from "@noldova/desktop.protocol";
   *
   * export const stopped: AgentControlState = new AgentControlState(true, true);
   * ```
   */
  public constructor(isStopped: boolean, isActing: boolean);

  /**
   * Reads a payload from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The payload.
   * @throws JsonException synchronously when `isStopped` or `isActing` is
   * missing or not a boolean, or another field is present; its path names the
   * field.
   *
   * @example
   * ```ts
   * import { AgentControlState } from "@noldova/desktop.protocol";
   *
   * export const state: AgentControlState = AgentControlState.fromJson({ isStopped: false, isActing: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): AgentControlState;

  /**
   * Returns the wire form.
   *
   * @returns The `isStopped` and `isActing` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { AgentControlState } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new AgentControlState(false, false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Noldova Desktop's own default keys, which a module's web view never declares.
 */
export declare class ShellKeys {
  /**
   * The stop key's default, `Mod+Shift+Period`, for `desktop.stopAgentControl`.
   */
  public static readonly stopAgentControl: KeyChord;

  /**
   * Noldova Desktop's default keys on a platform, each with its command's name.
   *
   * @param platform The platform, as Node.js names it, such as `darwin`.
   * @returns Each key and its command, a command with more than one key once
   * for each.
   *
   * @example
   * ```ts
   * import { type KeyChord, ShellKeys } from "@noldova/desktop.protocol";
   *
   * export const keys: readonly (readonly [KeyChord, string])[] = ShellKeys.list("darwin");
   * ```
   */
  public static list(platform: string): readonly (readonly [KeyChord, string])[];

  /**
   * Noldova Desktop's default keys on a platform that a focused web view's page
   * keeps, each with its command's name: the page gets the key while it has
   * the focus, a pane may declare it, and the shell takes it everywhere else.
   *
   * @param platform The platform, as Node.js names it, such as `darwin`.
   * @returns Each key and its command, a command with more than one key once
   * for each.
   *
   * @example
   * ```ts
   * import { type KeyChord, ShellKeys } from "@noldova/desktop.protocol";
   *
   * export const keys: readonly (readonly [KeyChord, string])[] = ShellKeys.pageFirst("win32");
   * ```
   */
  public static pageFirst(platform: string): readonly (readonly [KeyChord, string])[];

  /**
   * Noldova Desktop's default keys on a platform that a pane may declare,
   * each with its command's name: F6 and Shift+F6 move the focus through the
   * window's regions, but a pane that declares one takes it while one of its
   * views has the focus.
   *
   * @param platform The platform, as Node.js names it, such as `darwin`.
   * @returns Each key and its command.
   *
   * @example
   * ```ts
   * import { type KeyChord, ShellKeys } from "@noldova/desktop.protocol";
   *
   * export const keys: readonly (readonly [KeyChord, string])[] = ShellKeys.declarable("linux");
   * ```
   */
  public static declarable(platform: string): readonly (readonly [KeyChord, string])[];

  /**
   * Whether a key is one of Noldova Desktop's default keys, or the stop key's
   * default, on a platform.
   *
   * @param key The key.
   * @param platform The platform, as Node.js names it, such as `win32`.
   * @returns True when the key means one of them there.
   *
   * @example
   * ```ts
   * import { KeyChord, ShellKeys } from "@noldova/desktop.protocol";
   *
   * export const isTaken: boolean = ShellKeys.has(KeyChord.parse("Mod+W"), "win32");
   * ```
   */
  public static has(key: KeyChord, platform: string): boolean;
}

/**
 * The names of the events the shell publishes.
 */
export declare class ShellEvents {
  /**
   * `desktop.notifications`: the runtime's notifications or a device's Do not disturb changed; its payload is a
   * `NotificationBroadcast`.
   */
  public static readonly notifications: QualifiedName;

  /**
   * `desktop.settingsChanged`: a setting's value was set or reset; its payload
   * is a `SettingChange` with the value now in effect for its key.
   */
  public static readonly settingsChanged: QualifiedName;

  /**
   * `desktop.work`: work began or ended in the runtime; its payload is a
   * `WorkReport` of all the work now in progress.
   */
  public static readonly work: QualifiedName;

  /**
   * `desktop.updating`: the runtime is preparing for an update. Every client
   * answers with `desktop.updateSaved`: a main process once its windows have saved,
   * the command line at once. It has no payload.
   */
  public static readonly updating: QualifiedName;

  /**
   * `desktop.updateEnded`: the update the runtime prepared for stopped before
   * the runtime did, so the runtime works as before. It has no payload.
   */
  public static readonly updateEnded: QualifiedName;

  /**
   * `desktop.quitting`: a client asked the runtime with `desktop.quit` to quit
   * its main processes. A main process quits as its Quit Noldova Desktop Sample does: its windows
   * save, and it asks the person when work is in progress. A main process that
   * stays open answers with `desktop.quitAnswered`; one that quits asks the
   * runtime to stop with `desktop.stop` and ends its connection. It has no
   * payload.
   */
  public static readonly quitting: QualifiedName;

  /**
   * `desktop.commandsChanged`: a runtime command was registered or withdrawn,
   * or its enabled or checked state changed; its payload is the whole
   * `CommandList`, with a sequence greater than any list before it.
   */
  public static readonly commandsChanged: QualifiedName;

  /**
   * `desktop.modulesChanged`: a module turned off or on while the runtime
   * runs, with the modules that depend on it; its payload is the whole
   * `ModuleStatusList`, as `desktop.modules` answers it.
   */
  public static readonly modulesChanged: QualifiedName;

  /**
   * `desktop.programsChanged`: a program a module runs started or exited, or
   * the process group an exited program left ended; its payload is the whole
   * `ProgramStatusList`, with a sequence greater than any list before it.
   */
  public static readonly programsChanged: QualifiedName;

  /**
   * `desktop.recentCommandsChanged`: a device ran a command from command search; its payload is that device's
   * `RecentCommands`.
   */
  public static readonly recentCommandsChanged: QualifiedName;

  /**
   * `desktop.webViewCommand`: a runtime part calls on its module's web views; the runtime sends it to one main process only,
   * and its payload is a `WebViewCommand`, which the main process answers with `desktop.webViewAnswered`.
   */
  public static readonly webViewCommand: QualifiedName;

  /**
   * `desktop.secretCommand`: the runtime asks the main process for this machine's device, or to encrypt or decrypt a secret
   * with this machine's store; the runtime sends it to one main process only, and its payload is a `SecretCommand`, which the
   * main process answers with `desktop.secretAnswered`.
   */
  public static readonly secretCommand: QualifiedName;

  /**
   * `desktop.agentControlChanged`: agent control stopped or resumed, or the first agent session opened or the last one ended;
   * its payload is an `AgentControlState`.
   */
  public static readonly agentControlChanged: QualifiedName;

  /**
   * `desktop.webViewBlockedPorts`: the loopback ports the runtime and its modules' tool endpoints listen on, which a web view may
   * never reach; the runtime sends it to one main process only, on each change while it is connected, and its payload is a
   * `WebViewBlockedPorts`, which the main process acknowledges with `desktop.webViewPortsBlocked` once it refuses them.
   */
  public static readonly webViewBlockedPorts: QualifiedName;
}

/**
 * The client names the shell's own clients give in their handshake.
 */
export declare class ShellClients {
  /**
   * `mainProcess`: the main process, which `desktop.quit` asks to quit.
   */
  public static readonly mainProcess: string;

  /**
   * `cli`: the command line.
   *
   * @example
   * ```ts
   * import { ShellClients } from "@noldova/desktop.protocol";
   *
   * export const isCommandLine: boolean = ShellClients.commandLine === "cli";
   * ```
   */
  public static readonly commandLine: string;
}

/**
 * The notification kinds the shell posts itself. They belong to no module,
 * so turning modules' notifications off never mutes them, and they run only
 * the shell's own commands.
 */
export declare class ShellNotifications {
  /**
   * `desktop.saveFailed`: a window part's save failed while Noldova Desktop Sample was
   * closing, so Noldova Desktop Sample stayed open; an error naming the module.
   */
  public static readonly saveFailed: QualifiedName;

  /**
   * `desktop.saveUnfinished`: a window part did not finish saving within its
   * time while Noldova Desktop Sample was closing, and Noldova Desktop Sample closed without it; a
   * warning naming the module.
   */
  public static readonly saveUnfinished: QualifiedName;

  /**
   * `desktop.updateReady`: a newer version of Noldova Desktop Sample is downloaded and ready
   * to install, keyed by the version; it opens Settings' About page and
   * offers to restart to install it.
   */
  public static readonly updateReady: QualifiedName;

  /**
   * `desktop.support`: Help's Open log folder or Copy details, keyed by the
   * command's name; a lasting warning when it did not happen, offering to try
   * again, and a passing success when the details were copied.
   */
  public static readonly support: QualifiedName;

  /**
   * Every kind above, in this order.
   *
   * @example
   * ```ts
   * import { ShellNotifications } from "@noldova/desktop.protocol";
   *
   * export const isShellKind: boolean = ShellNotifications.all.some(t => t.text === "desktop.saveFailed");
   * ```
   */
  public static readonly all: readonly QualifiedName[];
}

/**
 * The names of the shell's methods that every build understands. They never
 * change after protocol version 1.
 */
export declare class ShellMethods {
  /**
   * `desktop.stop`: asks the runtime to stop; its payload is a `StopRequest`.
   */
  public static readonly stop: QualifiedName;

  /**
   * `desktop.moveAside`: asks the runtime to move data that predates the
   * shell aside, after a `PreShellData` failure.
   */
  public static readonly moveAside: QualifiedName;

  /**
   * `desktop.modules`: asks the runtime for every module of its build, what
   * its declaration says and where it stands; it answers with a
   * `ModuleStatusList`. A client that never asks
   * is unaffected.
   */
  public static readonly modules: QualifiedName;

  /**
   * `desktop.work`: asks the runtime what work is in progress, without
   * stopping anything; it answers with a `WorkReport`.
   */
  public static readonly work: QualifiedName;

  /**
   * `desktop.programs`: asks the runtime for the programs its modules run; it
   * answers with a `ProgramStatusList`.
   */
  public static readonly programs: QualifiedName;

  /**
   * `desktop.update`: asks a runtime of the same build to prepare for an
   * update; its payload is an `UpdateRequest`. The runtime announces
   * `desktop.updating`, waits for every other client's `desktop.updateSaved` and
   * answers with an `UpdateReady`.
   */
  public static readonly update: QualifiedName;

  /**
   * `desktop.updateSaved`: a client's answer to `desktop.updating`; its payload
   * is an `UpdateSaved`.
   */
  public static readonly updateSaved: QualifiedName;

  /**
   * `desktop.quit`: asks the runtime to quit the main processes connected to it, as
   * their Quit Noldova Desktop Sample does. The runtime announces `desktop.quitting`, or
   * answers at once with `NoMainProcess` when no main process is connected. A main process
   * quits once the runtime accepts its `desktop.stop`; the call then answers
   * with a `QuitReport` once every asked main process's connection has ended or
   * the runtime begins to stop. A main process that stays open fails the call:
   * with `Cancelled` when the person kept Noldova Desktop Sample open, with `Conflict` when
   * a save failed. A main process whose connection ends, or a runtime that
   * stops, before any main process quit fails it with `Unavailable`. A call made
   * while another waits joins it. While the call waits, its client is not
   * counted as sharing the runtime when a main process asks it to stop. It takes
   * no payload.
   */
  public static readonly quit: QualifiedName;

  /**
   * `desktop.quitAnswered`: a main process's answer to `desktop.quitting` when it
   * stayed open; its payload is a `QuitAnswered`.
   */
  public static readonly quitAnswered: QualifiedName;

  /**
   * `desktop.commands`: asks the runtime for the commands its active modules'
   * runtime parts registered; it answers with a `CommandList`.
   */
  public static readonly commands: QualifiedName;

  /**
   * `desktop.runCommand`: runs a runtime command; its payload is a
   * `CommandRun` and its answer whatever the command returns. A command that
   * is not registered fails with `NotFound`.
   */
  public static readonly runCommand: QualifiedName;

  /**
   * `desktop.notifications`: asks the runtime for its notifications; its payload is a `NotificationsQuery` and its answer a
   * `NotificationState` for that device.
   */
  public static readonly notifications: QualifiedName;

  /**
   * `desktop.postNotification`: posts a notification for a window part; its payload is a `NotificationPost` whose kind its
   * module declares, and its answer the `NotificationReference` of the notification it created or replaced.
   */
  public static readonly postNotification: QualifiedName;

  /**
   * `desktop.dismissNotification`: removes a notification; its payload is a `NotificationReference`. One that is already gone
   * is ignored.
   */
  public static readonly dismissNotification: QualifiedName;

  /**
   * `desktop.markNotificationsRead`: marks every notification read, as opening the notifications list does; it takes no payload.
   */
  public static readonly markNotificationsRead: QualifiedName;

  /**
   * `desktop.clearNotifications`: removes every notification that reports no work in progress, as the list's Clear all does;
   * it takes no payload.
   */
  public static readonly clearNotifications: QualifiedName;

  /**
   * `desktop.readWindowBounds`: reads the bounds the main process kept for a
   * window; its payload is a `WindowStateKey` and its answer a
   * `WindowStateValue`.
   */
  public static readonly readWindowBounds: QualifiedName;

  /**
   * `desktop.writeWindowBounds`: keeps a window's bounds; its payload is a
   * `WindowStateWrite`.
   */
  public static readonly writeWindowBounds: QualifiedName;

  /**
   * `desktop.readWindowLayout`: reads the layout a window kept; its payload is
   * a `WindowStateKey` and its answer a `WindowStateValue`.
   */
  public static readonly readWindowLayout: QualifiedName;

  /**
   * `desktop.writeWindowLayout`: keeps a window's layout; its payload is a
   * `WindowStateWrite`.
   */
  public static readonly writeWindowLayout: QualifiedName;

  /**
   * `desktop.settings`: asks for every setting's definition and its value for
   * the application; its payload is a `SettingsQuery` and its answer a
   * `SettingsSnapshot`.
   */
  public static readonly settings: QualifiedName;

  /**
   * `desktop.readSetting`: asks for a setting's value in effect for a key,
   * resolved through the key's scope object, its enclosing scope objects,
   * the application and the default; its payload is a `SettingKey` and its
   * answer a `SettingEntry`. It fails as `desktop.setSetting` does.
   */
  public static readonly readSetting: QualifiedName;

  /**
   * `desktop.setSetting`: sets a setting's value; its payload is a
   * `SettingValue`. An unknown setting fails with `NotFound`; a value the
   * setting does not accept, a scope it does not list, or a device setting
   * without a device fails with `InvalidParams`.
   */
  public static readonly setSetting: QualifiedName;

  /**
   * `desktop.resetSetting`: returns a setting to the value of its enclosing
   * scopes or its default; its payload is a `SettingKey`. It fails as
   * `desktop.setSetting` does.
   */
  public static readonly resetSetting: QualifiedName;

  /**
   * `desktop.recentCommands`: asks for the commands a device ran recently from command search; its payload is a
   * `RecentCommandsQuery` and its answer that device's `RecentCommands`, without the device.
   */
  public static readonly recentCommands: QualifiedName;

  /**
   * `desktop.recordCommand`: records that a device ran a command from command search; its payload is a `RecentCommandUse`.
   * The runtime keeps each device's 20 newest and publishes `desktop.recentCommandsChanged`.
   */
  public static readonly recordCommand: QualifiedName;

  /**
   * `desktop.windowClosed`: the main process tells the runtime that one of its windows closed for good; its payload is a
   * `WindowClosed`. A reload, including one after a page crash, keeps the window and sends nothing. The runtime reports
   * the window's closure to every active part after the requests the window sent before it, refuses later requests
   * from it, and sends it no more events.
   */
  public static readonly windowClosed: QualifiedName;

  /**
   * `desktop.grantFile`: the main process grants a module's runtime part one file the person picked, dropped or
   * pasted in a window; its payload is a `FileGrant`. The runtime takes it only from the app's main process, and
   * refuses it once the window has as many live grants as it allows.
   */
  public static readonly grantFile: QualifiedName;

  /**
   * `desktop.discardFileGrants`: a window part ends grants it no longer needs; its payload is a `FileGrantsDiscard`.
   * The runtime ends only the grants of the request's window and page, and passes over any other.
   */
  public static readonly discardFileGrants: QualifiedName;

  /**
   * `desktop.endFileGrants`: the main process tells the runtime that a window's page ended, by a reload or a crash;
   * its payload is a `FileGrantsEnded`. The runtime ends every grant of that page.
   */
  public static readonly endFileGrants: QualifiedName;

  /**
   * `desktop.resolveFileShare`: the main process asks which file a runtime part shared with a window, for a request
   * on its own scheme; its payload is a `FileShareResolve` and its answer the share's `FileGrant`. The runtime takes
   * it only from the app's main process, answers only a live share of that connection, and answers `NotFound`
   * otherwise.
   */
  public static readonly resolveFileShare: QualifiedName;

  /**
   * `desktop.webViewAnswered`: the main process answers a `desktop.webViewCommand`; its payload is a `WebViewAnswered`.
   * The runtime takes an answer only from the main process it sent the command to.
   */
  public static readonly webViewAnswered: QualifiedName;

  /**
   * `desktop.webViewEvents`: the main process passes the runtime its web views' events, in order; its payload is a
   * `WebViewEvents`, and the runtime gives each event only to the module that owns its view.
   */
  public static readonly webViewEvents: QualifiedName;

  /**
   * `desktop.readWebViewBlockedPorts`: the main process reads the loopback ports its web views may never reach, each time it
   * connects, before it acknowledges them with `desktop.webViewPortsBlocked`; it takes no payload, and it answers a
   * `WebViewBlockedPorts` to the one main process the runtime sends its web view calls to, and `null` to any other client.
   */
  public static readonly readWebViewBlockedPorts: QualifiedName;

  /**
   * `desktop.webViewPortsBlocked`: the main process acknowledges a `WebViewBlockedPorts` it read or was sent once its web views refuse
   * those ports; its payload is the `WebViewBlockedPorts` it applied, and the runtime gives a tool endpoint's address to its
   * module only after the acknowledgement that covers its port.
   */
  public static readonly webViewPortsBlocked: QualifiedName;

  /**
   * `desktop.saveSecret`: saves or replaces a module's secret on this machine; its payload is a `SecretValue`, and it answers
   * `null`. The main process encrypts the value with this machine's store, and the runtime keeps only what it encrypted; it fails
   * with `Unavailable` and a reason a module can show when this machine has no store that protects the value, or the app's main
   * process isn't connected.
   */
  public static readonly saveSecret: QualifiedName;

  /**
   * `desktop.removeSecret`: removes a module's secret from this machine; its payload is a `SecretReference`, and it answers
   * `null`, whether or not the secret was set.
   */
  public static readonly removeSecret: QualifiedName;

  /**
   * `desktop.secretStatus`: says whether a module's secret is set on this machine; its payload is a `SecretReference`, and it
   * answers `true` or `false`, never the value.
   */
  public static readonly secretStatus: QualifiedName;

  /**
   * `desktop.secretAnswered`: the main process answers a `desktop.secretCommand`; its payload is a `SecretAnswered`.
   * The runtime takes an answer only from the main process it sent the command to.
   */
  public static readonly secretAnswered: QualifiedName;

  /**
   * `desktop.agentControl`: reads whether agent control is stopped and whether any agent session is open; it takes no
   * payload and answers with an `AgentControlState`.
   */
  public static readonly agentControl: QualifiedName;

  /**
   * `desktop.appWindowsChanged`: the main process gives the runtime the whole list of the app's own windows, as it connects
   * and whenever a window opens or closes; its payload is an `AppWindowList`. The runtime takes it only from the main
   * process, and empties the list when that main process's connection closes.
   */
  public static readonly appWindowsChanged: QualifiedName;

  /**
   * `desktop.appShortcutsChanged`: the main process gives the runtime the whole list of the app's shortcuts, as it
   * connects and whenever one changes; its payload is an `AppShortcutList`. The runtime takes it only from the main
   * process, and empties the list when that main process's connection closes.
   */
  public static readonly appShortcutsChanged: QualifiedName;

  /**
   * `desktop.mainWindowChanged`: the main process gives the runtime its main window's title and whether it is shown, as
   * it connects and whenever either changes; its payload is a `MainWindow`. The runtime takes it only from the main
   * process, and forgets it when that main process's connection closes.
   */
  public static readonly mainWindowChanged: QualifiedName;

  /**
   * `desktop.mainWindow`: reads the main window as the main process last reported it; it takes no payload and answers
   * with a `MainWindow`, or null before the main process reports one.
   */
  public static readonly mainWindow: QualifiedName;
}

/**
 * A key as a keyboard event reports it: what `KeyChord.matches` compares.
 * A DOM `KeyboardEvent` satisfies it.
 */
export interface IKeyStroke {
  /**
   * The key's value, such as `k`, `K`, `Enter` or `~`.
   */
  readonly key: string;

  /**
   * The physical key, such as `KeyK` or `Backquote`.
   */
  readonly code: string;

  /**
   * Whether Control is held.
   */
  readonly ctrlKey: boolean;

  /**
   * Whether Alt, or Option on macOS, is held.
   */
  readonly altKey: boolean;

  /**
   * Whether Shift is held.
   */
  readonly shiftKey: boolean;

  /**
   * Whether Cmd on macOS, or the Windows or Super key, is held.
   */
  readonly metaKey: boolean;
}

/**
 * One option of a choice setting: the value stored and the title people
 * see.
 */
export declare class SettingOption {
  /**
   * The value a setting holds when this option is chosen.
   */
  public readonly value: string;

  /**
   * The title people see.
   */
  public readonly title: string;

  /**
   * Creates the option.
   *
   * @param value The stored value; empty, such as for a "Provider default"
   * option, or not blank.
   * @param title The title people see; not blank, and it may name keys by
   * `{key:<chord>}` tokens, as `KeyText` reads them.
   * @throws ArgumentException synchronously when the value is only white
   * space or the title is blank.
   *
   * @example
   * ```ts
   * import { SettingOption } from "@noldova/desktop.protocol";
   *
   * export const option: SettingOption = new SettingOption("Dark", "Dark");
   * ```
   */
  public constructor(value: string, title: string);

  /**
   * Reads an option from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The option.
   * @throws JsonException synchronously when a field is missing or not a
   * string, the value is only white space, the title is blank, or another
   * field is present.
   *
   * @example
   * ```ts
   * import { SettingOption } from "@noldova/desktop.protocol";
   *
   * export const option: SettingOption = SettingOption.fromJson({ value: "Dark", title: "Dark" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingOption;

  /**
   * Returns the wire form.
   *
   * @returns The `value` and `title` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { SettingOption } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingOption("Dark", "Dark").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The type of a setting's value: its kind and the limits of that kind. It
 * decides which values a setting accepts.
 */
export declare class SettingType {
  /**
   * The kind of value.
   */
  public readonly kind: SettingKind;

  /**
   * A fixed choice's options; empty for a dynamic choice and the other kinds.
   */
  public readonly options: readonly SettingOption[];

  /**
   * Whether a choice is dynamic: its module's window part supplies its
   * options at run time, so it accepts any string; `false` for a fixed
   * choice and the other kinds.
   */
  public readonly isDynamic: boolean;

  /**
   * Whether a text is checked: its module's window part supplies a check,
   * through `IWindowPartContext.provideSettingCheck`, and Settings refuses
   * a value the check answers with a message; `false` for an unchecked
   * text and the other kinds.
   */
  public readonly isChecked: boolean;

  /**
   * A number's minimum; `null` for the other kinds.
   */
  public readonly minimum: number | null;

  /**
   * A number's maximum; `null` for the other kinds.
   */
  public readonly maximum: number | null;

  /**
   * A number's step from its minimum; `null` for the other kinds.
   */
  public readonly step: number | null;

  /**
   * A text's maximum length; `null` for the other kinds.
   */
  public readonly maxLength: number | null;

  /**
   * The command an action runs; `null` for the other kinds.
   */
  public readonly command: QualifiedName | null;

  /**
   * The label of an action's button; `null` for the other kinds.
   */
  public readonly label: string | null;

  private constructor();

  /**
   * Creates the type of a setting that is on or off.
   *
   * @returns The boolean type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.boolean();
   * ```
   */
  public static boolean(): SettingType;

  /**
   * Creates the type of a setting that holds one of its options' values.
   *
   * @param options The options; at least one, with distinct values.
   * @returns The choice type.
   * @throws ArgumentException synchronously when there is no option or two
   * share a value.
   *
   * @example
   * ```ts
   * import { SettingOption, SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.choice([new SettingOption("Light", "Light"), new SettingOption("Dark", "Dark")]);
   * ```
   */
  public static choice(options: readonly SettingOption[]): SettingType;

  /**
   * Creates the type of a dynamic choice, whose options its module's window
   * part supplies at run time. It accepts any string, since the runtime
   * never has the options to check against.
   *
   * @returns The dynamic choice type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.dynamicChoice();
   * ```
   */
  public static dynamicChoice(): SettingType;

  /**
   * Creates the type of a setting that holds a number from a minimum to a
   * maximum, in whole steps from the minimum.
   *
   * @param minimum The smallest value; finite.
   * @param maximum The largest value; finite and not below the minimum.
   * @param step The distance between values; finite and positive.
   * @returns The number type.
   * @throws ArgumentException synchronously when a limit is not finite, the
   * maximum is below the minimum or the step is not positive.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.number(12, 18, 1);
   * ```
   */
  public static number(minimum: number, maximum: number, step: number): SettingType;

  /**
   * Creates the type of a setting that holds a string up to a length.
   *
   * @param maxLength The longest string accepted; a positive integer.
   * @param isChecked Whether the module's window part checks a value
   * before Settings saves it; `false` by default.
   * @returns The text type.
   * @throws ArgumentException synchronously when the length is not a
   * positive integer.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.text(200);
   * ```
   */
  public static text(maxLength: number, isChecked?: boolean): SettingType;

  /**
   * Creates the type of a setting that holds a list of distinct module
   * ids.
   *
   * @returns The modules type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.modules();
   * ```
   */
  public static modules(): SettingType;

  /**
   * Creates the type of the setting that holds the person's key bindings.
   *
   * @returns The key bindings type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.keyBindings();
   * ```
   */
  public static keyBindings(): SettingType;

  /**
   * Creates the type of the setting that holds the spelling languages.
   *
   * @returns The languages type.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.languages();
   * ```
   */
  public static languages(): SettingType;

  /**
   * Creates the type of a setting whose row is a button that runs a
   * command.
   *
   * @param command The command the button runs, without arguments.
   * @param label The button's label; not blank.
   * @returns The action type.
   * @throws ArgumentException synchronously when the label is blank.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.action(QualifiedName.parse("notes.openTemplates"), "Open templates");
   * ```
   */
  public static action(command: QualifiedName, label: string): SettingType;

  /**
   * Reads a type from its wire form: `kind` and the fields of that kind; a
   * choice has either `options` or `dynamic: true`, and a text may have
   * `checked: true`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The type.
   * @throws JsonException synchronously when the kind is unknown, a field of
   * the kind is missing or invalid, a choice has both `options` and
   * `dynamic` or a `dynamic` other than `true`, a text has a `checked`
   * other than `true`, or a field of another kind is present.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const type: SettingType = SettingType.fromJson({ kind: "Number", minimum: 12, maximum: 18, step: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingType;

  /**
   * Tells whether a value fits the type: a boolean; one of the options'
   * values, or any string for a dynamic choice; a number within the limits on a step; a string within the
   * length; a list of distinct, non-blank strings; an object from
   * command names to `null` or a key `KeyChord.canBind` accepts for the
   * command; or, for an action, only `null`.
   *
   * @param value The value.
   * @returns Whether the type accepts it.
   *
   * @example
   * ```ts
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const accepted: boolean = SettingType.number(12, 18, 1).accepts(14);
   * ```
   */
  public accepts(value: JsonValue): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The `kind` field and the fields of that kind.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { SettingType } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = SettingType.text(200).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * One object of a setting scope, such as one conversation: the scope's name
 * and the object's id. A value set for it overrides the values of the
 * scopes that enclose it.
 */
export declare class SettingScope {
  /**
   * The scope's name, which the module that owns the objects declares.
   */
  public readonly name: QualifiedName;

  /**
   * The object's id, as its owner defines it.
   */
  public readonly id: string;

  /**
   * Creates the scope reference.
   *
   * @param name The scope's name.
   * @param id The object's id; not blank.
   * @throws ArgumentException synchronously when the id is blank.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   *
   * export const scope: SettingScope = new SettingScope(QualifiedName.parse("chat.conversation"), "c42");
   * ```
   */
  public constructor(name: QualifiedName, id: string);

  /**
   * Reads a scope reference from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The scope reference.
   * @throws JsonException synchronously when the name is not a qualified
   * name, the id is blank, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingScope } from "@noldova/desktop.protocol";
   *
   * export const scope: SettingScope = SettingScope.fromJson({ name: "chat.conversation", id: "c42" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingScope;

  /**
   * Tells whether another reference names the same object of the same
   * scope.
   *
   * @param other The other reference, or `null`.
   * @returns Whether both name the same scope and id.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   *
   * const name: QualifiedName = QualifiedName.parse("chat.conversation");
   * export const same: boolean = new SettingScope(name, "c42").equals(new SettingScope(name, "c42"));
   * ```
   */
  public equals(other: SettingScope | null): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The `name` and `id` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingScope(QualifiedName.parse("chat.conversation"), "c42").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A setting's definition: what it is, the values it accepts, its default,
 * where its value is kept, the scopes that may override it, and where
 * Settings shows it. A module declares its own in `settings.json`; the
 * shell declares its own the same way.
 */
export declare class SettingDefinition {
  /**
   * The setting's name, `<owner>.<name>`.
   */
  public readonly name: QualifiedName;

  /**
   * The title people see.
   */
  public readonly title: string;

  /**
   * What the setting does, in a sentence.
   */
  public readonly description: string;

  /**
   * The values it accepts.
   */
  public readonly type: SettingType;

  /**
   * The value in effect when none is set.
   */
  public readonly defaultValue: JsonValue;

  /**
   * Whether the value is kept per device or shared.
   */
  public readonly locality: SettingLocality;

  /**
   * The scopes whose objects may override the application's value; none
   * for a device setting.
   */
  public readonly scopes: readonly QualifiedName[];

  /**
   * The Settings page that shows it.
   */
  public readonly page: string;

  /**
   * The group on that page.
   */
  public readonly group: string;

  /**
   * Creates the definition.
   *
   * @param name The setting's name.
   * @param title The title; not blank, and it may name keys by
   * `{key:<chord>}` tokens, as `KeyText` reads them.
   * @param description The description; not blank, and it may name keys by
   * `{key:<chord>}` tokens.
   * @param type The values it accepts.
   * @param defaultValue The default; a value the type accepts.
   * @param locality Where the value is kept.
   * @param scopes The scopes that may override it; distinct, and none for a
   * device setting.
   * @param page The Settings page; not blank.
   * @param group The group on the page; not blank.
   * @throws ArgumentException synchronously when a text is blank, the type
   * does not accept the default, or the scopes repeat or are given for a
   * device setting.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/desktop.protocol";
   *
   * export const definition: SettingDefinition = new SettingDefinition(
   *   QualifiedName.parse("chat.sendWithEnter"), "Send with Enter", "Sends a message when Enter is pressed.",
   *   SettingType.boolean(), true, SettingLocality.Shared, [QualifiedName.parse("chat.conversation")], "Chat", "Composer");
   * ```
   */
  public constructor(
    name: QualifiedName,
    title: string,
    description: string,
    type: SettingType,
    defaultValue: JsonValue,
    locality: SettingLocality,
    scopes: readonly QualifiedName[],
    page: string,
    group: string);

  /**
   * Reads a definition from its wire form, the form `settings.json` uses.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The definition.
   * @throws JsonException synchronously when a field is missing or invalid
   * or another field is present.
   *
   * @example
   * ```ts
   * import { SettingDefinition } from "@noldova/desktop.protocol";
   *
   * export const definition: SettingDefinition = SettingDefinition.fromJson({
   *   name: "chat.sendWithEnter", title: "Send with Enter", description: "Sends a message when Enter is pressed.",
   *   type: { kind: "Boolean" }, default: true, locality: "Shared", scopes: [], page: "Chat", group: "Composer"
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingDefinition;

  /**
   * Tells whether objects of a scope may override the setting.
   *
   * @param scope The scope's name.
   * @returns Whether the setting lists the scope.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/desktop.protocol";
   *
   * const conversation: QualifiedName = QualifiedName.parse("chat.conversation");
   * export const scoped: boolean = new SettingDefinition(
   *   QualifiedName.parse("chat.sendWithEnter"), "Send with Enter", "Sends a message when Enter is pressed.",
   *   SettingType.boolean(), true, SettingLocality.Shared, [conversation], "Chat", "Composer").isScopedBy(conversation);
   * ```
   */
  public isScopedBy(scope: QualifiedName): boolean;

  /**
   * Returns the wire form.
   *
   * @returns The fields `fromJson` reads.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SettingDefinition, SettingLocality, SettingType } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingDefinition(
   *   QualifiedName.parse("chat.sendWithEnter"), "Send with Enter", "Sends a message when Enter is pressed.",
   *   SettingType.boolean(), true, SettingLocality.Shared, [], "Chat", "Composer").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Which value of a setting is meant: the setting, the scope object it is
 * set for or `null` for the application, and the device for a device
 * setting. The payload of `desktop.resetSetting`.
 */
export declare class SettingKey {
  /**
   * The setting's name.
   */
  public readonly name: QualifiedName;

  /**
   * The scope object, or `null` for the application.
   */
  public readonly scope: SettingScope | null;

  /**
   * The device, for a device setting; `null` otherwise.
   */
  public readonly device: string | null;

  /**
   * Creates the key.
   *
   * @param name The setting's name.
   * @param scope The scope object; `null` by default, the application.
   * @param device The device; `null` by default. Not blank when given.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingKey } from "@noldova/desktop.protocol";
   *
   * export const key: SettingKey = new SettingKey(QualifiedName.parse("desktop.doNotDisturb"), null, "1b4e28ba-2fa1-41d2-883f-0016d3cca427");
   * ```
   */
  public constructor(name: QualifiedName, scope?: SettingScope | null, device?: string | null);

  /**
   * Reads a key from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The key.
   * @throws JsonException synchronously when the name is missing or not a
   * qualified name, the scope or device is invalid, or another field is
   * present.
   *
   * @example
   * ```ts
   * import { SettingKey } from "@noldova/desktop.protocol";
   *
   * export const key: SettingKey = SettingKey.fromJson({ name: "chat.sendWithEnter", scope: { name: "chat.conversation", id: "c42" } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingKey;

  /**
   * Returns the wire form.
   *
   * @returns The `name` field, and the `scope` and `device` fields when
   * given.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SettingKey } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingKey(QualifiedName.parse("desktop.mode")).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A change to a setting's value for a key, the payload of
 * `desktop.settingsChanged`: the value now in effect and whether a value is
 * stored for the key, false after a reset.
 */
export declare class SettingChange {
  /**
   * Which value changed.
   */
  public readonly key: SettingKey;

  /**
   * The value now in effect for the key.
   */
  public readonly value: JsonValue;

  /**
   * Whether a value is stored for the key: true after a set, false after a
   * reset, when the value comes from an enclosing scope or the default.
   */
  public readonly isSet: boolean;

  /**
   * Creates the change.
   *
   * @param key Which value changed.
   * @param value The value now in effect for the key.
   * @param isSet Whether a value is stored for the key.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";
   *
   * export const change: SettingChange = new SettingChange(new SettingKey(QualifiedName.parse("desktop.mode")), "System", false);
   * ```
   */
  public constructor(key: SettingKey, value: JsonValue, isSet: boolean);

  /**
   * Reads a change from its wire form: the key's fields, `value` and `isSet`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The change.
   * @throws JsonException synchronously when `value` or `isSet` is missing
   * or invalid, the key is invalid, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingChange } from "@noldova/desktop.protocol";
   *
   * export const change: SettingChange = SettingChange.fromJson({ name: "desktop.mode", value: "Dark", isSet: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingChange;

  /**
   * Returns the wire form.
   *
   * @returns The key's fields, `value` and `isSet`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingChange(new SettingKey(QualifiedName.parse("desktop.mode")), "Dark", true).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A setting's value for a key: the payload of `desktop.setSetting`.
 */
export declare class SettingValue {
  /**
   * Which value.
   */
  public readonly key: SettingKey;

  /**
   * The value.
   */
  public readonly value: JsonValue;

  /**
   * Creates the value.
   *
   * @param key Which value.
   * @param value The value.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingKey, SettingValue } from "@noldova/desktop.protocol";
   *
   * export const value: SettingValue = new SettingValue(new SettingKey(QualifiedName.parse("desktop.mode")), "Dark");
   * ```
   */
  public constructor(key: SettingKey, value: JsonValue);

  /**
   * Reads a value from its wire form: the key's fields and `value`.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The value.
   * @throws JsonException synchronously when `value` is missing, the key is
   * invalid, or another field is present.
   *
   * @example
   * ```ts
   * import { SettingValue } from "@noldova/desktop.protocol";
   *
   * export const value: SettingValue = SettingValue.fromJson({ name: "desktop.mode", value: "Dark" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingValue;

  /**
   * Returns the wire form.
   *
   * @returns The key's fields and `value`.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SettingKey, SettingValue } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingValue(new SettingKey(QualifiedName.parse("desktop.mode")), "Dark").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A setting's value in effect for the application or for a key, and whether
 * a value is stored for it. The answer of `desktop.readSetting`.
 */
export declare class SettingEntry {
  /**
   * The setting's name.
   */
  public readonly name: QualifiedName;

  /**
   * The value in effect.
   */
  public readonly value: JsonValue;

  /**
   * Whether a value is stored for the application or the key; `false` when
   * the value comes from an enclosing scope or the default.
   */
  public readonly isSet: boolean;

  /**
   * Creates the entry.
   *
   * @param name The setting's name.
   * @param value The value in effect.
   * @param isSet Whether a value is set.
   *
   * @example
   * ```ts
   * import { QualifiedName, SettingEntry } from "@noldova/desktop.protocol";
   *
   * export const entry: SettingEntry = new SettingEntry(QualifiedName.parse("desktop.mode"), "System", false);
   * ```
   */
  public constructor(name: QualifiedName, value: JsonValue, isSet: boolean);

  /**
   * Reads an entry from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The entry.
   * @throws JsonException synchronously when a field is missing or invalid
   * or another field is present.
   *
   * @example
   * ```ts
   * import { SettingEntry } from "@noldova/desktop.protocol";
   *
   * export const entry: SettingEntry = SettingEntry.fromJson({ name: "desktop.mode", value: "Dark", isSet: true });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingEntry;

  /**
   * Returns the wire form.
   *
   * @returns The `name`, `value` and `isSet` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { QualifiedName, SettingEntry } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingEntry(QualifiedName.parse("desktop.mode"), "System", false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The answer of `desktop.settings`: every setting's definition and its entry
 * for the application.
 */
export declare class SettingsSnapshot {
  /**
   * The definitions.
   */
  public readonly definitions: readonly SettingDefinition[];

  /**
   * The entries, each for a defined setting.
   */
  public readonly entries: readonly SettingEntry[];

  /**
   * Creates the snapshot.
   *
   * @param definitions The definitions; distinct names.
   * @param entries The entries; distinct, each naming a definition.
   * @throws ArgumentException synchronously when a name repeats or an entry
   * names no definition.
   *
   * @example
   * ```ts
   * import { SettingsSnapshot } from "@noldova/desktop.protocol";
   *
   * export const snapshot: SettingsSnapshot = new SettingsSnapshot([], []);
   * ```
   */
  public constructor(definitions: readonly SettingDefinition[], entries: readonly SettingEntry[]);

  /**
   * Reads a snapshot from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The snapshot.
   * @throws JsonException synchronously when a list is missing, an item is
   * invalid, a name repeats or an entry names no definition, or another
   * field is present.
   *
   * @example
   * ```ts
   * import { SettingsSnapshot } from "@noldova/desktop.protocol";
   *
   * export const snapshot: SettingsSnapshot = SettingsSnapshot.fromJson({ definitions: [], entries: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingsSnapshot;

  /**
   * Returns the wire form.
   *
   * @returns The `definitions` and `entries` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { SettingsSnapshot } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingsSnapshot([], []).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of `desktop.settings`: the device whose device settings the
 * answer gives. The main process sets it for a window.
 */
export declare class SettingsQuery {
  /**
   * The device, or `null`, when device settings are at their defaults.
   */
  public readonly device: string | null;

  /**
   * Creates the query.
   *
   * @param device The device, or `null`; not blank when given.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { SettingsQuery } from "@noldova/desktop.protocol";
   *
   * export const query: SettingsQuery = new SettingsQuery("1b4e28ba-2fa1-41d2-883f-0016d3cca427");
   * ```
   */
  public constructor(device: string | null);

  /**
   * Reads a query from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The query.
   * @throws JsonException synchronously when the device is blank or another
   * field is present.
   *
   * @example
   * ```ts
   * import { SettingsQuery } from "@noldova/desktop.protocol";
   *
   * export const query: SettingsQuery = SettingsQuery.fromJson({ device: "1b4e28ba-2fa1-41d2-883f-0016d3cca427" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): SettingsQuery;

  /**
   * Returns the wire form.
   *
   * @returns The `device` field when given.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { SettingsQuery } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new SettingsQuery(null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * Formats a date by a pattern, the form the shell's `desktop.timeFormat` and
 * `desktop.dateTimeFormat` settings take, so every part shows dates the same
 * way. The tokens are `yyyy` `yy` `MMMM` `MMM` `MM` `M` `dd` `d` `EEEE` `EEE`
 * `HH` `H` `hh` `h` `mm` `ss` and `a`, in local time, with British English
 * month and weekday names and `AM` or `PM` for `a`; text in single quotes
 * shows as it is, and everything else stays.
 */
export declare class DatePattern {
  /**
   * Formats a date by a pattern.
   *
   * @param date The date, shown in local time.
   * @param pattern The pattern, such as `d MMM yyyy, HH:mm`.
   * @returns The formatted text.
   *
   * @example
   * ```ts
   * import { DatePattern } from "@noldova/desktop.protocol";
   *
   * export const shown: string = DatePattern.format(new Date(2026, 8, 10, 13, 5), "'at' h:mm a");
   * ```
   */
  public static format(date: Date, pattern: string): string;

  /**
   * Tells whether a pattern shows a 12-hour clock: it has an `hh`, `h` or
   * `a` token outside quotes.
   *
   * @param pattern The pattern.
   * @returns `true` for a 12-hour clock.
   *
   * @example
   * ```ts
   * import { DatePattern } from "@noldova/desktop.protocol";
   *
   * export const isTwelveHour: boolean = DatePattern.isTwelveHour("h:mm a");
   * ```
   */
  public static isTwelveHour(pattern: string): boolean;
}

/**
 * One key a chord ends with: a letter, a digit, a punctuation key, a named
 * key or a function key. Letters match the key's value, falling back to the
 * physical key when the layout's value is not a Latin letter; digits,
 * punctuation and Space match the physical key, since Shift and layouts
 * change their value; named and function keys match their value.
 */
export declare class KeyName {
  /**
   * The key's name in a chord's text, such as `K`, `1`, `Comma`, `Enter` or
   * `F2`.
   */
  public readonly token: string;

  /**
   * Whether the key is one of F1 to F24.
   */
  public readonly isFunctionKey: boolean;

  /**
   * The key's name in `aria-keyshortcuts`: its `KeyboardEvent.key` value, such
   * as `K`, `ArrowUp` or `,`, and `Space` for the space bar.
   */
  public readonly ariaKey: string;

  private constructor();

  /**
   * Finds a key by its name.
   *
   * @param token The name, as a chord's text writes it.
   * @returns The key, or `undefined` when the name is not one.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/desktop.protocol";
   *
   * export const comma: KeyName | undefined = KeyName.find("Comma");
   * ```
   */
  public static find(token: string): KeyName | undefined;

  /**
   * Finds the key a keyboard event reports, by the same rules as `matches`.
   *
   * @param stroke The key a keyboard event reports.
   * @returns The key, or `undefined` for a key no chord names, such as a
   * modifier pressed alone.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/desktop.protocol";
   *
   * export const pressed: KeyName | undefined = KeyName.fromStroke({ key: "<", code: "Comma", ctrlKey: false, altKey: false, shiftKey: true, metaKey: false });
   * ```
   */
  public static fromStroke(stroke: IKeyStroke): KeyName | undefined;

  /**
   * Tells whether a stroke is this key, whatever modifiers it has.
   *
   * @param stroke The key a keyboard event reports.
   * @returns `true` when the stroke is this key.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/desktop.protocol";
   *
   * export const isK: boolean = KeyName.find("K")?.matches({ key: "k", code: "KeyK", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }) === true;
   * ```
   */
  public matches(stroke: IKeyStroke): boolean;

  /**
   * Returns what menus show for the key.
   *
   * @param isMac Whether to follow macOS's convention, which shows symbols
   * such as `↩` for Enter.
   * @returns The label.
   *
   * @example
   * ```ts
   * import { KeyName } from "@noldova/desktop.protocol";
   *
   * export const label: string | undefined = KeyName.find("Escape")?.label(false);
   * ```
   */
  public label(isMac: boolean): string;
}

/**
 * A key with its modifiers, written as text such as `Mod+Shift+K`: any of
 * `Mod`, `Ctrl`, `Alt` and `Shift` joined by `+` to one key. `Mod` is Ctrl
 * on Windows and Linux and Cmd on macOS; `Ctrl` is Control everywhere. There
 * is no token for the Windows, Super or Meta key.
 */
export declare class KeyChord {
  /**
   * Whether the chord holds Mod: Ctrl on Windows and Linux, Cmd on macOS.
   */
  public readonly hasMod: boolean;

  /**
   * Whether the chord holds Control.
   */
  public readonly hasCtrl: boolean;

  /**
   * Whether the chord holds Alt, or Option on macOS.
   */
  public readonly hasAlt: boolean;

  /**
   * Whether the chord holds Shift.
   */
  public readonly hasShift: boolean;

  /**
   * The key the chord ends with.
   */
  public readonly key: KeyName;

  /**
   * The chord's text with its modifiers in the order Mod, Ctrl, Alt, Shift.
   */
  public readonly text: string;

  /**
   * Whether the chord could take typing: it has no Mod, Ctrl or Alt and is
   * not a function key, such as `K`, `Shift+K` or `Enter`.
   */
  public get isTypingKey(): boolean;

  private constructor();

  /**
   * Reads a chord from its text without throwing, for checks that only need
   * to know whether the text is a chord.
   *
   * @param text The chord, such as `Mod+Shift+K`.
   * @returns The chord, or `null` when `parse` would refuse the text.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const chord: KeyChord | null = KeyChord.find("Mod+Shift+K");
   * ```
   */
  public static find(text: string): KeyChord | null;

  /**
   * Reads a chord from its text, with its modifiers in any order.
   *
   * @param text The chord, such as `Mod+Shift+K`.
   * @param parameterName The parameter a failure names; `key` by default.
   * @returns The chord.
   * @throws ArgumentException synchronously when the text is not a chord: an
   * unknown or repeated modifier, an unknown key, or both Mod and Ctrl.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const chord: KeyChord = KeyChord.parse("Shift+Mod+K");
   * ```
   */
  public static parse(text: string, parameterName?: string): KeyChord;

  /**
   * Reads a chord a command may have as its default key. A default needs
   * Mod, Ctrl or Alt, or a function key, so that typing is never taken, and
   * must not be a key that editing or the operating system owns on any
   * platform: Mod+A, C, V, X, Z and Y and Mod+Shift+Z; on macOS Mod+Q, W,
   * H, M, Comma, Tab and Space and Mod+Alt+Escape; on Windows and Linux
   * Alt+F4, Alt+Tab and Mod+Escape.
   *
   * @param text The chord.
   * @param parameterName The parameter a failure names; `key` by default.
   * @returns The chord.
   * @throws ArgumentException synchronously when the text is not a chord,
   * has no modifier that guards typing, or is reserved; the message says
   * which.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const chord: KeyChord = KeyChord.parseDefault("Mod+Alt+N");
   * ```
   */
  public static parseDefault(text: string, parameterName?: string): KeyChord;

  /**
   * Reads the chord a keyboard event presses on a platform, as the person
   * records a key. On Windows and Linux Ctrl reads as Mod; on macOS Cmd reads
   * as Mod and Control as Ctrl.
   *
   * @param stroke The key a keyboard event reports.
   * @param platform The platform, as in `process.platform`.
   * @returns The chord, or `null` when no chord can name the stroke: a key
   * the chords do not name, such as a modifier pressed alone, the Windows,
   * Super or Meta key on Windows and Linux, or Control and Cmd together on
   * macOS.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const chord: KeyChord | null = KeyChord.fromStroke({ key: "k", code: "KeyK", ctrlKey: false, altKey: false, shiftKey: true, metaKey: true }, "darwin");
   * ```
   */
  public static fromStroke(stroke: IKeyStroke, platform: string): KeyChord | null;

  /**
   * Finds who owns the chord when editing or an operating system reserves it
   * on any platform.
   *
   * @param command The command the chord would be bound to, whose being a
   * shell command frees Mod+W and Mod+Comma; `null` for a module's default.
   * @returns `editing`, `macOS` or `Windows and Linux`, or `null` when the
   * chord is free.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const owner: string | null = KeyChord.parse("Ctrl+C").findReservedOwner(null);
   * ```
   */
  public findReservedOwner(command: QualifiedName | null): string | null;

  /**
   * Tells whether the person may bind the chord to a command. A binding
   * follows the rules of `parseDefault`, except that a shell command may also
   * take Mod+W and Mod+Comma, which the shell handles itself.
   *
   * @param command The command.
   * @returns `true` when the chord does not take typing and nothing reserves
   * it for the command.
   *
   * @example
   * ```ts
   * import { KeyChord, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const isAllowed: boolean = KeyChord.parse("Mod+Comma").canBind(QualifiedName.parse("notes.create"));
   * ```
   */
  public canBind(command: QualifiedName): boolean;

  /**
   * Tells whether a keyboard event is this chord on a platform. The
   * modifiers must match exactly.
   *
   * @param stroke The key a keyboard event reports.
   * @param platform The platform, as in `process.platform`; `darwin` reads
   * Mod as Cmd.
   * @returns `true` when the stroke is this chord.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const pressed: boolean = KeyChord.parse("Mod+K").matches({ key: "k", code: "KeyK", ctrlKey: false, altKey: false, shiftKey: false, metaKey: true }, "darwin");
   * ```
   */
  public matches(stroke: IKeyStroke, platform: string): boolean;

  /**
   * Tells whether two chords are the same keys on a platform: on Windows and
   * Linux Mod and Ctrl are the same key.
   *
   * @param other The other chord.
   * @param platform The platform, as in `process.platform`.
   * @returns `true` when both chords press the same keys there.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const same: boolean = KeyChord.parse("Mod+K").isSameOn(KeyChord.parse("Ctrl+K"), "win32");
   * ```
   */
  public isSameOn(other: KeyChord, platform: string): boolean;

  /**
   * Returns what menus show for the chord, by the platform's convention:
   * macOS symbols in the order ⌃⌥⇧⌘ followed by the key, such as `⌥⇧⌘K`;
   * elsewhere names joined by `+`, such as `Ctrl+Alt+Shift+K`.
   *
   * @param platform The platform, as in `process.platform`.
   * @returns The label.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const label: string = KeyChord.parse("Mod+Shift+K").label("darwin");
   * ```
   */
  public label(platform: string): string;

  /**
   * Returns the chord in the form of the `aria-keyshortcuts` attribute: the
   * modifiers' key names, `Control`, `Alt`, `Shift` and on macOS `Meta`, then
   * the key's `KeyboardEvent.key` value, joined by `+`, such as
   * `Shift+Meta+ArrowUp` on macOS and `Control+Shift+ArrowUp` elsewhere.
   *
   * @param platform The platform, as in `process.platform`.
   * @returns The attribute's value for the chord.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const keys: string = KeyChord.parse("Mod+Shift+ArrowUp").ariaKeyShortcuts("linux");
   * ```
   */
  public ariaKeyShortcuts(platform: string): string;

  /**
   * Returns the chord's text.
   *
   * @returns The text, as `text` holds it.
   *
   * @example
   * ```ts
   * import { KeyChord } from "@noldova/desktop.protocol";
   *
   * export const text: string = KeyChord.parse("Shift+Mod+K").toString();
   * ```
   */
  public toString(): string;
}

/**
 * Text that names keys by tokens, such as `Send with {key:Mod+Enter}`: each
 * `{key:<chord>}` holds a chord as `KeyChord` reads it, and shows as that
 * chord in words: on Windows and Linux as `KeyChord.label` gives it, such as
 * `Send with Ctrl+Enter`, and on macOS with `Control`, `Option`, `Shift` and
 * `Cmd` in that order joined by `+` to the key, such as `Send with
 * Cmd+Enter`. Text without a token, braces that don't form one, and a token
 * that names no key stay as they are.
 */
export declare class KeyText {
  /**
   * Returns a text with each key token replaced by its chord in words on a
   * platform.
   *
   * @param text The text.
   * @param platform The platform, as in `process.platform`.
   * @returns The text people see there.
   *
   * @example
   * ```ts
   * import { KeyText } from "@noldova/desktop.protocol";
   *
   * export const title: string = KeyText.format("Send with {key:Mod+Enter}", "darwin");
   * ```
   */
  public static format(text: string, platform: string): string;
}

/**
 * A command a runtime part registered, as `desktop.commands` reports it.
 */
export declare class CommandInfo {
  /**
   * The command's name, `<module id>.<name>`.
   */
  public readonly name: QualifiedName;

  /**
   * What menus and search show for the command.
   */
  public readonly title: string;

  /**
   * The command's icon, a Material Symbols name; `null` when it has none.
   */
  public readonly icon: string | null;

  /**
   * The key the command asks for, or `null`.
   */
  public readonly defaultKey: KeyChord | null;

  /**
   * Whether the command can run now, for any arguments.
   */
  public readonly isEnabled: boolean;

  /**
   * Whether the command is checked, for any arguments; `null` when it is
   * not a command that is checked or unchecked.
   */
  public readonly isChecked: boolean | null;

  /**
   * Creates the information.
   *
   * @param name The command's name.
   * @param title The title; not whitespace only.
   * @param icon The icon, not whitespace only, or `null`.
   * @param defaultKey The default key, or `null`.
   * @param isEnabled Whether the command can run now; `true` by default.
   * @param isChecked Whether it is checked, or `null`, the default, when it
   * is not checkable.
   * @throws ArgumentException synchronously when the title or the icon is
   * blank.
   *
   * @example
   * ```ts
   * import { CommandInfo, KeyChord, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const command: CommandInfo = new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", "timer", KeyChord.parseDefault("Mod+Alt+T"));
   * export const paused: CommandInfo = new CommandInfo(QualifiedName.parse("clock.pause"), "Pause", null, null, true, false);
   * ```
   */
  public constructor(name: QualifiedName, title: string, icon: string | null, defaultKey: KeyChord | null, isEnabled?: boolean, isChecked?: boolean | null);

  /**
   * Reads the information from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The information.
   * @throws JsonException synchronously when `name` or `title` is missing or
   * invalid, or `icon`, `defaultKey`, `isEnabled` or `isChecked` is invalid;
   * its path names the field.
   *
   * @example
   * ```ts
   * import { CommandInfo } from "@noldova/desktop.protocol";
   *
   * export const command: CommandInfo = CommandInfo.fromJson({ name: "clock.tick", title: "Tick", defaultKey: "Mod+Alt+T", isEnabled: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommandInfo;

  /**
   * Returns the wire form.
   *
   * @returns The `name` and `title` fields, `icon` and `defaultKey` when the
   * command has them, `isEnabled` only when it is `false`, and `isChecked`
   * when the command is checkable.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { CommandInfo, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new CommandInfo(QualifiedName.parse("clock.tick"), "Tick", null, null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime commands of the active modules, in registration order, with
 * their state: the answer to `desktop.commands` and the payload of
 * `desktop.commandsChanged`.
 */
export declare class CommandList {
  /**
   * The commands.
   */
  public readonly commands: readonly CommandInfo[];

  /**
   * The runtime's count of command changes when the list was taken; a list
   * with a greater sequence is newer.
   */
  public readonly sequence: number;

  /**
   * Creates the list.
   *
   * @param commands The commands, copied.
   * @param sequence The count of changes; a whole number from 0.
   * @throws ArgumentException synchronously when the sequence is not a whole
   * number from 0.
   *
   * @example
   * ```ts
   * import { CommandList } from "@noldova/desktop.protocol";
   *
   * export const list: CommandList = new CommandList([], 0);
   * ```
   */
  public constructor(commands: readonly CommandInfo[], sequence: number);

  /**
   * Reads the list from its wire form. Unknown fields are ignored.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `commands` or `sequence` is
   * missing or invalid, or an entry is invalid; its path names the field or
   * the entry.
   *
   * @example
   * ```ts
   * import { CommandList } from "@noldova/desktop.protocol";
   *
   * export const list: CommandList = CommandList.fromJson({ commands: [{ name: "clock.tick", title: "Tick" }], sequence: 1 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommandList;

  /**
   * Returns the wire form.
   *
   * @returns The `commands` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { CommandList } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new CommandList([], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A program the runtime runs for a module, as the window shows it. Its
 * arguments and environment are never part of it.
 */
export declare class ProgramStatus {
  /**
   * The module the program runs for.
   */
  public readonly moduleId: string;

  /**
   * The program's path.
   */
  public readonly program: string;

  /**
   * The program's process id, or on macOS and Linux, once the program has
   * exited, the id of the process group it led.
   */
  public readonly processId: number;

  /**
   * When the program started.
   */
  public readonly started: Date;

  /**
   * Whether the program has exited cleanly on macOS or Linux while the
   * process group it led still runs.
   */
  public readonly hasExited: boolean;

  /**
   * Creates the status.
   *
   * @param moduleId The module's id; not blank.
   * @param program The program's path; not blank.
   * @param processId The process id; a whole number from 1.
   * @param started When it started, copied; a valid date.
   * @param hasExited Whether only its process group still runs.
   * @throws ArgumentException synchronously when a value is invalid.
   *
   * @example
   * ```ts
   * import { ProgramStatus } from "@noldova/desktop.protocol";
   *
   * export const git: ProgramStatus = new ProgramStatus("git", "/usr/bin/git", 4_210, new Date("2026-10-06T08:00:00Z"), false);
   * ```
   */
  public constructor(moduleId: string, program: string, processId: number, started: Date, hasExited: boolean);

  /**
   * Reads the status from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The status.
   * @throws JsonException synchronously when a field is missing, invalid or
   * unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { ProgramStatus } from "@noldova/desktop.protocol";
   *
   * export const git: ProgramStatus = ProgramStatus.fromJson({ module: "git", program: "/usr/bin/git", processId: 4210, startedAt: "2026-10-06T08:00:00.000Z", hasExited: false });
   * ```
   */
  public static fromJson(value: unknown, path?: string): ProgramStatus;

  /**
   * Returns the wire form.
   *
   * @returns The `module`, `program`, `processId`, `startedAt` and
   * `hasExited` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { ProgramStatus } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new ProgramStatus("git", "/usr/bin/git", 4_210, new Date(), false).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The programs the runtime runs for its modules: the answer to
 * `desktop.programs` and the payload of `desktop.programsChanged`.
 */
export declare class ProgramStatusList {
  /**
   * The programs, in the order they started, those that have exited last.
   */
  public readonly programs: readonly ProgramStatus[];

  /**
   * The runtime's count of program changes when the list was taken; a list
   * with a greater sequence is newer.
   */
  public readonly sequence: number;

  /**
   * Creates the list.
   *
   * @param programs The programs, copied.
   * @param sequence The count of changes; a whole number from 0.
   * @throws ArgumentException synchronously when the sequence is not a whole
   * number from 0.
   *
   * @example
   * ```ts
   * import { ProgramStatusList } from "@noldova/desktop.protocol";
   *
   * export const list: ProgramStatusList = new ProgramStatusList([], 0);
   * ```
   */
  public constructor(programs: readonly ProgramStatus[], sequence: number);

  /**
   * Reads the list from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `programs` or `sequence` is
   * missing or invalid, a field is unknown, or an entry is invalid; its path
   * names the field or the entry.
   *
   * @example
   * ```ts
   * import { ProgramStatusList } from "@noldova/desktop.protocol";
   *
   * export const list: ProgramStatusList = ProgramStatusList.fromJson({ programs: [], sequence: 3 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): ProgramStatusList;

  /**
   * Returns the wire form.
   *
   * @returns The `programs` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { ProgramStatusList } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new ProgramStatusList([], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A request to run a runtime command: the payload of `desktop.runCommand`.
 */
export declare class CommandRun {
  /**
   * The command's name.
   */
  public readonly name: QualifiedName;

  /**
   * The command's arguments; `null` when it takes none.
   */
  public readonly commandArguments: JsonValue;

  /**
   * Creates the request.
   *
   * @param name The command's name.
   * @param commandArguments The arguments.
   *
   * @example
   * ```ts
   * import { CommandRun, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const run: CommandRun = new CommandRun(QualifiedName.parse("clock.tick"), null);
   * ```
   */
  public constructor(name: QualifiedName, commandArguments: JsonValue);

  /**
   * Reads the request from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when `name` or `arguments` is
   * missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { CommandRun } from "@noldova/desktop.protocol";
   *
   * export const run: CommandRun = CommandRun.fromJson({ name: "clock.tick", arguments: { by: 2 } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): CommandRun;

  /**
   * Returns the wire form.
   *
   * @returns The `name` and `arguments` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { CommandRun, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new CommandRun(QualifiedName.parse("clock.tick"), null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * An action a notification offers: a button that runs a command.
 */
export declare class NotificationAction {
  /**
   * The button's text.
   */
  public readonly title: string;

  /**
   * The command the button runs, with its arguments.
   */
  public readonly command: CommandRun;

  /**
   * Creates the action.
   *
   * @param title The button's text.
   * @param command The command and its arguments.
   * @throws ArgumentException synchronously when `title` is blank.
   *
   * @example
   * ```ts
   * import { CommandRun, NotificationAction, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const action: NotificationAction = new NotificationAction("Show", new CommandRun(QualifiedName.parse("clock.tick"), null));
   * ```
   */
  public constructor(title: string, command: CommandRun);

  /**
   * Reads the action from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The action.
   * @throws JsonException synchronously when `title` or `command` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationAction } from "@noldova/desktop.protocol";
   *
   * export const action: NotificationAction = NotificationAction.fromJson({ title: "Show", command: { name: "clock.tick", arguments: null } });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationAction;

  /**
   * Returns the wire form.
   *
   * @returns The `title` and `command` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { CommandRun, NotificationAction, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationAction("Show", new CommandRun(QualifiedName.parse("clock.tick"), null)).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * What a module posts as a notification: the payload of `desktop.postNotification`, and of an update.
 */
export declare class NotificationPost {
  /**
   * The most actions a notification offers: 2.
   */
  public static readonly maximumActions: number;

  /**
   * The progress of work whose share done is unknown.
   */
  public static readonly indeterminate: "indeterminate";

  /**
   * The notification's kind, one its module declares in `contributes.notifications`.
   */
  public readonly kind: QualifiedName;

  /**
   * The key that identifies it within its kind; posting the same kind and key again replaces it. `null` when it has none.
   */
  public readonly key: string | null;

  /**
   * The title.
   */
  public readonly title: string;

  /**
   * The text below the title; `null` when it has none.
   */
  public readonly text: string | null;

  /**
   * How serious it is.
   */
  public readonly severity: NotificationSeverity;

  /**
   * The command that opening the notification runs; `null` when opening it does nothing.
   */
  public readonly open: CommandRun | null;

  /**
   * Its actions, at most {@link NotificationPost.maximumActions}.
   */
  public readonly actions: readonly NotificationAction[];

  /**
   * The progress of the work it reports: a share from 0 to 1, {@link NotificationPost.indeterminate}, or `null` when it reports none.
   */
  public readonly progress: number | typeof NotificationPost.indeterminate | null;

  /**
   * Creates the post.
   *
   * @param kind The kind.
   * @param key The key within the kind, or `null`.
   * @param title The title.
   * @param text The text, or `null`.
   * @param severity The severity.
   * @param open The command opening it runs, or `null`.
   * @param actions The actions.
   * @param progress The progress, or `null`.
   * @throws ArgumentException synchronously when the key, the title or the text is blank, there are more than two actions, or the progress is a number outside 0 to 1.
   *
   * @example
   * ```ts
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const post: NotificationPost = new NotificationPost(
   *   QualifiedName.parse("clock.alarm"), null, "Alarm", "It is time.", NotificationSeverity.Info, null, [], null);
   * ```
   */
  public constructor(
    kind: QualifiedName,
    key: string | null,
    title: string,
    text: string | null,
    severity: NotificationSeverity,
    open: CommandRun | null,
    actions: readonly NotificationAction[],
    progress: number | typeof NotificationPost.indeterminate | null);

  /**
   * Reads the post from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The post.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationPost } from "@noldova/desktop.protocol";
   *
   * export const post: NotificationPost = NotificationPost.fromJson({ kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [], progress: 0.5 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationPost;

  /**
   * Returns the wire form.
   *
   * @returns The `kind`, `title`, `severity` and `actions` fields, and `key`, `text`, `open` and `progress` when set.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationPost(QualifiedName.parse("clock.alarm"), null, "Alarm", null, NotificationSeverity.Info, null, [], null).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A notification the runtime holds: what its module posted, with its id, time and whether it was read.
 */
export declare class Notification {
  /**
   * The id the runtime gave it: an opaque string that no other notification has, in this run of the runtime or any other.
   */
  public readonly id: string;

  /**
   * Its place in the order the runtime received posts, from 1: each post and re-post takes the next number, and an update
   * keeps it.
   */
  public readonly sequence: number;

  /**
   * What its module posted, as last updated.
   */
  public readonly post: NotificationPost;

  /**
   * When it was first posted, as an ISO 8601 date and time.
   */
  public readonly postedAt: string;

  /**
   * Whether the person has seen it in the notifications list.
   */
  public readonly isRead: boolean;

  /**
   * Creates the notification.
   *
   * @param id The id.
   * @param sequence Its place in the order of posts.
   * @param post What was posted.
   * @param postedAt When it was posted.
   * @param isRead Whether it was read.
   * @throws ArgumentException synchronously when the id is blank, the sequence is not a whole number from 1 or the time is not a date
   * and time.
   *
   * @example
   * ```ts
   * import { Notification, NotificationPost } from "@noldova/desktop.protocol";
   *
   * export function hold(id: string, post: NotificationPost): Notification {
   *   return new Notification(id, 1, post, new Date().toISOString(), false);
   * }
   * ```
   */
  public constructor(id: string, sequence: number, post: NotificationPost, postedAt: string, isRead: boolean);

  /**
   * Reads the notification from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The notification.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { Notification } from "@noldova/desktop.protocol";
   *
   * export const notification: Notification = Notification.fromJson({
   *   id: "5f0c3a1e-2b7d-4c9e-8a61-0d4f2e7b9c13", sequence: 1, post: { kind: "clock.alarm", title: "Alarm", severity: "Info", actions: [] }, postedAt: "2026-10-03T08:00:00.000Z", isRead: false
   * });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Notification;

  /**
   * Returns the wire form.
   *
   * @returns The `id`, `sequence`, `post`, `postedAt` and `isRead` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import type { Notification } from "@noldova/desktop.protocol";
   *
   * export function write(notification: Notification): JsonObject {
   *   return notification.toJson();
   * }
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The runtime's notifications, newest first, as the runtime holds them; `NotificationState` and `NotificationBroadcast` carry
 * them on the wire.
 */
export declare class NotificationList {
  /**
   * The notifications, newest first.
   */
  public readonly notifications: readonly Notification[];

  /**
   * Creates the list.
   *
   * @param notifications The notifications, newest first.
   *
   * @example
   * ```ts
   * import { NotificationList } from "@noldova/desktop.protocol";
   *
   * export const list: NotificationList = new NotificationList([]);
   * ```
   */
  public constructor(notifications: readonly Notification[]);

  /**
   * Reads the list from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `notifications` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationList } from "@noldova/desktop.protocol";
   *
   * export const list: NotificationList = NotificationList.fromJson({ notifications: [] });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationList;

  /**
   * Returns the wire form.
   *
   * @returns The `notifications` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { NotificationList } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationList([]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A notification named by its id: the answer of `desktop.postNotification` and the payload of `desktop.dismissNotification`.
 */
export declare class NotificationReference {
  /**
   * The notification's id.
   */
  public readonly id: string;

  /**
   * Creates the reference.
   *
   * @param id The notification's id.
   * @throws ArgumentException synchronously when the id is blank.
   *
   * @example
   * ```ts
   * import { NotificationReference } from "@noldova/desktop.protocol";
   *
   * export const reference: NotificationReference = new NotificationReference("5f0c3a1e-2b7d-4c9e-8a61-0d4f2e7b9c13");
   * ```
   */
  public constructor(id: string);

  /**
   * Reads the reference from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The reference.
   * @throws JsonException synchronously when `id` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationReference } from "@noldova/desktop.protocol";
   *
   * export const reference: NotificationReference = NotificationReference.fromJson({ id: "5f0c3a1e-2b7d-4c9e-8a61-0d4f2e7b9c13" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationReference;

  /**
   * Returns the wire form.
   *
   * @returns The `id` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { NotificationReference } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationReference("5f0c3a1e-2b7d-4c9e-8a61-0d4f2e7b9c13").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A device's question for the runtime's notifications: the payload of `desktop.notifications`, which the main process sends for its
 * window, adding its own device.
 */
export declare class NotificationsQuery {
  /**
   * The device whose Do not disturb the answer reports.
   */
  public readonly device: string;

  /**
   * Creates the query.
   *
   * @param device The device's id.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { NotificationsQuery } from "@noldova/desktop.protocol";
   *
   * export const query: NotificationsQuery = new NotificationsQuery("laptop");
   * ```
   */
  public constructor(device: string);

  /**
   * Reads the query from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The query.
   * @throws JsonException synchronously when `device` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationsQuery } from "@noldova/desktop.protocol";
   *
   * export const query: NotificationsQuery = NotificationsQuery.fromJson({ device: "laptop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationsQuery;

  /**
   * Returns the wire form.
   *
   * @returns The `device` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { NotificationsQuery } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationsQuery("laptop").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The notifications as one device sees them: the answer of `desktop.notifications`, and what the main process forwards to its window
 * for each `desktop.notifications` event.
 */
export declare class NotificationState {
  /**
   * The notifications, newest first.
   */
  public readonly notifications: readonly Notification[];

  /**
   * Whether Do not disturb is on for the device.
   */
  public readonly isDoNotDisturb: boolean;

  /**
   * The modules whose notifications are muted: they stay in the list but show no toast or operating system notification
   * and count as read.
   */
  public readonly mutedModules: readonly string[];

  /**
   * The sequence of the runtime's latest post, or 0 before any; a later notification has a higher sequence.
   */
  public readonly sequence: number;

  /**
   * Creates the state.
   *
   * @param notifications The notifications, newest first.
   * @param isDoNotDisturb Whether Do not disturb is on for the device.
   * @param mutedModules The modules whose notifications are muted.
   * @param sequence The sequence of the latest post.
   * @throws ArgumentException synchronously when a muted module is blank or the sequence is not a whole number from 0.
   *
   * @example
   * ```ts
   * import { NotificationState } from "@noldova/desktop.protocol";
   *
   * export const state: NotificationState = new NotificationState([], false, ["clock"], 0);
   * ```
   */
  public constructor(notifications: readonly Notification[], isDoNotDisturb: boolean, mutedModules: readonly string[], sequence: number);

  /**
   * Reads the state from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The state.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationState } from "@noldova/desktop.protocol";
   *
   * export const state: NotificationState = NotificationState.fromJson({ notifications: [], isDoNotDisturb: true, mutedModules: [], sequence: 4 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationState;

  /**
   * Returns the wire form.
   *
   * @returns The `notifications`, `isDoNotDisturb`, `mutedModules` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { NotificationState } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationState([], false, [], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The payload of the `desktop.notifications` event: the notifications and the devices with Do not disturb on. The main process
 * forwards it to its window as the state for its own device.
 */
export declare class NotificationBroadcast {
  /**
   * The notifications, newest first.
   */
  public readonly notifications: readonly Notification[];

  /**
   * The devices with Do not disturb on.
   */
  public readonly quietDevices: readonly string[];

  /**
   * The modules whose notifications are muted.
   */
  public readonly mutedModules: readonly string[];

  /**
   * The sequence of the runtime's latest post, or 0 before any.
   */
  public readonly sequence: number;

  /**
   * Creates the broadcast.
   *
   * @param notifications The notifications, newest first.
   * @param quietDevices The devices with Do not disturb on.
   * @param mutedModules The modules whose notifications are muted.
   * @param sequence The sequence of the latest post.
   * @throws ArgumentException synchronously when a device or a muted module is blank or the sequence is not a whole number
   * from 0.
   *
   * @example
   * ```ts
   * import { NotificationBroadcast } from "@noldova/desktop.protocol";
   *
   * export const broadcast: NotificationBroadcast = new NotificationBroadcast([], ["laptop"], ["clock"], 0);
   * ```
   */
  public constructor(notifications: readonly Notification[], quietDevices: readonly string[], mutedModules: readonly string[], sequence: number);

  /**
   * Reads the broadcast from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The broadcast.
   * @throws JsonException synchronously when a field is missing, invalid or unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { NotificationBroadcast } from "@noldova/desktop.protocol";
   *
   * export const broadcast: NotificationBroadcast = NotificationBroadcast.fromJson({ notifications: [], quietDevices: [], mutedModules: [], sequence: 0 });
   * ```
   */
  public static fromJson(value: unknown, path?: string): NotificationBroadcast;

  /**
   * Returns the state one device sees.
   *
   * @param device The device's id.
   * @returns The notifications, the muted modules and the sequence, with Do not disturb on when the device is among the
   * quiet ones.
   *
   * @example
   * ```ts
   * import { NotificationBroadcast, type NotificationState } from "@noldova/desktop.protocol";
   *
   * export const state: NotificationState = new NotificationBroadcast([], ["laptop"], [], 0).stateFor("laptop");
   * ```
   */
  public stateFor(device: string): NotificationState;

  /**
   * Returns the wire form.
   *
   * @returns The `notifications`, `quietDevices`, `mutedModules` and `sequence` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { NotificationBroadcast } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new NotificationBroadcast([], [], [], 0).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A device's question for the commands it ran recently: the payload of `desktop.recentCommands`, which the main process sends for
 * its window, adding its own device.
 */
export declare class RecentCommandsQuery {
  /**
   * The device whose recent commands the answer lists.
   */
  public readonly device: string;

  /**
   * Creates the query.
   *
   * @param device The device's id.
   * @throws ArgumentException synchronously when the device is blank.
   *
   * @example
   * ```ts
   * import { RecentCommandsQuery } from "@noldova/desktop.protocol";
   *
   * export const query: RecentCommandsQuery = new RecentCommandsQuery("laptop");
   * ```
   */
  public constructor(device: string);

  /**
   * Reads the query from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The query.
   * @throws JsonException synchronously when `device` is missing or invalid, or a field is unknown; its path names the field.
   *
   * @example
   * ```ts
   * import { RecentCommandsQuery } from "@noldova/desktop.protocol";
   *
   * export const query: RecentCommandsQuery = RecentCommandsQuery.fromJson({ device: "laptop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RecentCommandsQuery;

  /**
   * Returns the wire form.
   *
   * @returns The `device` field.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { RecentCommandsQuery } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new RecentCommandsQuery("laptop").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A command a device ran from command search: the payload of `desktop.recordCommand`, which the main process sends for its window,
 * adding its own device.
 */
export declare class RecentCommandUse {
  /**
   * The device that ran the command.
   */
  public readonly device: string;

  /**
   * The command's id, as command search names it.
   */
  public readonly id: string;

  /**
   * Creates the use.
   *
   * @param device The device's id.
   * @param id The command's id.
   * @throws ArgumentException synchronously when the device or the id is blank.
   *
   * @example
   * ```ts
   * import { RecentCommandUse } from "@noldova/desktop.protocol";
   *
   * export const use: RecentCommandUse = new RecentCommandUse("laptop", "desktop.openSettings");
   * ```
   */
  public constructor(device: string, id: string);

  /**
   * Reads the use from its wire form, which accepts no unknown fields.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The use.
   * @throws JsonException synchronously when `device` or `id` is missing or invalid, or a field is unknown; its path names
   * the field.
   *
   * @example
   * ```ts
   * import { RecentCommandUse } from "@noldova/desktop.protocol";
   *
   * export const use: RecentCommandUse = RecentCommandUse.fromJson({ device: "laptop", id: "desktop.openSettings" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RecentCommandUse;

  /**
   * Returns the wire form.
   *
   * @returns The `device` and `id` fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { RecentCommandUse } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new RecentCommandUse("laptop", "desktop.openSettings").toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * The commands a device ran recently from command search, newest first: the answer of `desktop.recentCommands` and the
 * payload of the `desktop.recentCommandsChanged` event. The event names the device; the main process forwards it only to that
 * device's windows, without the device.
 */
export declare class RecentCommands {
  /**
   * The commands' ids, newest first, each once.
   */
  public readonly ids: readonly string[];

  /**
   * The device that ran the commands, or `null` when the list is already that device's.
   */
  public readonly device: string | null;

  /**
   * Creates the list.
   *
   * @param ids The commands' ids, newest first.
   * @param device The device's id, or `null`; `null` by default.
   * @throws ArgumentException synchronously when an id or the device is blank, or an id is listed twice.
   *
   * @example
   * ```ts
   * import { RecentCommands } from "@noldova/desktop.protocol";
   *
   * export const recent: RecentCommands = new RecentCommands(["desktop.openSettings", "clock.show"], "laptop");
   * ```
   */
  public constructor(ids: readonly string[], device?: string | null);

  /**
   * Reads the list from its wire form, which accepts no unknown fields; `device` may be left out.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The list.
   * @throws JsonException synchronously when `ids` is missing, a field is invalid or unknown, or an id is listed twice; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { RecentCommands } from "@noldova/desktop.protocol";
   *
   * export const recent: RecentCommands = RecentCommands.fromJson({ ids: ["clock.show"], device: "laptop" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): RecentCommands;

  /**
   * Returns the wire form.
   *
   * @returns The `ids` field, and `device` when there is one.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { RecentCommands } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new RecentCommands(["clock.show"]).toJson();
   * ```
   */
  public toJson(): JsonObject;
}

/**
 * A message of the local protocol. Its wire form is a JSON object whose
 * `kind` field names the message kind. Fields a message does not know are
 * ignored when it is read, except in a handshake, which carries the
 * capability token and accepts no unknown fields.
 */
export declare abstract class WireMessage {
  /**
   * The message's kind.
   */
  public abstract readonly kind: WireMessageKind;

  /**
   * Returns the wire form.
   *
   * @returns The `kind` field followed by the message's own fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { Cancel } from "@noldova/desktop.protocol";
   *
   * export const json: JsonObject = new Cancel("r1").toJson();
   * ```
   */
  public toJson(): JsonObject;

  /**
   * Returns the wire form as JSON text, without line breaks.
   *
   * @returns The JSON text.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/desktop.protocol";
   *
   * export const text: string = new Cancel("r1").toText();
   * ```
   */
  public toText(): string;

  /**
   * Returns the message's own fields, without `kind`.
   *
   * @returns The fields.
   *
   * @example
   * ```ts
   * import type { JsonObject } from "@noldova/context.json";
   * import { WireMessage, WireMessageKind } from "@noldova/desktop.protocol";
   *
   * export class Notice extends WireMessage {
   *   public readonly kind: WireMessageKind = WireMessageKind.Event;
   *
   *   protected toJsonFields(): JsonObject {
   *     return { name: "desktop.notice", payload: null };
   *   }
   * }
   * ```
   */
  protected abstract toJsonFields(): JsonObject;
}

/**
 * The first message a client sends on a connection. The runtime answers it
 * with a response carrying the same id: its own identity on success, or a
 * failure such as `UnsupportedVersion`, `BuildMismatch` or `Unauthorized`.
 */
export declare class Handshake extends WireMessage {
  /**
   * Always `Handshake`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id the response carries.
   */
  public readonly id: string;

  /**
   * The client's build identity.
   */
  public readonly identity: BuildIdentity;

  /**
   * The runtime's capability token, read from its discovery metadata.
   */
  public readonly token: string;

  /**
   * The kind of client, such as `mainProcess` or `cli`.
   */
  public readonly client: string;

  /**
   * Creates the handshake.
   *
   * @param id The id the response carries; not whitespace only, and at most
   * 256 characters.
   * @param identity The client's build identity.
   * @param token The capability token; not whitespace only.
   * @param client The kind of client; not whitespace only.
   * @throws ArgumentException synchronously when the id, token or client is
   * empty or whitespace only.
   * @throws ArgumentOutOfRangeException synchronously when the id is longer
   * than 256 characters.
   *
   * @example
   * ```ts
   * import { BuildIdentity, Handshake } from "@noldova/desktop.protocol";
   *
   * export function greet(identity: BuildIdentity, token: string): Handshake {
   *   return new Handshake("h1", identity, token, "cli");
   * }
   * ```
   */
  public constructor(id: string, identity: BuildIdentity, token: string, client: string);

  /**
   * Reads a handshake from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The handshake.
   * @throws JsonException synchronously when a field is unknown, missing, has
   * the wrong type or breaks the constructor's rules, in the handshake or its
   * identity; its path names the field.
   *
   * @example
   * ```ts
   * import { Handshake } from "@noldova/desktop.protocol";
   *
   * export function readHandshake(value: unknown): Handshake {
   *   return Handshake.fromJson(value);
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): Handshake;

  /**
   * Returns the handshake's own fields.
   *
   * @returns The `id`, `identity`, `token` and `client` fields.
   *
   * @example
   * ```ts
   * import { BuildIdentity, Handshake } from "@noldova/desktop.protocol";
   *
   * export const text: string = new Handshake("h1", new BuildIdentity("0.0.1", 1, "9f2c41"), "token", "mainProcess").toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * A call of a method. The runtime answers it with exactly one response with
 * the same id, unless the connection closes first.
 */
export declare class Request extends WireMessage {
  /**
   * Always `Request`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id that correlates the response; unique among the connection's
   * unanswered requests.
   */
  public readonly id: string;

  /**
   * The method's name.
   */
  public readonly method: QualifiedName;

  /**
   * The method's arguments, as the method's owner defines them.
   */
  public readonly payload: JsonValue;

  /**
   * How long the runtime may take before it answers with
   * `DeadlineExceeded`, in milliseconds; absent when the request has no
   * time limit.
   */
  public readonly timeoutMilliseconds: number | undefined;

  /**
   * The window the main process sent the request for, by the id a reload
   * keeps; absent when no window sent it, such as for the command line.
   */
  public readonly window: number | undefined;

  /**
   * The page the window had loaded when it sent the request, by the number
   * its main process gives each page the window loads, which a reload
   * changes; absent when no window sent the request.
   */
  public readonly page: number | undefined;

  /**
   * Creates the request.
   *
   * @param id The correlation id; not whitespace only, and at most 256
   * characters.
   * @param method The method's name.
   * @param payload The method's arguments.
   * @param timeoutMilliseconds The time limit in milliseconds, a positive
   * integer; omit it for no time limit.
   * @param window The window the request is sent for, a positive integer;
   * omit it when no window sends it.
   * @param page The page of that window that sent it, a positive integer;
   * omit it when no window sends it.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   * @throws ArgumentOutOfRangeException synchronously when the id is longer
   * than 256 characters, the time limit, the window or the page is not a
   * positive integer, or a page is given without a window.
   *
   * @example
   * ```ts
   * import { QualifiedName, Request } from "@noldova/desktop.protocol";
   *
   * export const capture: Request = new Request("r7", QualifiedName.parse("notes.capture"), { folder: "f1" }, 30_000);
   * ```
   */
  public constructor(id: string, method: QualifiedName, payload: JsonValue, timeoutMilliseconds?: number, window?: number, page?: number);

  /**
   * Reads a request from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The request.
   * @throws JsonException synchronously when a field is missing, has the
   * wrong type or breaks the constructor's or the name's rules; its path
   * names the field.
   *
   * @example
   * ```ts
   * import { Request } from "@noldova/desktop.protocol";
   *
   * export const request: Request = Request.fromJson({ id: "r7", method: "notes.capture", payload: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Request;

  /**
   * Returns the request's own fields.
   *
   * @returns The `id`, `method` and `payload` fields, `timeoutMilliseconds`
   * when the request has a time limit, and `window` when a window sent it.
   *
   * @example
   * ```ts
   * import { QualifiedName, Request } from "@noldova/desktop.protocol";
   *
   * export const text: string = new Request("r7", QualifiedName.parse("desktop.ping"), null).toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * The answer to a handshake or a request: a payload on success or a failure.
 */
export declare class Response extends WireMessage {
  /**
   * Always `Response`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id of the handshake or request it answers, or `null` when the
   * failed message could not be read far enough to find its id.
   */
  public readonly id: string | null;

  /**
   * The result on success, which may be `null`; absent on failure.
   */
  public readonly payload: JsonValue | undefined;

  /**
   * Why the call failed; absent on success.
   */
  public readonly failure: Failure | undefined;

  /**
   * True when the response carries a failure.
   */
  public get hasFailed(): boolean;

  private constructor();

  /**
   * Creates a successful response.
   *
   * @param id The id of the message it answers; not whitespace only.
   * @param payload The result.
   * @returns The response.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Response } from "@noldova/desktop.protocol";
   *
   * export const response: Response = Response.success("r7", { captured: true });
   * ```
   */
  public static success(id: string, payload: JsonValue): Response;

  /**
   * Creates a failed response.
   *
   * @param id The id of the message it answers, not whitespace only, or
   * `null` when it is unknown.
   * @param failure Why the call failed.
   * @returns The response.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Failure, FailureCode, Response } from "@noldova/desktop.protocol";
   *
   * export const response: Response = Response.failure("r7", new Failure(FailureCode.UnknownMethod, "No part registered notes.capture."));
   * ```
   */
  public static failure(id: string | null, failure: Failure): Response;

  /**
   * Reads a response from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The response.
   * @throws JsonException synchronously when it carries neither or both of
   * `payload` and `failure`, or when a field is missing, has the wrong type
   * or breaks the rules; its path names the field.
   *
   * @example
   * ```ts
   * import { Response } from "@noldova/desktop.protocol";
   *
   * export function isSuccessful(value: unknown): boolean {
   *   return !Response.fromJson(value).hasFailed;
   * }
   * ```
   */
  public static fromJson(value: unknown, path?: string): Response;

  /**
   * Returns the response's own fields.
   *
   * @returns The `id` field and either `payload` or `failure`.
   *
   * @example
   * ```ts
   * import { Response } from "@noldova/desktop.protocol";
   *
   * export const text: string = Response.success("r7", null).toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * A notification to connected clients. Clients reconcile events with the
 * state they load, because a reconnecting client can miss some.
 */
export declare class Event extends WireMessage {
  /**
   * Always `Event`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The event's name.
   */
  public readonly name: QualifiedName;

  /**
   * The event's data, as the event's owner defines it.
   */
  public readonly payload: JsonValue;

  /**
   * The one window of the receiving main process the event is for; absent
   * when the event is for every window of every connection it reaches.
   */
  public readonly window: number | undefined;

  /**
   * Creates the event.
   *
   * @param name The event's name.
   * @param payload The event's data.
   * @param window The one window the event is for, a positive integer; omit
   * it for every window.
   * @throws ArgumentOutOfRangeException synchronously when the window is not
   * a positive integer.
   *
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const changed: Event = new Event(QualifiedName.parse("notes.captured"), { folder: "f1" });
   * ```
   */
  public constructor(name: QualifiedName, payload: JsonValue, window?: number);

  /**
   * Reads an event from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The event.
   * @throws JsonException synchronously when a field is missing, has the
   * wrong type or the name breaks its rules; its path names the field.
   *
   * @example
   * ```ts
   * import { Event } from "@noldova/desktop.protocol";
   *
   * export const event: Event = Event.fromJson({ name: "notes.captured", payload: null });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Event;

  /**
   * Returns the event's own fields.
   *
   * @returns The `name` and `payload` fields, and `window` when the event is
   * for one window.
   *
   * @example
   * ```ts
   * import { Event, QualifiedName } from "@noldova/desktop.protocol";
   *
   * export const text: string = new Event(QualifiedName.parse("desktop.changed"), null).toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * Asks the runtime to stop an unanswered request. The runtime stops the
 * work it owns and answers the request with `Cancelled`; a request that has
 * already been answered is not affected.
 */
export declare class Cancel extends WireMessage {
  /**
   * Always `Cancel`.
   */
  public override readonly kind: WireMessageKind;

  /**
   * The id of the request to stop.
   */
  public readonly id: string;

  /**
   * Creates the cancellation.
   *
   * @param id The id of the request to stop; not whitespace only.
   * @throws ArgumentException synchronously when the id is empty or
   * whitespace only.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/desktop.protocol";
   *
   * export const cancel: Cancel = new Cancel("r7");
   * ```
   */
  public constructor(id: string);

  /**
   * Reads a cancellation from its wire form.
   *
   * @param value The untrusted value.
   * @param path The path a failure reports; `$` by default.
   * @returns The cancellation.
   * @throws JsonException synchronously when the id is missing, not a string
   * or blank.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/desktop.protocol";
   *
   * export const cancel: Cancel = Cancel.fromJson({ id: "r7" });
   * ```
   */
  public static fromJson(value: unknown, path?: string): Cancel;

  /**
   * Returns the cancellation's own fields.
   *
   * @returns The `id` field.
   *
   * @example
   * ```ts
   * import { Cancel } from "@noldova/desktop.protocol";
   *
   * export const text: string = new Cancel("r7").toText();
   * ```
   */
  protected override toJsonFields(): JsonObject;
}

/**
 * Creates models from wire forms. A model's constructor reports a broken rule
 * as an `ArgumentException` naming the parameter; read from the wire, the
 * same failure becomes a `JsonException` whose path names the field. Message
 * models of modules use it in their `fromJson` too.
 */
export declare class WireContract {
  /**
   * Rejects fields a security-sensitive message does not define.
   *
   * @param reader The reader of the message's object.
   * @param fields Every field the message defines, including `kind` when it
   * is a whole message.
   * @throws JsonException synchronously when the object has another field;
   * its path names the first such field.
   *
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { WireContract } from "@noldova/desktop.protocol";
   *
   * export function readStrict(value: unknown): JsonReader {
   *   const reader = JsonReader.fromValue(value);
   *   WireContract.requireKnownFields(reader, ["name"]);
   *   return reader;
   * }
   * ```
   */
  public static requireKnownFields(reader: JsonReader, fields: readonly string[]): void;

  /**
   * Runs a model's factory and translates its argument failures.
   *
   * @param reader The reader of the object the model is read from; its path
   * prefixes a failure's field.
   * @param factory Creates the model; it is called once, synchronously.
   * @returns The model the factory created.
   * @throws JsonException synchronously when the factory throws an
   * `ArgumentException`: its path is the reader's path followed by the
   * exception's parameter name, or the reader's path alone when it has
   * none, and the exception is its cause. Any other failure propagates
   * unchanged.
   *
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { QualifiedName, WireContract } from "@noldova/desktop.protocol";
   *
   * export function readName(value: unknown): QualifiedName {
   *   const reader = JsonReader.fromValue(value);
   *   return WireContract.create(reader, () => QualifiedName.parse(reader.readString("name"), "name"));
   * }
   * ```
   */
  public static create<T>(reader: JsonReader, factory: () => T): T;
}

/**
 * Decides which links Noldova Desktop Sample opens, in the system's own application or in a module's in-app browser: well-formed http,
 * https and mailto links without credentials, at most 32768 characters long.
 */
export declare class LinkPolicy {
  /**
   * Finds the link to open for a URL a window asked to open.
   *
   * @param url The URL as the window sent it; any value.
   * @returns The link in its normalized form, or `null` for any other value, scheme or a URL that does not parse.
   * @example
   * ```ts
   * import { LinkPolicy } from "@noldova/desktop.protocol";
   *
   * export const link: string | null = LinkPolicy.findAllowed("https://example.com/docs");
   * ```
   */
  public static findAllowed(url: unknown): string | null;
}

/**
 * Reads messages from their JSON text.
 */
export declare class WireDecoder {
  /**
   * Reads one message.
   *
   * @param text One frame's JSON text.
   * @returns The message, as the class its `kind` names.
   * @throws JsonException synchronously when the text is not JSON, not an
   * object, has an unknown kind or is not a valid message of its kind; its
   * path names the field.
   *
   * @example
   * ```ts
   * import { WireDecoder, type WireMessage } from "@noldova/desktop.protocol";
   *
   * export function decodeAll(frames: readonly string[]): readonly WireMessage[] {
   *   const decoder = new WireDecoder();
   *   return frames.map(t => decoder.decode(t));
   * }
   * ```
   */
  public decode(text: string): WireMessage;
}

/**
 * Splits a connection's text into frames: one message per line. Text after
 * the last line break is kept until the rest of its frame arrives. After it
 * throws, the reader must not be used again and the connection closes.
 *
 * The reader works on text: the transport decodes UTF-8 and sets its own
 * limit in bytes. The frame limit here counts characters, which are UTF-16
 * code units.
 */
export declare class FrameReader {
  /**
   * Creates the reader.
   *
   * @param maximumFrameLength The longest frame accepted, in characters; a
   * positive integer, 16 MiB by default.
   * @throws ArgumentOutOfRangeException synchronously when the maximum is not
   * a positive integer.
   *
   * @example
   * ```ts
   * import { FrameReader } from "@noldova/desktop.protocol";
   *
   * export const reader: FrameReader = new FrameReader(1024 * 1024);
   * ```
   */
  public constructor(maximumFrameLength?: number);

  /**
   * Reads the frames a chunk completes.
   *
   * @param chunk The next text received, decoded by the transport.
   * @returns The complete frames, in order, without their line breaks;
   * blank lines are skipped.
   * @throws ProtocolException synchronously with `FrameTooLarge` when a
   * frame, complete or not, exceeds the maximum length.
   *
   * @example
   * ```ts
   * import { FrameReader } from "@noldova/desktop.protocol";
   *
   * export const frames: string[] = new FrameReader().read("{\"kind\":\"Cancel\",\"id\":\"r1\"}\n{\"kind\"");
   * ```
   */
  public read(chunk: string): string[];
}

/**
 * Turns messages into frames. The frame limit counts characters, which are
 * UTF-16 code units; the transport encodes the text as UTF-8.
 */
export declare class FrameWriter {
  /**
   * Creates the writer.
   *
   * @param maximumFrameLength The longest frame written, in characters; a
   * positive integer, 16 MiB by default.
   * @throws ArgumentOutOfRangeException synchronously when the maximum is not
   * a positive integer.
   *
   * @example
   * ```ts
   * import { FrameWriter } from "@noldova/desktop.protocol";
   *
   * export const writer: FrameWriter = new FrameWriter(1024 * 1024);
   * ```
   */
  public constructor(maximumFrameLength?: number);

  /**
   * Writes one message as a frame.
   *
   * @param message The message.
   * @returns The message's JSON text followed by a line break.
   * @throws ProtocolException synchronously with `FrameTooLarge` when the
   * text exceeds the maximum length.
   *
   * @example
   * ```ts
   * import { Cancel, FrameWriter } from "@noldova/desktop.protocol";
   *
   * export const frame: string = new FrameWriter().write(new Cancel("r7"));
   * ```
   */
  public write(message: WireMessage): string;
}

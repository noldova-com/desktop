/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef, InjectionToken, Signal, Type } from "@angular/core";
import type { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import type { AgentControlState, KeyChord, NotificationPost, SettingEntry, SettingOption, SettingScope, WebViewEvent, WebViewNavigation, WebViewPane } from "@noldova/desktop.protocol";
import type { LinkGesture } from "@noldova/ui.components.angular";

/**
 * How the person opened a link: a plain click or Enter, the same with Ctrl
 * or Cmd held, or the middle button. It is the UI kit's own enum, so a part
 * passes the `gesture` of the kit's `linkOpen` event as it is.
 */
export { LinkGesture } from "@noldova/ui.components.angular";

/**
 * Whether the shell pads the page a view or document shows. The shell pads
 * every page by default, 0.75rem at the sides in the default theme, so the
 * page's content starts where its tab's icon does, and at the top and bottom
 * by where the page shows: 1rem in the middle or a dialog and 0.5rem in a
 * dock, so a view moved into the middle is padded as a document. A page
 * that runs edge to edge, such as a terminal or a code editor, turns it off at
 * any of three levels: its module for all of its views and documents, its
 * declaration, or the page itself at runtime. The page's choice wins over its
 * declaration's, and the declaration's over its module's.
 */
export declare enum ContentPadding {
  /**
   * The shell's padding for the place the page shows in.
   */
  Default = "Default",

  /**
   * No padding: the page reaches the edges of its panel.
   */
  None = "None"
}

/**
 * The docks a view can belong to.
 */
export declare enum DockSide {
  /**
   * The dock at the window's start.
   */
  Left = "Left",

  /**
   * The dock at the window's end.
   */
  Right = "Right",

  /**
   * The dock along the window's bottom.
   */
  Bottom = "Bottom"
}

/**
 * What became of a file {@link IWindowPartContext.saveFileAsync} asked to save.
 */
export declare enum FileSaveOutcome {
  /**
   * The bytes were written to the file the person chose.
   */
  Saved = "Saved",

  /**
   * The person cancelled the save dialog, or the window closed while it was
   * open; nothing was written.
   */
  Cancelled = "Cancelled",

  /**
   * The request was refused, or the file could not be written; Noldova
   * Noldova Desktop's log says why.
   */
  Failed = "Failed"
}

/**
 * Where a web link opens: in the in-app browser a window part registered
 * with {@link IWindowPartContext.registerInAppBrowser}, or in the person's
 * own browser.
 */
export declare enum LinkPlace {
  /**
   * In the in-app browser; with none registered, the link opens in the
   * system's browser instead.
   */
  InApp = "InApp",

  /**
   * In the system's own application, the person's browser for a web link.
   */
  System = "System"
}

/**
 * The tone of a status bar item's text and icon, which colours them.
 */
export declare enum StatusBarItemTone {
  /**
   * The status bar's text colour.
   */
  Neutral = "Neutral",

  /**
   * The design's muted text colour, for an item that is quieter than the
   * others, such as one that only reports.
   */
  Muted = "Muted"
}

/**
 * The side of the status bar an item stands on.
 */
export declare enum StatusBarSide {
  /**
   * The start of the status bar.
   */
  Left = "Left",

  /**
   * The end of the status bar, before the shell's own items.
   */
  Right = "Right"
}

/**
 * The side of the window's top row an action stands on.
 */
export declare enum TopBarSide {
  /**
   * After the Back and Forward buttons and before the layout menu.
   */
  Start = "Start",

  /**
   * Beside the window controls and the breadcrumb of the document area's
   * active tab.
   */
  End = "End"
}

/**
 * The base of every exception the window throws or rejects with, such as the
 * one {@link IWindowPartContext} gives when a part reads another module's
 * setting, so a part catches the window's failures apart from its own.
 */
export declare abstract class WindowException extends Exception {
  /**
   * The exception's name, which each concrete exception sets to its own class
   * name, written out, so that a minified build keeps it.
   */
  public override readonly name: string;

  /**
   * Creates the exception, for the window's own exceptions to call.
   *
   * @param message A sentence describing the failure.
   * @param options The preceding failure, if any.
   *
   * @example
   * ```ts
   * import { WindowException } from "@noldova/desktop.window";
   *
   * export function isWindowFailure(error: unknown): boolean {
   *   return error instanceof WindowException;
   * }
   * ```
   */
  protected constructor(message: string, options?: ExceptionOptions);
}

/**
 * The exception {@link IWindowPartContext.openFileAsync} rejects with when the
 * window refuses to open a file, such as a program or a script, or the system
 * cannot open it, so a part tells that refusal apart from other failures.
 */
export declare class FileNotOpenedException extends WindowException {
  /**
   * The exception's name, `FileNotOpenedException`.
   */
  public override readonly name: string;

  /**
   * Why the file wasn't opened, as the main process gave it, such as that only
   * documents and text files open.
   */
  public readonly reason: string;

  /**
   * Creates the exception, for the window to throw.
   *
   * @param productName The app's name, which the message starts with.
   * @param reason Why the file wasn't opened.
   * @example
   * ```ts
   * import { FileNotOpenedException } from "@noldova/desktop.window";
   *
   * export function readRefusal(error: unknown): string | null {
   *   return error instanceof FileNotOpenedException ? error.reason : null;
   * }
   * ```
   */
  public constructor(productName: string, reason: string);
}

/**
 * The exception {@link IWindowPartContext.showInFolderAsync} rejects with when
 * the window refuses to show a file in its folder, such as a path no file can
 * be read at, or a network or device path, so a part tells that refusal apart
 * from other failures.
 */
export declare class FileNotShownException extends WindowException {
  /**
   * The exception's name, `FileNotShownException`.
   */
  public override readonly name: string;

  /**
   * Why the file wasn't shown, as the main process gave it, such as that no
   * file can be read at the path.
   */
  public readonly reason: string;

  /**
   * Creates the exception, for the window to throw.
   *
   * @param productName The app's name, which the message starts with.
   * @param reason Why the file wasn't shown.
   * @example
   * ```ts
   * import { FileNotShownException } from "@noldova/desktop.window";
   *
   * export function readRefusal(error: unknown): string | null {
   *   return error instanceof FileNotShownException ? error.reason : null;
   * }
   * ```
   */
  public constructor(productName: string, reason: string);
}

/**
 * The exception {@link IWindowPartContext.requestAsync} rejects with when the
 * runtime refuses or fails the request, so a part reads the failure's code and
 * the details its module's runtime part gave, such as which note was missing.
 */
export declare class RuntimeRequestException extends WindowException {
  /**
   * The exception's name: `RuntimeRequestException`, or
   * `RuntimeDisconnectedException` once the runtime is gone, when the window
   * throws its own subclass; `instanceof RuntimeRequestException` holds for both.
   */
  public override readonly name: string;

  /**
   * The failure's code, one of `FailureCode`'s values from
   * `@noldova/desktop.protocol`: the one the runtime part's method failed with,
   * such as `NotFound`, or `Disconnected` once the runtime is gone.
   */
  public readonly code: string;

  /**
   * The failure's details, as the runtime part's method gave them with its
   * failure, or `undefined` when it gave none.
   */
  public readonly details: JsonObject | undefined;

  /**
   * Creates the exception, for the window to throw, and for a part's specs to
   * reject a fake request with, as the testing package's
   * `FakeWindowPartContext.requestAsync` shows.
   *
   * @param code The failure's code.
   * @param message A sentence describing the failure.
   * @param details The failure's details, if any.
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import { FailureCode } from "@noldova/desktop.protocol";
   * import { RuntimeRequestException } from "@noldova/desktop.window";
   *
   * export function readMissingNote(error: unknown): string | null {
   *   if (!(error instanceof RuntimeRequestException) || error.code !== FailureCode.NotFound || error.details === undefined)
   *     return null;
   *   return JsonReader.fromValue(error.details).readString("path");
   * }
   * ```
   */
  public constructor(code: string, message: string, details?: JsonObject);
}

/**
 * The key that runs a command, as {@link IWindowPartContext.keyOf} reads it.
 */
export interface ICommandKey {
  /**
   * The key as the window's menus show it on this platform, such as `⌥⌘N` on
   * macOS and `Ctrl+Alt+N` elsewhere.
   */
  readonly label: string;

  /**
   * The key in the form of the `aria-keyshortcuts` attribute, such as
   * `Alt+Meta+N` on macOS and `Control+Alt+N` elsewhere.
   */
  readonly ariaKeyShortcuts: string;
}

/**
 * How {@link IWindowPartContext.openDocument} opens a document.
 */
export interface IDocumentOptions {
  /**
   * Whether the document opens as a preview, which the next preview in its
   * group replaces until the person keeps it; false when left out. The
   * shared setting `desktop.previewTabs` turns previews off, and then every
   * document opens as an ordinary tab.
   */
  readonly preview?: boolean;

  /**
   * The segments shown before the title in the window row while the
   * document is active, such as its project and folder, outermost first;
   * none when left out. Segments are text and must not be blank.
   */
  readonly breadcrumb?: readonly string[];

  /**
   * A glyph shown before the breadcrumb in the window row, before the title
   * when there are no segments, such as a folder for a project; none when
   * left out. It must not be blank.
   */
  readonly breadcrumbIcon?: string;

  /**
   * A small image the tab shows before its title, in place of its glyph,
   * such as a site's favicon, drawn 0.875rem square with rounded corners. It
   * is a `data:image/...` URL, since the window loads no other images; the
   * part fetches it itself. Decorative: the title names the tab. Left out,
   * an open document keeps the image it shows, and one that isn't open has
   * none.
   */
  readonly image?: string;

  /**
   * The glyph the tab shows in the image's place while there is no image,
   * while it loads, after it fails and in forced colours, such as `public`
   * for a web page. Left out, an open document keeps the glyph it was given;
   * one that isn't open shows `public` with an image and the document's glyph
   * without one. It must not be blank.
   */
  readonly imageGlyph?: string;

  /**
   * A status the tab shows before its title in place of its image, such as
   * a page that can't be reached. Left out, an open document keeps its
   * status, and one that isn't open has none.
   */
  readonly status?: IDocumentStatus;

  /**
   * A marker the tab shows first, in the accent colour, with its own
   * tooltip, such as where the document was opened from. Left out, an open
   * document keeps its marker, and one that isn't open has none.
   */
  readonly marker?: IDocumentMarker;

  /**
   * Why the tab carries the accent underline, an inset line at its bottom
   * edge, such as "A teammate is using this page", which joins the tab's
   * accessible name. Left out, an open document keeps its underline, and one
   * that isn't open has none. It must not be blank.
   */
  readonly underline?: string;

  /**
   * The instance of an open document of the same name that the new document
   * opens right after, in that document's group, such as the page that asked
   * for a new one. A preview there replaces that group's preview, and opens
   * right after this document only when the group has none. When no document
   * of the same name and instance is open, the document opens as when this is
   * left out, at the end of the active group; a document that is already open
   * is only activated where it is.
   */
  readonly after?: string;

  /**
   * Whether the document becomes its group's active tab, as when the person
   * chooses it; true when left out. When false, the document joins its group's
   * tabs without becoming active, the group stays as it was, and the focus
   * stays where it is, such as a page an agent opens beside the one the person
   * reads; an open document stays where it is, behind the active tab. A preview
   * replaces the group's preview only when that preview isn't the active tab,
   * which otherwise stays open as an ordinary tab. A document opened into an
   * empty group still becomes that group's active tab.
   */
  readonly activate?: boolean;
}

/**
 * The tone of a document's status glyph, which colours it.
 */
export declare enum DocumentTone {
  /**
   * The tab's text colour.
   */
  Neutral = "Neutral",

  /**
   * The status colour of success.
   */
  Ok = "Ok",

  /**
   * The status colour of failure, such as a page that can't be reached.
   */
  Failed = "Failed"
}

/**
 * A status a document's tab shows before its title, in place of its image.
 */
export interface IDocumentStatus {
  /**
   * The status's glyph, drawn at the tab's icon size, such as `error`. It
   * must not be blank.
   */
  readonly glyph: string;

  /**
   * What the status means, such as "Can't reach this page", which joins
   * the tab's accessible name after its title. It must not be blank.
   */
  readonly description: string;

  /**
   * The glyph's tone, {@link DocumentTone.Neutral} when left out; under
   * forced colours the glyph takes the tab's text colour.
   */
  readonly tone?: DocumentTone;
}

/**
 * A marker a document's tab shows first, in the accent colour.
 */
export interface IDocumentMarker {
  /**
   * The marker's glyph, such as `subdirectory_arrow_right`. It must not be
   * blank.
   */
  readonly glyph: string;

  /**
   * The marker's tooltip, such as "Opened from Plans and pricing", which
   * joins the tab's accessible name after the status's description. It must
   * not be blank.
   */
  readonly label: string;
}

/**
 * What {@link IWindowPartContext.updateDocument} changes about an open
 * document; what is left out stays as it is.
 */
export interface IDocumentUpdate {
  /**
   * The new title, shown on the tab, in a dialog that shows the document,
   * and in the window row and the window's title while it is active.
   */
  readonly title?: string;

  /**
   * The new breadcrumb, as {@link IDocumentOptions.breadcrumb} describes
   * it; an empty list removes it.
   */
  readonly breadcrumb?: readonly string[];

  /**
   * The glyph shown before the new breadcrumb, as
   * {@link IDocumentOptions.breadcrumbIcon} describes it. It goes with a new
   * breadcrumb, and is refused without one; a new breadcrumb without it shows
   * no glyph.
   */
  readonly breadcrumbIcon?: string;

  /**
   * The new image, as {@link IDocumentOptions.image} describes it; null
   * removes it.
   */
  readonly image?: string | null;

  /**
   * The new glyph in the image's place, as
   * {@link IDocumentOptions.imageGlyph} describes it; null returns to the
   * default.
   */
  readonly imageGlyph?: string | null;

  /**
   * The new status, as {@link IDocumentOptions.status} describes it; null
   * removes it.
   */
  readonly status?: IDocumentStatus | null;

  /**
   * The new marker, as {@link IDocumentOptions.marker} describes it; null
   * removes it.
   */
  readonly marker?: IDocumentMarker | null;

  /**
   * The new reason for the underline, as {@link IDocumentOptions.underline}
   * describes it; null removes the underline.
   */
  readonly underline?: string | null;
}

/**
 * What a {@link ViewContribution} declares besides its title, icon, dock
 * and padding.
 */
export interface IViewOptions {
  /**
   * Whether the view opens as many tabs, one for each instance the part
   * opens with {@link IWindowPartContext.openView}, such as one for each
   * terminal; false when left out. A view with instances never opens in a
   * new layout, and a saved layout's instance tabs that the part does not
   * reopen before its activation ends close.
   */
  readonly hasInstances?: boolean;

  /**
   * A menu place, `<module id>.<name>`, whose rows show as icon buttons in
   * the tab row of every group that holds one of the view's tabs, before
   * the group's own buttons; a submenu row opens its place as a menu.
   * Every row's command gets `tabGroup`, the group's id, as an argument,
   * which {@link IViewInstanceOptions.tabGroup} takes back, and, while the
   * group's active tab is a document's, `document` and `instance`, that
   * document's name and instance. The place is a plain one, never a
   * toolbar; none when left out.
   */
  readonly tabRowPlace?: string;

  /**
   * Whether a person can rename the view's instance tabs in place, from
   * the tab menu's Rename, F2 on the focused tab or a double-click on the
   * tab; false when left out. Only a view with instances can be renamable.
   * The part hears each kept title through
   * {@link IWindowPartContext.onTabRenamed} and applies it with
   * {@link IWindowPartContext.updateView}.
   */
  readonly isRenamable?: boolean;
}

/**
 * What a {@link DocumentContribution} declares besides its component and
 * padding.
 */
export interface IDocumentContributionOptions {
  /**
   * A menu place, `<module id>.<name>`, whose rows show as icon buttons in
   * the tab row of every group that holds one of the document's tabs,
   * before the group's own buttons, as {@link IViewOptions.tabRowPlace}
   * does for a view, such as a browser's new tab; a submenu row opens its
   * place as a menu. Every row's command gets `tabGroup`, the group's id,
   * as an argument, and, while the group's active tab is a document's,
   * `document` and `instance`, that document's name and instance, such as
   * the page a new tab opens beside. The place is a plain one, never a
   * toolbar; none when left out.
   */
  readonly tabRowPlace?: string;

  /**
   * Whether a person can rename the document's tabs in place, from the tab
   * menu's Rename, F2 on the focused tab or a double-click on the tab;
   * false when left out, when a double-click keeps a preview tab open. The
   * part hears each kept title through
   * {@link IWindowPartContext.onTabRenamed} and applies it with
   * {@link IWindowPartContext.updateDocument}.
   */
  readonly isRenamable?: boolean;
}

/**
 * Where and how {@link IWindowPartContext.openView} opens an instance.
 */
export interface IViewInstanceOptions {
  /**
   * The glyph of the instance's tab; the view's icon when left out.
   */
  readonly icon?: string;

  /**
   * The id of the group to open the tab in, as a command from the view's
   * {@link IViewOptions.tabRowPlace} gets it in `tabGroup`. Left out, or
   * naming a group that is gone, the tab opens in
   * the current group when it holds one of the view's tabs, else in the
   * first group that holds one, else in the view's dock.
   */
  readonly tabGroup?: string;

  /**
   * The segments shown before the title in the window row while the
   * instance's tab is the active tab of the document area, such as a
   * terminal's working folder, outermost first; none when left out. In a
   * dock, the tab's breadcrumb is not shown. Segments are text and must not
   * be blank, as for {@link IDocumentOptions.breadcrumb}.
   */
  readonly breadcrumb?: readonly string[];

  /**
   * The glyph shown before the breadcrumb, as
   * {@link IDocumentOptions.breadcrumbIcon} describes it; none when left out.
   */
  readonly breadcrumbIcon?: string;
}

/**
 * What {@link IWindowPartContext.updateView} changes about an open
 * instance; what is left out stays as it is.
 */
export interface IViewUpdate {
  /**
   * The tab's new title.
   */
  readonly title?: string;

  /**
   * The tab's new glyph.
   */
  readonly icon?: string;

  /**
   * The new breadcrumb, as {@link IViewInstanceOptions.breadcrumb} describes
   * it; an empty list removes it.
   */
  readonly breadcrumb?: readonly string[];

  /**
   * The glyph shown before the new breadcrumb, as
   * {@link IDocumentUpdate.breadcrumbIcon} describes it for a document.
   */
  readonly breadcrumbIcon?: string;
}

/**
 * What a status-bar item shows besides its text, and what it runs.
 */
export interface IStatusBarItemOptions {
  /**
   * The glyph shown before the text; none when left out.
   */
  readonly icon?: string;

  /**
   * The tooltip, which is also the item's accessible name; the text names
   * it when left out.
   */
  readonly tooltip?: string;

  /**
   * The command the item runs, `<module id>.<name>`, from its module or a
   * dependency; the item is a button only when it has one.
   */
  readonly command?: string;

  /**
   * The arguments the command runs with; null when left out.
   */
  readonly commandArguments?: JsonValue;

  /**
   * Whether the item is hidden; false when left out. A hidden item takes no
   * space in the status bar and needs no text, icon or tooltip.
   */
  readonly isHidden?: boolean;

  /**
   * The tone of its text and icon, {@link StatusBarItemTone.Neutral} when
   * left out; under forced colours it takes the system's text colour.
   */
  readonly tone?: StatusBarItemTone;
}

/**
 * What a top-bar action runs its command with, and whether it shows.
 */
export interface ITopBarActionOptions {
  /**
   * The arguments the command runs with; null when left out.
   */
  readonly commandArguments?: JsonValue;

  /**
   * Whether the action is hidden; false when left out.
   */
  readonly isHidden?: boolean;
}

/**
 * How long the grants {@link IWindowPartContext.grantFilesAsync} issues live.
 */
export interface IFileGrantOptions {
  /**
   * The grants' lifetime in milliseconds, from 1 to 600 000; ten minutes when
   * left out.
   */
  readonly lifetime?: number;
}

/**
 * How {@link IWindowPartContext.chooseFilesAsync} lets the person pick files
 * and how long their grants live.
 */
export interface IFileChoiceOptions extends IFileGrantOptions {
  /**
   * Whether the person may pick more than one file; one when left out.
   */
  readonly multiple?: boolean;
}

/**
 * Which files {@link IWindowPartContext.chooseFilePathAsync} lets the person
 * pick and where its chooser starts.
 */
export interface IFilePathChoiceOptions {
  /**
   * The file name extensions the person may pick, 1 to 32 of 1 to 16 letters
   * and digits each, without the dot, such as `exe`; any file when left out.
   */
  readonly extensions?: readonly string[];

  /**
   * The absolute path of the folder the chooser starts in, absolute on the
   * window's platform and without control characters; where the system
   * starts it when left out.
   */
  readonly folder?: string;
}

/**
 * A file granted to the module's runtime part: what the window part may know
 * of it, never its path.
 */
export declare class IssuedFileGrant {
  /**
   * The grant, 32 lowercase hexadecimal digits, which the runtime part
   * redeems once with `context.files.redeemAsync`.
   */
  public readonly grant: string;

  /**
   * The file's name as the person sees it.
   */
  public readonly name: string;

  /**
   * The file's media type, `application/octet-stream` when it is not known.
   */
  public readonly mediaType: string;

  /**
   * The file's size in bytes when it was granted.
   */
  public readonly size: number;

  /**
   * Creates the granted file, as a test of a window part might.
   *
   * @param grant The grant.
   * @param name The file's name.
   * @param mediaType The file's media type.
   * @param size The file's size in bytes.
   * @example
   * ```ts
   * import { IssuedFileGrant } from "@noldova/desktop.window";
   *
   * export const report: IssuedFileGrant = new IssuedFileGrant("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", "report.pdf", "application/pdf", 1204);
   * ```
   */
  public constructor(grant: string, name: string, mediaType: string, size: number);
}

/**
 * What a request for files answers: the granted files, and why each other
 * file was not granted.
 */
export declare class IssuedFileGrants {
  /**
   * No file granted or refused, as a cancelled chooser answers.
   */
  public static readonly none: IssuedFileGrants;

  /**
   * The granted files, in the order they were picked or offered.
   */
  public readonly files: readonly IssuedFileGrant[];

  /**
   * One sentence for each file not granted, naming it and why, to show the
   * person.
   */
  public readonly refused: readonly string[];

  /**
   * Creates the answer, as a test of a window part might.
   *
   * @param files The granted files.
   * @param refused Why each other file was not granted.
   * @example
   * ```ts
   * import { IssuedFileGrant, IssuedFileGrants } from "@noldova/desktop.window";
   *
   * export const chosen: IssuedFileGrants = new IssuedFileGrants([new IssuedFileGrant("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21", "report.pdf", "application/pdf", 1204)], []);
   * ```
   */
  public constructor(files: readonly IssuedFileGrant[], refused: readonly string[]);
}

/**
 * Which view or document {@link IWindowPartContext.showInDialogAsync} shows,
 * and the dialog's title.
 */
export interface IViewDialogOptions {
  /**
   * The instance of a document, as {@link IWindowPartContext.openDocument}
   * names it; left out for a view.
   */
  readonly instance?: string;

  /**
   * The dialog's title; the view's or document's own title when left out.
   */
  readonly title?: string;
}

/**
 * How a web view's search reads its text.
 */
export interface IWebViewFindOptions {
  /**
   * Whether capitals and small letters differ; by default they don't.
   */
  readonly matchCase?: boolean;
}

/**
 * The result of a search in a web view's page.
 */
export interface IWebViewFound {
  /**
   * How many matches the page holds.
   */
  readonly matches: number;

  /**
   * The 1-based match the search marks, 0 when there is none.
   */
  readonly active: number;

  /**
   * Whether the engine didn't finish the search within its limit; the
   * counts are then 0, and the person should be told the search timed out
   * rather than that nothing matched.
   */
  readonly isTimedOut: boolean;

  /**
   * Whether a navigation of the page, a crash or a newer search ended the
   * search before the engine finished it; the counts are then 0, and the
   * person should be told the search stopped rather than that nothing
   * matched.
   */
  readonly isEnded: boolean;
}

/**
 * One web view a window part opened for one of its panes. The main process
 * holds the view's page; the window draws it in a `<webview>` element the part
 * mounts in its own element, and the part shows and drives it through the
 * handle, while its runtime part reaches it by its id. The element is part of
 * the window's page, so the part's menus, and Noldova Desktop's own menus,
 * dialogs, cards and notifications, lie over it like over any other element. To
 * draw over the live page, the part opens the view's layer with
 * {@link IWebViewHandle.openLayerAsync}. The view closes with its pane, and
 * when the part deactivates.
 */
export interface IWebViewHandle {
  /**
   * The view's id, which no other view has while the app runs; the runtime
   * part's controls and relay name the view by it.
   */
  readonly id: string;

  /**
   * The view or document the view shows in.
   */
  readonly pane: WebViewPane;

  /**
   * The key of the module's profile the view holds its cookies, storage and
   * cache in.
   */
  readonly profileKey: string;

  /**
   * Whether the view is closed: by {@link IWebViewHandle.close}, its pane
   * closing, the part deactivating, or the main process ending it.
   */
  readonly isClosed: boolean;

  /**
   * Puts the view in the part's element, which it fills: the window's element
   * for the view takes the host's whole padding box and follows its size,
   * since the page lays it out, so the host is positioned, such as with
   * `position: relative`, and the views mounted in one host lie over each
   * other. Mounting it in another element moves it there, and
   * mounting it in the same element again does nothing. The page loads once
   * the view is first mounted; a view never mounted keeps no page.
   *
   * @param host The part's positioned element the view fills.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function place(view: IWebViewHandle, host: HTMLElement): void {
   *   view.mount(host);
   *   view.show();
   * }
   * ```
   */
  mount(host: HTMLElement): void;

  /**
   * Shows the view, and hides the pane's other views; the view still stays
   * hidden while its pane is hidden. A hidden view keeps its place and its
   * page, and takes no clicks.
   *
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function select(view: IWebViewHandle): void {
   *   view.show();
   * }
   * ```
   */
  show(): void;

  /**
   * Hides the view.
   *
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function park(view: IWebViewHandle): void {
   *   view.hide();
   * }
   * ```
   */
  hide(): void;

  /**
   * Shows the part's component over the live view: the page keeps drawing and taking every click, key and scroll, and the layer's
   * elements are the window's markup, which the page can't read, style or reach. The component is created with the part's
   * {@link WindowPartTokens} and lies in the window's page, above the view's element, so it takes the window's style sheets, theme,
   * mode and forced colours.
   *
   * The component's host fills the view's element, and its coordinates are CSS pixels from the view's top-left corner, so a box read
   * from the page through the runtime part's relay is multiplied by the view's zoom. The layer takes no pointer, so clicks reach the
   * page; it is clipped at the view's edges, and shows and hides with the view. A view has one layer at a time: opening another closes
   * the first. The layer closes with the view, its pane and the part.
   *
   * @param load Loads the layer's component.
   * @returns The layer.
   * @throws Error asynchronously, rejecting the promise, with what `load` rejects with, with what the component throws as it is
   * created, or with the closed error when the view closes while the component loads; no layer is left open.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export async function markAsync(view: IWebViewHandle): Promise<() => void> {
   *   const layer = await view.openLayerAsync(() => import("./mark.component.js").then(t => t.MarkComponent));
   *   layer.componentRef.setInput("box", { x: 120, y: 80, width: 200, height: 40 });
   *   return () => layer.close();
   * }
   * ```
   */
  openLayerAsync<T>(load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>>;

  /**
   * Loads an address in the view, after the origin check on the origins its
   * runtime part allowed.
   *
   * @param url The address.
   * @returns A promise of `Started`, or `Refused` with the origin the check
   * refused; it rejects once the view is closed.
   * @example
   * ```ts
   * import { WebViewNavigationKind } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export async function openHome(view: IWebViewHandle): Promise<boolean> {
   *   return (await view.navigateAsync("https://example.com/")).kind === WebViewNavigationKind.Started;
   * }
   * ```
   */
  navigateAsync(url: string): Promise<WebViewNavigation>;

  /**
   * Goes back in the view's history.
   *
   * @returns A promise of `Started`, `Refused` with the origin, or `NoHistory`;
   * it rejects once the view is closed.
   * @example
   * ```ts
   * import type { WebViewNavigation } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function back(view: IWebViewHandle): Promise<WebViewNavigation> {
   *   return view.goBackAsync();
   * }
   * ```
   */
  goBackAsync(): Promise<WebViewNavigation>;

  /**
   * Goes forward in the view's history.
   *
   * @returns A promise of `Started`, `Refused` with the origin, or `NoHistory`;
   * it rejects once the view is closed.
   * @example
   * ```ts
   * import type { WebViewNavigation } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function forward(view: IWebViewHandle): Promise<WebViewNavigation> {
   *   return view.goForwardAsync();
   * }
   * ```
   */
  goForwardAsync(): Promise<WebViewNavigation>;

  /**
   * Loads the view's page again, after the origin check.
   *
   * @returns A promise of `Started`, or `Refused` with the origin; it rejects
   * once the view is closed.
   * @example
   * ```ts
   * import type { WebViewNavigation } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function reload(view: IWebViewHandle): Promise<WebViewNavigation> {
   *   return view.reloadAsync();
   * }
   * ```
   */
  reloadAsync(): Promise<WebViewNavigation>;

  /**
   * Stops the view's loading.
   *
   * @returns A promise of `Started`; it rejects once the view is closed.
   * @example
   * ```ts
   * import type { WebViewNavigation } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function stop(view: IWebViewHandle): Promise<WebViewNavigation> {
   *   return view.stopAsync();
   * }
   * ```
   */
  stopAsync(): Promise<WebViewNavigation>;

  /**
   * Reads the view's zoom, which it keeps across its navigations and shares
   * with no other view; every view starts at 1.
   *
   * @returns A promise of the view's zoom as a factor, 1 for 100%; it rejects
   * once the view is closed.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function readZoom(view: IWebViewHandle): Promise<number> {
   *   return view.getZoomAsync();
   * }
   * ```
   */
  getZoomAsync(): Promise<number>;

  /**
   * Sets the view's zoom, held between 0.25 and 5, and reports it in a `Zoom`
   * event when it changes; `setZoomAsync(1)` resets it.
   *
   * @param factor The zoom as a factor above 0, 1 for 100%.
   *
   * @returns A promise of the zoom the view took; it rejects with an
   * `ArgumentException` for a factor that isn't finite and above 0, and once the
   * view is closed.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function resetZoom(view: IWebViewHandle): Promise<number> {
   *   return view.setZoomAsync(1);
   * }
   * ```
   */
  setZoomAsync(factor: number): Promise<number>;

  /**
   * Zooms the view in to the next of the browser steps, from 25% to 500%, as
   * the person's Ctrl or Cmd with plus does in the view.
   *
   * @returns A promise of the view's zoom as a factor, 1 for 100%; it rejects
   * once the view is closed.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function zoomIn(view: IWebViewHandle): Promise<number> {
   *   return view.zoomInAsync();
   * }
   * ```
   */
  zoomInAsync(): Promise<number>;

  /**
   * Zooms the view out to the previous of the browser steps, as the person's
   * Ctrl or Cmd with minus does in the view.
   *
   * @returns A promise of the view's zoom as a factor, 1 for 100%; it rejects
   * once the view is closed.
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function zoomOut(view: IWebViewHandle): Promise<number> {
   *   return view.zoomOutAsync();
   * }
   * ```
   */
  zoomOutAsync(): Promise<number>;

  /**
   * Searches the view's page for the text, ending any running search, and
   * marks the first match; an empty text only ends the running search and
   * resolves no matches. A navigation or a crash ends the search too, and a search
   * the engine hasn't finished within 10 seconds resolves no matches.
   *
   * @param text The text to find.
   * @param options `matchCase` to tell capitals apart; by default it doesn't.
   *
   * @returns A promise of the number of matches and the 1-based active one, 0
   * when none; it rejects once the view is closed.
   * @example
   * ```ts
   * import type { IWebViewFound, IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function find(view: IWebViewHandle): Promise<IWebViewFound> {
   *   return view.findAsync("plan");
   * }
   * ```
   */
  findAsync(text: string, options?: IWebViewFindOptions): Promise<IWebViewFound>;

  /**
   * Moves the running search to its next match, wrapping at the end; without a
   * running search it resolves no matches.
   *
   * @returns A promise of the number of matches and the 1-based active one, 0
   * when none; it rejects once the view is closed.
   * @example
   * ```ts
   * import type { IWebViewFound, IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function next(view: IWebViewHandle): Promise<IWebViewFound> {
   *   return view.findNextAsync();
   * }
   * ```
   */
  findNextAsync(): Promise<IWebViewFound>;

  /**
   * Moves the running search to its previous match, wrapping at the start;
   * without a running search it resolves no matches.
   *
   * @returns A promise of the number of matches and the 1-based active one, 0
   * when none; it rejects once the view is closed.
   * @example
   * ```ts
   * import type { IWebViewFound, IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function previous(view: IWebViewHandle): Promise<IWebViewFound> {
   *   return view.findPreviousAsync();
   * }
   * ```
   */
  findPreviousAsync(): Promise<IWebViewFound>;

  /**
   * Ends the running search and clears its highlights; nothing happens without
   * one, or once the view is closed.
   *
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function closeFindBar(view: IWebViewHandle): void {
   *   view.endFind();
   * }
   * ```
   */
  endFind(): void;

  /**
   * Reports the view's events: its state, failed loads, refused navigations
   * and requests, a crash, a cleared profile, the person's declared keys, each
   * zoom change and each search's result, and `Closed` when the main
   * process ends it. No event comes after the part closes the view itself.
   *
   * @param listener Receives each event.
   * @returns The release.
   * @example
   * ```ts
   * import { WebViewEventKind } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function followTitle(view: IWebViewHandle, show: (title: string) => void): () => void {
   *   return view.subscribe(t => {
   *     if (t.kind === WebViewEventKind.State)
   *       show(String(t.details["title"]));
   *   });
   * }
   * ```
   */
  subscribe(listener: (event: WebViewEvent) => void): () => void;

  /**
   * Ends the view and its pending calls; nothing happens once it is closed.
   *
   * @example
   * ```ts
   * import type { IWebViewHandle } from "@noldova/desktop.window";
   *
   * export function finish(view: IWebViewHandle): void {
   *   view.close();
   * }
   * ```
   */
  close(): void;
}

/**
 * How {@link IWindowPartContext.openLinkAsync} opens a link.
 */
export interface ILinkOpenOptions {
  /**
   * How the person opened the link, which the in-app browser places the link
   * by; a plain click when left out.
   */
  readonly gesture?: LinkGesture;

  /**
   * Where the link opens, which the in-app browser is then not asked; left
   * out, the in-app browser places it by its gesture. It applies only to an
   * http or https link while a part is the in-app browser: every other link,
   * and every link while none is, opens in the system's application.
   */
  readonly place?: LinkPlace;
}

/**
 * The in-app browser a window part registers with
 * {@link IWindowPartContext.registerInAppBrowser}, which opens the http and
 * https links every module opens, wherever its own settings place them.
 */
export interface IInAppBrowser {
  /**
   * Where a link opens, by how the person opened it. Noldova Desktop Sample
   * asks only for an http or https link whose part gave no place, and opens
   * the link in the system's browser when this throws.
   *
   * @param url The link, an http or https address.
   * @param gesture How the person opened it.
   * @returns Where it opens.
   */
  placeFor(url: string, gesture: LinkGesture): LinkPlace;

  /**
   * Opens a link the browser placed in the app, or one the person or a part
   * chose to open there. When the promise rejects, Noldova Desktop Sample opens
   * the link in the system's browser instead and logs to the registering
   * part's module only the kind of the failure, such as `TypeError`, never its
   * message, which could hold the address.
   *
   * @param url The link, an http or https address.
   */
  openAsync(url: string): Promise<void>;
}

/**
 * Text a window part selects itself rather than as a field's or the page's
 * selection, such as a terminal's, which the part registers with
 * {@link IWindowPartContext.registerSelectionSource} so the window's Copy
 * reaches it.
 */
export interface ISelectionSource {
  /**
   * Whether anything is selected now; the window asks when it shows Copy and
   * when Copy runs.
   */
  hasSelection(): boolean;

  /**
   * The selected text, as Copy writes it to the clipboard.
   */
  readSelection(): string;
}

/**
 * A layer a window part opened over one of its web views with
 * {@link IWebViewHandle.openLayerAsync}. It closes when
 * {@link IWebViewLayer.close} is called, when the view opens another layer,
 * and when the view, its pane or the part closes.
 */
export interface IWebViewLayer<T> {
  /**
   * The layer's component, created with the part's
   * {@link WindowPartTokens}; the part sets its inputs with `setInput`.
   */
  readonly componentRef: ComponentRef<T>;

  /**
   * Resolves once, when the layer closes, whichever way it closes.
   */
  readonly closed: Promise<void>;

  /**
   * Closes the layer and its window; does nothing once it is closed.
   */
  close(): void;
}

/**
 * A palette a window part opened with
 * {@link IWindowPartContext.openBelowWindowRowAsync}, just under the window
 * row. It closes on a pointer outside it, on Escape that it doesn't handle
 * itself, when the window row moves away or is hidden, when the part is
 * withdrawn, when the command search opens, and when
 * {@link IWindowPalette.close} is called; focus then goes back to where it
 * was, when that is still there.
 */
export interface IWindowPalette<T> {
  /**
   * The palette's component, created with the part's
   * {@link WindowPartTokens}.
   */
  readonly componentRef: ComponentRef<T>;

  /**
   * Resolves once, when the palette closes, whichever way it closes.
   */
  readonly closed: Promise<void>;

  /**
   * Closes the palette; does nothing once it is closed.
   */
  close(): void;
}

/**
 * A module's window part: what the window activates, asks to continue after
 * the runtime starts again, and deactivates. A module's window part exports
 * it as `windowPart` from its `src/api/index.ts`, where the build finds it.
 * Activation stays light; a part loads heavy code when its first view opens.
 */
export interface IWindowPart {
  /**
   * The module's id, which is its folder's name.
   */
  readonly moduleId: string;

  /**
   * The padding of the module's views and documents that declare none.
   * Leaving it out keeps the shell's padding.
   *
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ContentPadding, DockSide, type IWindowPart, type IWindowPartContext, ViewContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-terminal-panel", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPanelComponent {
   * }
   *
   * export class TerminalWindowPart implements IWindowPart {
   *   public readonly moduleId: string = "terminal";
   *   public readonly padding: ContentPadding = ContentPadding.None;
   *
   *   public activateAsync(context: IWindowPartContext): Promise<void> {
   *     context.registerView(new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, true, () => Promise.resolve(TerminalPanelComponent)));
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(true);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  readonly padding?: ContentPadding;

  /**
   * Registers the part's contributions through its context. The window
   * calls it once, in module order, after the parts of the module's
   * dependencies have activated.
   *
   * @param context The part's context, which it keeps until it deactivates.
   * @returns A promise that settles once the part has activated; a rejection
   * fails the part in this window alone and withdraws its contributions.
   * @example
   * ```ts
   * import { type IWindowPart, type IWindowPartContext, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
   *
   * export class ClockWindowPart implements IWindowPart {
   *   public readonly moduleId: string = "clock";
   *
   *   public activateAsync(context: IWindowPartContext): Promise<void> {
   *     context.registerStatusBarItem(new StatusBarItemContribution("clock.time", StatusBarSide.Right, new StatusBarItemState("12:00")));
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(false);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  activateAsync(context: IWindowPartContext): Promise<void>;

  /**
   * Asks the part, once the runtime is ready again, whether it continues
   * with its context, contributions, views and documents. Before resolving
   * true, the part reads again through its context everything it took from
   * the runtime, including its notifications, because the new runtime may
   * hold other state and events sent while it was away are lost. A document
   * the part opens from here, or from anything else it runs while the window
   * reconnects, waits for the reconnect to end, then opens as at any other
   * time, in the order asked, each in front, so the last one is active.
   *
   * @returns A promise of true when the part continues, or false to have the
   * window deactivate it and activate it again, which is always safe; a
   * rejection rebuilds it the same way and logs the failure.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import type { IWindowPart, IWindowPartContext } from "@noldova/desktop.window";
   *
   * export class NotesWindowPart implements IWindowPart {
   *   private context: IWindowPartContext | null = null;
   *
   *   public readonly moduleId: string = "notes";
   *   public notes: JsonValue = null;
   *
   *   public async activateAsync(context: IWindowPartContext): Promise<void> {
   *     this.context = context;
   *     this.notes = await context.requestAsync("notes.list", null);
   *   }
   *
   *   public async reconnectAsync(): Promise<boolean> {
   *     if (this.context === null)
   *       return false;
   *     this.notes = await this.context.requestAsync("notes.list", null);
   *     return true;
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     this.context = null;
   *     this.notes = null;
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  reconnectAsync(): Promise<boolean>;

  /**
   * Releases what the part holds besides its contributions, such as timers.
   * The window calls it in reverse module order and then withdraws the
   * part's contributions, subscriptions and notifications itself.
   *
   * @returns A promise that settles once the part has released them.
   * @example
   * ```ts
   * import type { IWindowPart } from "@noldova/desktop.window";
   *
   * export class TickerWindowPart implements IWindowPart {
   *   private timer: ReturnType<typeof setInterval> | null = null;
   *
   *   public readonly moduleId: string = "ticker";
   *
   *   public activateAsync(): Promise<void> {
   *     this.timer = setInterval(() => undefined, 1000);
   *     return Promise.resolve();
   *   }
   *
   *   public reconnectAsync(): Promise<boolean> {
   *     return Promise.resolve(true);
   *   }
   *
   *   public deactivateAsync(): Promise<void> {
   *     if (this.timer !== null)
   *       clearInterval(this.timer);
   *     return Promise.resolve();
   *   }
   * }
   * ```
   */
  deactivateAsync(): Promise<void>;
}

/**
 * What the window gives a window part: registration of its contributions,
 * and access to commands, notifications, documents, the runtime and
 * settings. A part reaches only its own module's names and its dependencies',
 * `<module id>.<name>`; it registers only names its module declares in
 * `module.json`. Everything it registers is withdrawn when it deactivates.
 * After that, the context ignores what would register, mark or post
 * something, or change the window's tabs, such as a call from a load that
 * finishes late: it still refuses a name or value a live context refuses, but
 * registers no contribution, provider or listener, opens, changes, closes or
 * shows no document or view, shows none in a view dialog, shows no link
 * menu, becomes no in-app browser, sets no badge,
 * marks no tab, shows no notification, and the functions it returns do
 * nothing. A document or view a part asks to open, change or close during
 * an activation that then fails is never opened, changed or closed. The
 * calls that reach the system do nothing after a withdraw either:
 * `chooseFolderAsync` answers `null` and `saveFileAsync` answers
 * `FileSaveOutcome.Cancelled` without showing a dialog, and `openLinkAsync`,
 * `openFileAsync` and `showInFolderAsync` open and show nothing. Their
 * refusals live in the main process, so these five answer without checking
 * their values. `chooseFilePathAsync` answers `null` without showing a
 * dialog, still refusing options a live context refuses.
 * `chooseFilesAsync` and `grantFilesAsync` answer no files,
 * still refusing a lifetime a live context refuses, and a withdraw ends every
 * file grant the part holds, including those a request still pending
 * answers.
 */
export interface IWindowPartContext {
  /**
   * The part's web views: it opens them for its own panes, and every one it
   * still holds closes when it deactivates.
   */
  readonly webViews: IWindowWebViews;

  /**
   * The module's own secrets in this machine's secret store, which the part
   * saves, replaces, removes and checks but never reads back: only the
   * module's runtime part reads a value, as `documents/MODULES.md` says.
   */
  readonly secrets: IWindowSecrets;

  /**
   * Whether agent control is stopped and whether any agent session is open,
   * which the runtime keeps current through `desktop.agentControlChanged`;
   * null until the runtime first answers.
   *
   * @example
   * ```ts
   * import { type Signal, computed } from "@angular/core";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function isStopped(context: IWindowPartContext): Signal<boolean> {
   *   return computed(() => context.agentControl()?.isStopped === true);
   * }
   * ```
   */
  readonly agentControl: Signal<AgentControlState | null>;

  /**
   * Registers one of the module's views.
   *
   * @param view The view, which the module declares in
   * `contributes.views`.
   * @throws Error synchronously when the view belongs to another module, the
   * module does not declare it, or it is already registered.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { DockSide, type IWindowPartContext, ViewContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-notes-list", template: "<ul></ul>" })
   * export class NotesListComponent {
   * }
   *
   * export function registerList(context: IWindowPartContext): void {
   *   context.registerView(new ViewContribution("notes.list", "Notes", "notes", DockSide.Left, true, () => Promise.resolve(NotesListComponent)));
   * }
   * ```
   */
  registerView(view: ViewContribution): void;

  /**
   * Registers one of the module's documents.
   *
   * @param document The document, which the module declares in
   * `contributes.documents`.
   * @throws Error synchronously when the document belongs to another module,
   * the module does not declare it, or it is already registered.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { DocumentContribution, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-notes-editor", template: "<textarea></textarea>" })
   * export class NotesEditorComponent {
   * }
   *
   * export function registerEditor(context: IWindowPartContext): void {
   *   context.registerDocument(new DocumentContribution("notes.note", () => Promise.resolve(NotesEditorComponent)));
   * }
   * ```
   */
  registerDocument(document: DocumentContribution): void;

  /**
   * Registers the module's placeholder, which the documents area shows while
   * no document is open, such as a start page with ways to begin.
   *
   * @param placeholder The placeholder, which the module declares in
   * `contributes.placeholders`.
   * @throws Error synchronously when the placeholder belongs to another
   * module, the module does not declare it, or a placeholder is already
   * registered, since the window shows one.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { type IWindowPartContext, PlaceholderContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-notes-start", template: "<button type=\"button\">New note</button>" })
   * export class NotesStartComponent {
   * }
   *
   * export function registerStart(context: IWindowPartContext): void {
   *   context.registerPlaceholder(new PlaceholderContribution("notes.start", () => Promise.resolve(NotesStartComponent)));
   * }
   * ```
   */
  registerPlaceholder(placeholder: PlaceholderContribution): void;

  /**
   * Registers one of the module's Settings pages, which Settings shows
   * among the pages under the title its `settings.json` gives, with the
   * module's component in the content column, followed by the settings of
   * the modules that depend on this one and name the page's title as their
   * page; until the part registers it, the page shows that it is loading,
   * and while the module is failed or blocked it shows why.
   *
   * @param page The page, which the module declares in
   * `contributes.settingsPages` and in its `settings.json`'s `pages`.
   * @throws Error synchronously when the page belongs to another module,
   * the module does not declare it, or it is already registered.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { type IWindowPartContext, SettingsPageContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-notes-sync", template: "<section class=\"nol-settings-group\"></section>" })
   * export class NotesSyncComponent {
   * }
   *
   * export function registerSync(context: IWindowPartContext): void {
   *   context.registerSettingsPage(new SettingsPageContribution("notes.sync", () => Promise.resolve(NotesSyncComponent)));
   * }
   * ```
   */
  registerSettingsPage(page: SettingsPageContribution): void;

  /**
   * Gives Settings search the rows one of the module's own pages draws, so a
   * search finds them as it finds settings: it matches each row's title and
   * description and shows the page with its matching rows, and opening a row
   * opens the page, scrolls the element marked `data-setting="<id>"` into
   * view once the page's component draws it, and marks it until the person
   * leaves the page or searches again.
   *
   * The part can call it at any time, its page's component too through the
   * same context, so the rows follow what the page shows; the rows go when
   * the part deactivates.
   *
   * @param page The page, which the module declares in
   * `contributes.settingsPages` and in its `settings.json`'s `pages`.
   * @param rows The page's rows, which replace its earlier ones; an empty
   * list clears them.
   * @throws Error synchronously when the page or a row's id belongs to
   * another module, or the module does not declare the page.
   * @throws ArgumentException synchronously when two rows have the same id.
   * @example
   * ```ts
   * import { type IWindowPartContext, SettingsRow } from "@noldova/desktop.window";
   *
   * export function showSyncRows(context: IWindowPartContext): void {
   *   context.setSettingsRows("notes.sync", [
   *     new SettingsRow("notes.sync.server", "Sync server", "Where your notes sync to."),
   *     new SettingsRow("notes.sync.interval", "Sync every")
   *   ]);
   * }
   * ```
   */
  setSettingsRows(page: string, rows: readonly SettingsRow[]): void;

  /**
   * Registers one of the module's commands, which then runs in this window.
   *
   * @param command The command, which the module declares in
   * `contributes.commands`.
   * @throws Error synchronously when the command belongs to another module,
   * the module does not declare it, or a command of that name is already
   * registered.
   * @example
   * ```ts
   * import { CommandContribution, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function registerNewNote(context: IWindowPartContext): void {
   *   context.registerCommand(new CommandContribution("notes.new", "New note", "add", "Mod+Alt+N", () => context.requestAsync("notes.create", null)));
   * }
   * ```
   */
  registerCommand(command: CommandContribution): void;

  /**
   * Registers one of the module's search sources, whose recent items and
   * matches the window's search shows in a group and a filter of their own.
   *
   * @param source The source, named `<module id>.<name>`.
   * @throws Error synchronously when the source belongs to another module or
   * a source of that name is already registered.
   * @example
   * ```ts
   * import { SearchAnswer, SearchSourceContribution, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function registerNotesSearch(context: IWindowPartContext): void {
   *   context.registerSearchSource(new SearchSourceContribution("notes.notes", "Notes", "notes", "Notes", null, "description",
   *     () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([]))));
   * }
   * ```
   */
  registerSearchSource(source: SearchSourceContribution): void;

  /**
   * Registers one of the module's status-bar items.
   *
   * @param item The item, which the module declares in
   * `contributes.statusBarItems`.
   * @returns The registered item, which the part updates or hides.
   * @throws Error synchronously when the item belongs to another module, the
   * module does not declare it, it is already registered, or its command
   * belongs to neither the module nor a dependency.
   * @example
   * ```ts
   * import { type IWindowPartContext, type StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
   *
   * export function registerCount(context: IWindowPartContext): StatusBarItem {
   *   return context.registerStatusBarItem(new StatusBarItemContribution("notes.count", StatusBarSide.Left,
   *     new StatusBarItemState("3 notes", { command: "notes.showList" })));
   * }
   * ```
   */
  registerStatusBarItem(item: StatusBarItemContribution): StatusBarItem;

  /**
   * Registers one of the module's top-bar actions.
   *
   * @param action The action, which the module declares in
   * `contributes.topBarActions`.
   * @returns The registered action, which the part updates or hides.
   * @throws Error synchronously when the action belongs to another module,
   * the module does not declare it, it is already registered, or its command
   * belongs to neither the module nor a dependency.
   * @example
   * ```ts
   * import { type IWindowPartContext, type TopBarAction, TopBarActionContribution, TopBarActionState } from "@noldova/desktop.window";
   *
   * export function registerSync(context: IWindowPartContext): TopBarAction {
   *   return context.registerTopBarAction(new TopBarActionContribution("notes.sync", new TopBarActionState("sync", "Sync notes", "notes.sync")));
   * }
   * ```
   */
  registerTopBarAction(action: TopBarActionContribution): TopBarAction;

  /**
   * Registers a step that saves the part's unsaved state when Noldova Desktop Sample
   * closes, quits for a newer build or restarts. The window runs every
   * part's steps and its own layout save together and closes only once they
   * settle. A step that rejects keeps Noldova Desktop Sample open: the window logs the
   * error and shows it as a notification naming the module, and the person
   * closes again once it is fixed. A part whose steps have not settled after
   * 4 seconds does not hold closing back: Noldova Desktop Sample closes, and the window
   * logs it and posts a warning naming the module.
   *
   * @param save The step; it resolves once the state is saved.
   * @returns A function that removes the step; deactivation removes it too.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function saveDraftsOnClose(context: IWindowPartContext, saveDraftsAsync: () => Promise<void>): () => void {
   *   return context.registerSave(saveDraftsAsync);
   * }
   * ```
   */
  registerSave(save: () => Promise<void>): () => void;

  /**
   * Makes the Edit menu's and the text field menu's Copy follow a selection
   * the part keeps itself, such as a terminal's. While focus is in the
   * element, Copy is enabled when the source has a selection, and copies its
   * text through the window's own clipboard channel, as
   * `ClipboardWriter` writes, without any web permission. While the source
   * has nothing selected, Copy acts on a text field inside the element as
   * before. Cut, Paste and Select All, and Copy anywhere else, work as before.
   *
   * Register the narrowest element that holds the selection. When registered
   * elements are nested, Copy follows the innermost one around the focus, and
   * registering an element again replaces its source; the earlier remover
   * then leaves the new one in place.
   *
   * @param element The element whose focus, its own or a descendant's, makes
   * the source the one Copy follows.
   * @param source The selection.
   * @returns A function that removes the source; deactivation removes it too.
   * Copy ignores a source whose element has left the page, but the window
   * keeps it until it is removed, so the part calls the remover when it
   * discards the element.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function followTerminalSelection(context: IWindowPartContext, element: HTMLElement,
   *   terminal: { hasSelection(): boolean; getSelection(): string }): () => void {
   *   return context.registerSelectionSource(element, { hasSelection: () => terminal.hasSelection(), readSelection: () => terminal.getSelection() });
   * }
   * ```
   */
  registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void;

  /**
   * Supplies the rows of one of the module's dynamic menu groups. The window
   * asks again whenever it builds the menu or toolbar, and leaves out a row
   * whose command belongs to neither the module nor a dependency, and a group
   * without rows.
   *
   * @param group The group's name, which the module's `menus.json` declares
   * as `dynamic`.
   * @param provider Returns the rows for the context object the menu was
   * opened with, `{}` in the main menu and toolbars.
   * @returns A function that withdraws the rows; deactivation withdraws them
   * too.
   * @throws Error synchronously when the group belongs to another module or
   * the module does not declare it as dynamic.
   * @example
   * ```ts
   * import { type IWindowPartContext, MenuRowContribution } from "@noldova/desktop.window";
   *
   * export function provideRecent(context: IWindowPartContext, recent: readonly string[]): () => void {
   *   return context.provideMenuGroup("notes.recent", () => recent.map(t => new MenuRowContribution("notes.open", { note: t }, t)));
   * }
   * ```
   */
  provideMenuGroup(group: string, provider: (context: JsonObject) => readonly MenuRowContribution[]): () => void;

  /**
   * Supplies the options of one of the module's dynamic choice settings.
   * Settings asks again whenever one of the module's settings changes and
   * whenever the part calls `refreshSettingOptions`, so the options can
   * follow the module's other settings and data the part loads. It keeps a
   * value that isn't among the options, marked unavailable, and shows the
   * value in a disabled field while no options are supplied, the provider
   * returns `null` because its data is still loading, or it throws or returns
   * two options with one value. Settings calls the provider synchronously
   * while it renders, outside any reactive context, so the provider may read
   * and write signals, and a signal it reads doesn't make Settings ask again.
   *
   * @param setting The setting's name, which the module's `settings.json`
   * declares as a `Choice` with `"dynamic": true`.
   * @param provider Returns the options for the module's settings in effect
   * for the application, by name; an option's value may be empty, such as
   * for a "Provider default" option; or `null` while the data they come
   * from is still loading, followed by `refreshSettingOptions` once it is.
   * @returns A function that stops supplying them; deactivation stops it
   * too, and a later call for the same setting replaces the provider.
   * @throws Error synchronously when the setting belongs to another module
   * or is not a dynamic choice.
   * @example
   * ```ts
   * import { SettingOption } from "@noldova/desktop.protocol";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function provideModels(context: IWindowPartContext, models: ReadonlyMap<string, readonly string[]>): () => void {
   *   return context.provideSettingOptions("notes.model", values =>
   *     (models.get(String(values["notes.account"])) ?? []).map(t => new SettingOption(t, t)));
   * }
   * ```
   */
  provideSettingOptions(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void;

  /**
   * Tells Settings that a dynamic choice setting's options changed, such as
   * when data the provider reads finished loading, so it asks the provider
   * again. Changes of the module's settings need no call.
   *
   * @param setting The setting's name, a dynamic choice of the module.
   * @throws Error synchronously when the setting belongs to another module
   * or is not a dynamic choice.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function modelsLoaded(context: IWindowPartContext): void {
   *   context.refreshSettingOptions("notes.model");
   * }
   * ```
   */
  refreshSettingOptions(setting: string): void;

  /**
   * Supplies the check of one of the module's checked text settings.
   * When the person commits a value in Settings, Settings asks the check:
   * a message refuses the value, which Settings doesn't save, and the field
   * keeps the refused text with the message under it until the person's
   * next commit, even when an earlier save lands meanwhile. Settings also
   * shows the message for a stored value the check refuses, without
   * changing it, until the person commits a value the check accepts. While
   * no check is supplied, such as before the part activates, Settings saves
   * any value within the text's length. A check that throws accepts the
   * value, and the part's log names the setting and the error's name, or
   * the type of what was thrown, never the value. Settings calls the check
   * synchronously, outside any reactive context, so a signal it reads
   * doesn't make Settings ask again.
   *
   * @param setting The setting's name, which the module's `settings.json`
   * declares as a `Text` with `"checked": true`.
   * @param check Returns the message that tells the person why a value is
   * refused, in their terms, or `null` to accept it.
   * @returns A function that stops supplying it; deactivation stops it
   * too, and a later call for the same setting replaces the check.
   * @throws Error synchronously when the setting belongs to another module
   * or is not a checked text.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function checkSites(context: IWindowPartContext): () => void {
   *   return context.provideSettingCheck("notes.sites", value =>
   *     value.split(",").some(t => t.trim().includes(" ")) ? "Enter hosts, such as github.com, separated by commas." : null);
   * }
   * ```
   */
  provideSettingCheck(setting: string, check: (value: string) => string | null): () => void;

  /**
   * Sets or removes the badge of one of the module's views.
   *
   * @param view The view's name, which the module declares in
   * `contributes.views`.
   * @param badge The badge, or null to remove it.
   * @throws Error synchronously when the view belongs to another module or
   * the module does not declare it.
   * @example
   * ```ts
   * import { type IWindowPartContext, ViewBadge } from "@noldova/desktop.window";
   *
   * export function showUnread(context: IWindowPartContext, unread: number): void {
   *   context.setViewBadge("notes.list", unread === 0 ? null : new ViewBadge(unread, `${unread} unread notes`));
   * }
   * ```
   */
  setViewBadge(view: string, badge: ViewBadge | null): void;

  /**
   * Marks the tab of one of the module's views or documents as working. A
   * view's tab shows a spinner in place of its close glyph and reveals Close
   * when hovered or focused; a document's tab shows the spinner before its
   * title, in place of its image, status or glyph, and keeps Close at its end.
   * Either is marked busy for assistive technology, until every mark on it is
   * cleared or the part is withdrawn. Real work that should hold up
   * quitting is reported by the module's runtime part, not by this mark.
   *
   * @param name The view's or document's name, which the module declares in
   * `contributes.views` or `contributes.documents`.
   * @param instance The tab's instance, if it has one.
   * @returns A function that clears this mark; calling it again does nothing.
   * @throws Error synchronously when the name belongs to another module, the
   * module declares no such view or document, or the instance is not valid.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function syncNoteAsync(context: IWindowPartContext, note: string, sync: () => Promise<void>): Promise<void> {
   *   const clear = context.markWorking("notes.note", note);
   *   try {
   *     await sync();
   *   }
   *   finally {
   *     clear();
   *   }
   * }
   * ```
   */
  markWorking(name: string, instance?: string): () => void;

  /**
   * Marks the tab of one of the module's views or documents as waiting for the
   * person, such as for an answer to an approval. The tab shows a raised hand
   * in place of its close glyph, at the spinner's size and place, reveals Close
   * when hovered or focused, and its accessible name ends with "waiting for
   * your answer", until every waiting mark on it is cleared or the part is
   * withdrawn. A tab that is also marked working shows waiting, and isn't
   * marked busy; it works again once its waiting marks are cleared.
   *
   * @param name The view's or document's name, which the module declares in
   * `contributes.views` or `contributes.documents`.
   * @param instance The tab's instance, if it has one.
   * @returns A function that clears this mark; calling it again does nothing.
   * @throws Error synchronously when the name belongs to another module, the
   * module declares no such view or document, or the instance is not valid.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function askAsync(context: IWindowPartContext, chat: string, answer: () => Promise<boolean>): Promise<boolean> {
   *   const clear = context.markWaiting("chats.chat", chat);
   *   try {
   *     return await answer();
   *   }
   *   finally {
   *     clear();
   *   }
   * }
   * ```
   */
  markWaiting(name: string, instance?: string): () => void;

  /**
   * Tells whether a name belongs to the module or one of its dependencies,
   * which is what the part may reach.
   *
   * @param name A name, `<module id>.<name>`.
   * @returns True when the name's module id is the module's own or a
   * dependency's.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function canOpen(context: IWindowPartContext, command: string): boolean {
   *   return context.isAllowed(command);
   * }
   * ```
   */
  isAllowed(name: string): boolean;

  /**
   * Runs a command of the module or a dependency, in the window or in the
   * runtime, or Noldova Desktop's `desktop.search`, which opens search under the
   * filter of the source its `source` argument names.
   *
   * @param name The command's name.
   * @param commandArguments The arguments; null when left out.
   * @returns A promise of the command's result; it rejects when the command
   * is not registered, not enabled or fails.
   * @throws Error synchronously when the command belongs to neither the
   * module nor a dependency, and is not `desktop.search`.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function openNote(context: IWindowPartContext, note: string): Promise<JsonValue> {
   *   return context.runCommandAsync("notes.open", { note });
   * }
   * ```
   */
  runCommandAsync(name: string, commandArguments?: JsonValue): Promise<JsonValue>;

  /**
   * Names the command the window would run for a key, so an element's own key
   * handler, which runs before the window's, can decide which keys to leave
   * to the window: an element that keeps Ctrl keys typically leaves its own
   * module's commands and every Ctrl+Shift key, and keeps other plain Ctrl
   * keys by preventing their default. The window reads the key with the
   * person's bindings and, inside an element marked with
   * {@link KeepsCtrlKeysDirective}, by its rule, and names only an enabled
   * command it would run now, whether or not the key repeats or a handler
   * already prevented its default.
   *
   * @param event The key event, during its handling.
   * @returns The command's name, or `null` when the window runs none for the
   * key, including while text is being composed.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function isForShell(context: IWindowPartContext, event: KeyboardEvent): boolean {
   *   const command = context.findWindowCommand(event);
   *   return command === null || !(command.startsWith("terminal.") || event.shiftKey);
   * }
   * ```
   */
  findWindowCommand(event: KeyboardEvent): string | null;

  /**
   * Reads the key that runs a command, after the person's bindings, so a part
   * can show it beside the command's control. The signal follows the person's
   * bindings and the commands as they change.
   *
   * @param command The command's qualified name, such as `notes.newNote`.
   * @returns A signal of the command's key, or of `null` while the command
   * has no key or isn't registered.
   * @example
   * ```ts
   * import { type Signal, computed } from "@angular/core";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function newNoteHint(context: IWindowPartContext): Signal<string> {
   *   const key = context.keyOf("notes.newNote");
   *   return computed(() => key()?.label ?? "");
   * }
   * ```
   */
  keyOf(command: string): Signal<ICommandKey | null>;

  /**
   * Posts a notification of one of the module's kinds.
   *
   * @param post The notification; its commands belong to the module or a
   * dependency.
   * @returns A promise of the handle that dismisses it; it rejects
   * when the kind belongs to another module or the module does not declare
   * it, a command belongs to neither the module nor a dependency, or the
   * runtime refuses the post.
   * @example
   * ```ts
   * import { NotificationPost, NotificationSeverity, QualifiedName } from "@noldova/desktop.protocol";
   * import { type IWindowPartContext, type NotificationHandle } from "@noldova/desktop.window";
   *
   * export function announceSaved(context: IWindowPartContext): Promise<NotificationHandle> {
   *   return context.postNotificationAsync(new NotificationPost(QualifiedName.parse("notes.saved"), null, "Note saved", null, NotificationSeverity.Info, null, [], null));
   * }
   * ```
   */
  postNotificationAsync(post: NotificationPost): Promise<NotificationHandle>;

  /**
   * Opens one of the module's documents at the end of the active document
   * group, or right after another of its open instances when
   * {@link IDocumentOptions.after} names one, or activates it where it is,
   * unless {@link IDocumentOptions.activate} is false. While the part first activates with a saved
   * layout, the document shows only when the layout holds it. An open document
   * keeps its look, changing only what the options give.
   *
   * @param name The document's name.
   * @param instance Which of the document's instances, such as a note's id.
   * @param title The tab's title.
   * @param options Whether it opens as a preview, its breadcrumb, its look,
   * the document it opens after and whether it becomes active; an ordinary, active tab with no breadcrumb, at
   * the end of the active group, when left out.
   * @throws Error synchronously when the document belongs to another module,
   * or the title or a breadcrumb segment is blank.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function previewNote(context: IWindowPartContext, note: string, title: string): void {
   *   context.openDocument("notes.note", note, title, { preview: true, breadcrumb: ["Notes", "Drafts"] });
   * }
   *
   * export function openLinkedNote(context: IWindowPartContext, from: string, note: string, title: string): void {
   *   context.openDocument("notes.note", note, title, { after: from });
   * }
   * ```
   */
  openDocument(name: string, instance: string, title: string, options?: IDocumentOptions): void;

  /**
   * Keeps an open preview of one of the module's documents, so the next
   * preview does not replace it.
   *
   * @param name The document's name.
   * @param instance The instance it opened with.
   * @throws Error synchronously when the document belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function keepEdited(context: IWindowPartContext, note: string): void {
   *   context.keepDocument("notes.note", note);
   * }
   * ```
   */
  keepDocument(name: string, instance: string): void;

  /**
   * Closes one of the module's documents: its tab closes as when the person
   * closes it, the next tab of its group shows, and a view dialog showing it
   * closes. Back and Forward keep it as a place; for a document whose subject
   * is gone, use {@link IWindowPartContext.forgetDocument}.
   * {@link onDocumentClosed} does not hear of it. Nothing happens when the
   * document is not open.
   *
   * @param name The document's name.
   * @param instance The instance it opened with.
   * @throws Error synchronously when the document belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function closeNote(context: IWindowPartContext, note: string): void {
   *   context.closeDocument("notes.note", note);
   * }
   * ```
   */
  closeDocument(name: string, instance: string): void;

  /**
   * Removes one of the module's documents from Back and Forward, and closes
   * it as {@link IWindowPartContext.closeDocument} does, for a document whose
   * subject is gone, such as a deleted note. A document closed any other
   * way stays a place that Back and Forward reopen.
   *
   * @param name The document's name.
   * @param instance The instance it opened with.
   * @throws Error synchronously when the document belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function forgetDeleted(context: IWindowPartContext, note: string): void {
   *   context.forgetDocument("notes.note", note);
   * }
   * ```
   */
  forgetDocument(name: string, instance: string): void;

  /**
   * Changes the title or breadcrumb of one of the module's open documents,
   * such as after the person renames or moves a note, a tab in the
   * background included. Nothing shows when the document is not open.
   * A change made before the window's saved layout loads applies once it
   * has, over the title saved with the layout; a later close or
   * {@link openDocument} of the document, also before the load, drops it.
   *
   * @param name The document's name.
   * @param instance The instance it opened with.
   * @param update The new title, breadcrumb or both.
   * @throws Error synchronously when the document belongs to another module,
   * the title, a breadcrumb segment or the breadcrumb's glyph is blank, or the
   * glyph comes without a breadcrumb.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function renameNote(context: IWindowPartContext, note: string, title: string): void {
   *   context.updateDocument("notes.note", note, { title });
   * }
   * ```
   */
  updateDocument(name: string, instance: string, update: IDocumentUpdate): void;

  /**
   * Listens for the person closing a tab of one of the module's documents,
   * such as to delete a record kept for each open page. A preview that
   * another preview replaces closes too. It never hears of a close made by
   * {@link closeDocument} or {@link forgetDocument}, the part deactivating
   * or the window going away. The part's deactivation removes the listener;
   * an error it throws is reported and the other listeners still hear. A
   * close the person makes while no listener of the document is registered,
   * such as while the part is inactive or reactivating, waits: the part's
   * next activation leaves that tab closed even when it reopens the
   * instance with {@link openDocument}, and the document's listeners hear
   * the close when that activation ends. Opening the instance after an
   * activation drops the waiting close.
   *
   * @param name The document's name.
   * @param listener Called with the instance whose tab closed.
   * @returns A function that removes the listener.
   * @throws Error synchronously when the document belongs to another module
   * or the module does not declare it.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function dropClosedPages(context: IWindowPartContext, drop: (page: string) => void): () => void {
   *   return context.onDocumentClosed("browser.page", drop);
   * }
   * ```
   */
  onDocumentClosed(name: string, listener: (instance: string) => void): () => void;

  /**
   * Listens for a person renaming a tab of one of the module's renamable
   * views or documents in place, as {@link IViewOptions.isRenamable} and
   * {@link IDocumentContributionOptions.isRenamable} declare it. Enter or
   * leaving the field keeps the title, trimmed; the listener hears it, or
   * an empty title, which asks for the part's own automatic title. Escape,
   * or a title the tab already shows, tells it nothing. The part owns the
   * name: the tab shows its old title until the part applies the new one
   * with {@link updateView} or {@link updateDocument}. The part's
   * deactivation removes the listener; an error it throws is reported and
   * the other listeners still hear.
   *
   * @param name The view's or document's name.
   * @param listener Called with the instance whose tab was renamed and the
   * kept title, empty for the automatic one.
   * @returns A function that removes the listener.
   * @throws Error synchronously when the view or document belongs to
   * another module, or the module does not register it as renamable.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function followRenames(context: IWindowPartContext, automaticTitle: (terminal: string) => string): () => void {
   *   return context.onTabRenamed("terminal.panel", (terminal, title) =>
   *     context.updateView("terminal.panel", terminal, { title: title === "" ? automaticTitle(terminal) : title }));
   * }
   * ```
   */
  onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void;

  /**
   * Lists the instances of one of the module's documents whose tabs are
   * open, such as to delete the records of pages with no tab, one the
   * person closed before it ever showed included. Asked while the part
   * activates, it answers once that activation ends, with the saved layout's
   * tabs in place and the waiting closes heard, so the part never awaits it
   * inside {@link IWindowPart.activateAsync}; asked later, it answers at once.
   *
   * @param name The document's name.
   * @returns A promise of the open instances, in tab order, or of `null`
   * when the part deactivates or its activation fails first; it rejects when
   * the document belongs to another module or the module does not declare
   * it.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function pruneClosedPages(context: IWindowPartContext, prune: (open: readonly string[]) => void): void {
   *   void context.listOpenDocumentsAsync("browser.page").then(open => open === null ? undefined : prune(open));
   * }
   * ```
   */
  listOpenDocumentsAsync(name: string): Promise<readonly string[] | null>;

  /**
   * Opens a tab for an instance of one of the module's views with
   * instances, such as a new terminal, and activates it; one already open
   * activates where it is, with the new title, glyph and breadcrumb. Its
   * component gets the instance and title as its `instance` and `title`
   * inputs.
   *
   * While the part activates, until the promise its
   * {@link IWindowPart.activateAsync} returned resolves, an instance tab the
   * saved layout holds takes the new title, glyph and breadcrumb where it
   * is, without activating, and the saved instance tabs it does not reopen
   * by then close without {@link onViewClosed}.
   *
   * @param name The view's name.
   * @param instance Which of the view's instances, such as a terminal's id;
   * not blank.
   * @param title The tab's title.
   * @param options Its glyph, the group to open in and its breadcrumb, as
   * {@link IViewInstanceOptions} describes them.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view with instances, or the instance, the title or a
   * breadcrumb segment is blank.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function openTerminal(context: IWindowPartContext, id: string, shell: string, tabGroup: string): void {
   *   context.openView("terminal.session", id, shell, { tabGroup });
   * }
   * ```
   */
  openView(name: string, instance: string, title: string, options?: IViewInstanceOptions): void;

  /**
   * Changes the title, glyph or breadcrumb of an open instance's tab, such
   * as after its shell changes the terminal's title or working folder.
   * Nothing happens when it is not open.
   *
   * @param name The view's name.
   * @param instance The instance it opened with.
   * @param update The new title, glyph, breadcrumb or any of them.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view with instances, the instance, the title, a
   * breadcrumb segment or the breadcrumb's glyph is blank, or the breadcrumb's
   * glyph comes without a breadcrumb.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function retitleTerminal(context: IWindowPartContext, id: string, title: string): void {
   *   context.updateView("terminal.session", id, { title });
   * }
   * ```
   */
  updateView(name: string, instance: string, update: IViewUpdate): void;

  /**
   * Closes an instance's tab, such as after its terminal's process exits:
   * the next tab of its group shows, a view dialog showing it closes, and
   * {@link onViewClosed} does not hear of it. Nothing happens when it is
   * not open.
   *
   * @param name The view's name.
   * @param instance The instance it opened with.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view with instances, or the instance is blank.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function closeExited(context: IWindowPartContext, id: string): void {
   *   context.closeView("terminal.session", id);
   * }
   * ```
   */
  closeView(name: string, instance: string): void;

  /**
   * Shows one of the part's views without instances, such as a bottom
   * panel, and moves the focus into it, as choosing its tab with the
   * pointer does: to the element it last held there, else its first
   * focusable element, once the view shows one, such as after its part
   * loads, waiting up to 10 seconds unless the person moves the focus,
   * clicks or presses a key elsewhere first. {@link openView} only
   * activates an instance, and the shell's `desktop.toggleView` leaves the
   * focus on the view's tab. A view that is not open opens in its dock; an
   * open one activates where it is, wherever the person moved it, and the
   * dock that holds it shows, even when it was hidden or the narrow window
   * closed it.
   *
   * While the part activates, until the promise its
   * {@link IWindowPart.activateAsync} returned resolves, the view shows once
   * the window has loaded its layout.
   *
   * @param name The view's name.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view without instances.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function showPanel(context: IWindowPartContext): void {
   *   context.showView("terminal.panel");
   * }
   * ```
   */
  showView(name: string): void;

  /**
   * Hides the dock that holds one of the part's view tabs, as the shell's
   * `desktop.toggleLeftDock`, `desktop.toggleRightDock` and
   * `desktop.toggleBottomDock` hide it: the dock keeps its tabs, so
   * {@link showView}, {@link openView} or the person shows the view again
   * where it was. A focus inside the dock moves to its strip, as when the
   * person hides it. The person may have moved the tab to any dock. Nothing
   * happens when the tab is not open, is outside a dock, such as among the
   * documents, or its dock is already hidden.
   *
   * @param name The view's name.
   * @param instance Which instance's tab, for a view with instances; left
   * out for a view without instances.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view, the instance is left out for a view with
   * instances or given for one without, or the instance is blank.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function hideTerminal(context: IWindowPartContext, id: string): void {
   *   context.hideViewDock("terminal.session", id);
   * }
   * ```
   */
  hideViewDock(name: string, instance?: string): void;

  /**
   * Grows the dock that holds one of the part's view tabs so the tab's
   * content shows at least a length, in rem, along the dock's axis: its
   * height in the bottom dock, its width in a side dock. The dock grows
   * once, when the tab's content first shows in a dock shorter than that, by
   * what it lacks and no further than the window allows; a content already
   * long enough grows nothing, and a later resize by the person stands.
   * Nothing grows while the tab is outside a dock, such as among the
   * documents. The tab may open after the call, as when the part opens it
   * next. A new call for the same tab takes the place of the one before.
   *
   * @param name The view's name.
   * @param minimum The length in rem the tab's content shows at least, above
   * 0.
   * @param instance Which instance's tab, for a view with instances; left
   * out for a view without instances.
   * @returns A function that ends the ask and puts the dock's earlier size
   * back, unless the person or another ask resized the dock since; it does
   * nothing once a later call for the same tab took the ask's place, or the
   * second time.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view, the instance is left out for a view with
   * instances or given for one without, the instance is blank, or the
   * minimum is not a finite number above 0.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function showTall(context: IWindowPartContext, id: string): () => void {
   *   context.openView("terminal.session", id, "Sign in");
   *   return context.growViewDock("terminal.session", 20, id);
   * }
   * ```
   */
  growViewDock(name: string, minimum: number, instance?: string): () => void;

  /**
   * Reads which dock holds one of the part's view tabs, such as to know
   * whether {@link growViewDock} grows the tab's height or its width. The
   * signal holds {@link DockSide.Bottom} while the tab is in the bottom dock,
   * {@link DockSide.Left} or {@link DockSide.Right} while it is in a side
   * dock, and `null` while it is outside a dock, such as among the documents,
   * or not open, as before the part opens it or after it closes. It follows
   * the tab as the person or the part moves, opens or closes it; a hidden
   * dock still holds its tabs, so its side stays. Once the part deactivates,
   * a new call reads `null`.
   *
   * @param name The view's name.
   * @param instance Which instance's tab, for a view with instances; left
   * out for a view without instances.
   * @returns A signal of the dock's side, or of `null` while no dock holds
   * the tab.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view, the instance is left out for a view with
   * instances or given for one without, or the instance is blank.
   * @example
   * ```ts
   * import { type Signal, computed } from "@angular/core";
   * import { DockSide, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function growsHeight(context: IWindowPartContext, id: string): Signal<boolean> {
   *   const dock = context.viewDockOf("terminal.session", id);
   *   return computed(() => dock() === DockSide.Bottom);
   * }
   * ```
   */
  viewDockOf(name: string, instance?: string): Signal<DockSide | null>;

  /**
   * Listens for the person closing an instance's tab, such as to end its
   * terminal. It hears only the person's close: never the part's own
   * {@link closeView}, the saved tabs closed at the end of activation, the
   * part deactivating or the window going away. The part's deactivation
   * removes the listener; an error it throws is reported and the other
   * listeners still hear. A close the person makes while no listener of
   * the view is registered, such as while the part is inactive or
   * reactivating, waits: the part's next activation leaves that tab closed
   * even when it reopens the instance with {@link openView}, and the view's
   * listeners hear the close when that activation ends.
   *
   * @param name The view's name.
   * @param listener Called with the instance whose tab closed.
   * @returns A function that removes the listener.
   * @throws Error synchronously when the view belongs to another module or
   * is not a registered view with instances.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function endClosedTerminals(context: IWindowPartContext, end: (id: string) => void): () => void {
   *   return context.onViewClosed("terminal.session", end);
   * }
   * ```
   */
  onViewClosed(name: string, listener: (instance: string) => void): () => void;

  /**
   * Shows a view or document in a large modal dialog. One already open in a
   * tab moves into the dialog and returns when it closes.
   *
   * @param name The view's or document's name, the module's, a
   * dependency's or the shell's.
   * @param options The document's instance and the dialog's title.
   * @returns A promise that settles when the dialog closes; it rejects when
   * the name belongs to another module, another dialog is open, the runtime
   * is starting again, or no such view or document is registered.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function showNote(context: IWindowPartContext, note: string): Promise<void> {
   *   return context.showInDialogAsync("notes.note", { instance: note, title: "Note" });
   * }
   * ```
   */
  showInDialogAsync(name: string, options?: IViewDialogOptions): Promise<void>;

  /**
   * Opens a palette just under the window row, centred across the window, as
   * the command search opens: the part's component, created with its
   * {@link WindowPartTokens}, with `shown` true and a content padding of its
   * own. The window shows one palette at a time.
   *
   * @param load Loads the palette's component.
   * @returns The palette, or null when the window shows no window row,
   * another palette, the command search's included, is open, or the part was
   * withdrawn while the component loaded, in which case it is never created.
   * @throws Error asynchronously, rejecting the promise, with what `load`
   * rejects with, or with what the component throws as it is created; no
   * palette is left open.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function findAsync(context: IWindowPartContext): Promise<boolean> {
   *   const palette = await context.openBelowWindowRowAsync(() => import("./find.component.js").then(t => t.FindComponent));
   *   await palette?.closed;
   *   return palette !== null;
   * }
   * ```
   */
  openBelowWindowRowAsync<T>(load: () => Promise<Type<T>>): Promise<IWindowPalette<T> | null>;

  /**
   * Writes a message to the main process's log under the module's id. The
   * message holds no secrets and no unnecessary personal or project data.
   *
   * @param message The message.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function logSkipped(context: IWindowPartContext, count: number): void {
   *   context.log(`Skipped ${count} notes that could not be read.`);
   * }
   * ```
   */
  log(message: string): void;

  /**
   * Opens a link the one way every module does. An http or https link opens
   * in the in-app browser a part registered with
   * {@link IWindowPartContext.registerInAppBrowser} when the options' place
   * says so or, with no place, where that browser places it by the options'
   * gesture; otherwise, and when the in-app browser fails, it opens in the
   * system's own application, such as the person's browser, as does every
   * other link, such as a new message in their mail app. The system opens
   * only well-formed http, https and mailto links without credentials, and
   * Noldova Desktop Sample never asks first. The in-app browser gets a link only
   * when it passes the same check, and in its normalized form, so a link with
   * credentials, over 32768 characters or that does not parse goes to the
   * system, which refuses it. A click on a link in the window's
   * content opens it the same way, with the click's gesture, unless the part
   * handled the click itself.
   *
   * @param url The link to open.
   * @param options How the person opened it, or where it opens.
   * @returns A promise that settles once the in-app browser or the system has
   * taken the link; it rejects when Noldova Desktop Sample refuses the link or
   * the system cannot open it. After the part is withdrawn, it settles at
   * once without checking the link and opens nothing.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { LinkOpenEvent } from "@noldova/ui.components.angular";
   *
   * export function openLink(context: IWindowPartContext, opened: LinkOpenEvent): Promise<void> {
   *   return context.openLinkAsync(opened.url, { gesture: opened.gesture });
   * }
   * ```
   */
  openLinkAsync(url: string, options?: ILinkOpenOptions): Promise<void>;

  /**
   * Shows a web link's menu at the pointer, which offers to open the link in
   * the app, while a part is the in-app browser, and in the person's
   * browser, and cancels the event's default. It shows nothing for a link that
   * isn't http or https, and leaves that event's default alone. A right-click
   * on a link in the window's content shows it the same way, unless the part
   * handled the event itself.
   *
   * @param url The link the person asked the menu of.
   * @param event The right-click, which places the menu.
   * After the part is withdrawn, it shows nothing.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   * import type { LinkMenuEvent } from "@noldova/ui.components.angular";
   *
   * export function showLinkMenu(context: IWindowPartContext, asked: LinkMenuEvent): void {
   *   context.showLinkMenu(asked.url, asked.event);
   * }
   * ```
   */
  showLinkMenu(url: string, event: MouseEvent): void;

  /**
   * Makes the part the in-app browser, which then opens the http and https
   * links every module opens with {@link IWindowPartContext.openLinkAsync},
   * wherever it places them. One part at a time is the in-app browser; until
   * it registers, and once it unregisters or is withdrawn, every link opens
   * in the system's browser.
   *
   * @param browser Where links open, and how to open one in the app.
   * @returns A function that unregisters the browser.
   * @throws InAppBrowserTakenException when another part is already the in-app
   * browser. After the part is withdrawn, it registers nothing and returns a
   * function that does nothing.
   * @example
   * ```ts
   * import { LinkGesture, LinkPlace, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function registerBrowser(context: IWindowPartContext, openPageAsync: (url: string) => Promise<void>): () => void {
   *   return context.registerInAppBrowser({
   *     placeFor: (_url, gesture) => gesture === LinkGesture.Plain ? LinkPlace.InApp : LinkPlace.System,
   *     openAsync: openPageAsync
   *   });
   * }
   * ```
   */
  registerInAppBrowser(browser: IInAppBrowser): () => void;

  /**
   * Shows a file or a folder, selected in its parent folder, in the system's
   * file manager: File Explorer on Windows, the Finder on macOS, and the file
   * manager on Linux. It never opens or runs the file, never opens the folder
   * itself, and never asks first.
   *
   * The main process shows only an absolute path to an existing regular file
   * or folder, checked when the request arrives, or a link to one. It refuses
   * a missing or relative path, and on Windows any path that isn't on a drive,
   * such as a network or device path, before looking at it. It follows each
   * link in the path in turn, reading the link without looking at where it
   * leads, and refuses a path with a link to a network or device path before
   * looking at that path. On Windows a `..` drops the part before it by its
   * text first, as Windows does. The file manager is given the path the links
   * reach, with no link left in it, so it shows what was checked. A mapped
   * drive and a network mount on macOS and Linux can still reach another
   * machine. The check and the showing are two steps, so a file replaced
   * between them is shown as it is then. The part decides which files it
   * shows, such as the ones it saved itself.
   *
   * @param path The file's or folder's absolute path.
   * @returns A promise that settles once the request is handed to the system's
   * file manager; it rejects with a {@link FileNotShownException}, whose
   * `reason` says why, when the path is refused. After the part is withdrawn,
   * it settles at once without checking the path and shows nothing.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function showAttachment(context: IWindowPartContext, savedPath: string): Promise<void> {
   *   return context.showInFolderAsync(savedPath);
   * }
   * ```
   */
  showInFolderAsync(path: string): Promise<void>;

  /**
   * Opens a document or text file in the system's default app for its kind,
   * and never asks first. It never opens a program or a script.
   *
   * The main process checks the path as {@link showInFolderAsync} does, but
   * refuses a folder, and then the file's kind, by its name and by the name of
   * the file the path leads to: only a PDF (`.pdf`), an office or OpenDocument
   * file without macros (`.docx`, `.xlsx`, `.pptx`, `.rtf`, `.odt`, `.ods`,
   * `.odp`) and a plain text or data file (`.txt`, `.md`, `.markdown`, `.csv`,
   * `.tsv`, `.json`, `.log`, `.yaml`, `.yml`, `.xml`, `.toml`) open, case aside.
   * Every other file is refused, and on macOS and Linux so is a file marked
   * executable, whatever its name. Once its links are followed, the path the file
   * is at, with its drive followed too, is checked again, so on Windows a mapped
   * drive that leads to a network path is refused; a network mount on macOS and
   * Linux can still reach another machine. The default app is given that
   * checked path, not the path as the part gave it. The check and the opening
   * are two steps, so a file replaced between them is opened as it is then. A
   * part shows a refused file in its folder with {@link showInFolderAsync}
   * instead.
   *
   * @param path The file's absolute path.
   * @returns A promise that settles once the system has taken the file; it
   * rejects with a {@link FileNotOpenedException}, whose `reason` says why,
   * when the file is refused or the system cannot open it. After the part is
   * withdrawn, it settles at once without checking the path and opens nothing.
   * @example
   * ```ts
   * import { FileNotOpenedException, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function openReportAsync(context: IWindowPartContext, path: string): Promise<void> {
   *   try {
   *     await context.openFileAsync(path);
   *   }
   *   catch (error) {
   *     if (!(error instanceof FileNotOpenedException))
   *       throw error;
   *     await context.showInFolderAsync(path);
   *   }
   * }
   * ```
   */
  openFileAsync(path: string): Promise<void>;

  /**
   * Asks the person to choose a folder, with the system's own folder chooser
   * attached to this window. The part gets the folder's path; it gets no other
   * access to the folder, which its runtime part reaches by that path.
   *
   * @returns A promise of the chosen folder's absolute path, or null when the
   * person cancels, the window closes while the chooser is open or the window
   * already shows a file or folder chooser or a save dialog. After the part is
   * withdrawn, it answers null at once without showing the chooser.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function openProjectAsync(context: IWindowPartContext): Promise<void> {
   *   const folder = await context.chooseFolderAsync();
   *   if (folder !== null)
   *     await context.requestAsync("notes.openFolder", { folder });
   * }
   * ```
   */
  chooseFolderAsync(): Promise<string | null>;

  /**
   * Asks the person to choose one file, with the system's own file chooser
   * attached to this window. The part gets the file's path; it gets no other
   * access to the file, which its runtime part reaches by that path.
   *
   * @param options The extensions the person may pick and the folder the
   * chooser starts in; any file, from where the system starts, by default.
   * @returns A promise of the chosen file's absolute path, or null when the
   * person cancels, the window closes while the chooser is open, the window
   * already shows a file or folder chooser or a save dialog. After the part
   * is withdrawn, it answers null at once without showing the chooser.
   * @throws {ArgumentException} Rejected when the extensions are not 1 to 32
   * extensions of 1 to 16 letters and digits each, or the folder is not an
   * absolute path on the window's platform or holds a control character.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function chooseProgramAsync(context: IWindowPartContext): Promise<void> {
   *   const program = await context.chooseFilePathAsync({ extensions: ["exe", "cmd"] });
   *   if (program !== null)
   *     await context.requestAsync("tools.useProgram", { program });
   * }
   * ```
   */
  chooseFilePathAsync(options?: IFilePathChoiceOptions): Promise<string | null>;

  /**
   * Saves bytes to a file the person chooses, with the system's own save
   * dialog attached to this window, starting in the system's Downloads folder
   * with the name suggested, or where the system last was when that folder is
   * not found; the part never learns the chosen path.
   *
   * @param name The suggested file name, a plain name without a folder, such
   * as `photo.png`, that every system can hold: no reserved Windows name such
   * as `CON`, no `\ / : * ? " < > |`, control or direction characters, no
   * dot or space at its end and at most 255 bytes in UTF-8.
   * @param bytes The file's contents, at most 512 MiB.
   * @returns A promise of what became of the file: saved, cancelled when the
   * person cancels or the window closes while the dialog is open, or failed
   * when the name or bytes are refused, the window already shows a file or
   * folder chooser or a save dialog, or the file cannot be written; a failed write
   * leaves an existing file as it was. After the part is withdrawn, it
   * answers cancelled at once without checking the name or bytes or showing
   * the dialog.
   * @example
   * ```ts
   * import { FileSaveOutcome, type IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function saveImageAsync(context: IWindowPartContext, bytes: Uint8Array): Promise<boolean> {
   *   return await context.saveFileAsync("photo.png", bytes) === FileSaveOutcome.Saved;
   * }
   * ```
   */
  saveFileAsync(name: string, bytes: Uint8Array): Promise<FileSaveOutcome>;

  /**
   * Lets the person pick files for the module with the system's own file
   * chooser attached to this window, and grants each picked regular file to
   * the module's runtime part for this page of the window. The part gets each
   * file's grant, name, media type and size, never its path; it passes a
   * grant to its runtime part, which should redeem it at once, when the
   * request arrives, and copy the file into its own store: a grant is used
   * once, and it ends when its lifetime runs out, when the part discards it
   * or is withdrawn, and when the window's page reloads or closes.
   *
   * @param options How long the grants live, ten minutes by default and at
   * most, and whether the person may pick more than one file.
   * @returns A promise of the granted files and, for each picked file that
   * isn't granted, such as a folder, a pipe or a device, a sentence naming it
   * and why. It answers none when the person cancels, the window closes while
   * the chooser is open, the window already shows a file or folder chooser or
   * a save dialog, or the page sending it is not the window's current page.
   * After the part is withdrawn, it answers none at once without showing the
   * chooser.
   * @throws {ArgumentOutOfRangeException} Rejected when the lifetime is not a
   * whole number of milliseconds from 1 to 600 000.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function attachAsync(context: IWindowPartContext): Promise<void> {
   *   const chosen = await context.chooseFilesAsync({ multiple: true });
   *   if (chosen.files.length > 0)
   *     await context.requestAsync("notes.attach", { grants: chosen.files.map(t => t.grant) });
   * }
   * ```
   */
  chooseFilesAsync(options?: IFileChoiceOptions): Promise<IssuedFileGrants>;

  /**
   * Grants files the person dropped or pasted on the module's pane to the
   * module's runtime part for this page of the window, as
   * {@link IWindowPartContext.chooseFilesAsync} grants picked ones. A file
   * with a path on disk, such as one dropped from the system's file manager,
   * is granted by that path, which the part never learns, and on Windows only
   * when it is on a drive, never a network or device path; a pasted file
   * without one, such as an image copied from a page, is staged by the main
   * process, at most 64 MiB in one call and 256 MiB staged in all, and its
   * copy is deleted when the grant ends.
   *
   * @param files The files of the drop's or paste's `DataTransfer`, at most
   * 256.
   * @param options How long the grants live, ten minutes by default and at
   * most.
   * @returns A promise of the granted files and, for each file that isn't
   * granted, a sentence naming it and why. It answers none for no files, a
   * page that is not the window's current page, and after the part is
   * withdrawn.
   * @throws {ArgumentOutOfRangeException} Rejected when the lifetime is not a
   * whole number of milliseconds from 1 to 600 000, or there are more than 256
   * files.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function dropAsync(context: IWindowPartContext, event: DragEvent): Promise<void> {
   *   event.preventDefault();
   *   const granted = await context.grantFilesAsync(Array.from(event.dataTransfer?.files ?? []));
   *   if (granted.files.length > 0)
   *     await context.requestAsync("notes.attach", { grants: granted.files.map(t => t.grant) });
   * }
   * ```
   */
  grantFilesAsync(files: readonly File[], options?: IFileGrantOptions): Promise<IssuedFileGrants>;

  /**
   * Ends grants the part holds and no longer needs, such as those of files
   * the person removed before the part sent them on. A grant the part does not
   * hold, or already discarded, is skipped; a redeemed grant has already ended.
   *
   * @param grants The grants to end.
   * @example
   * ```ts
   * import type { IssuedFileGrants, IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function cancel(context: IWindowPartContext, chosen: IssuedFileGrants): void {
   *   context.discardFileGrants(chosen.files.map(t => t.grant));
   * }
   * ```
   */
  discardFileGrants(grants: readonly string[]): void;

  /**
   * Turns the grant of a file the part's runtime part shared, with
   * `IRuntimeFiles.shareAsync`, into its address on the main process's own
   * scheme, `desktop-file://<grant>/`, which the page loads like any image
   * address, with no bytes passing as text. The part then holds the share as
   * it holds a grant: `discardFileGrants` ends it, and so does withdrawing the
   * part; a withdrawn part's share ends at once. The page's reload, the
   * window's close and the share's lifetime end it too. The main process serves
   * PNG, JPEG, GIF and WebP images as themselves and anything else as
   * `application/octet-stream`, never as a document.
   *
   * @param grant The share's grant, as the runtime part answered it.
   * @returns The address.
   * @throws ArgumentException synchronously when the grant is not 32
   * lowercase hexadecimal digits.
   * @example
   * ```ts
   * import { JsonReader } from "@noldova/context.json";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function showAsync(context: IWindowPartContext, image: HTMLImageElement): Promise<void> {
   *   const grant = JsonReader.fromValue(await context.requestAsync("notes.photo", null)).readString("grant");
   *   image.src = context.fileAddressOf(grant);
   * }
   * ```
   */
  fileAddressOf(grant: string): string;

  /**
   * Calls a method of the module's runtime part or a dependency's.
   *
   * @param method The method's name.
   * @param parameters The parameters.
   * @returns A promise of the method's result; it rejects when the method
   * belongs to neither the module nor a dependency, and with a
   * {@link RuntimeRequestException}, whose `code` and `details` say why, when
   * the runtime refuses or fails the request.
   * @example
   * ```ts
   * import type { JsonValue } from "@noldova/context.json";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function listNotes(context: IWindowPartContext): Promise<JsonValue> {
   *   return context.requestAsync("notes.list", { limit: 50 });
   * }
   * ```
   */
  requestAsync(method: string, parameters: JsonValue): Promise<JsonValue>;

  /**
   * Listens to an event of the module's runtime part or a dependency's.
   *
   * @param event The event's name.
   * @param listener Called with each payload of the event.
   * @returns A function that stops listening; deactivation stops it too.
   * @throws Error synchronously when the event belongs to neither the module
   * nor a dependency.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function followChanges(context: IWindowPartContext, refresh: () => void): () => void {
   *   return context.onEvent("notes.changed", () => refresh());
   * }
   * ```
   */
  onEvent(event: string, listener: (payload: JsonValue) => void): () => void;

  /**
   * Reads the application's value in effect of a setting of the module, a
   * dependency or the shell. `readSettingAsync` reads it for a scope object.
   *
   * @param name The setting's name.
   * @returns The value, or undefined while the window has not loaded the
   * settings or no such setting exists.
   * @throws Error synchronously when the setting belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function readsWrapped(context: IWindowPartContext): boolean {
   *   return context.readSetting("notes.wrapLines") === true;
   * }
   * ```
   */
  readSetting(name: string): JsonValue | undefined;

  /**
   * Asks the runtime for the value in effect of a setting of the module, a
   * dependency or the shell at a scope object: the value set for the
   * object, else for each enclosing object, else for the application, else
   * the default. A change at an enclosing scope or the application reaches
   * `onSettingChanged` with that scope, not with the object's, so a part
   * that shows the object reads it again.
   *
   * @param name The setting's name.
   * @param scope The scope object; the application when left out or null.
   * @returns A promise of the setting's name, the value in effect and
   * whether a value is stored for the object itself; it rejects when the
   * setting belongs to another module that is not a dependency, or the
   * runtime refuses the request, such as for a scope the setting does not
   * list.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export async function isWrappedInProject(context: IWindowPartContext, project: string): Promise<boolean> {
   *   const entry = await context.readSettingAsync("notes.wrapLines", new SettingScope(QualifiedName.parse("notes.project"), project));
   *   return entry.value === true;
   * }
   * ```
   */
  readSettingAsync(name: string, scope?: SettingScope | null): Promise<SettingEntry>;

  /**
   * Changes a setting of the module. A value equal to the setting's default
   * resets it when it would otherwise take its default.
   *
   * @param name The setting's name.
   * @param value The value, which the setting's type accepts.
   * @param scope The setting scope to set it in; the application scope when
   * left out or null.
   * @returns A promise that settles once the runtime has stored it; it
   * rejects when the setting belongs to another module or the runtime
   * refuses the value.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function wrapLines(context: IWindowPartContext, isWrapped: boolean): Promise<void> {
   *   return context.writeSettingAsync("notes.wrapLines", isWrapped);
   * }
   * ```
   */
  writeSettingAsync(name: string, value: JsonValue, scope?: SettingScope | null): Promise<void>;

  /**
   * Removes the stored value of a setting of the module, so it follows its
   * enclosing scopes and its default again.
   *
   * @param name The setting's name.
   * @param scope The setting scope to reset it in; the application scope
   * when left out or null.
   * @returns A promise that settles once the runtime has removed it; it
   * rejects when the setting belongs to another module or the runtime
   * refuses the request.
   * @example
   * ```ts
   * import { QualifiedName, SettingScope } from "@noldova/desktop.protocol";
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function resetForProject(context: IWindowPartContext, project: string): Promise<void> {
   *   return context.resetSettingAsync("notes.wrapLines", new SettingScope(QualifiedName.parse("notes.project"), project));
   * }
   * ```
   */
  resetSettingAsync(name: string, scope?: SettingScope | null): Promise<void>;

  /**
   * Listens to changes of a setting of the module, a dependency or the
   * shell, in any scope.
   *
   * @param name The setting's name.
   * @param listener Called with the value now in effect, the scope it
   * changed in, null for the application scope, and whether a value is
   * stored for that scope, false after a reset.
   * @returns A function that stops listening; deactivation stops it too.
   * @throws Error synchronously when the setting belongs to another module.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function followWrapping(context: IWindowPartContext, apply: (isWrapped: boolean) => void): () => void {
   *   return context.onSettingChanged("notes.wrapLines", (value, scope) => {
   *     if (scope === null)
   *       apply(value === true);
   *   });
   * }
   * ```
   */
  onSettingChanged(name: string, listener: (value: JsonValue, scope: SettingScope | null, isSet: boolean) => void): () => void;

  /**
   * Says whether a module the module optionally depends on is active in the
   * window now: active in the runtime and, when it has a window part, with
   * that part activated. A dependency's state is settled before the part
   * activates, so the part reads it here and follows its later changes with
   * {@link IWindowPartContext.onDependencyChanged}; in that listener, it
   * answers the state the listener was just given.
   *
   * @param moduleId The optional dependency's id.
   * @returns Whether that module is active in the window; false for a module
   * that isn't one of the module's optional dependencies, and once the part
   * deactivated.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function showsClock(context: IWindowPartContext): boolean {
   *   return context.isDependencyActive("clock");
   * }
   * ```
   */
  isDependencyActive(moduleId: string): boolean;

  /**
   * Listens for a module the module optionally depends on turning on or off
   * while the part stays active, such as across a restart of the runtime. The
   * part reaches an optional dependency's methods, events, commands and
   * settings like a required one's, and they fail while it is not active; it
   * reads the state at activation with
   * {@link IWindowPartContext.isDependencyActive}.
   *
   * @param listener Called with the optional dependency's id and whether it
   * is now active in the window: active in the runtime and, when it has a
   * window part, with that part activated; the window reports an error it
   * throws.
   * @returns A function that stops listening; deactivation stops it too.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function followClock(context: IWindowPartContext, show: (isShown: boolean) => void): () => void {
   *   show(context.isDependencyActive("clock"));
   *   return context.onDependencyChanged((moduleId, isActive) => {
   *     if (moduleId === "clock")
   *       show(isActive);
   *   });
   * }
   * ```
   */
  onDependencyChanged(listener: (moduleId: string, isActive: boolean) => void): () => void;
}

/**
 * A window part's secrets, as {@link IWindowPartContext.secrets} gives them:
 * a sign-in field saves a token the module's runtime part reads. Every call
 * goes to the runtime, which refuses it as `Unavailable` until the app's main
 * process has connected, and a value never comes back to the window.
 */
export interface IWindowSecrets {
  /**
   * Saves a value under one of the module's own names, replacing any value
   * saved there.
   *
   * @param name The name, `<module>.<member>`.
   * @param value The value, from 1 to 16,384 characters, with no lone surrogate.
   * @returns A promise that rejects with `WindowPartAccessException` when the
   * name is another module's, `ArgumentException` when the name or value is
   * not valid, and the runtime's failure when this machine has no keyring to
   * protect the value; nothing is saved then.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function signIn(context: IWindowPartContext, token: string): Promise<void> {
   *   return context.secrets.saveAsync("notes.syncToken", token);
   * }
   * ```
   */
  saveAsync(name: string, value: string): Promise<void>;

  /**
   * Removes the value saved under one of the module's own names, if any.
   *
   * @param name The name, `<module>.<member>`.
   * @returns A promise that rejects with `WindowPartAccessException` when the
   * name is another module's, and `ArgumentException` when it is not valid.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function signOut(context: IWindowPartContext): Promise<void> {
   *   return context.secrets.removeAsync("notes.syncToken");
   * }
   * ```
   */
  removeAsync(name: string): Promise<void>;

  /**
   * Says whether a value is saved under one of the module's own names on this
   * machine, without reading it.
   *
   * @param name The name, `<module>.<member>`.
   * @returns A promise of whether a value is saved; it rejects with
   * `WindowPartAccessException` when the name is another module's, and
   * `ArgumentException` when it is not valid.
   * @example
   * ```ts
   * import type { IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function isSignedIn(context: IWindowPartContext): Promise<boolean> {
   *   return context.secrets.isSetAsync("notes.syncToken");
   * }
   * ```
   */
  isSetAsync(name: string): Promise<boolean>;
}

/**
 * A window part's web views, as {@link IWindowPartContext.webViews} gives
 * them.
 */
export interface IWindowWebViews {
  /**
   * Opens a web view for one of the module's open views or documents, on the
   * module's own profile with that key. A pane holds up to 32 views, of which
   * one shows at a time; the module declares what its views' debugging calls
   * may do in `webViews.json`.
   *
   * @param pane The view or document, which the module owns and which is open.
   * @param profileKey The profile's key: a lowercase letter or digit followed
   * by up to 63 lowercase letters, digits and hyphens.
   * @returns A promise of the view's handle, hidden until the part shows it;
   * it rejects when the pane belongs to another module, isn't declared or
   * isn't open, the module declares no `webViews.json`, the pane holds as
   * many views as it may, or the key isn't valid.
   * @example
   * ```ts
   * import { QualifiedName, WebViewPane } from "@noldova/desktop.protocol";
   * import type { IWebViewHandle, IWindowPartContext } from "@noldova/desktop.window";
   *
   * export function openPage(context: IWindowPartContext): Promise<IWebViewHandle> {
   *   return context.webViews.openAsync(new WebViewPane(QualifiedName.parse("browser.page"), "tab-1"), "workspace-1");
   * }
   * ```
   */
  openAsync(pane: WebViewPane, profileKey: string): Promise<IWebViewHandle>;
}

/**
 * A command a window part registers: a named action with a title, an
 * optional icon and default key, and its handler.
 */
export declare class CommandContribution {
  /**
   * The command's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The title that menus, command search and Keyboard shortcuts show.
   */
  public readonly title: string;

  /**
   * The glyph shown beside the title, or null when it has none.
   */
  public readonly icon: string | null;

  /**
   * The key that runs it unless the person binds another, or null when it
   * has none.
   */
  public readonly defaultKey: KeyChord | null;

  /**
   * Runs the command with its arguments and resolves to its result.
   */
  public readonly runAsync: (commandArguments: JsonValue) => Promise<JsonValue>;

  /**
   * Tells whether the command is enabled for given arguments.
   */
  public readonly isEnabled: (commandArguments: JsonValue) => boolean;

  /**
   * Tells whether the command is checked for given arguments, or null when
   * it is never checked, so menus show no checkbox for it.
   */
  public readonly isChecked: ((commandArguments: JsonValue) => boolean) | null;

  /**
   * Tells whether the command applies to given arguments; a menu row whose
   * command does not apply is left out.
   */
  public readonly isApplicable: (commandArguments: JsonValue) => boolean;

  /**
   * Creates the command.
   *
   * @param name The command's name, `<module id>.<name>`.
   * @param title The title, not blank.
   * @param icon The glyph, not blank, or null.
   * @param defaultKey The default key, such as `Mod+Alt+N`, with Mod, Ctrl
   * or Alt or as a function key, and not one editing or the operating
   * system owns; or null.
   * @param runAsync Runs the command with its arguments, null when run
   * without, and resolves to its result.
   * @param isEnabled Whether it is enabled for given arguments; always when
   * left out.
   * @param isChecked Whether it is checked for given arguments; never
   * checked when left out or null.
   * @param isApplicable Whether it applies to given arguments; always when
   * left out.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`, the title or icon is blank, or the default key is
   * not a valid default key.
   * @example
   * ```ts
   * import { CommandContribution } from "@noldova/desktop.window";
   *
   * let isWrapped: boolean = false;
   *
   * export const wrap: CommandContribution = new CommandContribution("notes.toggleWrap", "Wrap lines", "wrap", "Mod+Alt+W",
   *   () => {
   *     isWrapped = !isWrapped;
   *     return Promise.resolve(isWrapped);
   *   },
   *   () => true,
   *   () => isWrapped,
   *   commandArguments => commandArguments === null);
   * ```
   * @example
   * ```ts
   * import { CommandContribution } from "@noldova/desktop.window";
   *
   * export const refresh: CommandContribution = new CommandContribution("notes.refresh", "Refresh notes", null, null, () => Promise.resolve(null));
   * ```
   */
  public constructor(
    name: string,
    title: string,
    icon: string | null,
    defaultKey: string | null,
    runAsync: (commandArguments: JsonValue) => Promise<JsonValue>,
    isEnabled?: (commandArguments: JsonValue) => boolean,
    isChecked?: ((commandArguments: JsonValue) => boolean) | null,
    isApplicable?: (commandArguments: JsonValue) => boolean);
}

/**
 * The padding choice of the page a tab shows, which the page's component
 * injects with {@link WindowPartTokens.contentPadding} to override its
 * declaration and its module for as long as it is shown.
 */
export declare class ContentPaddingRef {
  /**
   * The page's own choice, or null while it leaves the padding to its
   * declaration and its module.
   */
  public readonly value: Signal<ContentPadding | null>;

  /**
   * Sets the page's padding until it is set again or reset.
   *
   * @param padding The padding the page wants.
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { ContentPadding, WindowPartTokens } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-terminal-page", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPageComponent {
   *   public constructor() {
   *     inject(WindowPartTokens.contentPadding).set(ContentPadding.None);
   *   }
   * }
   * ```
   */
  public set(padding: ContentPadding): void;

  /**
   * Drops the page's choice, so its declaration and its module decide again.
   *
   * @example
   * ```ts
   * import { Component, inject } from "@angular/core";
   * import { ContentPadding, type ContentPaddingRef, WindowPartTokens } from "@noldova/desktop.window";
   *
   * @Component({
   *   selector: "nol-notes-preview",
   *   template: "<button type=\"button\" (click)=\"showFullWidth()\">Full width</button><button type=\"button\" (click)=\"showDefault()\">Default</button>"
   * })
   * export class NotesPreviewComponent {
   *   private readonly padding: ContentPaddingRef = inject(WindowPartTokens.contentPadding);
   *
   *   protected showFullWidth(): void {
   *     this.padding.set(ContentPadding.None);
   *   }
   *
   *   protected showDefault(): void {
   *     this.padding.reset();
   *   }
   * }
   * ```
   */
  public reset(): void;
}

/**
 * A document a window part registers: its name and the component its tabs
 * show.
 */
export declare class DocumentContribution {
  /**
   * The document's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * Loads the component the document's tabs show.
   */
  public readonly loadComponent: () => Promise<Type<unknown>>;

  /**
   * The padding the document declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * The menu place whose rows show as icon buttons in the tab row of every
   * group that holds one of the document's tabs, as
   * {@link IDocumentContributionOptions.tabRowPlace} describes it, or null.
   */
  public readonly tabRowPlace: string | null;

  /**
   * Whether a person can rename the document's tabs in place, as
   * {@link IDocumentContributionOptions.isRenamable} describes it.
   */
  public readonly isRenamable: boolean;

  /**
   * Creates the document's contribution.
   *
   * @param name The document's name, `<module id>.<name>`.
   * @param loadComponent Loads the component the document shows, which a
   * part loads lazily so activation stays light.
   * @param padding The padding of its page; left out, its module decides.
   * @param options What the document declares besides its component and
   * padding; nothing when left out.
   * @throws ArgumentException synchronously when the name, or the
   * options' tab-row place, is not `<module id>.<name>`.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ContentPadding, DocumentContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-editor-file", template: "<div class=\"code\"></div>" })
   * export class FileEditorComponent {
   * }
   *
   * export const editor: DocumentContribution = new DocumentContribution("editor.file", () => Promise.resolve(FileEditorComponent), ContentPadding.None);
   * ```
   */
  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>, padding?: ContentPadding, options?: IDocumentContributionOptions);
}

/**
 * A search source's answer to a query: the matches it lists and how many it
 * found.
 */
export declare class SearchAnswer {
  /**
   * The matches the source lists, the best first.
   */
  public readonly results: readonly SearchResult[];

  /**
   * How many matches the source found, which may be more than it lists.
   */
  public readonly total: number;

  /**
   * Creates a source's answer to a query.
   *
   * @param results The matches the source lists, the best first.
   * @param total How many matches it found; left out, as many as it lists.
   * @throws ArgumentOutOfRangeException synchronously when the total is not a
   * whole number or is fewer than the results.
   * @example
   * ```ts
   * import { SearchAnswer, type SearchResult } from "@noldova/desktop.window";
   *
   * export function answerOf(results: readonly SearchResult[], found: number): SearchAnswer {
   *   return new SearchAnswer(results.slice(0, 20), found);
   * }
   * ```
   */
  public constructor(results: readonly SearchResult[], total?: number);
}

/**
 * A row of the window's search: a result a source found, with the matched
 * ranges it marks and how to open it.
 */
export declare class SearchResult {
  /**
   * The result's id, unique within its source.
   */
  public readonly id: string;

  /**
   * The result's title.
   */
  public readonly title: string;

  /**
   * The muted text after the title, or empty.
   */
  public readonly detail: string;

  /**
   * Opens the result, which the search calls after it closes.
   */
  public readonly openAsync: () => Promise<void>;

  /**
   * The part of the title that matched the query, or null.
   */
  public readonly titleMatch: TextRange | null;

  /**
   * The part of the detail that matched the query, or null.
   */
  public readonly detailMatch: TextRange | null;

  /**
   * The key the row shows, such as `Ctrl+N`, or null.
   */
  public readonly keyLabel: string | null;

  /**
   * Creates a row of the search.
   *
   * @param id The result's id, unique within its source.
   * @param title The result's title.
   * @param detail The muted text after the title, or empty.
   * @param openAsync Opens the result.
   * @param titleMatch The part of the title that matched, or null.
   * @param detailMatch The part of the detail that matched, or null.
   * @param keyLabel The key the row shows, or null.
   * @throws ArgumentException synchronously when the id, the title or the key
   * label is empty or only white space.
   * @throws ArgumentOutOfRangeException synchronously when a matched range
   * runs past the end of its text.
   * @example
   * ```ts
   * import { SearchResult, TextRange } from "@noldova/desktop.window";
   *
   * export const result: SearchResult = new SearchResult("42", "Terminal tab freezes", "desktop", () => Promise.resolve(), new TextRange(0, 4));
   * ```
   */
  public constructor(id: string, title: string, detail: string, openAsync: () => Promise<void>, titleMatch?: TextRange | null, detailMatch?: TextRange | null,
    keyLabel?: string | null);
}

/**
 * A search source a window part registers: its names in the search, the
 * glyph of its rows, and the calls that give its recent items and matches.
 */
export declare class SearchSourceContribution {
  /**
   * The source's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The label of the source's filter, such as `Messages`.
   */
  public readonly label: string;

  /**
   * The source's name in the search field's placeholder, such as `messages`.
   */
  public readonly placeholderName: string;

  /**
   * The heading of the source's group while the person types, such as
   * `In messages`.
   */
  public readonly heading: string;

  /**
   * The heading of the source's group before the person types, such as
   * `Recent chats`, or null when the source has no recent items.
   */
  public readonly recentHeading: string | null;

  /**
   * The Material Symbols glyph the source's rows show.
   */
  public readonly icon: string;

  /**
   * Resolves to the source's recent items, the most recent first.
   */
  public readonly recentAsync: (signal: AbortSignal) => Promise<readonly SearchResult[]>;

  /**
   * Resolves to the source's matches for a trimmed query that never starts
   * with `>`.
   */
  public readonly searchAsync: (query: string, signal: AbortSignal) => Promise<SearchAnswer>;

  /**
   * Creates a search source.
   *
   * @param name The source's name, `<module id>.<name>`.
   * @param label The label of its filter.
   * @param placeholderName Its name in the field's placeholder.
   * @param heading Its group's heading while the person types.
   * @param recentHeading Its group's heading before the person types, or null.
   * @param icon The Material Symbols glyph its rows show.
   * @param recentAsync Resolves to its recent items; the signal aborts when
   * the palette closes.
   * @param searchAsync Resolves to its matches; the signal aborts when the
   * query changes or the palette closes.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`, or a label, a heading or the icon is empty or only
   * white space.
   * @example
   * ```ts
   * import { SearchAnswer, SearchSourceContribution } from "@noldova/desktop.window";
   *
   * export const notes: SearchSourceContribution = new SearchSourceContribution("notes.notes", "Notes", "notes", "Notes", "Recent notes", "description",
   *   () => Promise.resolve([]), () => Promise.resolve(new SearchAnswer([])));
   * ```
   */
  public constructor(name: string, label: string, placeholderName: string, heading: string, recentHeading: string | null, icon: string,
    recentAsync: (signal: AbortSignal) => Promise<readonly SearchResult[]>, searchAsync: (query: string, signal: AbortSignal) => Promise<SearchAnswer>);
}

/**
 * A range of characters in a text, such as the part of a title that matched
 * the query.
 */
export declare class TextRange {
  /**
   * The index of the range's first character.
   */
  public readonly start: number;

  /**
   * How many characters the range holds.
   */
  public readonly length: number;

  /**
   * The index just after the range's last character.
   */
  public get end(): number;

  /**
   * Creates a range of characters in a text.
   *
   * @param start The index of its first character, 0 or more.
   * @param length How many characters it holds, 1 or more.
   * @throws ArgumentOutOfRangeException synchronously when the start or the
   * length is not a whole number in range.
   * @example
   * ```ts
   * import { TextRange } from "@noldova/desktop.window";
   *
   * export const match: TextRange = new TextRange(4, 4);
   * ```
   */
  public constructor(start: number, length: number);
}

/**
 * A placeholder a window part registers: its name and the component the
 * documents area shows while no document is open.
 */
export declare class PlaceholderContribution {
  /**
   * The placeholder's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * Loads the component the placeholder shows.
   */
  public readonly loadComponent: () => Promise<Type<unknown>>;

  /**
   * The padding the placeholder declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * Creates the placeholder's contribution.
   *
   * @param name The placeholder's name, `<module id>.<name>`.
   * @param loadComponent Loads the component the placeholder shows, which a
   * part loads lazily so activation stays light.
   * @param padding The padding of its page; left out, its module decides.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { PlaceholderContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-chat-start", template: "<button type=\"button\">Start a chat</button>" })
   * export class ChatStartComponent {
   * }
   *
   * export const start: PlaceholderContribution = new PlaceholderContribution("chat.start", () => Promise.resolve(ChatStartComponent));
   * ```
   */
  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>, padding?: ContentPadding);
}

/**
 * A Settings page of a module's own, which shows the module's component in
 * Settings' content column under the page's title.
 */
export declare class SettingsPageContribution {
  /**
   * The page's name, `<module id>.<name>`, which the module's
   * `settings.json` gives with the page's title.
   */
  public readonly name: string;

  /**
   * Loads the component the page shows.
   */
  public readonly loadComponent: () => Promise<Type<unknown>>;

  /**
   * Creates the page's contribution.
   *
   * @param name The page's name, `<module id>.<name>`.
   * @param loadComponent Loads the component the page shows, which a part
   * loads lazily so activation stays light; the component injects
   * `WindowPartTokens.context` for its part's context, draws its own
   * sections, and is destroyed when the person leaves the page.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { SettingsPageContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-git-github-account", template: "<section class=\"nol-settings-group\"></section>" })
   * export class AccountComponent {
   * }
   *
   * export const account: SettingsPageContribution = new SettingsPageContribution("git-github.account", () => Promise.resolve(AccountComponent));
   * ```
   */
  public constructor(name: string, loadComponent: () => Promise<Type<unknown>>);
}

/**
 * A row a module's own Settings page draws, which it gives Settings search
 * with `IWindowPartContext.setSettingsRows`.
 */
export declare class SettingsRow {
  /**
   * The row's id, `<module id>.<name>`, unique on its page, which the row's
   * element carries as `data-setting`.
   */
  public readonly id: string;

  /**
   * The row's title, as the page shows it.
   */
  public readonly title: string;

  /**
   * The row's description, as the page shows it, or null.
   */
  public readonly description: string | null;

  /**
   * Creates a row.
   *
   * @param id The row's id, `<module id>.<name>`.
   * @param title The row's title, which is not blank.
   * @param description The row's description, if it has one.
   * @throws ArgumentException synchronously when the id is not
   * `<module id>.<name>` or the title is blank.
   * @example
   * ```ts
   * import { SettingsRow } from "@noldova/desktop.window";
   *
   * export const server: SettingsRow = new SettingsRow("notes.sync.server", "Sync server", "Where your notes sync to.");
   * ```
   */
  public constructor(id: string, title: string, description?: string | null);
}

/**
 * A row a window part supplies to one of its dynamic menu groups: a command
 * with its arguments, an optional label and an optional icon.
 */
export declare class MenuRowContribution {
  /**
   * The command the row runs, `<module id>.<name>`.
   */
  public readonly command: string;

  /**
   * The arguments, into which the menu's context object is merged, the
   * row's own fields winning.
   */
  public readonly commandArguments: JsonObject;

  /**
   * The row's label, or null to show the command's title.
   */
  public readonly label: string | null;

  /**
   * The row's icon, a Material Symbols name, or null to show the command's
   * icon. The row shows it wherever it shows its command's: in a menu, in a
   * submenu, as a button in a tab row or a toolbar, and in command search.
   */
  public readonly icon: string | null;

  /**
   * Creates the row.
   *
   * @param command The command, from the module or a dependency.
   * @param commandArguments The arguments; `{}` when left out.
   * @param label The label, not blank; the command's title when left out or
   * null.
   * @param icon The icon, a Material Symbols name, not blank; the command's
   * icon when left out or null.
   * @throws ArgumentException synchronously when the command is not
   * `<module id>.<name>`, or the label or the icon is blank.
   * @example
   * ```ts
   * import { MenuRowContribution } from "@noldova/desktop.window";
   *
   * export const row: MenuRowContribution = new MenuRowContribution("notes.open", { note: "n1" }, "Groceries", "shopping_cart");
   * ```
   */
  public constructor(command: string, commandArguments?: JsonObject, label?: string | null, icon?: string | null);
}

/**
 * The handle of a notification a window part posted, which dismisses it.
 */
export declare class NotificationHandle {
  /**
   * The notification's id, which no other notification has; empty for a post
   * a withdrawn context ignored.
   */
  public readonly id: string;

  /**
   * Creates the handle. The window creates it for each post; a test double
   * creates its own.
   *
   * @param id The notification's id.
   * @param remove Removes the notification.
   * @example
   * ```ts
   * import { NotificationHandle } from "@noldova/desktop.window";
   *
   * export const handle: NotificationHandle = new NotificationHandle("1", () => undefined);
   * ```
   */
  public constructor(id: string, remove: () => void);

  /**
   * Removes the notification; nothing happens once it is gone.
   *
   * @example
   * ```ts
   * import type { NotificationHandle } from "@noldova/desktop.window";
   *
   * export function finish(handle: NotificationHandle): void {
   *   handle.dismiss();
   * }
   * ```
   */
  public dismiss(): void;
}

/**
 * A registered status-bar item, which its window part updates.
 */
export declare class StatusBarItem {
  /**
   * The item's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The side it stands on.
   */
  public readonly side: StatusBarSide;

  /**
   * What it shows now.
   */
  public readonly state: Signal<StatusBarItemState>;

  /**
   * Creates the registered item. The window creates it when a part
   * registers the item; a test double creates its own.
   *
   * @param contribution The item as registered.
   * @param check Throws when a state may not be shown, such as one whose
   * command another module owns; it checks the first state and every update.
   * @throws Error synchronously when `check` throws for the first state.
   * @example
   * ```ts
   * import { StatusBarItem, StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
   *
   * export const item: StatusBarItem = new StatusBarItem(new StatusBarItemContribution("clock.time", StatusBarSide.Right, new StatusBarItemState("12:00")), () => undefined);
   * ```
   */
  public constructor(contribution: StatusBarItemContribution, check: (state: StatusBarItemState) => void);

  /**
   * Changes what the item shows.
   *
   * @param state The new state.
   * @throws Error synchronously when its command belongs to neither the
   * module nor a dependency; the item keeps its state.
   * @example
   * ```ts
   * import { type StatusBarItem, StatusBarItemState } from "@noldova/desktop.window";
   *
   * export function showTime(item: StatusBarItem, time: string): void {
   *   item.update(new StatusBarItemState(time, { tooltip: `The time is ${time}` }));
   * }
   * ```
   */
  public update(state: StatusBarItemState): void;
}

/**
 * A status-bar item a window part registers: its name, side and first
 * state.
 */
export declare class StatusBarItemContribution {
  /**
   * The item's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The side it stands on.
   */
  public readonly side: StatusBarSide;

  /**
   * What it shows first.
   */
  public readonly state: StatusBarItemState;

  /**
   * Creates the item.
   *
   * @param name The item's name, which the module declares in
   * `contributes.statusBarItems`.
   * @param side The side it stands on, in module order and then declared
   * order.
   * @param state What it shows first.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { StatusBarItemContribution, StatusBarItemState, StatusBarSide } from "@noldova/desktop.window";
   *
   * export const time: StatusBarItemContribution = new StatusBarItemContribution("clock.time", StatusBarSide.Right, new StatusBarItemState("12:00"));
   * ```
   */
  public constructor(name: string, side: StatusBarSide, state: StatusBarItemState);
}

/**
 * What a status-bar item shows: text, an icon or both, a tooltip, and the
 * command it runs.
 */
export declare class StatusBarItemState {
  /**
   * The text, which may be empty when the item has an icon and a tooltip,
   * or while it is hidden.
   */
  public readonly text: string;

  /**
   * The glyph, or null when it has none.
   */
  public readonly icon: string | null;

  /**
   * The tooltip, or null when the text names the item.
   */
  public readonly tooltip: string | null;

  /**
   * The command the item runs, or null when it runs none and is no button.
   */
  public readonly command: string | null;

  /**
   * The arguments the command runs with; null when it has none.
   */
  public readonly commandArguments: JsonValue;

  /**
   * Whether the item is hidden, taking no space in the status bar.
   */
  public readonly isHidden: boolean;

  /**
   * The tone of its text and icon.
   */
  public readonly tone: StatusBarItemTone;

  /**
   * The item's accessible name: its tooltip, or else its text.
   */
  public get label(): string;

  /**
   * Creates the state.
   *
   * @param text The text; empty only with an icon and a tooltip, or while
   * the item is hidden.
   * @param options The icon, tooltip, command, visibility and tone; none
   * when left out.
   * @throws ArgumentException synchronously when the icon or tooltip is
   * blank, a shown item's text is blank without an icon or without a
   * tooltip, or the command is not `<module id>.<name>`.
   * @example
   * ```ts
   * import { StatusBarItemState } from "@noldova/desktop.window";
   *
   * export const alarm: StatusBarItemState = new StatusBarItemState("", { icon: "alarm", tooltip: "Alarm at 7:00", command: "clock.showAlarms" });
   * ```
   * @example
   * ```ts
   * import { StatusBarItemState, StatusBarItemTone } from "@noldova/desktop.window";
   *
   * export const synced: StatusBarItemState = new StatusBarItemState("Synced", { tone: StatusBarItemTone.Muted });
   * export const waiting: StatusBarItemState = new StatusBarItemState("", { isHidden: true });
   * ```
   * @example
   * ```ts
   * import { StatusBarItemState } from "@noldova/desktop.window";
   *
   * // @ts-expect-error
   * export const unnamed: StatusBarItemState = new StatusBarItemState({ icon: "alarm" });
   * ```
   */
  public constructor(text: string, options?: IStatusBarItemOptions);
}

/**
 * A registered top-bar action, which its window part updates.
 */
export declare class TopBarAction {
  /**
   * The action's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The side of the top row it stands on.
   */
  public readonly side: TopBarSide;

  /**
   * What it shows and runs now.
   */
  public readonly state: Signal<TopBarActionState>;

  /**
   * Creates the registered action. The window creates it when a part
   * registers the action; a test double creates its own.
   *
   * @param contribution The action as registered.
   * @param check Throws when a state may not be shown, such as one whose
   * command another module owns; it checks the first state and every update.
   * @throws Error synchronously when `check` throws for the first state.
   * @example
   * ```ts
   * import { TopBarAction, TopBarActionContribution, TopBarActionState } from "@noldova/desktop.window";
   *
   * export const action: TopBarAction = new TopBarAction(new TopBarActionContribution("notes.sync", new TopBarActionState("sync", "Sync notes", "notes.sync")), () => undefined);
   * ```
   */
  public constructor(contribution: TopBarActionContribution, check: (state: TopBarActionState) => void);

  /**
   * Changes what the action shows and runs.
   *
   * @param state The new state.
   * @throws Error synchronously when its command belongs to neither the
   * module nor a dependency; the action keeps its state.
   * @example
   * ```ts
   * import { type TopBarAction, TopBarActionState } from "@noldova/desktop.window";
   *
   * export function hideWhileSyncing(action: TopBarAction, isSyncing: boolean): void {
   *   action.update(new TopBarActionState("sync", "Sync notes", "notes.sync", { isHidden: isSyncing }));
   * }
   * ```
   */
  public update(state: TopBarActionState): void;
}

/**
 * A top-bar action a window part registers: its name, first state and side.
 */
export declare class TopBarActionContribution {
  /**
   * The action's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * What it shows and runs first.
   */
  public readonly state: TopBarActionState;

  /**
   * The side of the top row it stands on.
   */
  public readonly side: TopBarSide;

  /**
   * Creates the action.
   *
   * @param name The action's name, which the module declares in
   * `contributes.topBarActions`.
   * @param state What it shows and runs first.
   * @param side The side it asks for, in module order and then declared
   * order; the end when left out.
   * @throws ArgumentException synchronously when the name is not
   * `<module id>.<name>`.
   * @example
   * ```ts
   * import { TopBarActionContribution, TopBarActionState, TopBarSide } from "@noldova/desktop.window";
   *
   * export const search: TopBarActionContribution = new TopBarActionContribution("notes.search", new TopBarActionState("search", "Search notes", "notes.search"), TopBarSide.Start);
   * ```
   */
  public constructor(name: string, state: TopBarActionState, side?: TopBarSide);
}

/**
 * What a top-bar action shows and runs: an icon button with a title.
 */
export declare class TopBarActionState {
  /**
   * The glyph of its button.
   */
  public readonly icon: string;

  /**
   * The title, its tooltip and accessible name; while its command can't run, it names why.
   */
  public readonly title: string;

  /**
   * The command it runs; while the command can't run, because it is not registered or not enabled, the button stays focusable, marked unavailable, and runs nothing.
   */
  public readonly command: string;

  /**
   * The arguments the command runs with; null when it has none.
   */
  public readonly commandArguments: JsonValue;

  /**
   * Whether the action is hidden.
   */
  public readonly isHidden: boolean;

  /**
   * Creates the state.
   *
   * @param icon The glyph, not blank.
   * @param title The title, not blank.
   * @param command The command, `<module id>.<name>`.
   * @param options The arguments and visibility; none when left out.
   * @throws ArgumentException synchronously when the icon or title is blank
   * or the command is not `<module id>.<name>`.
   * @example
   * ```ts
   * import { TopBarActionState } from "@noldova/desktop.window";
   *
   * export const sync: TopBarActionState = new TopBarActionState("sync", "Sync notes", "notes.sync", { commandArguments: { force: true } });
   * ```
   */
  public constructor(icon: string, title: string, command: string, options?: ITopBarActionOptions);
}

/**
 * The badge on a view's icon or after its tab's title: a count or a dot,
 * with a description for its accessible name.
 */
export declare class ViewBadge {
  /**
   * The count, or null for a dot.
   */
  public readonly count: number | null;

  /**
   * What the badge means, which the view's accessible name includes.
   */
  public readonly description: string;

  /**
   * Creates the badge.
   *
   * @param count A whole number from 1, or null for a dot.
   * @param description What the badge means, not blank.
   * @throws ArgumentException synchronously when the count is not a whole
   * number from 1 or the description is blank.
   * @example
   * ```ts
   * import { ViewBadge } from "@noldova/desktop.window";
   *
   * export const changed: ViewBadge = new ViewBadge(null, "Notes changed elsewhere");
   * ```
   */
  public constructor(count: number | null, description: string);
}

/**
 * A view a window part registers: content for a panel, in a dock or in the
 * middle, with its title and icon.
 */
export declare class ViewContribution {
  /**
   * The view's name, `<module id>.<name>`.
   */
  public readonly name: string;

  /**
   * The title of its tab.
   */
  public readonly title: string;

  /**
   * The glyph of its tab.
   */
  public readonly icon: string;

  /**
   * The dock it opens in until the person moves it.
   */
  public readonly defaultSide: DockSide;

  /**
   * Whether it shows in a new layout.
   */
  public readonly isShownByDefault: boolean;

  /**
   * Loads the component the view shows.
   */
  public readonly loadComponent: () => Promise<Type<unknown>>;

  /**
   * The padding the view declares, or null when its module decides.
   */
  public readonly padding: ContentPadding | null;

  /**
   * Whether the view opens as many tabs, one for each instance.
   */
  public readonly hasInstances: boolean;

  /**
   * The menu place shown in the tab row of a group holding its tabs, or
   * null for none.
   */
  public readonly tabRowPlace: string | null;

  /**
   * Whether a person can rename the view's instance tabs in place, as
   * {@link IViewOptions.isRenamable} describes it.
   */
  public readonly isRenamable: boolean;

  /**
   * Creates the view's contribution.
   *
   * @param name The view's name, `<module id>.<name>`.
   * @param title The title of its tab, not blank.
   * @param icon The glyph of its tab, not blank.
   * @param defaultSide The dock it opens in.
   * @param isShownByDefault Whether it shows in a new layout.
   * @param loadComponent Loads the component the view shows, which a part
   * loads lazily so activation stays light.
   * @param padding The padding of its page; left out, its module decides.
   * @param options Whether it has instances and the place of its tab-row
   * buttons, as {@link IViewOptions} describes them; neither when left out.
   * @throws ArgumentException synchronously when the name or the tab-row
   * place is not `<module id>.<name>` or the title or icon is blank.
   * @example
   * ```ts
   * import { Component } from "@angular/core";
   * import { ContentPadding, DockSide, ViewContribution } from "@noldova/desktop.window";
   *
   * @Component({ selector: "nol-terminal-panel", template: "<div class=\"terminal\"></div>" })
   * export class TerminalPanelComponent {
   * }
   *
   * export const terminal: ViewContribution = new ViewContribution("terminal.panel", "Terminal", "terminal", DockSide.Bottom, true,
   *   () => Promise.resolve(TerminalPanelComponent), ContentPadding.None);
   *
   * export const sessions: ViewContribution = new ViewContribution("terminal.session", "Terminal", "terminal", DockSide.Bottom, false,
   *   () => Promise.resolve(TerminalPanelComponent), ContentPadding.None, { hasInstances: true, tabRowPlace: "terminal.tabRow" });
   * ```
   */
  public constructor(name: string, title: string, icon: string, defaultSide: DockSide, isShownByDefault: boolean, loadComponent: () => Promise<Type<unknown>>,
    padding?: ContentPadding, options?: IViewOptions);
}

/**
 * The injection tokens of the window-part contract.
 */
export declare class WindowPartTokens {
  /**
   * The {@link IWindowPartContext} of the window part whose views and
   * documents the component belongs to.
   */
  public static readonly context: InjectionToken<IWindowPartContext>;

  /**
   * The {@link ContentPaddingRef} of the page the component is shown on.
   */
  public static readonly contentPadding: InjectionToken<ContentPaddingRef>;

  /**
   * Whether the page the component is shown on is in view.
   * @remarks The window keeps a tab's page while the tab is open. A hidden
   * page is taken out of the document and gets no change detection until it
   * shows again, so a component reads this signal to pause work of its own,
   * such as timers, while it is hidden.
   */
  public static readonly shown: InjectionToken<Signal<boolean>>;
}

/**
 * Marks its host element as keeping Ctrl keys, such as a terminal that gives
 * Ctrl+key to its shell, with `nolKeepsCtrlKeys`. On Windows and Linux, a
 * key pressed inside the element runs the window command bound to it, as
 * elsewhere, unless the element prevented its default; a Ctrl+Shift+key with
 * no binding of its own runs the command bound to the same key with Ctrl
 * alone, while one bound to a disabled command, or to one a dialog holds,
 * runs nothing. The editing commands, Undo, Redo, Cut, Copy, Paste and Select all,
 * never run from a key there, and the window leaves those keys' defaults to
 * the element. On macOS, where the window's keys use Cmd, nothing changes.
 * {@link IWindowPartContext.findWindowCommand} reads keys by the same rule.
 *
 * @example
 * ```ts
 * import { Component } from "@angular/core";
 * import { KeepsCtrlKeysDirective } from "@noldova/desktop.window";
 *
 * @Component({
 *   selector: "nol-terminal-pane",
 *   imports: [KeepsCtrlKeysDirective],
 *   template: "<div class=\"terminal\" nolKeepsCtrlKeys></div>"
 * })
 * export class TerminalPaneComponent {
 * }
 * ```
 */
export declare class KeepsCtrlKeysDirective {
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ShellClients, ShellMethods } from "@noldova/desktop.protocol";
import { ProductInfo } from "@noldova/desktop.runtime";

import { MainProcessFailureKind } from "./enums/main-process-failure-kind.js";
import type { IPreloadChannels } from "./interfaces/i-preload-channels.js";

export class Resources {
  public static readonly folderSeparator: string = "/";
  public static readonly restartErrorFile: string = "update-restart.log";
  public static readonly installerErrorFile: string = "update-installer.log";
  public static readonly okButton: string = "OK";
  public static readonly updateStoppedBeforeHandoff: string = "An update stopped before its handoff, so its launch barrier was removed.";
  public static readonly updateBarrierCleared: string = "The person chose to open the application after an unfinished update, so its launch barrier was removed.";
  public static readonly checkoutHashAlgorithm: string = "sha256";
  public static readonly hexEncoding: "hex" = "hex";
  public static readonly checkoutHashLength: number = 8;
  public static readonly idSeparator: string = ".";
  public static readonly relaunchArgumentPrefixes: readonly string[] = ["--data-dir=", "--user-data-dir=", "--device-dir="];
  public static readonly appIdParameter: string = "appId";
  public static readonly iconPathParameter: string = "iconPath";
  public static readonly relaunchCommandParameter: string = "relaunchCommand";
  public static readonly readyChannel: string = "desktop:ready";
  public static readonly menuBarChannel: string = "desktop:menuBar";
  public static readonly menuCommandChannel: string = "desktop:menuCommand";
  public static readonly editChannel: string = "desktop:edit";
  public static readonly appearanceChannel: string = "desktop:appearance";
  public static readonly closeRequestChannel: string = "desktop:closeRequest";
  public static readonly closeAnswerChannel: string = "desktop:closeAnswer";
  public static readonly updateSaveRequestChannel: string = "desktop:updateSaveRequest";
  public static readonly updateSaveAnswerChannel: string = "desktop:updateSaveAnswer";
  public static readonly startupStateChannel: string = "desktop:startupState";
  public static readonly readStartupChannel: string = "desktop:readStartup";
  public static readonly startupActionChannel: string = "desktop:startupAction";
  public static readonly readLayoutChannel: string = "desktop:readLayout";
  public static readonly writeLayoutChannel: string = "desktop:writeLayout";
  public static readonly requestChannel: string = "desktop:request";
  public static readonly pageChannel: string = "desktop:page";
  public static readonly runtimeEventChannel: string = "desktop:runtimeEvent";
  public static readonly readBuildChannel: string = "desktop:readBuild";
  public static readonly copyTextChannel: string = "desktop:copyText";
  public static readonly openLogFolderChannel: string = "desktop:openLogFolder";
  public static readonly copyDetailsChannel: string = "desktop:copyDetails";
  public static readonly openLinkChannel: string = "desktop:openLink";
  public static readonly openFileChannel: string = "desktop:openFile";
  public static readonly showInFolderChannel: string = "desktop:showInFolder";
  public static readonly webViewOpenChannel: string = "desktop:webViewOpen";
  public static readonly webViewAttachChannel: string = "desktop:webViewAttach";
  public static readonly webViewNavigateChannel: string = "desktop:webViewNavigate";
  public static readonly webViewActChannel: string = "desktop:webViewAct";
  public static readonly webViewCloseChannel: string = "desktop:webViewClose";
  public static readonly webViewKeepChannel: string = "desktop:webViewKeep";
  public static readonly webViewExpectChannel: string = "desktop:webViewExpect";
  public static readonly webViewShortcutsChannel: string = "desktop:webViewShortcuts";
  public static readonly appShortcutsChannel: string = "desktop:appShortcuts";
  public static readonly webViewEventChannel: string = "desktop:webViewEvent";
  public static readonly webViewShortcutChannel: string = "desktop:webViewShortcut";
  public static readonly webViewShortcutAnswerChannel: string = "desktop:webViewShortcutAnswer";
  public static readonly webViewInputChannel: string = "desktop:webViewInput";
  public static readonly webViewFocusReleaseChannel: string = "desktop:webViewFocusRelease";
  public static readonly webViewZoomChannel: string = "desktop:webViewZoom";
  public static readonly webViewFindChannel: string = "desktop:webViewFind";
  public static readonly webViewZoomMode: string = "isolated";
  public static readonly webViewZoomMinimum: number = 0.25;
  public static readonly webViewZoomMaximum: number = 5;
  public static readonly webViewFindTimeout: number = 10_000;
  public static readonly webViewZoomSteps: readonly number[] = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
  public static readonly webViewZoomKeys: ReadonlyMap<string, number> = new Map([
    ["Equal", 1], ["NumpadAdd", 1], ["=", 1], ["+", 1], ["Minus", -1], ["NumpadSubtract", -1], ["-", -1], ["Digit0", 0], ["Numpad0", 0], ["0", 0]
  ]);
  public static readonly zoomInDirection: string = "in";
  public static readonly zoomOutDirection: string = "out";
  public static readonly webViewFindNext: string = "next";
  public static readonly webViewFindPrevious: string = "previous";
  public static readonly clearSelection: "clearSelection" = "clearSelection";
  public static readonly foundInPageEvent: "found-in-page" = "found-in-page";
  public static readonly zoomChangedEvent: "zoom-changed" = "zoom-changed";
  public static readonly pageFaviconUpdatedEvent: "page-favicon-updated" = "page-favicon-updated";
  public static readonly imageField: string = "image";
  public static readonly factorField: string = "factor";
  public static readonly isControlledField: string = "isControlled";
  public static readonly matchesField: string = "matches";
  public static readonly activeField: string = "active";
  public static readonly textField: string = "text";
  public static readonly matchCaseField: string = "matchCase";
  public static readonly chooseFolderChannel: string = "desktop:chooseFolder";
  public static readonly openDirectoryProperty: "openDirectory" = "openDirectory";
  public static readonly chooseFilePathChannel: string = "desktop:chooseFilePath";
  public static readonly extensionsField: "extensions" = "extensions";
  public static readonly folderField: "folder" = "folder";
  public static readonly maximumFileExtensions: number = 32;
  public static readonly fileExtensionPattern: RegExp = /^[A-Za-z0-9]{1,16}$/;
  public static readonly controlCharacterPattern: RegExp = /\p{Cc}/u;
  public static readonly filePathChoiceRefused: string =
    "A file chooser was not shown: a window part asked with options that are not 1 to 32 extensions of letters and digits and an absolute starting folder.";
  public static readonly saveFileChannel: string = "desktop:saveFile";
  public static readonly showOverwriteConfirmationProperty: "showOverwriteConfirmation" = "showOverwriteConfirmation";
  public static readonly plainFileNamePattern: RegExp =
    /^(?!(?:con|conin\$|conout\$|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$))[^\\/:*?"<>|\p{Cc}\p{Bidi_Control}]*[^\\/:*?"<>|\p{Cc}\p{Bidi_Control}. ]$/iu;
  public static readonly fileNameByteLimit: number = 255;
  public static readonly fileSaveByteLimit: number = 512 * 1024 * 1024;
  public static readonly fileSaveRefused: string =
    "A file was not saved: a window part asked with a name that is not a plain file name, or without bytes or with more than 512 MiB of them.";
  public static readonly fileSaveUntrusted: string = "A file was not saved: the request did not come from the window's own page.";
  public static readonly dialogAlreadyOpen: string = "A dialog was not shown: the window already shows a file or folder chooser or a save dialog for a window part.";
  public static readonly chooseFilesChannel: string = "desktop:chooseFiles";
  public static readonly grantFilesChannel: string = "desktop:grantFiles";
  public static readonly openFileProperty: "openFile" = "openFile";
  public static readonly multiSelectionsProperty: "multiSelections" = "multiSelections";
  public static readonly nameField: "name" = "name";
  public static readonly pathField: "path" = "path";
  public static readonly bytesField: "bytes" = "bytes";
  public static readonly sizeField: "size" = "size";
  public static readonly grantField: string = "grant";
  public static readonly mediaTypeField: string = "mediaType";
  public static readonly grantedField: string = "granted";
  public static readonly refusedField: string = "refused";
  public static readonly lifetimeField: "lifetime" = "lifetime";
  public static readonly multipleField: "multiple" = "multiple";
  public static readonly offeredFileLimit: number = 256;
  public static readonly pastedByteLimit: number = 64 * 1024 * 1024;
  public static readonly stagedByteLimit: number = 256 * 1024 * 1024;
  public static readonly unknownMediaType: string = "application/octet-stream";
  public static readonly pastedFileName: string = "pasted";
  public static readonly mediaTypePattern: RegExp = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
  public static readonly fileGrantRefused: string =
    "No file was granted: a window part asked for a name that is not a module's, with options that are not a lifetime of up to 600 000 milliseconds, or with more than 256 files or files that are not files.";
  public static readonly fileGrantUntrusted: string = "No file was granted: the request did not come from the window's current page.";
  public static readonly sharedFileScheme: string = "desktop-file";
  public static readonly sharedFileHostPattern: RegExp = /^[0-9a-f]{32}$/;
  public static readonly sharedImageTypes: readonly string[] = ["image/png", "image/jpeg", "image/gif", "image/webp"];
  public static readonly sharedFileHeaders: Readonly<Record<string, string>> = {
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  };
  public static readonly contentTypeHeader: string = "Content-Type";
  public static readonly contentLengthHeader: string = "Content-Length";
  public static readonly getMethod: string = "GET";
  public static readonly notFoundStatus: number = 404;
  public static readonly sharedFileAddressRefused: string = "not a GET of a share's address";
  public static readonly sharedFilePageEnded: string = "its page ended";
  public static readonly sharedFileChanged: string = "the file changed or was replaced";
  public static readonly offeredFileNotRegular: string = "it is not a regular file.";
  public static readonly offeredFileLinkElsewhere: string = "a link in the path leads to a network or device path, which is never granted.";
  public static readonly offeredFileNotLocal: string = "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is granted, never a network or device path.";
  public static readonly pastedFileTooLarge: string = "a paste may stage at most 64 MiB.";
  public static readonly stagedFolderFull: string = "the files staged for modules already hold 256 MiB.";
  public static readonly installCommandChannel: string = "desktop:installCommand";
  public static readonly readUpdateChannel: string = "desktop:readUpdate";
  public static readonly updateActionChannel: string = "desktop:updateAction";
  public static readonly notificationOpenedChannel: string = "desktop:notificationOpened";
  public static readonly quitQuestionChannel: string = "desktop:quitQuestion";
  public static readonly readTrayAvailableChannel: string = "desktop:readTrayAvailable";
  public static readonly trayAvailableChannel: string = "desktop:trayAvailable";
  public static readonly readFullScreenChannel: string = "desktop:readFullScreen";
  public static readonly fullScreenChannel: string = "desktop:fullScreen";
  public static readonly readMaximizedChannel: string = "desktop:readMaximized";
  public static readonly maximizedChannel: string = "desktop:maximized";
  public static readonly windowActionChannel: string = "desktop:windowAction";
  public static readonly quitAnswerChannel: string = "desktop:quitAnswer";
  public static readonly moduleLogChannel: string = "desktop:moduleLog";
  public static readonly windowErrorChannel: string = "desktop:windowError";
  public static readonly copyTextLimit: number = 32 * 1024 * 1024;
  public static readonly copyImageChannel: string = "desktop:copyImage";
  public static readonly imageCopyByteLimit: number = 64 * 1024 * 1024;
  public static readonly imageCopyPixelLimit: number = 50_000_000;
  public static readonly imageCopySideLimit: number = 16384;
  public static readonly pngSignature: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  public static readonly pngHeaderLength: number = 33;
  public static readonly imageCopyRefused: string =
    "An image was not copied: a window part asked without the bytes of a PNG image of at most 16384 pixels a side and 50 million in all, or with more than 64 MiB of them.";
  public static readonly imageCopyUndecoded: string = "An image was not copied: its PNG bytes did not decode.";
  public static readonly imageCopyBusy: string = "An image was not copied: the window was still copying another image.";
  public static readonly textCopyUntrusted: string = "A text was not copied: the request did not come from the window's own page.";
  public static readonly textCopyRefused: string = "A text was not copied: it was not text, or longer than 33554432 UTF-16 code units.";
  public static readonly imageCopyUntrusted: string = "An image was not copied: the request did not come from the window's own page.";
  public static readonly webViewAddressLimit: number = 32768;
  public static readonly webViewSchemes: readonly string[] = ["http:", "https:"];
  public static readonly webViewSubresourceSchemes: readonly string[] = ["data:", "blob:"];
  public static readonly webViewSocketSchemes: ReadonlyMap<string, string> = new Map([["ws:", "http:"], ["wss:", "https:"]]);
  public static readonly webViewLoopbackName: string = "localhost";
  public static readonly webViewLoopbackSuffix: string = ".localhost";
  public static readonly webViewWildcardPrefix: string = "*.";
  public static readonly webViewOriginSeparator: string = "//";
  public static readonly webViewHextets: number = 8;
  public static readonly webViewDefaultPorts: ReadonlyMap<string, number> = new Map([["http:", 80], ["https:", 443], ["ws:", 80], ["wss:", 443]]);
  public static readonly webViewBracketsPattern: RegExp = /^\[|\]$/gu;
  public static readonly webViewTrailingDotPattern: RegExp = /\.$/u;
  public static readonly webViewZoneSeparator: string = "%";
  public static readonly blankPage: string = "about:blank";
  public static readonly sourceDocument: string = "about:srcdoc";
  public static readonly sourceDocumentPath: string = "srcdoc";
  public static readonly aboutScheme: string = "about:";
  public static readonly webViewPartitionPrefix: string = "persist:";
  public static readonly webViewPartitionSeparator: string = ".";
  public static readonly webViewsPerPane: number = 32;
  public static readonly webViewBacklogLimit: number = 256;
  public static readonly webViewReplyLimit: number = 4 * 1024 * 1024;
  public static readonly webViewEventLimit: number = 64 * 1024;
  public static readonly webViewProtocolVersion: string = "1.3";
  public static readonly webViewServerErrorCode: number = -32000;
  public static readonly webViewAbortedLoadCode: number = -3;
  public static readonly webViewRtcPolicy: "disable_non_proxied_udp" = "disable_non_proxied_udp";
  public static readonly pageEnableMethod: string = "Page.enable";
  public static readonly getFrameTreeMethod: string = "Page.getFrameTree";
  public static readonly frameNavigatedEvent: string = "Page.frameNavigated";
  public static readonly navigationStartEvents: readonly string[] = ["Page.frameRequestedNavigation", "Page.frameStartedNavigating"];
  public static readonly interceptFileChooserMethod: string = "Page.setInterceptFileChooserDialog";
  public static readonly fileChooserOpenedEvent: string = "Page.fileChooserOpened";
  public static readonly dispatchKeyEventMethod: string = "Input.dispatchKeyEvent";
  public static readonly dispatchTouchEventMethod: string = "Input.dispatchTouchEvent";
  public static readonly inputDomainPrefix: string = "Input.";
  public static readonly beforeInputEvent: "before-input-event" = "before-input-event";
  public static readonly keyDownInputs: readonly string[] = ["keyDown", "rawKeyDown"];
  public static readonly codeField: string = "code";
  public static readonly modifiersField: string = "modifiers";
  public static readonly originField: string = "origin";
  public static readonly dispositionField: string = "disposition";
  public static readonly refusedPageLimit: number = 64;
  public static readonly refusedPageNameLimit: number = 64;
  public static readonly refusedPageOriginLimit: number = 256;
  public static readonly refusedPagePrefix: string = "data:text/html;base64,";
  public static readonly refusedPageBackground: string = "Canvas";
  public static readonly refusedPageText: string = "CanvasText";
  public static readonly namelessRefusedReason: string = "Its address isn't one this view opens.";
  public static readonly hiddenRefusedTarget: string = "this address";
  public static readonly altModifier: number = 1;
  public static readonly ctrlModifier: number = 2;
  public static readonly metaModifier: number = 4;
  public static readonly shiftModifier: number = 8;
  public static readonly insertTextMethod: string = "Input.insertText";
  public static readonly focusEmulationMethod: string = "Emulation.setFocusEmulationEnabled";
  public static readonly enabledParameter: string = "enabled";
  public static readonly focusBarrierWorld: number = 1999;
  public static readonly focusBarrierScript: string = "0";
  public static readonly layoutMetricsMethod: string = "Page.getLayoutMetrics";
  public static readonly layoutViewportField: string = "cssLayoutViewport";
  public static readonly pageXField: string = "pageX";
  public static readonly pageYField: string = "pageY";
  public static readonly scrollBackWorld: number = 1998;
  public static readonly webViewScrollReadTimeout: number = 500;
  public static readonly webViewScrollUnread: string = "its restored page did not answer where it was scrolled";
  public static readonly webViewScrollUnbound: string = "its page was replaced or closed while it loaded";
  public static readonly webViewScrollNavigated: string = "a navigation came while its page loaded";
  public static readonly webViewScrollInput: string = "an input came while its page loaded";
  public static readonly webViewScrollRedirected: string = "its page went to another address while it loaded";
  public static readonly pointerMoveTypes: readonly string[] = ["mouseMove", "mouseEnter", "mouseLeave"];
  public static readonly autoRepeatField: string = "autoRepeat";
  public static readonly keyDownType: string = "keyDown";
  public static readonly rawKeyDownType: string = "rawKeyDown";
  public static readonly charType: string = "char";
  public static readonly keyUpType: string = "keyUp";
  public static readonly keyModifierNames: readonly (readonly [number, string])[] = [
    [Resources.altModifier, "alt"], [Resources.ctrlModifier, "control"], [Resources.metaModifier, "meta"], [Resources.shiftModifier, "shift"]
  ];
  public static readonly autoRepeatModifier: string = "isautorepeat";
  public static readonly pressField: string = "press";
  public static readonly webViewKeyTexts: ReadonlyMap<string, string> = new Map([["Enter", "\r"]]);
  public static readonly webViewKeyNames: ReadonlyMap<string, string> = new Map([["ArrowUp", "Up"], ["ArrowDown", "Down"], ["ArrowLeft", "Left"], ["ArrowRight", "Right"], [" ", "Space"], ["+", "Plus"]]);
  public static readonly webViewTextUnreadable: string = "The text input names no text.";
  public static readonly webViewKeyUnreadable: string = "The key event names no key, or a type the page's input doesn't take.";
  public static readonly mainFrameResource: string = "mainFrame";
  public static readonly subFrameResource: string = "subFrame";
  public static readonly serviceWorkerHeader: string = "Service-Worker";
  public static readonly serviceWorkerScript: string = "script";
  public static readonly nullOrigin: string = "null";
  public static readonly willFrameNavigateEvent: "will-frame-navigate" = "will-frame-navigate";
  public static readonly didStopLoadingEvent: "did-stop-loading" = "did-stop-loading";
  public static readonly didNavigateEvent: "did-navigate" = "did-navigate";
  public static readonly didNavigateInPageEvent: "did-navigate-in-page" = "did-navigate-in-page";
  public static readonly pageTitleUpdatedEvent: "page-title-updated" = "page-title-updated";
  public static readonly didFailLoadEvent: "did-fail-load" = "did-fail-load";
  public static readonly certificateErrorEvent: "certificate-error" = "certificate-error";
  public static readonly selectClientCertificateEvent: "select-client-certificate" = "select-client-certificate";
  public static readonly loginEvent: "login" = "login";
  public static readonly willDownloadEvent: "will-download" = "will-download";
  public static readonly detachEvent: "detach" = "detach";
  public static readonly webViewReplyNotObject: string = "The engine's reply is not an object.";
  public static readonly focusEmulationRefused: string = "The host owns focus emulation, so a module may not send Emulation.setFocusEmulationEnabled.";
  public static readonly webViewLost: string = "A web view lost its defaults, so it was closed.";
  public static readonly webViewBatchLimit: number = 64;
  public static readonly addressField: string = "address";
  public static readonly descriptionField: string = "description";
  public static readonly isLoadingField: string = "isLoading";
  public static readonly canGoBackField: string = "canGoBack";
  public static readonly canGoForwardField: string = "canGoForward";
  public static readonly requestField: string = "request";
  public static readonly isRedirectField: string = "isRedirect";
  public static readonly frameIdField: string = "frameId";
  public static readonly frameTreeField: string = "frameTree";
  public static readonly frameField: string = "frame";
  public static readonly parentIdField: string = "parentId";
  public static readonly navigationTypeField: string = "navigationType";
  public static readonly sameDocumentNavigationTypes: readonly string[] = ["sameDocument", "historySameDocument"];
  public static readonly hadRecentInputField: string = "hadRecentInput";
  public static readonly methodField: string = "method";
  public static readonly paramsField: string = "params";
  public static readonly isCutField: string = "isCut";
  public static readonly countField: string = "count";
  public static readonly paneField: string = "pane";
  public static readonly profileKeyField: string = "profileKey";
  public static readonly viewField: string = "view";
  public static readonly moduleField: string = "module";
  public static readonly partitionField: string = "partition";
  public static readonly keysField: string = "keys";
  public static readonly isAttachedField: string = "isAttached";
  public static readonly timeoutField: string = "timeoutMilliseconds";
  public static readonly downloadRequest: string = "download";
  public static readonly newWindowRequest: string = "newWindow";
  public static readonly personInputTypes: readonly string[] = ["rawKeyDown", "keyDown", "mouseDown", "touchStart"];
  public static readonly personPressTypes: readonly string[] = ["mouseDown", "touchStart"];
  public static readonly nonActivatingKeys: readonly string[] = ["Escape", "Accel", "Alt", "AltGraph", "CapsLock", "Control", "Fn", "FnLock", "Hyper", "Meta", "NumLock", "ScrollLock", "Shift", "ShiftLevel5", "Super", "Symbol", "SymbolLock"];
  public static readonly relayedPressTypes: ReadonlyMap<string, string> = new Map([["Input.dispatchMouseEvent", "mousePressed"], [Resources.dispatchTouchEventMethod, "touchStart"]]);
  public static readonly touchPointsField: string = "touchPoints";
  public static readonly touchPointIdField: string = "id";
  public static readonly pressFreeInputMethods: readonly string[] = ["Input.dispatchMouseEvent", "Input.dispatchTouchEvent", "Input.dispatchKeyEvent", "Input.insertText"];
  public static readonly inputStartKind: string = "Start";
  public static readonly inputEndKind: string = "End";
  public static readonly inputPressKind: string = "Press";
  public static readonly recentInputMilliseconds: number = 5000;
  public static readonly fromPressField: string = "fromPress";
  public static readonly newWindowRequestLimit: number = 5;
  public static readonly newWindowRequestMilliseconds: number = 1000;
  public static readonly permissionRequest: string = "permission";
  public static readonly fileChooserRequest: string = "fileChooser";
  public static readonly authenticationRequest: string = "authentication";
  public static readonly certificateRequest: string = "certificate";
  public static readonly nestedViewRequest: string = "nestedView";
  public static readonly addressParameter: string = "address";
  public static readonly linkRefused: string = "A link was not opened: only well-formed http, https and mailto links without credentials open.";
  public static readonly nullCharacter: string = "\u0000";
  public static readonly windowsDrivePathPattern: RegExp = /^[A-Za-z]:[\\/]/u;
  public static readonly shownFileNotText: string = "the path isn't text without null characters.";
  public static readonly shownFileNotAbsolute: string = "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is shown, never a network or device path.";
  public static readonly shownFileMissing: string = "no file can be read at the path.";
  public static readonly shownFileNotRegular: string = "the path isn't a regular file or a folder.";
  public static readonly shownFileLinkElsewhere: string = "a link in the path leads to a network or device path, which is never shown.";
  public static readonly shownFileUntrusted: string = "the request didn't come from one of the app's windows.";
  public static readonly openedFileNotAbsolute: string = "the path isn't absolute; on Windows only a path on a drive, such as C:\\, is opened, never a network or device path.";
  public static readonly openedFileNotRegular: string = "the path isn't a regular file; a folder, or a link to one, isn't opened.";
  public static readonly openedFileLinkElsewhere: string = "a link in the path leads to a network or device path, which is never opened.";
  public static readonly openedFileKindRefused: string = "only documents and text files open, such as .pdf, .docx, .txt or .md; any other file, a program or a script included, never opens.";
  public static readonly openedFileExecutable: string = "the file is marked executable, so it never opens.";
  public static readonly openedFileFailed: string = "the system couldn't open the file.";
  public static readonly openedFileExtensions: ReadonlySet<string> = new Set([
    ".pdf", ".docx", ".xlsx", ".pptx", ".rtf", ".odt", ".ods", ".odp",
    ".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".log", ".yaml", ".yml", ".xml", ".toml"
  ]);
  public static readonly executableModeBits: number = 0o111;
  public static readonly extensionSeparator: string = ".";
  public static readonly streamSeparator: string = ":";
  public static readonly windowsPathSeparators: readonly string[] = ["\\", "/"];
  public static readonly posixPathSeparators: readonly string[] = ["/"];
  public static readonly currentFolderName: string = ".";
  public static readonly parentFolderName: string = "..";
  public static readonly followedLinkLimit: number = 40;
  public static readonly shellOwner: string = "desktop";
  public static readonly methodParameter: string = "method";
  public static readonly secretValueParameter: string = "value";
  public static readonly windowShellMethods: readonly string[] = [
    ShellMethods.modules.text,
    ShellMethods.commands.text,
    ShellMethods.runCommand.text,
    ShellMethods.agentControl.text,
    ShellMethods.notifications.text,
    ShellMethods.postNotification.text,
    ShellMethods.dismissNotification.text,
    ShellMethods.markNotificationsRead.text,
    ShellMethods.clearNotifications.text,
    ShellMethods.settings.text,
    ShellMethods.readSetting.text,
    ShellMethods.setSetting.text,
    ShellMethods.resetSetting.text,
    ShellMethods.recentCommands.text,
    ShellMethods.recordCommand.text,
    ShellMethods.programs.text,
    ShellMethods.discardFileGrants.text,
    ShellMethods.saveSecret.text,
    ShellMethods.removeSecret.text,
    ShellMethods.secretStatus.text
  ];
  public static readonly deviceMethods: readonly string[] = [
    ShellMethods.settings.text,
    ShellMethods.readSetting.text,
    ShellMethods.setSetting.text,
    ShellMethods.resetSetting.text,
    ShellMethods.recentCommands.text,
    ShellMethods.recordCommand.text
  ];
  public static readonly deviceField: string = "device";
  public static readonly deviceRequestNeedsIdentity: string = "This device has no identity, so a request that belongs to it cannot be made.";
  public static readonly deviceRequestPayloadNotObject: string = "A request that belongs to this device must have a JSON object as its payload.";
  public static readonly methodNotText: string = "The method must be a qualified name such as notes.open.";
  public static readonly payloadNotJson: string = "The payload must be a JSON value.";
  public static readonly layoutNotObject: string = "The layout must be a JSON object.";
  public static readonly clientName: string = ShellClients.mainProcess;
  public static readonly handoffRole: string = "handoff";
  public static readonly runtimeRole: string = "runtime";
  public static readonly updateClientName: string = "update";
  public static readonly moveAsideAction: string = "moveAside";
  public static readonly stopWorkAction: string = "stopWork";
  public static readonly waitAction: string = "wait";
  public static readonly retryAction: string = "retry";
  public static readonly kindField: string = "kind";
  public static readonly detailsField: string = "details";
  public static readonly updateVersionField: string = "version";
  public static readonly updateProgressField: string = "progress";
  public static readonly updateCheckedAtField: string = "checkedAt";
  public static readonly updateReasonField: string = "reason";
  public static readonly updateMustMoveField: string = "mustMove";
  public static readonly updateFilesField: string = "files";
  public static readonly updateFileField: string = "file";
  public static readonly updateSha512Field: string = "sha512";
  public static readonly updateNotifiedField: string = "notified";
  public static readonly updateStateChannel: string = "desktop:updateState";
  public static readonly updateReadyFile: string = "update-ready.json";
  public static readonly updateConfigFile: string = "update-config.json";
  public static readonly updateCacheSuffix: string = "-updater-";
  public static readonly updateCheckLockFile: string = "update-check.lock";
  public static readonly updateLockRemovalBusy: string = "another running process was removing it the whole time";
  public static readonly updateChecksStateKey: string = "updateChecks";
  public static readonly updateFeedTimeout: number = 30_000;
  public static readonly updateCheckAction: string = "Check";
  public static readonly updateRestartAction: string = "Restart";
  public static readonly handoffFolder: string = "handoff";
  public static readonly squirrelStagedEvent: string = "update-downloaded";
  public static readonly updateStageLimit: number = 120_000;
  public static readonly automaticUpdateChecks: string = "Automatic";
  public static readonly updateChecksAtStart: string = "AtStart";
  public static readonly onRequestUpdateChecks: string = "OnRequest";
  public static readonly updateCheckChoices: readonly string[] = [Resources.automaticUpdateChecks, Resources.updateChecksAtStart, Resources.onRequestUpdateChecks];
  public static readonly firstUpdateCheckDelay: number = 30_000;
  public static readonly updateCheckInterval: number = 600_000;
  public static readonly feedSourceOption: string = "source";
  public static readonly updateTargets: ReadonlyMap<string, readonly [string, string]> = new Map([
    ["win32", ["windows", "exe"]],
    ["darwin", ["macos", "zip"]],
    ["linux", ["linux", "AppImage"]]
  ]);
  public static readonly updateArchitectures: readonly string[] = ["x64", "arm64"];
  public static readonly debianPackageExtension: string = "deb";
  public static readonly packagedResourcesFolder: string = "resources";
  public static readonly packageTypeFile: string = "package-type";
  public static readonly debianPackageType: string = "deb";
  public static readonly debianInstallerProgram: string = "/usr/bin/pkexec";
  public static readonly debianUpdateInstallerFile: string = "linux-update-install";
  public static readonly debianUpdateArgumentsRefusedCode: number = 64;
  public static readonly debianUpdateChangedCode: number = 65;
  public static readonly rootUserId: number = 0;
  public static readonly writableByOthersMode: number = 0o022;
  public static readonly feedSourceMissing: string = "The update feed's provider needs the feed's source in its options.";
  public static readonly feedExecutorUnexpected: string = "The update feed's provider needs electron-updater's HTTP executor in its runtime options.";
  public static readonly feedExecutorOption: string = "executor";
  public static readonly customProvider: "custom" = "custom";
  public static readonly updateAssetOrigins: readonly string[] = ["https://release-assets.githubusercontent.com", "https://objects.githubusercontent.com"];
  public static readonly updateSentHeaders: readonly string[] = ["accept", "range", "cache-control"];
  public static readonly userAgentHeader: string = "User-Agent";
  public static readonly dailyCheckToken: string = "daily";
  public static readonly dailyCheckFile: string = "last-daily-update-check";
  public static readonly invalidAddress: string = "an invalid address";
  public static readonly downloadProgressEvent: "download-progress" = "download-progress";
  public static readonly pendingUpdateFolder: string = "pending";
  public static readonly updaterCacheFolderField: string = "updaterCacheDirName";
  public static readonly releaseVersionPattern: RegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
  public static readonly updateVersionPattern: RegExp = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})(?:-internal\.(0|[1-9]\d{0,8}))?$/u;
  public static readonly sha512Algorithm: string = "sha512";
  public static readonly base64Encoding: "base64" = "base64";
  public static readonly latin1Encoding: "latin1" = "latin1";
  public static readonly lineBreak: string = "\n";
  public static readonly updateInfoInvalid: string = "The release's information is invalid.";
  public static readonly updateDownloadMismatch: string = "The download doesn't match the release.";
  public static readonly updateDownloadInterrupted: string = "The download was interrupted.";
  public static readonly updateNotSigned: string = "The update isn't signed by the publisher.";
  public static readonly updateFailedUnexpectedly: string = "The update stopped on an unexpected error.";
  public static readonly updateFileChanged: string = "the downloaded file has changed or is gone";
  public static readonly updateFileElsewhere: string = "its file is not the package in the updater's cache";
  public static readonly updateChangedBeforeHandoff: string = "The downloaded update has changed since it was checked, so it wasn't installed.";
  public static readonly updateNotStaged: string = "macOS couldn't prepare the update for installing.";
  public static readonly shipItNotFound: string = "macOS prepared the update, but nothing is waiting to install it.";
  public static readonly updateNotStagedInTime: string = "macOS didn't prepare the update for installing within 2 minutes.";
  public static readonly updateFeedRedirected: string = "The update feed redirected to an address with another protocol.";
  public static readonly updateCheckerUnknown: string = "The main process could not identify its own process, so it cannot check for updates.";
  public static readonly restartToUpdateTitle: string = "Restart to update";
  public static readonly restartToUpdateMember: string = "restartToUpdate";
  public static readonly updateInfoInvalidCodes: readonly string[] = [
    "ERR_UPDATER_INVALID_VERSION", "ERR_UPDATER_INVALID_UPDATE_INFO", "ERR_UPDATER_NO_FILES_PROVIDED", "ERR_UPDATER_NO_CHECKSUM", "ERR_UPDATER_ZIP_FILE_NOT_FOUND"
  ];
  public static readonly updateDownloadMismatchCodes: readonly string[] = ["ERR_CHECKSUM_MISMATCH"];
  public static readonly updateNotSignedCodes: readonly string[] = ["ERR_UPDATER_INVALID_SIGNATURE"];
  public static readonly dataDirectoryArgument: string = "--data-dir=";
  public static readonly userDataArgument: string = "--user-data-dir=";
  public static readonly userDataPath: "userData" = "userData";
  public static readonly downloadsPath: "downloads" = "downloads";
  public static readonly runAsNodeVariable: string = "ELECTRON_RUN_AS_NODE";
  public static readonly runAsNodeValue: string = "1";
  public static readonly commandLineArgument: string = "--command-line";
  public static readonly desktopToolsEntrySegments: readonly string[] = ["node_modules", "@noldova", "desktop.cli", "services", "cli-entry.js"];
  public static readonly inheritedStdio: "inherit" = "inherit";
  public static readonly signalExitBase: number = 128;
  public static readonly workWaitInterval: number = 2000;
  public static readonly stableConnectionPeriod: number = 30000;
  public static readonly reconnectionDelays: readonly number[] = [0, 1000, 2000, 4000, 8000];
  public static readonly endedByRuntime: string = "the runtime ended it.";
  public static readonly connectionEndedByRuntime: string = "The runtime ended its connection to the main process, so the main process connects again.";
  public static readonly deviceDirectoryArgument: string = "--device-dir=";
  public static readonly handoverArguments: readonly string[] = [Resources.dataDirectoryArgument, Resources.userDataArgument, Resources.deviceDirectoryArgument];
  public static readonly windowsPlatform: string = "win32";
  public static readonly deviceFileName: string = "device.json";
  public static readonly deviceIdField: string = "id";
  public static readonly createOnlyFlag: string = "wx";
  public static readonly textEncoding: BufferEncoding = "utf8";
  public static readonly appearanceFile: string = "appearance.json";
  public static readonly deviceStateFile: string = "device-state.json";
  public static readonly windowStateFile: string = "window-state.json";
  public static readonly trayCloseHintKey: string = "trayCloseHintShown";
  public static readonly trayIconStateKey: string = "trayIcon";
  public static readonly fileNameParameter: string = "fileName";
  public static readonly executablePathParameter: string = "executablePath";
  public static readonly temporarySuffix: string = ".tmp";
  public static readonly appearanceLimit: number = 4096;
  public static readonly appearanceTooLarge: string = "The appearance preferences are larger than 4096 characters.";
  public static readonly keepAppearanceChannel: string = "desktop:keepAppearance";
  public static readonly readSpellingChannel: string = "desktop:readSpelling";
  public static readonly spellingChannel: string = "desktop:spelling";
  public static readonly fieldMenuChannel: string = "desktop:fieldMenu";
  public static readonly replaceMisspellingChannel: string = "desktop:replaceMisspelling";
  public static readonly addToDictionaryChannel: string = "desktop:addToDictionary";
  public static readonly dictionaryFolderSegments: readonly string[] = ["assets", "dictionaries"];
  public static readonly dictionariesFile: string = "dictionaries.json";
  public static readonly dictionariesFolder: string = "Dictionaries";
  public static readonly dictionariesField: string = "dictionaries";
  public static readonly languageField: string = "language";
  public static readonly fileField: string = "file";
  public static readonly languagesField: string = "languages";
  public static readonly fallbackField: string = "fallback";
  public static readonly isKeyboardField: string = "isKeyboard";
  public static readonly wordField: string = "word";
  public static readonly suggestionsField: string = "suggestions";
  public static readonly keyboardMenuSource: string = "keyboard";
  public static readonly spellingTextLimit: number = 100;
  public static readonly languageTagPattern: RegExp = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/;
  public static readonly dictionaryFilePattern: RegExp = /^[A-Za-z0-9-]+\.bdic$/;
  public static readonly dictionaryWordPattern: RegExp = /^\S{1,100}$/u;
  public static readonly urlSeparator: string = "/";
  public static readonly listSeparator: string = ", ";
  public static readonly spellingInvalid: string = "The spelling preferences must be whether to check and a list of language tags.";
  public static readonly uuidPattern: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  public static readonly hashPrefix: string = "#";
  public static readonly queryPrefix: string = "?";
  public static readonly macPlatform: string = "darwin";
  public static readonly linuxPlatform: string = "linux";
  public static readonly unprotectedStorageBackends: readonly string[] = ["basic_text", "unknown"];
  public static readonly relaunchPlatforms: readonly string[] = [Resources.linuxPlatform, Resources.macPlatform, Resources.windowsPlatform];
  public static readonly appImageVariables: readonly string[] = ["APPIMAGE", "APPDIR", "ARGV0", "OWD"];
  public static readonly appImageFolderVariable: string = "APPDIR";
  public static readonly appImageWorkingFolderVariable: string = "OWD";
  public static readonly standardDescriptors: readonly number[] = [0, 1, 2];
  public static readonly enableLoggingVariable: string = "ELECTRON_ENABLE_LOGGING";
  public static readonly noConsoleVariable: string = "ELECTRON_NO_ATTACH_CONSOLE";
  public static readonly noConsoleValue: string = "1";
  public static readonly terminalArguments: readonly string[] = ["--enable-logging", "--remote-debugging-port", "--remote-debugging-pipe"];
  public static readonly appRunPathVariables: readonly (readonly [string, readonly string[], readonly string[]])[] = [
    ["PATH", [String.empty, "/usr/sbin"], []],
    ["XDG_DATA_DIRS", ["/usr/share/"], ["/usr/share/gnome", "/usr/local/share/", "/usr/share/"]],
    ["LD_LIBRARY_PATH", ["/usr/lib"], []],
    ["GSETTINGS_SCHEMA_DIR", ["/usr/share/glib-2.0/schemas"], []]
  ];
  public static readonly pathListSeparator: string = ":";
  public static readonly restartShell: string = "/bin/bash";
  public static readonly restartWaitLimit: number = 60000;
  public static readonly processStatusFolder: string = "/proc";
  public static readonly processStatusFile: string = "stat";
  public static readonly processStatusNameEnd: string = ") ";
  public static readonly processStatusSeparator: string = " ";
  public static readonly processStartTimeField: number = 19;
  public static readonly restartShellArguments: readonly string[] = [
    "--noprofile",
    "--norc",
    "-p",
    "-c",
    [
      "set -f",
      "holder=$1 started=$2 limit=$3 image=$4",
      "shift 4",
      "SECONDS=0",
      "while { read -r stat < \"/proc/$holder/stat\"; } 2>/dev/null; do",
      "  fields=(${stat##*\") \"})",
      "  [[ ${fields[0]} != Z && ( -z $started || ${fields[19]} == \"$started\" ) ]] || break",
      "  if (( SECONDS * 1000 >= limit )); then echo \"The process $holder had not ended after $limit ms, so $image starts anyway.\" >&2; break; fi",
      "  sleep 0.1",
      "done",
      "cd / || exit 1",
      "if [[ ! -x $image ]]; then echo \"$image cannot be started after the update.\" >&2; exit 1; fi",
      "exec -- \"$image\" \"$@\" < /dev/null > /dev/null 2>&1"
    ].join("\n")
  ];
  public static readonly restartVersionField: string = "version";
  public static readonly restartArgumentsField: string = "arguments";
  public static readonly restartWrittenField: string = "written";
  public static readonly restartArgumentsLimit: number = 600000;
  public static readonly permissionBits: number = 0o7777;
  public static readonly appImagePartPattern: RegExp = /^\.(.+)\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.part$/;
  public static readonly readFlag: string = "r";
  public static readonly launchControl: string = "/bin/launchctl";
  public static readonly launchControlList: string = "list";
  public static readonly launchControlRemove: string = "remove";
  public static readonly launchControlPrint: string = "print";
  public static readonly launchControlMissingServiceCode: number = 113;
  public static readonly launchPrintProcessPattern: RegExp = /^\s*pid = (\d+)\s*$/m;
  public static readonly launchListSeparator: string = "\t";
  public static readonly launchListProcessColumn: number = 0;
  public static readonly launchListLabelColumn: number = 2;
  public static readonly installerArguments: readonly string[] = ["--updated", "/S", "--force-run"];
  public static readonly mainProcessFileSuffix: string = ".desktop";
  public static readonly enableFeaturesSwitch: string = "enable-features";
  public static readonly ozonePlatformSwitch: string = "ozone-platform";
  public static readonly waylandPlatform: string = "wayland";
  public static readonly globalShortcutsPortalFeature: string = "GlobalShortcutsPortalPreferredTrigger";
  public static readonly disableBlinkFeaturesSwitch: string = "disable-blink-features";
  public static readonly webBluetoothFeature: string = "WebBluetooth";
  public static readonly windowsIcon: string = "icon-dark.ico";
  public static readonly windowIcon: string = "icon-dark-512.png";
  public static readonly lightWindowsIcon: string = "icon-light.ico";
  public static readonly lightWindowIcon: string = "icon-light-512.png";
  public static readonly lightIconSuffix: string = "-light";
  public static readonly dockIcon: string = "icon-dock-512.png";
  public static readonly trayFolder: string = "tray";
  public static readonly trayIconPrefix: string = "tray-";
  public static readonly trayWindowsExtension: string = ".ico";
  public static readonly trayMacSuffix: string = "Template.png";
  public static readonly trayLinuxExtension: string = ".png";
  public static readonly trayWorkRows: number = 5;
  public static readonly trayNotificationRows: number = 3;
  public static readonly trayLabelLimit: number = 60;
  public static readonly trayEllipsis: string = "…";
  public static readonly noWorkLabel: string = "No work running";
  public static readonly turnOnDoNotDisturbLabel: string = "Turn on Do not disturb";
  public static readonly turnOffDoNotDisturbLabel: string = "Turn off Do not disturb";
  public static readonly stopAgentsLabel: string = "Stop agents";
  public static readonly resumeAgentsLabel: string = "Resume agents";
  public static readonly stopKeyRefusedTitle: string = "The stop key works only in the app";
  public static readonly preloadFileName: string = "preload.cjs";
  public static readonly preloadArgument: string = "--desktop-preload=";
  public static readonly bridgeName: string = "desktop";
  public static readonly preloadChannels: IPreloadChannels = {
    addToDictionary: Resources.addToDictionaryChannel,
    appShortcuts: Resources.appShortcutsChannel,
    appearance: Resources.appearanceChannel,
    chooseFilePath: Resources.chooseFilePathChannel,
    chooseFiles: Resources.chooseFilesChannel,
    chooseFolder: Resources.chooseFolderChannel,
    closeAnswer: Resources.closeAnswerChannel,
    closeRequest: Resources.closeRequestChannel,
    copyDetails: Resources.copyDetailsChannel,
    copyImage: Resources.copyImageChannel,
    copyText: Resources.copyTextChannel,
    edit: Resources.editChannel,
    fieldMenu: Resources.fieldMenuChannel,
    fullScreen: Resources.fullScreenChannel,
    grantFiles: Resources.grantFilesChannel,
    installCommand: Resources.installCommandChannel,
    keepAppearance: Resources.keepAppearanceChannel,
    maximized: Resources.maximizedChannel,
    menuBar: Resources.menuBarChannel,
    menuCommand: Resources.menuCommandChannel,
    moduleLog: Resources.moduleLogChannel,
    notificationOpened: Resources.notificationOpenedChannel,
    openFile: Resources.openFileChannel,
    openLink: Resources.openLinkChannel,
    openLogFolder: Resources.openLogFolderChannel,
    page: Resources.pageChannel,
    quitAnswer: Resources.quitAnswerChannel,
    quitQuestion: Resources.quitQuestionChannel,
    readBuild: Resources.readBuildChannel,
    readFullScreen: Resources.readFullScreenChannel,
    readLayout: Resources.readLayoutChannel,
    readMaximized: Resources.readMaximizedChannel,
    readSpelling: Resources.readSpellingChannel,
    readStartup: Resources.readStartupChannel,
    readTrayAvailable: Resources.readTrayAvailableChannel,
    readUpdate: Resources.readUpdateChannel,
    ready: Resources.readyChannel,
    replaceMisspelling: Resources.replaceMisspellingChannel,
    request: Resources.requestChannel,
    runtimeEvent: Resources.runtimeEventChannel,
    saveFile: Resources.saveFileChannel,
    showInFolder: Resources.showInFolderChannel,
    spelling: Resources.spellingChannel,
    startupAction: Resources.startupActionChannel,
    startupState: Resources.startupStateChannel,
    trayAvailable: Resources.trayAvailableChannel,
    updateAction: Resources.updateActionChannel,
    updateSaveAnswer: Resources.updateSaveAnswerChannel,
    updateSaveRequest: Resources.updateSaveRequestChannel,
    updateState: Resources.updateStateChannel,
    webViewAct: Resources.webViewActChannel,
    webViewAttach: Resources.webViewAttachChannel,
    webViewClose: Resources.webViewCloseChannel,
    webViewKeep: Resources.webViewKeepChannel,
    webViewExpect: Resources.webViewExpectChannel,
    webViewEvent: Resources.webViewEventChannel,
    webViewFind: Resources.webViewFindChannel,
    webViewFocusRelease: Resources.webViewFocusReleaseChannel,
    webViewInput: Resources.webViewInputChannel,
    webViewNavigate: Resources.webViewNavigateChannel,
    webViewOpen: Resources.webViewOpenChannel,
    webViewShortcut: Resources.webViewShortcutChannel,
    webViewShortcutAnswer: Resources.webViewShortcutAnswerChannel,
    webViewShortcuts: Resources.webViewShortcutsChannel,
    webViewZoom: Resources.webViewZoomChannel,
    windowAction: Resources.windowActionChannel,
    windowError: Resources.windowErrorChannel,
    writeLayout: Resources.writeLayoutChannel
  };
  public static readonly repositoryRootSegments: readonly string[] = ["..", "..", ".."];
  public static readonly developmentPackageSegments: readonly string[] = ["_build", "development-package"];
  public static readonly windowIndexSegments: readonly string[] = ["_build", "window", "browser", "index.html"];
  public static readonly platformParameter: string = "platform";
  public static readonly windowIndexParameter: string = "windowIndexPath";
  public static readonly preloadParameter: string = "preloadPath";
  public static readonly hiddenTitleBarStyle: "hidden" = "hidden";
  public static readonly denyWindowOpen: "deny" = "deny";
  public static readonly trafficLightPosition: Readonly<{ x: number; y: number }> = { x: 12, y: 9 };
  public static readonly willNavigateEvent: "will-navigate" = "will-navigate";
  public static readonly willRedirectEvent: "will-redirect" = "will-redirect";
  public static readonly willAttachWebviewEvent: "will-attach-webview" = "will-attach-webview";
  public static readonly didAttachWebviewEvent: "did-attach-webview" = "did-attach-webview";
  public static readonly webContentsCreatedEvent: "web-contents-created" = "web-contents-created";
  public static readonly selectBluetoothDeviceEvent: "select-bluetooth-device" = "select-bluetooth-device";
  public static readonly webViewContentsType: "webview" = "webview";
  public static readonly destroyedEvent: "destroyed" = "destroyed";
  public static readonly closeEvent: "close" = "close";
  public static readonly closedEvent: "closed" = "closed";
  public static readonly themeUpdatedEvent: "updated" = "updated";
  public static readonly clickEvent: "click" = "click";
  public static readonly showEvent: "show" = "show";
  public static readonly hideEvent: "hide" = "hide";
  public static readonly failedEvent: "failed" = "failed";
  public static readonly dataEvent: "data" = "data";
  public static readonly errorEvent: "error" = "error";
  public static readonly abortEvent: "abort" = "abort";
  public static readonly secondInstanceEvent: "second-instance" = "second-instance";
  public static readonly windowAllClosedEvent: "window-all-closed" = "window-all-closed";
  public static readonly activateEvent: "activate" = "activate";
  public static readonly willQuitEvent: "will-quit" = "will-quit";
  public static readonly beforeQuitEvent: "before-quit" = "before-quit";
  public static readonly resizeEvent: "resize" = "resize";
  public static readonly moveEvent: "move" = "move";
  public static readonly willMoveEvent: "will-move" = "will-move";
  public static readonly willResizeEvent: "will-resize" = "will-resize";
  public static readonly maximizeEvent: "maximize" = "maximize";
  public static readonly unmaximizeEvent: "unmaximize" = "unmaximize";
  public static readonly enterFullScreenEvent: "enter-full-screen" = "enter-full-screen";
  public static readonly leaveFullScreenEvent: "leave-full-screen" = "leave-full-screen";
  public static readonly boundsSaveDelay: number = 500;
  public static readonly connectingShowLimit: number = 2_000;
  public static readonly paintShowLimit: number = 10_000;
  public static readonly logLineSeparator: string = "\n";
  public static readonly moduleIdPattern: RegExp = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
  public static readonly reloadCrashLimit: number = 10_000;
  public static readonly rendererEndLimit: number = 5_000;
  public static readonly renderProcessGoneEvent: "render-process-gone" = "render-process-gone";
  public static readonly inputEvent: "input-event" = "input-event";
  public static readonly didStartLoadingEvent: "did-start-loading" = "did-start-loading";
  public static readonly didStartNavigationEvent: "did-start-navigation" = "did-start-navigation";
  public static readonly contextMenuEvent: "context-menu" = "context-menu";
  public static readonly unresponsiveEvent: "unresponsive" = "unresponsive";
  public static readonly responsiveEvent: "responsive" = "responsive";
  public static readonly cleanExitReason: string = "clean-exit";
  public static readonly warningBoxType: "warning" = "warning";
  public static readonly infoBoxType: "info" = "info";
  public static readonly errorBoxType: "error" = "error";
  public static readonly bundleCommandSegments: readonly string[] = ["..", "Resources", "bin"];
  public static readonly pathCommandFolder: string = "/usr/local/bin";
  public static readonly scriptRunner: string = "/usr/bin/osascript";
  public static readonly administratorScript: readonly string[] = [
    "-e", "on run argv",
    "-e", "set commandLink to quoted form of (item 3 of argv)",
    "-e", "do shell script \"[ -e \" & commandLink & \" ] && [ ! -L \" & commandLink & \" ] && exit 3; /bin/mkdir -p \" & quoted form of (item 2 of argv) & \" && /bin/ln -sfh \" & quoted form of (item 1 of argv) & \" \" & commandLink with prompt (item 4 of argv) with administrator privileges",
    "-e", "end run"
  ];
  public static readonly userCancelledCode: string = "(-128)";
  public static readonly occupiedExitCode: string = "(3)";
  public static readonly missingErrorCode: string = "ENOENT";
  public static readonly existingErrorCode: string = "EEXIST";
  public static readonly errorCodeField: "code" = "code";
  public static readonly deniedErrorCodes: readonly string[] = ["EACCES", "EPERM"];
  public static readonly unreadablePathCodes: readonly string[] = ["ENOENT", "ENOTDIR", "ELOOP", "EINVAL", "EACCES", "EPERM"];
  public static readonly windowStoppedDetail: string = "Reload it to continue. Your layout comes back from the last save.";
  public static readonly windowStoppedAgainDetail: string = "It stopped again right after it was reloaded. The log folder has what it recorded.";
  public static readonly windowNotRespondingDetail: string = "You can wait for it or reload it.";
  public static readonly reloadButton: string = "Reload";
  public static readonly quitButton: string = "Quit";
  public static readonly waitButton: string = "Wait";
  public static readonly openLogFolderButton: string = "Open log folder";
  public static readonly windowUnresponsive: string = "The window's page stopped responding.";
  public static readonly windowResponsiveAgain: string = "The window's page responds again.";
  public static readonly windowStoppedAgainRecord: string = "The window's page stopped again within 10 s of a reload, so the person was offered the log folder instead of another reload.";
  public static readonly uncaughtExceptionEvent: "uncaughtException" = "uncaughtException";
  public static readonly unhandledRejectionEvent: "unhandledRejection" = "unhandledRejection";
  public static readonly quitExitCode: number = 0;
  public static readonly appBundleExtension: string = ".app";
  public static readonly bundleFromProgramSegments: readonly string[] = ["..", "..", ".."];
  public static readonly macApplicationsFolder: string = "/Applications";
  public static readonly macHomeApplicationsFolder: string = "Applications";
  public static readonly homeVariable: string = "HOME";
  public static readonly installFolderStagingPrefix: string = ".";
  public static readonly dittoProgram: string = "/usr/bin/ditto";
  public static readonly installFolderStagingSeparator: string = "-";
  public static readonly installFolderStagingProcessPattern: RegExp = /^[1-9]\d*$/u;
  public static readonly missingProcessErrorCode: string = "ESRCH";
  public static readonly plistProgram: string = "/usr/bin/plutil";
  public static readonly bundleInformationSegments: readonly string[] = ["Contents", "Info.plist"];
  public static readonly bundleIdentifierKey: string = "CFBundleIdentifier";
  public static readonly bundleVersionKey: string = "CFBundleShortVersionString";
  public static readonly removeProgram: string = "/bin/rm";
  public static readonly removeRecursiveOption: string = "-rf";
  public static readonly failureExitCode: number = 1;
  public static readonly mainWindow: string = "main";
  public static readonly deviceNotIdentified: string = "This device has no identity, so the window's layout and Do not disturb are not kept.";
  public static readonly descriptionsField: string = "descriptions";
  public static readonly isWaitingField: string = "isWaiting";
  public static readonly isUpdateField: string = "isUpdate";
  public static readonly windowMinimumWidth: number = 640;
  public static readonly windowMinimumHeight: number = 480;
  public static readonly windowWidth: number = 1280;
  public static readonly windowHeight: number = 800;
  public static readonly windowAreaShare: number = 0.9;
  public static readonly windowRowReach: number = 160;
  public static readonly closeAnswerTimeout: number = 5000;
  public static readonly layoutWriteTimeout: number = 5000;
  public static readonly updateBarrierInterval: number = 1000;
  public static readonly updatePrepareTimeout: number = 15000;
  public static readonly updateExitWait: number = 10000;
  public static readonly updateStopMargin: number = 10000;
  public static readonly updateExitInterval: number = 250;
  public static readonly runtimeStartWait: number = 15000;
  public static readonly barrierReleaseRetryDelay: number = 1000;
  public static readonly runtimeStartInterval: number = 250;
  public static readonly updateRelaunchLimit: number = 10000;
  public static readonly updateNotRelaunchedInTime: string = "macOS didn't quit to install the update within 10 seconds.";
  public static readonly workSeparator: string = "; ";
  public static readonly separatorMenuType: "separator" = "separator";
  public static readonly checkboxMenuType: "checkbox" = "checkbox";
  public static readonly radioMenuType: "radio" = "radio";
  public static readonly normalMenuType: "normal" = "normal";
  public static readonly undoRole: "undo" = "undo";
  public static readonly redoRole: "redo" = "redo";
  public static readonly cutRole: "cut" = "cut";
  public static readonly copyRole: "copy" = "copy";
  public static readonly pasteRole: "paste" = "paste";
  public static readonly pasteAndMatchStyleRole: "pasteAndMatchStyle" = "pasteAndMatchStyle";
  public static readonly deleteRole: "delete" = "delete";
  public static readonly selectAllRole: "selectAll" = "selectAll";
  public static readonly startSpeakingRole: "startSpeaking" = "startSpeaking";
  public static readonly stopSpeakingRole: "stopSpeaking" = "stopSpeaking";
  public static readonly servicesRole: "services" = "services";
  public static readonly hideRole: "hide" = "hide";
  public static readonly hideOthersRole: "hideOthers" = "hideOthers";
  public static readonly unhideRole: "unhide" = "unhide";
  public static readonly quitRole: "quit" = "quit";
  public static readonly minimizeRole: "minimize" = "minimize";
  public static readonly zoomRole: "zoom" = "zoom";
  public static readonly closeRole: "close" = "close";
  public static readonly frontRole: "front" = "front";
  public static readonly aboutRole: "about" = "about";
  public static readonly windowRole: "window" = "window";
  public static readonly helpRole: "help" = "help";
  public static readonly pngMimeType: string = "image/png";
  public static readonly killSignal: NodeJS.Signals = "SIGKILL";
  public static readonly probeSignal: number = 0;
  public static readonly argumentSeparator: string = " ";
  public static readonly mediaSourceParts: number = 3;
  public static readonly pipedStdio: "pipe" = "pipe";
  public static readonly datePadLength: number = 2;
  public static readonly datePadCharacter: string = "0";
  public static readonly dateSeparator: string = "-";
  public static readonly userAgentCommentSeparator: string = "; ";
  public static readonly grantByteLength: number = 16;
  public static readonly stagedFolderMode: number = 0o700;
  public static readonly stagedFileMode: number = 0o600;
  public static readonly pngWidthOffset: number = 16;
  public static readonly pngHeightOffset: number = 20;
  public static readonly millisecondsPerSecond: number = 1_000;
  public static readonly maximumProgress: number = 100;
  public static readonly trayLabelSpacesPattern: RegExp = /\s+/g;
  public static readonly trayLabelSpace: string = " ";
  public static readonly mnemonicMarker: string = "&";
  public static readonly escapedMnemonicMarker: string = "&&";
  public static readonly workQueryTimeout: number = 2000;
  public static readonly programTimeout: number = 5000;
  public static readonly programOutputLimit: number = 65536;
  public static readonly gdbusPath: string = "/usr/bin/gdbus";
  public static readonly trayHostQueryArguments: readonly string[] = [
    "call", "--session", "--dest", "org.kde.StatusNotifierWatcher", "--object-path", "/StatusNotifierWatcher",
    "--method", "org.freedesktop.DBus.Properties.Get", "org.kde.StatusNotifierWatcher", "IsStatusNotifierHostRegistered"
  ];
  public static readonly trayHostMonitorArguments: readonly string[] = ["monitor", "--session", "--dest", "org.kde.StatusNotifierWatcher"];
  public static readonly trayHostRegisteredAnswer: string = "(<true>,)";
  public static readonly trayMonitorFirstDelay: number = 1000;
  public static readonly trayMonitorLongestDelay: number = 60_000;
  public static readonly trayMonitorDelayGrowth: number = 2;
  public static readonly windowLogLimit: number = 65536;
  public static readonly windowErrorBurst: number = 10;
  public static readonly windowErrorPeriod: number = 60000;
  public static readonly windowErrorsLeftOut: string = "The window reported more than ten errors within a minute; the rest of that minute's errors are left out of the log.";
  public static readonly executableField: string = "executable";
  public static readonly argumentsField: string = "arguments";
  public static readonly errorFileField: string = "errorFile";
  public static readonly environmentField: string = "environment";
  public static readonly environmentNotText: string = "An environment variable's value must be text.";
  public static readonly processIdField: string = "processId";
  public static readonly failureField: string = "failure";
  public static readonly payloadField: string = "payload";
  public static readonly replyNeedsOneOutcome: string = "A start reply carries either a process id or a failure.";
  public static readonly starterEnded: string = "The runtime starter ended before it started the runtime.";
  public static readonly starterAcknowledgement: string = "acknowledged";
  public static readonly utilityEntryRelativePath: string = "../utility-entry.js";
  public static readonly ignoredStdio: "ignore" = "ignore";
  public static readonly messageEvent: "message" = "message";
  public static readonly exitEvent: "exit" = "exit";
  public static readonly xField: string = "x";
  public static readonly yField: string = "y";
  public static readonly widthField: string = "width";
  public static readonly heightField: string = "height";
  public static readonly maximizedField: string = "maximized";
  public static readonly invalidWindowState: string = "The saved window state is not valid.";
  public static readonly positionPairMessage: string = "A window position has both coordinates or neither.";
  public static readonly windowUrlParameter: string = "windowUrl";
  public static readonly timeoutParameter: string = "timeout";
  public static readonly backgroundField: string = "background";
  public static readonly titleBarField: string = "titleBar";
  public static readonly titleBarTextField: string = "titleBarText";
  public static readonly titleBarHeightField: string = "titleBarHeight";
  public static readonly invalidAppearance: string = "The window appearance is not valid.";
  public static readonly menusField: string = "menus";
  public static readonly placeField: string = "place";
  public static readonly titleField: string = "title";
  public static readonly rowsField: string = "rows";
  public static readonly typeField: "type" = "type";
  public static readonly idField: string = "id";
  public static readonly labelField: string = "label";
  public static readonly keyField: string = "key";
  public static readonly enabledField: string = "enabled";
  public static readonly checkField: string = "check";
  public static readonly checkedField: string = "checked";
  public static readonly appMenu: string = "desktop.app";
  public static readonly editMenu: string = "desktop.edit";
  public static readonly windowMenu: string = "desktop.window";
  public static readonly helpMenu: string = "desktop.help";
  public static readonly commandKey: string = "Command";
  public static readonly controlKey: string = "Control";
  public static readonly altKey: string = "Alt";
  public static readonly shiftKey: string = "Shift";
  public static readonly acceleratorSeparator: string = "+";
  public static readonly invalidMenuBar: string = "The menu bar is not valid.";
  public static readonly speechLabel: string = "Speech";
  public static readonly editTitle: string = "Edit";
  public static readonly windowTitle: string = "Window";
  public static readonly closeWindowLabel: string = "Close Window";
  public static readonly closeWindowAccelerator: string = "Command+Shift+W";
  public static readonly macMenuKeys: readonly string[] = ["Mod+Q", "Mod+H", "Mod+Alt+H", "Mod+M", "Mod+Shift+W"];
  public static readonly windowMediaSource: string = "window";
  public static readonly mediaSourceSeparator: string = ":";
  public static readonly invalidColor: string = "A window color is a hexadecimal color or an rgb() or rgba() color.";
  public static readonly colorPattern: RegExp = /^(?:#[0-9A-Fa-f]{3,8}|rgba?\([0-9., %/]+\))$/;
  public static readonly validSignatureStatus: number = 0;
  public static readonly signerUnreadable: string = "Windows verified its signature but could not read its signer's name";
  public static readonly publisherUnknown: string = "this build is unsigned, so it has no publisher to check the update's signer against";
  public static readonly updateKeysUnknown: string = "this build is unsigned, so it has no key to check the update's signature against";
  public static readonly updateEntryMissing: string = "the update's information lists no such file";
  public static readonly updateSignatureMissing: string = "the update's information carries no signature for it";
  public static readonly updateHashDiffers: string = "its SHA-512 differs from the update's information";
  public static readonly updateSignatureInvalid: string = "its signature is not by a key this build ships";
  public static readonly updateReadySignatureMissing: string = "the ready update's record carries no signature for it";
  public static readonly updateSignatureField: string = "signature";
  public static readonly updateSignatureLength: number = 64;
  public static readonly publicKeyEncoding: "spki" = "spki";
  public static readonly keyDerFormat: "der" = "der";
  public static readonly nameEscape: string = "\\";
  public static readonly nameQuote: string = "\"";
  public static readonly nameSeparator: string = ",";
  public static readonly nameAssignment: string = "=";
  public static readonly lineBreaks: RegExp = /\s*[\r\n]+\s*/g;
  public static readonly lineJoin: string = " ";
  public static readonly isEndedField: string = "isEnded";
  public static readonly isTimedOutField: string = "isTimedOut";
  public static readonly targetClosedError: string = "target closed";
  public static readonly ipv4Version: number = 4;
  public static readonly ipv6Version: number = 6;
  public static readonly ipv4Separator: string = ".";
  public static readonly ipv6Separator: string = ":";
  public static readonly ipv6ZeroRun: string = "::";
  public static readonly hextetRadix: number = 16;
  public static readonly mappedMarkerHextet: number = 5;
  public static readonly mappedIpv4Marker: number = 0xffff;
  public static readonly embeddedIpv4Hextet: number = 6;
  public static readonly nat64PrefixHextets: number = 2;
  public static readonly byteBits: number = 8;
  public static readonly byteMask: number = 0xff;
  public static readonly nat64First: number = 0x64;
  public static readonly nat64Second: number = 0xff9b;
  public static readonly uniqueLocalMask: number = 0xfe00;
  public static readonly uniqueLocalPrefix: number = 0xfc00;
  public static readonly linkLocalMask: number = 0xffc0;
  public static readonly linkLocalPrefix: number = 0xfe80;
  public static readonly loopbackFirst: number = 127;
  public static readonly privateClassAFirst: number = 10;
  public static readonly privateClassBFirst: number = 172;
  public static readonly privateClassBSecondLow: number = 16;
  public static readonly privateClassBSecondHigh: number = 31;
  public static readonly privateClassCFirst: number = 192;
  public static readonly privateClassCSecond: number = 168;
  public static readonly sharedAddressFirst: number = 100;
  public static readonly sharedAddressSecondLow: number = 64;
  public static readonly sharedAddressSecondHigh: number = 127;
  public static readonly linkLocalFirst: number = 169;
  public static readonly linkLocalSecond: number = 254;
  public static readonly faviconDecodeWorld: number = 1997;
  public static readonly faviconDecodeTimeout: number = 2000;
  public static readonly faviconFetchTimeout: number = 10_000;
  public static readonly faviconCandidateLimit: number = 4;
  public static readonly faviconByteLimit: number = 1_048_576;
  public static readonly faviconSide: number = 64;
  public static readonly faviconPngLimit: number = 16_384;
  public static readonly faviconBase64Limit: number = 21_848;
  public static readonly faviconHeaderStart: number = 12;
  public static readonly faviconWidthOffset: number = 16;
  public static readonly faviconHeightOffset: number = 20;
  public static readonly faviconHeaderEnd: number = 24;
  public static readonly faviconHeaderType: string = "IHDR";
  public static readonly faviconPngPrefix: string = "data:image/png;base64,";
  public static readonly faviconPngSignature: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  public static readonly faviconBase64Pattern: RegExp = /^[A-Za-z0-9+/]+={0,2}$/u;

  public static get updateUnderWay(): string {
    return `Another update of ${Resources.applicationName} is under way.`;
  }

  public static get installerNotCopied(): string {
    return `${Resources.applicationName} couldn't make a protected copy of the update's installer.`;
  }

  public static get updaterNotCreated(): string {
    return `${Resources.applicationName} couldn't start checking for updates.`;
  }

  public static get updateHolderNotFound(): string {
    return `${Resources.applicationName} could not find its own process in the process table.`;
  }

  public static get applicationName(): string {
    return ProductInfo.current.name;
  }

  public static get installFolder(): string | null {
    return ProductInfo.current.installFolder;
  }

  public static formatCommandLineNotStarted(program: string, reason: string): string {
    return `The command line could not start through ${program}: ${reason}\n`;
  }

  public static formatInstallFolderMoved(bundle: string, target: string): string {
    return `Moved ${bundle} into its install folder, as ${target}, and moved the old copy to the Trash.`;
  }

  public static formatInstallFolderOldCopyKept(bundle: string, target: string, reason: string): string {
    return `Copied ${bundle} into its install folder, as ${target}, but the old copy could not be moved to the Trash: ${reason}`;
  }

  public static formatInstallFolderNotWritable(bundle: string, target: string, reason: string): string {
    return `${bundle} could not be copied to ${target}, so it keeps running where it is: ${reason}`;
  }

  public static plistExtractArguments(key: string): readonly string[] {
    return ["-extract", key, "raw", "-o", "-"];
  }

  public static formatInstallFolderAlreadyThere(bundle: string, target: string): string {
    return `${target} already holds the app, as new as ${bundle} or newer, so the old copy was moved to the Trash.`;
  }

  public static formatInstallFolderTargetExists(bundle: string, target: string, identifiers: readonly string[], versions: readonly string[]): string {
    return `${bundle} stays where it is, since ${target} already exists and is not the same app as new or newer: ${identifiers.join(" and ")}, versions ${versions.join(" and ")}.`;
  }

  public static formatInstallFolderTargetUnread(bundle: string, target: string, reason: string): string {
    return `${bundle} stays where it is, since ${target} already exists and could not be read: ${reason}`;
  }

  public static formatInstallFolderHomeCopyTrashed(copy: string, target: string): string {
    return `${target} holds the app, as new as ${copy} or newer, so the copy in the home folder's Applications was moved to the Trash.`;
  }

  public static formatInstallFolderHomeCopyLinked(copy: string, target: string, resolved: string): string {
    return `${copy} stays where it is, since it is not a copy of its own beside ${target}: it resolves to ${resolved}.`;
  }

  public static formatInstallFolderHomeCopyKept(copy: string, target: string, reason: string): string {
    return `${target} holds the app, but the copy in the home folder's Applications, ${copy}, could not be moved to the Trash: ${reason}`;
  }

  public static formatInstallFolderStagingLeft(staging: string, reason: string): string {
    return `The unfinished copy ${staging} could not be removed: ${reason}`;
  }

  public static get appUserModelId(): string {
    return ProductInfo.current.applicationId;
  }

  public static get developmentAppUserModelId(): string {
    return ProductInfo.current.developmentApplicationId;
  }

  public static get updateInstalling(): string {
    return `${Resources.applicationName} is installing an update.`;
  }

  public static get updateInstallingDetail(): string {
    return `Open ${Resources.applicationName} again once the update has finished.`;
  }

  public static get updateRelaunchFailed(): string {
    return `macOS will install the update once ${Resources.applicationName} quits, but ${Resources.applicationName} can't open again by itself.`;
  }

  public static get updateRelaunchFailedDetail(): string {
    return `Open ${Resources.applicationName} once the update has installed.`;
  }

  public static get debianInstallerMissing(): string {
    return `This copy of ${Resources.applicationName} is a Debian package, but this system has no pkexec to ask for an administrator's permission, so it can't install the update.`;
  }

  public static get debianUpdateInstallerMissing(): string {
    return `This copy of ${Resources.applicationName} is a Debian package, but its update installer is missing or can be changed by someone other than root, so it can't install the update.`;
  }

  public static get notAnAppImage(): string {
    return `This copy of ${Resources.applicationName} doesn't run from an AppImage, so it can't install the update.`;
  }

  public static formatUpdateRelaunchFailed(reason: string): string {
    return `The update was handed off, but macOS could not be asked to install it and start the new version, so the main process quits instead: ${reason}`;
  }

  public static get updateUnfinished(): string {
    return `An update of ${Resources.applicationName} may still be installing, or it did not finish.`;
  }

  public static get updateUnfinishedDetail(): string {
    return `If no installer is still running, open ${Resources.applicationName} to go on with the version you have.`;
  }

  public static get openApplicationButton(): string {
    return `Open ${Resources.applicationName}`;
  }

  public static get updateBarrierNotCleared(): string {
    return `${Resources.applicationName} could not clear the unfinished update, so it will quit.`;
  }

  public static get updateBarrierNotClearedDetail(): string {
    return `Open ${Resources.applicationName} again in a moment. If this keeps happening, its log has the reason.`;
  }

  public static formatScrollBackScript(x: number, y: number): string {
    return `scrollTo(${x}, ${y})`;
  }

  public static formatLayoutReadAfterFailedWrite(message: string): string {
    return `The window's layout was read after its last write failed or went unanswered, so it may be the layout kept before that write: ${message}`;
  }

  public static formatBarrierNotCleared(message: string): string {
    return `The launch barrier of an unfinished update could not be removed: ${message}`;
  }

  public static formatRelaunchFailed(reason: string): string {
    return `${Resources.applicationName} could not start itself apart from the terminal, so it runs in the terminal and quits when the terminal closes: ${reason}`;
  }

  public static formatHandoverFailed(reason: string): string {
    return `The newer ${Resources.applicationName} could not be started for the hand-over, so this one quits without it: ${reason}`;
  }

  public static formatBarrierUnreadable(message: string): string {
    return `The launch barrier could not be read: ${message}`;
  }

  public static formatBarrierUnwatched(message: string): string {
    return `The launch barrier's folder could not be watched, so another main process's update can't close this one: ${message}`;
  }

  public static formatBarrierUnsettled(message: string): string {
    return `The launch barrier could not be settled: ${message}`;
  }

  public static formatWindowSaveUnanswered(window: number): string {
    return `Window ${window} did not finish saving within 5 seconds.`;
  }

  public static formatWindowSaveGone(window: number): string {
    return `Window ${window} closed before it saved.`;
  }

  public static formatMainProcessUnrecorded(message: string): string {
    return `This main process could not be recorded in its installation, so an update may not wait for it: ${message}`;
  }

  public static formatWebViewCommandInvalid(reason: string): string {
    return `The runtime sent a web view command that is not valid, so it was not answered: ${reason}`;
  }

  public static formatSecretCommandInvalid(reason: string): string {
    return `The runtime sent a secret command that is not valid, so it was not answered: ${reason}`;
  }

  public static formatSharedFileAddress(grant: string): string {
    return `${Resources.sharedFileScheme}://${grant}/`;
  }

  public static formatSharedFileRefused(reason: string): string {
    return `A shared file was not served: ${reason}.`;
  }

  public static formatFileNotGranted(name: string, reason: string): string {
    return `${name} was not given to the module: ${reason}`;
  }

  public static formatOfferedFileUnreadable(code: string): string {
    return `it can't be read (${code}).`;
  }

  public static formatOfferedFileUnstaged(code: string): string {
    return `it can't be staged for the module (${code}).`;
  }

  public static formatFileFilterName(extensions: readonly string[]): string {
    return extensions.map(t => `*.${t}`).join(", ");
  }

  public static formatWebViewPortsUnread(reason: string): string {
    return `The runtime's blocked loopback ports could not be read, so web views refuse every loopback address: ${reason}`;
  }

  public static formatWebViewPortsInvalid(reason: string): string {
    return `The runtime sent blocked loopback ports that are not valid, so they were not acknowledged: ${reason}`;
  }

  public static formatWebViewsUnreadable(reason: string): string {
    return `The modules' web view declarations could not be read, so no web view opens: ${reason}`;
  }

  public static formatWebViewPageWithoutView(contentsId: number, address: string): string {
    return `A page load was refused because its web contents ${contentsId} belong to no web view Noldova Desktop opened: ${address}`;
  }

  public static formatWebViewScrollNotKept(module: string, view: string): string {
    return `Web view ${view} of ${module} kept no scroll position: its page did not answer where it was scrolled within ${Resources.webViewScrollReadTimeout} ms, or answered no position, so it will not be scrolled back once it moves.`;
  }

  public static formatWebViewScrollNotRestored(module: string, view: string, x: number, y: number, reason: string): string {
    return `Web view ${view} of ${module} was not scrolled back to (${x}, ${y}): ${reason}.`;
  }

  public static formatWebViewScrollKeptPending(module: string, view: string, x: number, y: number): string {
    return `Web view ${view} of ${module} kept the scroll position (${x}, ${y}) its restored page had not been scrolled back to yet, rather than where that page showed.`;
  }

  public static formatWebViewRestoreFailedShown(module: string, view: string, error: string): string {
    return `Web view ${view} of ${module} restored its page with an error (${error}) but shows the kept address, so it is still scrolled back.`;
  }

  public static formatWebViewScrollShown(x: number, y: number): string {
    return `its restored page already showed (${x}, ${y})`;
  }

  public static formatWebViewScrollScriptFailed(error: string): string {
    return `its scroll script failed (${error})`;
  }

  public static formatWebViewAttachRefused(windowId: number, partition: string): string {
    return `A <webview> in window ${windowId} was refused, because its partition "${partition}" belongs to no web view the window opened.`;
  }

  public static formatShortcutPress(windowId: number, press: number): string {
    return `${windowId} ${press}`;
  }

  public static formatWebViewPartition(module: string, profileKey: string): string {
    return `${Resources.webViewPartitionPrefix}${module}${Resources.webViewPartitionSeparator}${profileKey}`;
  }

  public static formatNotAnAddress(address: string): string {
    return `"${address}" is not an IPv4 or IPv6 address.`;
  }

  public static get untrustedRequest(): string {
    return `Only ${Resources.applicationName}'s own window may call the runtime.`;
  }

  public static get restartName(): string {
    return `${ProductInfo.current.slug}-restart`;
  }

  public static get restartArgumentsNotWritten(): string {
    return `${Resources.applicationName} couldn't keep its data and device folders for the new version, so the update wasn't installed.`;
  }

  public static formatRestartArgumentsFile(installationId: string): string {
    return `${ProductInfo.current.slug}-restart-${installationId}.json`;
  }

  public static formatRestartArgumentsTaken(launchArguments: readonly string[]): string {
    return `The main process runs on the folders of the version it updated: ${launchArguments.join(" ")}`;
  }

  public static formatRestartArgumentsUnread(error: string): string {
    return `The folders kept for this version could not be read, so it starts on its own: ${error}`;
  }

  public static formatRestartArgumentsNotForgotten(error: string): string {
    return `The folders kept for this version could not be removed after it read them: ${error}`;
  }

  public static formatRestartArgumentsNotRemoved(error: string): string {
    return `The folders kept for the new version could not be removed after the update failed: ${error}`;
  }

  public static formatAppImagePart(name: string, unique: string): string {
    return `.${name}.${unique}.part`;
  }

  public static formatAppImageUnreadable(image: string, reason: string): string {
    return `The AppImage ${image} could not be read, so the update was not installed: ${reason}`;
  }

  public static formatAppImageFolderUnwritable(folder: string, reason: string): string {
    return `The folder ${folder} cannot be written, so the AppImage in it cannot be replaced with the update: ${reason}`;
  }

  public static formatAppImageLeftoverNotRemoved(folder: string): string {
    return `An unfinished copy of an earlier update in ${folder} could not be removed, so the AppImage in it was not replaced.`;
  }

  public static formatDebianUpdateArgumentsRefused(file: string): string {
    return `The update installer refused the arguments it was given for ${file}, so the installed version was left as it was.`;
  }

  public static formatDebianPackageNotInstalled(file: string, reason: string): string {
    return `The Debian package ${file} could not be installed, so the installed version was left as it was: ${reason}`;
  }

  public static formatAppImageNotReplaced(image: string, reason: string): string {
    return `The AppImage ${image} could not be replaced with the update and was left as it was: ${reason}`;
  }

  public static formatAppImageFolderNotSynced(folder: string, reason: string): string {
    return `The AppImage in ${folder} was replaced, but the folder could not be flushed to disk: ${reason}`;
  }

  public static formatShipItLabel(bundleIdentifier: string): string {
    return `${bundleIdentifier}.ShipIt`;
  }

  public static formatSystemLaunchJob(label: string): string {
    return `system/${label}`;
  }

  public static formatShipItUnreadable(reason: string): string {
    return `The installer process of the staged update could not be looked up: ${reason}`;
  }

  public static formatBuildDetails(productVersion: string, fingerprint: string): string {
    return `${Resources.applicationName} ${productVersion}, build ${fingerprint}`;
  }

  public static formatDataFolderDetails(folder: string): string {
    return `Data folder: ${folder}`;
  }

  public static formatDatabasesNotBackedUp(dataDirectory: string, reason: string): string {
    return `${Resources.applicationName} couldn't back up the databases of ${dataDirectory}, so the update didn't start: ${reason}`;
  }

  public static formatRuntimeNotReached(dataDirectory: string): string {
    return `${Resources.applicationName} couldn't reach the runtime of ${dataDirectory} to stop it for the update.`;
  }

  public static formatRuntimeStillStarting(dataDirectory: string): string {
    return `The runtime of ${dataDirectory} was still starting, so it couldn't be stopped for the update.`;
  }

  public static formatUpdateBarrierNotReleased(reason: string): string {
    return `The update's barrier could not be removed after the update stopped, even when tried again: ${reason}`;
  }

  public static formatFailureWithCause(message: string, cause: string): string {
    return `${message} (${cause})`;
  }

  public static formatRuntimeNotFound(dataDirectory: string): string {
    return `The runtime of ${dataDirectory} could not be identified, so it can't be verified to stop for the update.`;
  }

  public static formatStoppedShipItNotRemoved(reason: string): string {
    return `The job of an installed update could not be removed, so it is tried again at the next start: ${reason}`;
  }

  public static formatShipItNotRemoved(reason: string): string {
    return `The staged update could not be withdrawn, so it may install when ${Resources.applicationName} quits: ${reason}`;
  }

  public static formatInstallerUnsigned(installer: string, reason: string): string {
    return `The update's installer ${installer} is not signed by the publisher, so it was not started: ${reason}`;
  }

  public static formatInstallerNotStarted(installer: string, reason: string): string {
    return `The update's installer ${installer} could not be started: ${reason}`;
  }

  public static get iconFolderSegments(): readonly string[] {
    return ProductInfo.current.icons.split(Resources.folderSeparator);
  }

  public static get commandName(): string {
    return ProductInfo.current.slug;
  }

  public static get commandInstalled(): string {
    return `The ${Resources.commandName} command is installed.`;
  }

  public static get commandAlreadyInstalled(): string {
    return `The ${Resources.commandName} command is already installed.`;
  }

  public static get commandNotInstalled(): string {
    return `The ${Resources.commandName} command was not installed.`;
  }

  public static get commandMissingDetail(): string {
    return `This build of ${Resources.applicationName} has no command to link; an installed ${Resources.applicationName} has one.`;
  }

  public static get windowStopped(): string {
    return `${Resources.applicationName}'s window stopped unexpectedly.`;
  }

  public static get windowNotResponding(): string {
    return `${Resources.applicationName}'s window isn't responding.`;
  }

  public static get mainProcessFailed(): string {
    return `${Resources.applicationName} stopped because of an unexpected error.`;
  }

  public static get mainProcessFailedDetail(): string {
    return "Work running in the runtime continues. Changes from the last few seconds may not have been saved. "
      + `Restart ${Resources.applicationName} to go on, or open the log folder to see what happened.`;
  }

  public static get mainProcessFailedBeforeStartDetail(): string {
    return `This happened while ${Resources.applicationName} was starting. Restart ${Resources.applicationName} to try again.`;
  }

  public static get restartButton(): string {
    return `Restart ${Resources.applicationName}`;
  }

  public static get runtimeNotConnected(): string {
    return `${Resources.applicationName} is not connected to its runtime.`;
  }

  public static get starterServiceName(): string {
    return `${Resources.applicationName} runtime starter`;
  }

  public static formatInvalidDevice(file: string): string {
    return `The device identity in ${file} is not valid; remove the file to give this device a new identity.`;
  }

  public static formatWindowStateFailed(method: string, message: string): string {
    return `The runtime refused ${method}: ${message}`;
  }

  public static formatConnectionEnded(code: string, message: string): string {
    return `The main process ended its connection to the runtime, so it connects again (${code}): ${message}`;
  }

  public static formatEndedByMainProcess(code: string, message: string): string {
    return `the main process ended it (${code}): ${message}`;
  }

  public static formatReconnectionStopped(cause: string): string {
    return `The connection to the runtime ended ${Resources.reconnectionDelays.length + 1} times in a row, each within ${Resources.stableConnectionPeriod / 1000} seconds of connecting, so the main process stopped connecting again. The last time, ${cause}`;
  }

  public static formatEventNotForwarded(name: string, reason: string): string {
    return `The runtime's event ${name} could not be passed to the window: ${reason}`;
  }

  public static get openApplicationLabel(): string {
    return `Open ${Resources.applicationName}`;
  }

  public static get quitApplicationLabel(): string {
    return `Quit ${Resources.applicationName}`;
  }

  public static formatMoreWork(count: number): string {
    return `and ${count} more`;
  }

  public static formatRestartToUpdateLabel(version: string): string {
    return `Restart to update to ${version}`;
  }

  public static formatTrayToolTip(running: number, unread: number, isUpdateReady: boolean): string {
    const parts = [...running > 0 ? [`${running} running`] : [], ...unread > 0 ? [`${unread} unread`] : [], ...isUpdateReady ? ["update ready"] : []];
    return parts.length === 0 ? Resources.applicationName : `${Resources.applicationName}: ${parts.join(", ")}`;
  }

  public static formatSettingNotRead(name: string, reason: string): string {
    return `The setting ${name} could not be read for this device, so the main process keeps its last value: ${reason}`;
  }

  public static formatTrayNotShown(reason: string): string {
    return `The tray icon could not be shown: ${reason}`;
  }

  public static formatTrayStateNotRead(reason: string): string {
    return `The tray icon could not read the runtime's work and notifications: ${reason}`;
  }

  public static formatStopAgentsLabel(refusedKey: string | null): string {
    return Object.isNull(refusedKey) ? Resources.stopAgentsLabel : `${Resources.stopAgentsLabel} (${refusedKey} works only in the app)`;
  }

  public static formatStopKeyRefusedBody(key: string, platform: string): string {
    return `The system refused ${key}, so it stops agents only while ${Resources.applicationName} is in front. Stop agents in its icon's menu in the ${platform === Resources.windowsPlatform ? "notification area" : "tray"} works at any time.`;
  }

  public static formatStopKeyNotTaken(key: string, reason: string): string {
    return `The stop key ${key} could not be taken system-wide, so it works only in the app: ${reason}`;
  }

  public static formatStopKeyNoticeFailed(reason: string): string {
    return `The operating system did not show the notice that the stop key works only in the app: ${reason}`;
  }

  public static formatAgentCommandFailed(command: string, reason: string): string {
    return `The command ${command} could not run from the stop key or the tray: ${reason}`;
  }

  public static formatAppShortcutsNotRead(reason: string): string {
    return `The window's shortcuts could not be read, so the runtime keeps the last ones: ${reason}`;
  }

  public static formatAppSurfaceNotSent(method: string, reason: string): string {
    return `The runtime was not told ${method}, so it is sent again at the next change: ${reason}`;
  }

  public static formatAgentControlNotRead(reason: string): string {
    return `The runtime's agent control could not be read, so the stop key waits for its next change: ${reason}`;
  }

  public static formatDoNotDisturbNotSet(reason: string): string {
    return `Do not disturb could not be changed from the tray: ${reason}`;
  }

  public static formatWorkNotRead(reason: string): string {
    return `The runtime's work could not be read before quitting, so ${Resources.applicationName} quits without asking: ${reason}`;
  }

  public static formatRuntimeNotStopped(reason: string): string {
    return `The runtime could not be stopped as ${Resources.applicationName} quits: ${reason}`;
  }

  public static get trayCloseHintTitle(): string {
    return `${Resources.applicationName} is still running`;
  }

  public static formatTrayCloseHintBody(platform: string): string {
    return `Open it again or quit it from its icon in the ${platform === Resources.windowsPlatform ? "notification area" : "tray"}.`;
  }

  public static formatTrayCloseHintFailed(reason: string): string {
    return `The operating system did not show the hint that ${Resources.applicationName} is still running, so it counts as not shown: ${reason}`;
  }

  public static formatDeviceStateNotRead(reason: string): string {
    return `The device's state could not be read, so its hints count as not shown and the tray icon follows its default until the runtime answers: ${reason}`;
  }

  public static formatDeviceStateUnsaved(key: string, reason: string): string {
    return `The device could not record ${key} in its state: ${reason}`;
  }

  public static formatModuleLogLine(moduleId: string, line: string): string {
    return `${moduleId}: ${line}`;
  }

  public static formatWindowErrorLine(moduleId: string | null, line: string): string {
    return Object.isNull(moduleId) ? `Window error: ${line}` : `Window error in ${moduleId}: ${line}`;
  }

  public static formatBoundsUnsaved(reason: string): string {
    return `The window's bounds could not be saved: ${reason}`;
  }

  public static formatBoundsLostAtClose(reason: string): string {
    return `The window closed without saving its bounds, because the runtime could not be reached; the last position is lost: ${reason}`;
  }

  public static formatLocalBoundsUnkept(reason: string): string {
    return `The window's bounds from the runtime could not be kept on this device, so its next start waits for the runtime's: ${reason}`;
  }

  public static formatLocalBoundsUnreadable(reason: string): string {
    return `The window's bounds kept on this device could not be read, so it waits for the runtime's: ${reason}`;
  }

  public static formatBoundsNotRestored(reason: string): string {
    return `The window's saved bounds could not be restored, so it opens with its default bounds: ${reason}`;
  }

  public static formatMethodRefused(method: string): string {
    return `The window may not call ${method}; the main process calls the shell's methods itself.`;
  }

  public static formatLogFolderNotOpened(reason: string): string {
    return `The log folder could not be opened: ${reason}`;
  }

  public static formatLinkNotOpened(reason: string): string {
    return `A link could not be opened: ${reason}`;
  }

  public static formatFileNotOpened(reason: string): string {
    return `A file was not opened: ${reason}`;
  }

  public static formatFileNotShown(reason: string): string {
    return `A file was not shown in its folder: ${reason}`;
  }

  public static formatSavedFilePart(unique: string): string {
    return `.${unique}.part`;
  }

  public static formatImageNotCopied(reason: string): string {
    return `An image could not be copied: ${reason}`;
  }

  public static formatFileNotSaved(reason: string): string {
    return `A file could not be saved: ${reason}`;
  }

  public static formatDownloadsNotFound(reason: string): string {
    return `The Downloads folder was not found, so the save dialog starts in the system's last folder: ${reason}`;
  }

  public static formatNotAFolder(path: string): string {
    return `${path} is not a folder.`;
  }

  public static formatAdministratorPrompt(link: string): string {
    return `${Resources.applicationName} wants to link ${link} to its ${Resources.commandName} command, so that terminals can run it.`;
  }

  public static formatCommandInstalledDetail(link: string): string {
    return `${link} links to the command inside ${Resources.applicationName}. Terminals opened from now on run it as ${Resources.commandName}.`;
  }

  public static formatCommandAlreadyInstalledDetail(link: string): string {
    return `${link} already links to the command inside this ${Resources.applicationName}.`;
  }

  public static formatCommandOccupiedDetail(link: string): string {
    return `${link} is a file that is not a link, so ${Resources.applicationName} leaves it alone. Move or remove it, then install the command again.`;
  }

  public static formatPathCommandFailed(link: string, reason: string): string {
    return `The ${Resources.commandName} command could not be linked at ${link}: ${reason}`;
  }

  public static formatProgramFailed(file: string, reason: string): string {
    return `${file} failed: ${reason}`;
  }

  public static formatSystemNotificationFailed(reason: string): string {
    return `The operating system did not show a notification: ${reason}`;
  }

  public static formatNotificationsNotRead(reason: string): string {
    return `The notifications could not be read, so the operating system shows none until the window reads them again: ${reason}`;
  }

  public static formatDataFolderUnusable(folder: string, reason: string): string {
    return `${Resources.applicationName} cannot use the data folder ${folder}: ${reason}`;
  }

  public static formatFailureDetail(problem: string, advice: string): string {
    return `${problem}\n\n${advice}`;
  }

  public static formatDeviceUnavailable(reason: string): string {
    return `This device's identity could not be read, so window bounds are not kept: ${reason}`;
  }

  public static formatStarterFailed(failure: string): string {
    return `The runtime starter could not start the runtime: ${failure}`;
  }

  public static formatUpdateWork(description: string, dataDirectory: string): string {
    return `${description} (${dataDirectory})`;
  }

  public static formatWorkStartedMeanwhile(work: string): string {
    return `Work started while ${Resources.applicationName} prepared to update: ${work}`;
  }

  public static formatUpdateRefused(dataDirectory: string, message: string): string {
    return `The runtime of ${dataDirectory} could not prepare for the update: ${message}`;
  }

  public static formatUpdateUnsaved(dataDirectory: string, problems: string): string {
    return `Not everything of ${dataDirectory} was saved: ${problems}`;
  }

  public static formatProcessesNotExited(processes: string, seconds: number): string {
    return `These processes did not exit within ${seconds} seconds: ${processes}`;
  }

  public static formatUpdateSavedUnsent(message: string): string {
    return `The runtime was not told that the windows had saved for the update: ${message}`;
  }

  public static formatRuntimeNotStarted(reason: string): string {
    return `The runtime could not be started or reached, so the window offers to try again: ${reason}`;
  }

  public static formatDictionariesUnread(reason: string): string {
    return `The list of shipped dictionaries could not be read, so no spelling language is offered: ${reason}`;
  }

  public static formatDictionaryUncopied(reason: string): string {
    return `A shipped dictionary could not be put in the profile, so its language is not offered: ${reason}`;
  }

  public static formatDictionaryFieldInvalid(value: string): string {
    return `"${value}" is not a language tag or a dictionary file name.`;
  }

  public static formatSpellingLanguagesRefused(languages: string, reason: string): string {
    return `The spell checker refused the languages ${languages}: ${reason}`;
  }

  public static formatSpellingRejected(reason: string): string {
    return `The window's spelling preferences were rejected: ${reason}`;
  }

  public static formatRefusedPageScript(page: string): string {
    return `location.replace(${JSON.stringify(page)})`;
  }

  public static formatRefusedTitle(name: string, origin: string): string {
    return `${name} doesn't open ${origin}`;
  }

  public static formatRefusedReason(name: string): string {
    return `Its address isn't one ${name} opens.`;
  }

  public static formatNamelessRefusedTitle(origin: string): string {
    return `This view doesn't open ${origin}`;
  }

  public static formatRefusedPage(title: string, reason: string, background: string, color: string, nonce: string): string {
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">` +
      `<meta name="color-scheme" content="light dark"><title>${title}</title><style>body{margin:0;padding:1rem;background:${background};color:${color};font:0.875rem/1.4 system-ui,sans-serif}` +
      `h1{margin:0 0 0.5rem;font-size:1rem;font-weight:600;overflow-wrap:anywhere}p{margin:0}</style></head><body data-refused="${nonce}"><h1>${title}</h1><p>${reason}</p></body></html>`;
  }

  public static formatAppearanceUnread(reason: string): string {
    return `The device's last appearance could not be read, so the window starts in the default appearance: ${reason}`;
  }

  public static formatAppearanceUnsaved(reason: string): string {
    return `The device's appearance could not be kept for the next start: ${reason}`;
  }

  public static formatWindowPageNotLoaded(file: string, reason: string): string {
    return `The window's page ${file} didn't load: ${reason}`;
  }

  public static formatPreferencesRejected(reason: string): string {
    return `The window's appearance preferences are not valid, so they are not kept: ${reason}`;
  }

  public static formatMenuBarRejected(reason: string): string {
    return `The window sent a menu bar that is not valid, so the menu bar is unchanged: ${reason}`;
  }

  public static formatAppearanceRejected(reason: string): string {
    return `The window reported an appearance that is not valid, so it is shown without it: ${reason}`;
  }

  public static formatSingleInstanceLockRefused(processId: number): string {
    return `Another main process owns this data directory, so this one (${processId}) quits and asks that one to show its window.`;
  }

  public static formatMainProcessLogUnavailable(reason: string): string {
    return `The main process's log could not be written, so its records go to standard error only: ${reason}`;
  }

  public static formatJsonPath(path: string, name: string): string {
    return `${path}.${name}`;
  }

  public static formatQuotedArgument(value: string): string {
    return `"${value}"`;
  }

  public static formatDraftFile(file: string, id: string): string {
    return `${file}.${id}`;
  }

  public static formatTemporaryFile(file: string, id: string): string {
    return `${file}.${id}${Resources.temporarySuffix}`;
  }

  public static formatJsonLine(json: string): string {
    return `${json}${Resources.logLineSeparator}`;
  }

  public static formatFeedUserAgent(slug: string, version: string, comments: readonly string[]): string {
    return `${slug}/${version} (${comments.join(Resources.userAgentCommentSeparator)})`;
  }

  public static formatLogLine(time: string, text: string): string {
    return `${time} ${text}${Resources.logLineSeparator}`;
  }

  public static formatFeatureList(features: string, feature: string): string {
    return `${features},${feature}`;
  }

  public static formatArgumentValuePrefix(name: string): string {
    return `${name}=`;
  }

  public static formatProcessEntry(role: string, processId: number): string {
    return `${role} ${processId}`;
  }

  public static formatWindowShownUnpainted(seconds: number, isLoading: boolean, isCrashed: boolean): string {
    const page = isCrashed ? "its page has crashed" : isLoading ? "its page is still loading" : "its page loaded but did not report its first paint";
    return `The window was shown before it was painted, ${seconds} s after it opened, because ${page}.`;
  }

  public static formatPagePaintedLate(seconds: number): string {
    return `The window's page painted ${seconds} s after it opened, after the window was shown unpainted.`;
  }

  public static formatRendererGone(reason: string, exitCode: number): string {
    return `The window's page stopped: ${reason}, exit code ${exitCode}.`;
  }

  public static formatRendererEnded(processId: number): string {
    return `The window's page did not stop when asked, so the main process ended its process ${processId}.`;
  }

  public static formatNoRendererToEnd(processId: number): string {
    return `The window's page did not stop when asked and has no renderer process of its own to end (${processId}), so the main process reloads it.`;
  }

  public static formatRendererNotEnded(reason: string): string {
    return `The window's page did not stop when asked, and its process could not be ended, so the main process reloads it: ${reason}`;
  }

  public static formatRecoveryChoice(choice: string): string {
    return `The person chose ${choice}.`;
  }

  public static formatMainProcessFailure(kind: MainProcessFailureKind, error: string): string {
    return `The main process's main process failed with ${kind === MainProcessFailureKind.UnhandledRejection ? "an unhandled rejection" : "an uncaught exception"}: ${error}`;
  }

  public static formatMainProcessNotReleased(error: string): string {
    return `The main process could not stop its watchers and helper programs before it quit: ${error}`;
  }

  public static formatMainProcessBoxFailed(error: string): string {
    return `The main process could not ask what to do after its main process failed, so it quits: ${error}`;
  }

  public static get updateFeedUnreachable(): string {
    return `${Resources.applicationName} couldn't reach its update feed.`;
  }

  public static formatUpdateFeedRefused(status: number): string {
    return `The update feed answered with HTTP status ${status}.`;
  }

  public static get updateCheckedElsewhere(): string {
    return `Another ${Resources.applicationName} is checking for updates.`;
  }

  public static formatInstallerNotHeld(code: number): string {
    return `The update's installer couldn't be held unchanged for its start (Windows error ${code}).`;
  }

  public static formatUpdateNoLongerOffered(version: string): string {
    return `The update feed no longer offers version ${version}.`;
  }

  public static formatStagedUpdateKept(error: string): string {
    return `A failed handoff left its update staged: ${error}`;
  }

  public static formatHandoffNotRemoved(error: string): string {
    return `The copy of an update's installer could not be removed, so it is removed at the next start: ${error}`;
  }

  public static formatHandoffNotStamped(reason: string): string {
    return `The process that took over the update could not be read to record it in the update's barrier: ${reason}`;
  }

  public static formatHandoffNotRecorded(reason: string): string {
    return `The process that took over the update could not be recorded in the update's barrier: ${reason}`;
  }

  public static formatUpdateLockLeft(error: string): string {
    return `The update check's lock could not be removed, so it stays until this main process checks again or quits: ${error}`;
  }

  public static formatDownloadRefused(reason: string): string {
    return `The downloaded update was refused and is deleted: ${reason}`;
  }

  public static formatUpdateUnsignedAtHandoff(file: string, reason: string): string {
    return `The update ${file} carries no valid signature, so it was not installed: ${reason}`;
  }

  public static formatUpdateNotDeleted(error: string): string {
    return `The update that failed its publisher check could not be deleted: ${error}`;
  }

  public static formatUpdateCheckNotReleased(error: string): string {
    return `The update check could not let go of its lock: ${error}`;
  }

  public static formatUpdaterNotCreated(error: string): string {
    return `The updater could not be created, so this main process doesn't check for updates: ${error}`;
  }

  public static formatUpdateRequestCancelled(host: string): string {
    return `An update request to ${host} was cancelled: it is neither the feed's host nor GitHub's release asset host.`;
  }

  public static formatDailyCheckNotRecorded(error: string): string {
    return `The day's first update check could not be recorded, so a later start may mark today's check again: ${error}`;
  }

  public static formatUpdaterMessage(message: string): string {
    return `The updater reported: ${message}`;
  }

  public static formatSignatureInvalid(status: number, message: string): string {
    const code = `0x${status.toString(16).toUpperCase().padStart(8, "0")}`;
    return message.length > 0 ? `its signature is not valid (${code}): ${message}` : `its signature is not valid (${code})`;
  }

  public static formatSignedByAnother(signer: string, publisher: string): string {
    return `it is signed by ${signer}, not by ${publisher}`;
  }

  public static formatUpdateSignatureCheck(milliseconds: number, hasPassed: boolean): string {
    return hasPassed ? `The update's signature check passed in ${milliseconds} ms.` : `The update's signature check failed in ${milliseconds} ms.`;
  }

  public static formatUpdateSignatureUnchecked(error: string): string {
    return `its signature could not be checked: ${error}`;
  }

  public static formatUpdateTarget(platform: string, architecture: string): string {
    return `${platform}-${architecture}`;
  }

  public static formatUpdateSignatureMessage(version: string, target: string, name: string, sha512: string): string {
    return `noldova-desktop-update/1\n${version}\n${target}\n${name}\n${sha512}\n`;
  }

  public static formatPublisherCheck(milliseconds: number, hasPassed: boolean): string {
    return hasPassed ? `The update's publisher check passed in ${milliseconds} ms.` : `The update's publisher check failed in ${milliseconds} ms.`;
  }

  public static formatUpdateFailed(error: string): string {
    return `The update failed: ${error}`;
  }

  public static formatUpdateInstalled(version: string): string {
    return `version ${version} is no newer than the installed one`;
  }

  public static formatUpdateRecordDropped(reason: string): string {
    return `The ready update's record was removed, since ${reason}.`;
  }

  public static formatUpdateNotRecorded(error: string): string {
    return `The ready update could not be recorded, so it downloads again after a restart: ${error}`;
  }

  public static formatUpdateNotPosted(message: string): string {
    return `The runtime refused the ready update's notification, so the main process posts it again when the runtime is ready: ${message}`;
  }

  public static formatUpdateNotNotified(error: string): string {
    return `The ready update's notification could not be posted or recorded: ${error}`;
  }

  public static formatUpdateReadyTitle(version: string): string {
    return `${Resources.applicationName} ${version} is ready to install.`;
  }

  public static formatChannelFile(platform: string, architecture: string): string {
    return `latest-${platform}-${architecture}.yml`;
  }

  public static formatPackageFile(productName: string, platform: string, architecture: string, extension: string): string {
    return `${productName}-${platform}-${architecture}.${extension}`;
  }

  public static formatReleasedPackageFile(productName: string, version: string, platform: string, architecture: string, extension: string): string {
    return `${productName}-${version}-${platform}-${architecture}.${extension}`;
  }

  public static formatUpdateCacheFolder(slug: string, installationId: string): string {
    return `${slug}${Resources.updateCacheSuffix}${installationId}`;
  }

  public static formatWindowSize(name: string, minimum: number): string {
    return `The window ${name} is a whole number of at least ${minimum} pixels.`;
  }

  public static formatIpv4(first: number, second: number, third: number, fourth: number): string {
    return `${first}.${second}.${third}.${fourth}`;
  }

  public static formatSubdomainSuffix(hostname: string): string {
    return `.${hostname}`;
  }

  public static formatFaviconDecodeScript(source: string): string {
    return `(async () => {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob("${source}"), t => t.charCodeAt(0))]));
  const scale = Math.min(1, ${Resources.faviconSide} / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
  let text = "";
  for (const value of png)
    text += String.fromCharCode(value);
  return btoa(text);
})().catch(() => null)`;
  }
}

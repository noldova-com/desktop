/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export { LinkGesture } from "@noldova/ui.components.angular";

export { ViewToolbarBandComponent } from "../app/components/view-toolbar-band/view-toolbar-band.component.js";
export { KeepsCtrlKeysDirective } from "../app/directives/keeps-ctrl-keys.directive.js";
export { ContentPadding } from "../app/enums/content-padding.js";
export { DockSide } from "../app/enums/dock-side.js";
export { DocumentTone } from "../app/enums/document-tone.js";
export { FileSaveOutcome } from "../app/enums/file-save-outcome.js";
export { LinkPlace } from "../app/enums/link-place.js";
export { StatusBarItemTone } from "../app/enums/status-bar-item-tone.js";
export { StatusBarSide } from "../app/enums/status-bar-side.js";
export { TopBarSide } from "../app/enums/top-bar-side.js";
export { FileNotOpenedException } from "../app/exceptions/file-not-opened.exception.js";
export { FileNotShownException } from "../app/exceptions/file-not-shown.exception.js";
export { RuntimeRequestException } from "../app/exceptions/runtime-request.exception.js";
export { WindowException } from "../app/exceptions/window.exception.js";
export type { ICommandKey } from "../app/interfaces/i-command-key.js";
export type { IDocumentContributionOptions } from "../app/interfaces/i-document-contribution-options.js";
export type { IDocumentMarker } from "../app/interfaces/i-document-marker.js";
export type { IDocumentOptions } from "../app/interfaces/i-document-options.js";
export type { IDocumentStatus } from "../app/interfaces/i-document-status.js";
export type { IDocumentUpdate } from "../app/interfaces/i-document-update.js";
export type { IFileChoiceOptions } from "../app/interfaces/i-file-choice-options.js";
export type { IFilePathChoiceOptions } from "../app/interfaces/i-file-path-choice-options.js";
export type { IFileGrantOptions } from "../app/interfaces/i-file-grant-options.js";
export type { IInAppBrowser } from "../app/interfaces/i-in-app-browser.js";
export type { ILinkOpenOptions } from "../app/interfaces/i-link-open-options.js";
export type { ISelectionSource } from "../app/interfaces/i-selection-source.js";
export type { IStatusBarItemOptions } from "../app/interfaces/i-status-bar-item-options.js";
export type { ITopBarActionOptions } from "../app/interfaces/i-top-bar-action-options.js";
export type { IUndoProvider } from "../app/interfaces/i-undo-provider.js";
export type { IViewDialogOptions } from "../app/interfaces/i-view-dialog-options.js";
export type { IViewInstanceOptions } from "../app/interfaces/i-view-instance-options.js";
export type { IViewOptions } from "../app/interfaces/i-view-options.js";
export type { IViewUpdate } from "../app/interfaces/i-view-update.js";
export type { IWebViewFindOptions } from "../app/interfaces/i-web-view-find-options.js";
export type { IWebViewFound } from "../app/interfaces/i-web-view-found.js";
export type { IWebViewHandle } from "../app/interfaces/i-web-view-handle.js";
export type { IWebViewLayer } from "../app/interfaces/i-web-view-layer.js";
export type { IWindowPalette } from "../app/interfaces/i-window-palette.js";
export type { IWindowPart } from "../app/interfaces/i-window-part.js";
export type { IWindowPartContext } from "../app/interfaces/i-window-part-context.js";
export type { IWindowSecrets } from "../app/interfaces/i-window-secrets.js";
export type { IWebViewOpenOptions } from "../app/interfaces/i-web-view-open-options.js";
export type { IWindowWebViews } from "../app/interfaces/i-window-web-views.js";
export { CommandContribution } from "../app/models/command-contribution.js";
export { ContentPaddingRef } from "../app/models/content-padding-ref.js";
export { IssuedFileGrant } from "../app/models/issued-file-grant.js";
export { IssuedFileGrants } from "../app/models/issued-file-grants.js";
export { NotificationHandle } from "../app/models/notification-handle.js";
export { DocumentContribution } from "../app/models/document-contribution.js";
export { PlaceholderContribution } from "../app/models/placeholder-contribution.js";
export { SearchAnswer } from "../app/models/search-answer.js";
export { SearchResult } from "../app/models/search-result.js";
export { SearchSourceContribution } from "../app/models/search-source-contribution.js";
export { TextRange } from "../app/models/text-range.js";
export { SettingsPageContribution } from "../app/models/settings-page-contribution.js";
export { SettingsRow } from "../app/models/settings/settings-row.js";
export { StatusBarItem } from "../app/models/status-bar-item.js";
export { StatusBarItemContribution } from "../app/models/status-bar-item-contribution.js";
export { StatusBarItemState } from "../app/models/status-bar-item-state.js";
export { MenuRowContribution } from "../app/models/menu-row-contribution.js";
export { TopBarAction } from "../app/models/top-bar-action.js";
export { TopBarActionContribution } from "../app/models/top-bar-action-contribution.js";
export { TopBarActionState } from "../app/models/top-bar-action-state.js";
export { ViewBadge } from "../app/models/view-badge.js";
export { ViewContribution } from "../app/models/view-contribution.js";
export { WindowPartTokens } from "../app/models/window-part-tokens.js";
export { TimeFormatService } from "../app/services/time-format.service.js";

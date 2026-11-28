# Window

**Scope:** The app's window and its main process: the boundary between them, the workspace, keys and menus, Settings and the Modules document, what the window does while the runtime is away, notifications on screen, the tray, and closing.
The window's look follows the organization's UI standard, `https://github.com/noldova-com/.github/blob/main/standards/UI.md`, and its parts come from `@noldova/ui.components.angular`.
The window's own layout and look, such as the window row, the docks and the cards it shows, arrive here with the Window package.
The Window package keeps its strings and numbers in its `src/resources.ts`, as every package does.

## The boundary

- The window shows confirmed state and keeps only transient state itself; durable state goes to its owner in [RUNTIME.md](RUNTIME.md#state) after a pause in changes and when the window closes.
  A layout change still waiting on its pause when the page hides, as a reload does, is sent at once, and the main process answers the reloaded page's read of the layout only once every write sent before it has landed or failed.
  A write that doesn't answer fails after its five-second limit and the connection's five-second grace for a late answer, so it holds the read for about ten seconds at most; a write that failed or went unanswered may leave the layout kept before it, though one that went unanswered can still land before the read, and the read writes a line to the main process log saying so.
- Every privileged request crosses the preload bridge and the main process's authenticated connection to the runtime.
  Window parts get no token, socket, process or file handle.
- The main process sends each window's requests with the window's id, which a reload keeps, passes it only the events for it or for every window, and tells the runtime when the window closes, as [RUNTIME.md](RUNTIME.md#messages) says; a closed window's late requests go nowhere.
- The window listens to the preload's events once and converts each event's payload once, however many listen.
  It passes the event to the window's own services that take every event, and to the window parts' listeners of that event's name alone, so every listener of an event gets the same payload.
- The renderer stays sandboxed and context-isolated, as the organization's Electron standard, `https://github.com/noldova-com/.github/blob/main/standards/stacks/ELECTRON.md`, says.
- No page gets a web permission: the main process refuses every permission request and check, and turns Web Bluetooth off before ready, by adding `WebBluetooth` to any `--disable-blink-features` value already given, so a page has no `navigator.bluetooth` and the system is never asked for Bluetooth; every web contents also cancels a Bluetooth device choice, with `preventDefault()` and an empty device id.
- The sandboxed preload loads no file of its own, so the main process hands it, in one `--desktop-preload=` argument, the bridge's name, the limit on pasted bytes, the window's last appearance and each IPC channel's name, all from the electron package's `Resources`; the preload refuses to start without them, and refuses an answer other than `true` or `false` to a question the window asks as yes or no.
- External content is never rendered as markup that can reach the bridge.
- The window never navigates away from its page and never opens another window.
- The window names the app by the product name the app passes in: the app's entry gives `WindowApplication.startAsync` its `desktop.product.name`, as [BUILD.md](BUILD.md#an-apps-inputs) says.
  The page's title, the macOS application menu, the startup, about and quit texts and the window's messages show that name; the Window package carries no name of its own and refuses to start without one.
- Links open through one path, the context's `openLinkAsync`, which a click on a link that no part handled takes too, with the click's gesture: a plain click, one with Ctrl or Cmd held, or the middle button, the UI kit's `LinkGesture`.
  One window part at a time may be the in-app browser, through the context's `registerInAppBrowser`: it places each `http` or `https` link by its gesture, in the app or in the system's browser, unless the part opening the link gives the place, and opens the ones it places in the app.
  It is never asked about any other scheme, and every link opens in the system's own application while no part is the in-app browser; when it throws or fails to open a link, the link opens in the system's browser, and only the failure's kind, such as `TypeError`, goes to its module's log.
  The main process takes the request only from the window's own page, opens only well-formed `http`, `https` and `mailto` links without credentials, and logs each link it refuses.
  The in-app browser gets a link only when the same `LinkPolicy`, from `@noldova/desktop.protocol`, allows it, and in its normalized form; any other link goes to the main process, which refuses it.
- A web link's menu, which the context's `showLinkMenu` shows at the pointer and a right-click on a link that no part handled shows too, offers "Open in" the product's name while a part is the in-app browser, then "Open in your browser"; it is the `desktop.link` menu place, with the commands `desktop.openLinkInApp` and `desktop.openLinkInBrowser`, which take the link as `url`.
  Neither command is offered for a link `LinkPolicy` refuses, and each opens the link in its normalized form.
- A window part shows a file or a folder, selected in its parent folder, in the system's file manager through the context's `showInFolderAsync`, which never opens or runs the file and never opens the folder itself.
  The main process takes the request only from the window's own page and checks the path when the request arrives: it shows only an absolute path to an existing regular file or folder, or a link to one, and on Windows only a path on a drive.
  A network or device path is refused before it is looked at.
  The main process follows each link in the path in turn, reading the link without looking at where it leads, and refuses a path with a link to a network or device path before looking at that path; a mapped drive and a network mount on macOS and Linux can still reach another machine.
  A `..` in the path, or in a link's text, goes back from where the links before it led, as macOS and Linux do; on Windows it drops the part before it by its text first, as Windows does.
  The file manager is given the path the walk reached, with no link left in it, not the path as the part gave it, so it shows what was checked.
  The check and the showing are two steps, so a file replaced between them is shown as it is then.
  It refuses a missing or relative path, text with a null character and a request from anywhere but the window's own page, logs the reason without the path or the sender's address, and the part's promise rejects with that reason.
- A window part opens a document or text file in the system's default app through the context's `openFileAsync`, which never opens a program or a script.
  The main process checks the path as it does for showing, but refuses a folder, then the file's kind by its name and by the name of the file the path leads to, against the one list of kinds that open, `openedFileExtensions` in the Electron package's resources: PDF, office and OpenDocument files without macros, and plain text and data files such as `.txt`, `.md`, `.csv`, `.json`, `.log`, `.yaml` and `.xml`.
  Every other file is refused, and on macOS and Linux so is a file marked executable for anyone, whatever its name; on Windows a name with a stream, such as `run.exe:notes.txt`, is refused too.
  A path is checked, and a kind by its name, before the file is looked at.
  Then the path the file is at, once its links are followed and with its drive followed too, is checked the same way: on Windows a mapped or substituted drive that leads to a network path is refused, while a network mount on macOS and Linux can still reach another machine.
  The default app is given that checked path, not the path as the part gave it.
  The check and the opening are two steps, so a file replaced between them is opened as it is then.
  It logs each refusal, and a failure of the system to open the file, without the path, and the part's promise rejects with the reason; the part can show a refused file in its folder instead.
- A window part has the person choose a folder through the context's `chooseFolderAsync`: the main process takes the request only from the window's own page and shows the system's own folder chooser attached to that window.
  The part gets the chosen folder's path, or null when the person cancels or the window closes while the chooser is open; it gets no other access to the folder, which its runtime part reaches by that path.
  A window shows one file or folder chooser or save dialog at a time; the main process logs and refuses another request meanwhile.
- A window part has the person choose one file by its path through the context's `chooseFilePathAsync`, in the same way: the part gets the chosen file's absolute path or null, and no other access to the file.
  It may limit the choice to up to 32 extensions of letters and digits and name an absolute starting folder; the context rejects other extensions, and a folder that is not absolute on the window's platform or holds a control character, and the main process logs and refuses such options again.
- A window part asks for files the person gives it through the context: `chooseFilesAsync` shows the system's own file chooser attached to the window, and `grantFilesAsync` takes the files the person drops or pastes on its pane.
  The main process takes either only from the window's current page, follows a link to the file it names, refuses a folder, a FIFO, a socket and a device, and grants each other file to the part's module for that page, as [RUNTIME.md](RUNTIME.md#file-grants) says; it never opens the file.
  A dropped file is granted by the path the preload reads with Electron's `webUtils.getPathForFile`, and a pasted one without a path by its bytes, which the main process stages, at most 64 MiB in one call and 256 MiB staged in all.
  The part gets each file's grant, name, media type and size, never its path, and a sentence for each file it didn't get, naming it and why; it passes the grants to its runtime part, which redeems them at once.
  The context ends the part's grants when the part discards them or is withdrawn, and the main process ends a page's grants when the next page names itself or its renderer goes away.
- A window part loads a file its runtime part shares with it by address, with no bytes passing as text: the runtime part answers the share's grant, and the context's `fileAddressOf` turns it into `desktop-file://<grant>/`, which the page loads as an image's source.
  The context holds the share as it holds a grant, so `discardFileGrants` ends it, and withdrawing the part ends it at once.
  The window's content security policy lets images, and nothing else, load from that scheme.
- A window part saves bytes to a file the person chooses through the context's `saveFileAsync`, with a plain file name to suggest: the main process takes the request only from the window's own page, refuses a name with a folder in it or one that some system cannot hold, and more than 512 MiB of bytes, shows the system's own save dialog attached to that window, starting in the system's Downloads folder with the suggested name, or, when that folder can't be found or isn't a folder, where the system last was, with the reason logged, which asks before replacing a file, and writes the bytes itself.
  It writes them to a new file beside the chosen one and renames it over that file, so a failed write leaves an existing file as it was.
  The part learns only whether the file was saved, cancelled (also when the window closes while the dialog is open) or failed, never the chosen path; the main process logs each refusal and failed write.
- The window provides the kit's `ClipboardWriter` from the preload bridge, so the kit's own copy actions and a window part's components, which inject it, write text and images through the main process.
  The main process takes text only from the window's own page, at most 33,554,432 characters (32 Mi UTF-16 code units), enough for a selection across a long scrollback, and refuses longer text and anything that isn't text, leaving the clipboard as it was.
  An image goes as its file's bytes, at most 64 MiB, to `writeImageAsync`.
  The window reads the image's size from its header, a GIF's from its screen and its first frame, and refuses one of more than 16384 pixels a side or 50 million in all (200 MB decoded) before decoding it, so a small file that declares a huge image never reaches a decoder.
  It passes PNG bytes on as they are, draws JPEG, GIF (its first frame) and WebP images on a canvas and passes them on as PNG, so the main process never encodes an image, and refuses any other bytes.
  It copies one image at a time and refuses another meanwhile.
  The main process takes the request only from the window's own page, one image at a time for each window.
  It refuses bytes that aren't a PNG file's, more than 64 MiB, or a header that declares more than 16384 pixels a side or 50 million in all.
  It writes the bytes as they are once Electron has decoded them, so a refused image leaves the clipboard as it was.
  The part learns only whether the image was copied; the main process logs each refusal and failed copy.
- The window provides the kit's time formats, through `provideTimeFormats`, from `desktop.timeFormat` and `desktop.dateTimeFormat` written with `DatePattern`, so the kit's messages and permission cards in a window part show their times in the person's formats, with the 12-hour defaults, `h:mm a` and `MMM d, yyyy, h:mm a`, until the settings load, and redraw them on a change; an entry's own `provideTimeFormats`, which comes after the window's providers, takes its place.
- The window's root injector holds `TimeFormatService`, which writes a window part's dates and times in the same two patterns, as [MODULES.md](MODULES.md#settings-and-their-scopes) says; a part's components reach it through the part's injector, whose parent is the window's.
- The Edit commands act on the text field or editable text that had focus before a menu took it, restoring it and its selection first, and run only what that field allows.
  A window part whose element keeps a selection of its own, such as a terminal's, registers it with the context's `registerSelectionSource`: while focus is in that element, the Edit menu's and the text field menu's Copy is enabled when the source has a selection and copies its text through the preload bridge, which the main process takes only from the window's own page, as `ClipboardWriter` writes, with no web permission.
  Copy follows the innermost registered element around the focus, and acts on a field inside it while the source has nothing selected; registering an element again replaces its source.
  A right-click inside a registered element that isn't on a field opens the text field menu at the pointer for whatever has the focus inside that element, such as a terminal's helper text area, so its Copy follows the source and its Paste goes there; while the focus is outside the element, the right-click opens no menu.
  A copy the main process refuses leaves the clipboard as it was; the main process logs the refusal and the window logs that the selection wasn't copied, neither with the text.
  The other Edit commands, and Copy anywhere else, act on the field as before; deactivation removes a part's sources, and a part removes the source of an element it discards.
- A window part with an undo of its own, such as a Git client's last write, gives it to the window with the context's `provideUndo`, one provider for each window, from whichever module; a second is refused with `UndoProviderTakenException`.
  While the window's page has the focus and it is on none of a text field, an editable element and an element inside a registered selection source, Edit → Undo and Mod+Z run the provider's `undoAsync`, and Undo is greyed while its `canUndo` is `false`; otherwise they run the native undo, as without a provider, so a web view's page and a field keep theirs.
  On macOS the menu bar's own Undo row takes Cmd+Z while the provider takes Undo, and the native row comes back when it doesn't; on Windows and Linux the window takes Ctrl+Z, except inside an element that keeps Ctrl keys, such as a terminal.
  Withdrawing the provider, or deactivating its part, brings back the native undo.

## Workspace

- The workspace has docks at the sides and the bottom and, in the middle, document groups that can be split.
  An open dock keeps at least its minimum size, 10 rem in the default look, and a dock the window is too small for closes to its strip.
  The side docks give way so the document area keeps 30 rem, or a width the person left it by dragging a dock, or, while the active tab of the active document group is a document or view that declares a `preferredWidth`, that width: each shrinks to its minimum, the right one first, then closes to its strip, the right one first, and comes back past a 2 rem margin once the window has room or a tab without that width is in front; on a 1440×900 window a document that declares 60 rem gets at least 60 rem with both docks open.
  A side dock the person drags while that tab is in front keeps its size, and the tab's docks give way to the width the drag leaves, until Reset layout gives the tab its declared width again.
  A side dock a view grows while that tab is in front keeps its size the same way until the growth is released, or until the person drags a dock, whose width then holds instead; the latest growth holds while several do.
  The bottom dock opens at its default height, 12.5 rem in the default look, in a workspace at least 46.5 rem high, the default 1280×800 window's; in a shorter one that height gives way in proportion, down to the minimum, so a 905×616 window's bottom dock is 10 rem, and a height the person chose stays as it is.
  A dock opened from its strip or its toggle, or by showing one of its views, whether the person or a window part shows it, opens anyway, at what the document's minimum leaves, down to its groups' own minimum, such as 6.25 rem for a bottom dock of one group, and stays closed when even that doesn't fit.
  The window keeps one such dock open at a time, so opening another lets it close the one before, and it stops keeping it once the window has room for it.
- A view shows in a dock or in the middle, and a document in a tab of a document group.
- Closing a group's active tab makes active the tab of that group that was active most recently and is still open, as the usual editors do, so closing a page opened from another page returns to that page; only when no tab of the group was active before, it makes the next tab active, or the last.
  Each group keeps the order its tabs were active in through a saved layout, and a layout saved without it starts that order again from its active tabs.
- A group's tabs keep their width, and its tab row scrolls sideways when they don't all fit, as an editor's does, its buttons staying at its end; "Show all tabs" lists every tab of the group.
  The mouse wheel scrolls the row across, a wheel down toward the row's end in either direction, and a thin thumb laid over the row's bottom edge, taking none of its height, shows while the pointer is over the row and can be dragged.
  Whenever the active tab changes, by a click, the keyboard, "Show all tabs" or a command, it scrolls into view whole, between the row's start and its buttons, as does any tab of the row that takes the focus; the row scrolls and nothing around it does.
  When the buttons change width, the active tab scrolls into view again; when a tab changes size, an active tab that lay whole stays whole, and a row the person scrolled it out of stays where it is.
  This holds for the documents' groups as for the docks', and the arrow keys, Home and End move along every tab of the group, making the tab they reach the active one, which scrolls into view and takes the focus.
  A tab is never wider than the row's room before those buttons, even as buttons come and go, so a longer title ends with an ellipsis and shows whole as its tooltip.
- Each open tab has one live view, made the first time the tab shows and kept until the tab closes or its window part deactivates, so typed text, a selection or a scroll position stays when the person switches tabs, moves a tab or collapses its dock.
  A view behind another tab of its group stays in the page, hidden by `visibility` and `opacity` and inert, so it takes no pointer or focus and a module's web view keeps its page; a view whose tab moves to another group, a dock or a dialog, or whose dock collapses, leaves the page until it shows in its new place, where a web view gets a new page, which after a move restores its form fields and scroll but not its script's state, as [WEB-VIEWS.md](WEB-VIEWS.md#the-window-bridge) says, and after a collapse loads its address again.
- A page's components read two signals of `WindowPartTokens`: `shown`, true while the page is in view, so a hidden page can pause its timers, and `activeDocument`, true while the page is the window's active document, the active tab of the active document group.
  With documents side by side in several groups, each is shown and only one is the active document; the signal follows the active group as the person moves between groups by pointer or by keyboard, and as a saved layout restores, so a module that keeps one current item for the window, such as a selected record another of its views highlights, follows the person rather than the page that showed last.
  A settings page, the placeholder of an empty document group and a palette are never the active document, and a layer over a web view is while its view's tab is.
  A hidden view tells its part it is hidden; when it shows again, it renders what changed and its focus and scroll positions come back.
- Choosing a document's or a view's tab with the pointer moves the focus into its content, to the element it last held there, else its first focusable element; until the content shows one, such as while its part activates, the focus stays on the tab and moves in once it does, for up to 10 seconds, unless first the focus moves elsewhere, the person clicks or presses a key outside the tab and its content, or another tab of that group is chosen.
  A module's web view is a page of its own, whose focus and presses the window doesn't see, so they don't end the wait.
  Choosing a tab with the keyboard keeps the focus on the tab.
  A tab the person drops, or moves with the keyboard or a menu, keeps the focus on the tab, in its new place.
  Pressing a view's button in a dock's strip with the pointer, when the press shows the view, with instances or without, moves the focus into the view the same way, waiting the same way for a view that shows its focusable element later; a keyboard press on the button, or a press that hides the dock, leaves the focus where it is, except that a keyboard press that opens a dock with no rail, whose strip then goes away, moves the focus to the view's tab.
  The same holds wherever a control that holds the focus goes away: a setting's Reset moves the focus to its row's control, the one Tab reaches, a search result's Open page to the opened page's first control Tab reaches once the page loads, or to the page list when it has none, unless the person moved the focus or picked or searched for another page meanwhile, and a notification's Dismiss to the next row's Dismiss, else the previous row's, else the popover.
- While no document is open, the document group shows the placeholder one window part registers, such as a start page with ways to begin, padded like a document; without a placeholder, it shows the product's name and "No modules" when no view is registered either, and nothing otherwise.
  The placeholder goes when a document opens and comes back when the last one closes.
  When the last document closes and takes the focus with it, the focus moves to the placeholder's first focusable element once the placeholder shows; otherwise the placeholder leaves the focus where it is, at startup too.
- F6, `desktop.focusNextRegion`, and Shift+F6, `desktop.focusPreviousRegion`, move the focus through the window's regions in the order they stand in the page: the window row, the window's toolbar band, the docks' strips, each group and the status bar, and around again.
  The focus lands on a region's first element in the tab order, a group's in its active tab's content before its tab strip, and a region with none is passed over.
  In a group that shows a module's web view, the view is a stop of its own after the rest of the group, such as the pane's toolbar, so the focus moves between the page and its toolbar with the same keys; a view hidden behind another tab is no stop.
  Pressed in a view, the keys run the commands as in the window, unless the module declares them for its pane, as [WEB-VIEWS.md](WEB-VIEWS.md#keys-from-a-view) says.
  Both commands can be bound like any other and are enabled while a region has an element in the tab order.
- A window part can show its own views and documents, its dependencies' and Noldova Desktop's in a large modal dialog, and the dialog's title bar offers to open the view in the main window.
  A view already open in a tab moves into the dialog as the same live view and returns to its tab when the dialog closes.
  A window part can close the dialog while it shows one of the part's own views or documents, as the person's close does; asked about one shown in a tab or not shown, it does nothing.
- While agent control is stopped, every open view and document of a module that declares tools shows a bar above it, laid out so it covers nothing: "Agents are stopped" and Resume, which runs `desktop.resumeAgentControl`.
  The bar sits on a surface unlike the view's in both modes, the panel's in a dock and the raised one in the middle, with no line; when agent control resumes, from any bar, the tray or a command, every bar goes and each view has its whole height back.
- Noldova Desktop pads every view and document the same way, by where it shows; a page that runs edge to edge, such as a terminal, turns the padding off for its module, its declaration or the page itself, the most specific choice winning.
- A new layout, on a first start with no saved layout and after Reset the layout, opens each view shown by default on its side, in the group and at the place in its tab row that it names, and shows each group's first tab.
  A side's groups go in number order, top to bottom on the left and right and left to right at the bottom, and share the side equally; a number no shown view uses leaves no gap.
  Tabs go lowest order first, across modules; views without an order follow, in module order and then registration order, as views with the same order do, so views that name neither give one group per side, as before.
  The layout is saved after any change, and a saved layout keeps its groups and tabs: a person who already has one keeps it until Reset the layout.
  Reset the layout gives the layout of a first start with no saved layout: every open view not shown by default closes, instances included, and the open documents stay, in their order, with the active one.
  Before any view closes, the reset runs the save steps of each part that owns one of those views, as on closing, and again for a view opened while they run; a step that rejects leaves the layout as it was, with a notification naming the module, so the person can reset again once it saves.
  The reset saves at most three times: when the third pass's save steps open another view still, it stops as if a step had rejected, naming the module that owns that view.
- The saved layout restores the person's workspace, its toolbars, each view's and document's toolbar band and its docks, without opening unrelated content as a side effect, and keeps the place of a tab whose module is absent.
  A tab saved under a document's former name reopens as that document, as [MODULES.md](MODULES.md#former-names) says.
  It keeps each open document's title, so a restored or background tab shows its title before its module titles it again; a title the module gives wins.
- A window part opens one of its documents at the end of the active document group, or right after another open instance of the same document that it names, in that instance's group, such as a page opened from another page.
  A preview replaces that group's preview, and opens right after the named instance only when the group has none; a document already open only activates where it is.
- A window part can open a document without activating it, such as a page an agent opens beside the one the person reads: it joins its group's tabs where an active one would, the active tab, the active group and the focus stay as they were, and its tab doesn't scroll into view or close a view dialog; a document already open stays where it is, behind the active tab, and a preview tab of it is kept unless it opens as a preview again.
  Such a preview replaces the group's preview only when that preview isn't the active tab, which otherwise stays open as an ordinary tab; in an empty group the document becomes the active tab.
- When the window first loads its layout, documents that parts open while they activate show only where the saved layout holds them, and never change which tab is active; documents the person opened before the layout loaded, and those a part opened once its own activation ended while a later part still activated, open again after them.
- While modules switch or the window reconnects to the runtime, a document a part that keeps running opens waits for the switch or the reconnect to end, then opens as at any other time, active unless the part asked otherwise; one that a part the switch or the reconnect starts again opens while it activates joins the layout without changing which tab is active.
- A window part can close one of its own documents: its tab closes as when the person closes it, the view dialog showing it closes, and a close asked for before the layout loads applies once it has.
  It forgets a document whose subject is gone, such as a deleted note, which also closes it and takes it out of Back and Forward; a forget asked for before the layout loads applies once it has, so Back can't reach a document the saved layout showed.
  A new title or breadcrumb for a document, with a glyph before the breadcrumb if the part gives one, a tab in the background included, given before the layout loads applies once it has; a later close or open of the document, also before the load, drops it.
  The part hears when the person closes one of its document tabs, a preview another preview replaces included, and never when the part closes or forgets one itself, the part deactivates or the window goes away.
  A close the person makes while no listener of the document is registered, such as while its part is inactive or reactivating, waits: the part's next activation leaves that tab closed even when it reopens the instance, and the document's listeners hear the close when that activation ends; the part opening the instance after an activation drops the waiting close.
  The part can list the instances of a document whose tabs are open, so it can drop what it keeps for one with no tab; asked while it activates, the list comes once that activation ends, with the saved layout's tabs in place.
- A view with instances, such as a terminal, opens one tab for each instance its window part opens, titled and labelled by the part, and never opens in a new layout.
  It opens in the group the part names, else the current group when it holds one of the view's tabs, else the first group that holds one, else the view's dock.
  The part may give an instance a breadcrumb, under the same rules as a document's.
  - Its activation ends when the promise its part's `activateAsync` returned resolves.
    Until then, an instance tab the saved layout holds takes the part's title and glyph where it is, without activating; the saved instance tabs the part has not reopened by then close quietly, and one it opens afterwards opens as new.
  - The part may give a group's front back after its open brought an instance's tab forward, such as a detail view it showed for a document the person leaves: the tab in front before that open shows again, without moving the focus or the group the tab commands act on.
    A later open while the instance's tab is still in front keeps that earlier tab to give back.
    Nothing changes when no open brought the tab forward, or since then the person chose a tab in that group, moved, closed or added a tab there, or another open changed the group.
  - The part hears when the person closes one of its instance tabs, and never when the part closes one itself, a saved tab closes at the end of activation, the part deactivates or the window goes away.
    A close the person makes while no listener of the view is registered, such as while its part is inactive or reactivating, waits: the part's next activation leaves that tab closed even when it reopens the instance, and the view's listeners hear the close when that activation ends.
  - A view may name a plain menu place whose rows show as icon buttons, with the rows' titles as their names, in the tab row of each group that holds one of its tabs, after the tabs and before the group's own buttons; a submenu row opens its place as a menu, and every row's command, its submenus' included, gets the group's id as `tabGroup`.
- A document's tab may show, before its title: a marker glyph in the accent colour with its own tooltip, such as where it was opened from; then one of the spinner while it is marked working, a status glyph in its tone's status colour, such as `error` for a page that can't be reached, or a `data:image` image, 0.875rem square, such as a favicon, with its glyph in its place while it is missing, loading or failed and in forced colours; else its glyph.
  The status's description and the marker's tooltip join the tab's accessible name, in that order, after its title.
  A working document's tab keeps Close at its end; a view's tab shows the spinner in Close's place.
- A document may name a plain menu place in the same way, in the `DocumentContribution`'s options, whose rows show as icon buttons in the tab row of each group that holds one of its tabs, such as a browser's new tab; a group holding tabs of several views and documents shows each place once, views' places first; a document's place's rows also get, while the group's active tab is a document of that place's module, its name and instance as `document` and `instance`, which never reach a view's place or another module's.
- A view with instances, or a document, may declare its tabs renamable, `isRenamable` in its options.
  On such a tab, the tab menu's Rename (`desktop.renameTab`), F2 on the focused tab and a double-click edit the title in place; on any other tab a double-click keeps a preview tab open, as before.
  Enter or leaving the field keeps the title, trimmed, and Escape cancels; the part hears a kept title that differs from the one shown, or an empty one for its automatic title, through `onTabRenamed`, and applies it with `updateView` or `updateDocument`, so the tab shows its old title until it does.
- A window part can show one of its views without instances, such as a bottom panel: a view that is not open opens in its dock, as the layout menu's `desktop.toggleView` opens it, an open one activates where it is, wherever the person moved it, and the dock that holds it shows, even when it was hidden or the window was too narrow or too short for it.
  It moves the focus into the view as choosing the view's tab with the pointer does: to the element it last held there, else its first focusable element; until the view shows one, such as while its part still loads, the focus stays on the tab and moves in once it does, for up to 10 seconds, unless first the focus moves elsewhere, the person clicks or presses a key outside the tab and the view, or another tab of that group is chosen.
  Opening an instance only activates it, and `desktop.toggleView` leaves the focus on the tab; a view asked for while the part activates shows once the window has loaded its layout.
  Opening an instance expands its dock when the dock is collapsed to its strip, unless the part passes `revealDock: false`: then the instance's tab comes to the front of its group, whether it was open or is new, and the dock stays collapsed, such as for a commit's details opened as the person clicks through a history; showing a view, and the opens the person asks for, still expand it.
- A window part can hide the dock that holds one of its view tabs, with instances or without, as the dock's toggle command hides it, keeping its tabs, so showing the view shows it there again.
  If the focus was in the dock, it moves to the button of its group's active tab in the dock's strip, as when the person hides the dock; otherwise it stays where it is.
  A dock the window was too narrow or too short for, or kept open for the part, hides the same way and stays hidden once the window has room; its strip, its toggle or showing the view opens it again in one press.
  Nothing changes for a tab that is not open, a tab outside a dock, such as among the documents, or a dock already hidden.
- A window part can ask that one of its view tabs, with instances or without, show at least a length in rem along its dock's axis, such as a terminal that needs a number of rows, until it releases the ask.
  The dock grows once, when the tab's page first shows in a dock shorter than that, by what it lacks and no further than the window allows; a page already long enough grows nothing, and a later resize by the person stands.
  The release puts the dock's earlier size back, unless the person or another ask resized the dock since; a new ask for the same tab takes the place of the one before.
- A window part can read which dock holds one of its view tabs, with instances or without, as a signal that follows the tab as the person or the part moves, opens or closes it: the bottom dock, the left or the right one, or none while the tab is outside a dock, such as among the documents, or not open.
  A hidden dock keeps its tabs, so the side stays while it is hidden.
- A part that loads a snapshot reconciles it with the events that arrive meanwhile, so an old answer never replaces a newer selection.

## Keys and menus

- The window keeps one keyboard listener on the page, after every element's own.
  A key that a field, an editor or a terminal handled, a key during text composition and a repeated key are left alone; a key bound to an enabled command runs it and goes no further.
- On Windows and Linux, an element marked with `nolKeepsCtrlKeys`, such as a terminal, keeps the Ctrl keys it uses: inside it, a Ctrl+Shift+key with no binding of its own runs the command its Ctrl+key is bound to, while one bound to a disabled command, or to one a dialog holds, runs nothing; the Edit commands' keys, with or without Shift, stay with the element, neither run nor prevented.
  A window part asks `findWindowCommand` which command the window would run for a key, with the person's bindings and this rule, before its element handles it; the element leaves its own module's commands and every Ctrl+Shift key to the window and keeps its other Ctrl keys by preventing their default.
  On macOS nothing changes, since Cmd is the window's.
- While a modal dialog is open, only the Edit commands run from keys, and a view's dialog adds its own module's commands.
- On macOS the main process builds the native menu bar from the rows the window gives it, keeping the system's own items; choosing a row runs it in the window, and the window's key handling stays the only one.
  It shows the rows only of the window that has the focus: rows a window sends while it doesn't are kept and shown once it has the focus again.
  Once the window whose rows it shows closes, the main process puts back the standard menu bar it starts with, the app, Edit and Window menus with the system's items, so no row is left that runs nowhere.
- An app that gives the window `titleBar`, as [BUILD.md](BUILD.md#an-apps-inputs) says, shows its icon and name, each only when given, at the very start of the window row, after the traffic lights on macOS: the icon 1rem square, the name 0.25rem after it in the row's own text, both level with the row's buttons and 0.5rem before the menus or the buttons that follow.
  They stay in the row's drag region and never fold the menus: the name takes only the room that leaves the search field its full width in the window's centre, cut with an ellipsis and hidden below 3rem, and the icon stays until the field is down to its 12rem.
- An app whose `titleBar` sets `documentTabs`, as [BUILD.md](BUILD.md#an-apps-inputs) says, shows the tab row of its first document group in reading order, the top-start one, in the window row, after the row's buttons and 6rem of drag region before the search field, which then stands after the tabs at its 27.5rem, down to 12rem, instead of in the window's centre; every app that leaves it out keeps the centred field and every group its own tab row.
  The row's tabs are that group's own, so selecting, closing, renaming, dragging, the group's actions and the overflow list work as in the group, and once the group closes the next group in reading order takes its place.
  The group's actions follow its last tab, as in a title bar's tab group, and the row stays a drag region from them to the search field.
  The row stays a drag region between and around the tabs, and only the tabs and buttons leave it: on Windows the row ends before the system's controls, on macOS it starts after the traffic lights and the app's name and icon, and on Linux the window's own controls stay at its end.
  Every other document group keeps its tab row, and a module that needs something else in the row than tabs has no place for it yet.
- On Windows and Linux the menus show at the start of the window row, as a menu bar or a menu button, or not at all, as the shared setting `desktop.menuBar` chooses.
- The window row shows the search field in its middle and no heading: the window takes the title of the document area's active tab when that tab is a document or a view's instance, and a tab in a dock never names it, whichever group has focus.
  A document's title shows in its tab, and its part draws its title and breadcrumb in its own content where it wants them; the window keeps the breadcrumb but shows it nowhere.
- After the menus, the window row shows a button that shows or hides the left dock, Back and Forward, the modules' actions placed at the start, the layout menu and Settings, in reading order; each button's tooltip names its command's key.
  The menus come first on Windows and Linux, after the app's name and icon, as a system's own title bar puts them, and fold into the menu button while the row can't keep 6rem for dragging and 12rem for the search field.
- A row button whose command can't run stays in the tab order, marked `aria-disabled` and drawn as the kit's unavailable button; its tooltip shows why on keyboard focus as on hover, and a click, Enter or Space runs nothing.
  A module's action names why in its title, which is also its name; Back, Forward and Settings keep their names and show and are described by a reason instead of their key: "No earlier document to go back to", "No later document to go forward to", and "Settings opens once the window has started", since Settings can't run only until the modules' parts have started.
- Back and Forward step through the last 50 documents shown in the middle and places that views add to them, such as a list's items or a pane's pages, in one history; showing another document or adding a place after going back drops the entries ahead.
  A view adds a place with `recordPlace`, and one equal to the entry the person is on is ignored, so a view may add each place it shows; reaching a place shows the view, its instance's tab or the view in its dock, and then tells the view's `onPlaceShown` listeners which place to show, while the active document stays as it was.
  They skip a place whose view has no listener, whose instance's tab is closed or that its part forgot with `forgetPlace`, drop a module's places when its part deactivates, and step from a place back to the document shown under it, though that document is the active one.
  A document closed since, by the person, by its part or by the next preview, stays a place: going to it opens it again as a preview with the title and breadcrumb it last had.
  They skip a document its part forgot and one whose module no longer offers it.
  Their keys are Alt+Left and Alt+Right on Windows and Linux, and Cmd+[ and Cmd+] on macOS, where Option+Left moves by a word in text.
- A menu row shows its command's title and icon, unless it gives its own: a declared item may give a label, and a row a window part supplies to a dynamic group, a `MenuRowContribution`, a label and a Material Symbols icon, which it shows in a menu, a submenu, a tab row's buttons, a toolbar and search.
  A choice shows its place's checked row's title and icon, or its place's title and icon when no row is checked, and its place's icon when the checked row has none.
- The layout menu, the place `desktop.layoutMenu`, shows or hides each dock and each view the window lists, except views with instances, a view opening in its dock, and resets the layout.
- A window part opens its own palette just under the window row, centred across the window, with its context's `openBelowWindowRowAsync`.
  The window shows one palette at a time: the call answers null without a window row, while a palette is open, or when the part is withdrawn while the component loads, which is then never created; the search's keys close a module's palette and open the search.
  The call rejects with what the loading rejects with, or with what the component throws as it is created, and leaves no palette open.
  A palette closes on a pointer outside it, on Escape that it doesn't handle itself, when the window row moves away or is hidden, when its part is withdrawn, or when asked; its `closed` resolves once, and focus goes back where it was when that is still there.
- While any agent session is open, the main process takes the stop key system-wide: the person's binding of `desktop.stopAgentControl`, `Mod+Shift+Period` by default.
  A change of the binding takes effect at once, and with the binding removed no key is taken.
- When the system refuses the stop key, because another program holds it, a notification says so once per key while the app runs, the tray's Stop agents says the key works only in the app, and the key still works inside the app.
  On Linux under Wayland the main process asks the desktop's GlobalShortcuts portal for the key, with Chromium's `GlobalShortcutsPortalPreferredTrigger` feature added to any `--enable-features` the app was started with, so that GNOME is asked too, and the portal never tells the app the answer: GNOME asks the person once and KDE Plasma takes the key without asking.
  When the person declined, or the desktop runs no portal, the key works only inside the app and no notice says so, while the tray's Stop agents always works.
- Spell checking runs only from the dictionaries the app ships, and never downloads one; on macOS the system chooses the languages.

## Search

- The window row shows one search field in its middle, centred across the window and 27.5rem wide: a magnifier, the placeholder "Search" followed by the sources' names in order, such as "Search chats, messages, commands and settings", and the key of `desktop.search`, Ctrl+K, or Cmd+K on macOS.
  It is as tall as the row's buttons and level with them, drawn as an input edged in the menu border color, or with forced colours in the button text colour, its text and key cap too, and gives way to the window row's drag region on both sides; when the buttons before it are wider than those after it, it moves off the window's centre only as far as the row's middle needs.
- Clicking the field or pressing its key opens the search palette in the field's place, 40rem wide, its top at the field's top, with its field focused; the key of `desktop.showCommands`, Ctrl+Shift+P by default, opens it with `>` typed.
  The field keeps its place, hidden, while the palette covers it.
  `desktop.search` with `{ "source": name }`, the name of a source, opens the palette under that source's filter; it and `desktop.openSettings` are the two Noldova Desktop commands a window part may run with its context's `runCommandAsync`; the View menu runs `desktop.search` and `desktop.showCommands` as Search and Show all commands.
- Escape, a pointer outside the palette and opening a result close it, and focus goes back where it was when that is still there.
- Under the field, a filter for All and one for each source, each source's with its match count while there is a query, with a `+` right after a count the source capped; Tab moves to the next filter, Shift+Tab to the one before, and a filter shows only its source.
- Before the person types, the palette shows each source's recent items in a group of its own under the source's recent heading, such as Recent chats and Recent commands, with the first row selected.
- While the person types, a Best match row comes first, then one group for each source with its matches under the source's heading, as many as 2 under All.
  Under a source's own filter, or when only the commands are searched, the group lists every match the source gives and no Best match comes first.
  Each row shows the source's icon, its title with the matched range in the accent colour at the emphasis weight, a muted detail and, for a command, its key.
- A query that starts with `>` searches the commands alone, for the text after it; `>` alone lists the recent commands, then every other command by title.
- Up and Down move the selection and Enter opens the selected row; the footer says so, with "Type > for commands only" at its end.
- Noldova Desktop's own sources come last, Commands and then Settings.
  Commands lists every enabled command and the main menu's rows; its recent items are the commands last run from the search, as many as the shared setting `desktop.recentCommandCount` asks, 5 by default.
  Settings lists every setting the Settings page shows, has no recent items, and opening one opens Settings at that setting.

### Search sources

- A window part adds a source with its context's `registerSearchSource`, a `SearchSourceContribution` that stays while the part is active and goes when it is withdrawn.
- A source gives:
  - `name`, a contribution name unique within its module;
  - `label`, its filter's label, such as "Messages";
  - `placeholderName`, its name in the field's placeholder, such as "messages";
  - `heading`, its group's heading while the person types, such as "In messages";
  - `recentHeading`, its group's heading before the person types, such as "Recent chats", or null when it has no recent items;
  - `icon`, the Material Symbols glyph its rows show;
  - `recentAsync(signal)`, which resolves to its recent items, the most recent first;
  - `searchAsync(query, signal)`, which resolves to a `SearchAnswer`: its matches, the best first, `total`, how many it found, which may be more than it lists, and `isCapped`, whether it stopped counting at that total, false unless it says so.
- A `SearchResult` has an `id` unique within its source, a `title`, a `titleMatch`, the matched range of the title as a `TextRange` of `start` and `length` or null, a `detail` and its `detailMatch`, a `keyLabel` or null, and `openAsync()`, which the palette calls after it closes.
- The query a source gets is trimmed, never starts with `>`, and is never empty; only Noldova Desktop's Commands gets an empty one, for `>` alone.
- Sources come in the order of their modules in the module list, a module's own in the order it registered them, then Noldova Desktop's.
- The Best match is the result whose title the window's matcher ranks best in the first answer that has one: the query at the title's start first, then at the start of a word, then anywhere, a tie going to the earlier result; a result whose title doesn't hold the query is never the Best match.
  It stays until the query changes, so the row Enter opens never changes under the person: a later answer's better result shows in its own source's group.
- The palette asks every source at once and shows each one's group as its answer comes, keeping the selected row while it is listed.
  It aborts a source's `signal` when the query changes or the palette closes, and drops an answer that comes after that.
  A source whose call rejects shows no group and no count, and its failure goes to the window's log; the other sources never wait for a late or failed one.
  The palette tells its quick input, as `itemsQuery`, the text as typed that its rows answer: that text once the list holds the first answer with a match for its query, or once every source has answered or failed with none, so Enter pressed while a new query loads waits only until then and opens the row then selected, such as the Best match, even while a late source is still answering.
  When Noldova Desktop's commands change while the palette is open, such as when the window's start ends, the palette asks Commands again for the open query and its recent items, and shows the newest answer, dropping an older one that comes later; a module's source is asked once per query.

## Settings and modules

- Settings is a document of Noldova Desktop's own, `desktop.settings`: its pages are General, Appearance, Notifications and Keyboard shortcuts first, then the modules' pages in the order they first appear, and About last; it opens on General, which shows only while it has rows.
  The search field and every page's content take the full width beside the page list, inside Settings' own margins, at any window width.
  Settings' margin, `--nol-settings-margin`, is the same on both sides: before the page list and the search field, and after the search field and a page's rows, where the content's scrollbar gutter, kept whether the page scrolls or not, lies inside it.
  Where the page list gives way to a select, a page's rows start at the margin too.
  Every page's content starts at the edge of General's groups: Settings sets that edge around a module's page, so the page's first element starts there, and Keyboard shortcuts' heading, explanation and table start there too.
  The edge is the CSS variable `--nol-settings-edge`, which Settings sets to the theme's `--nol-settings-item-padding-inline`, the rows' own inline padding, so a page's edge and its rows' text stay together in any theme.
- A module's own page, which its `settings.json` declares, takes its place after the pages its module's settings name, else after the other modules' pages, and shows its title as the page's heading, then the component its window part registers, with its part's context, in the content column; the component is destroyed when the person leaves the page.
  Until the part registers it, the page shows the kit's spinner, and a page the active part never registered doesn't show; while the module is failed or blocked, or when its component fails to load, which the window reports, the page shows the module's failure card, and while the module is off or unavailable the page doesn't show.
  The settings of the modules that depend on its module and name the page's title as their `page` show after the component, in their groups, as on any page.
  Searching matches the page's title and those settings, and its result opens the page and shows the settings that match; `desktop.openSettings` with `{ "page": <name or title> }` opens Settings on a page.
  A page also gives Settings search the rows it draws itself, so a search finds them as it finds settings.
  The part gives them with its context's `setSettingsRows(page, rows)`, where `page` is a page its module declares and `rows` replaces the page's whole list, an empty list clearing it.
  Each row is a `SettingsRow(id, title, description?)`: `id` is unique on the page, written like a setting's name with the module's prefix, such as `notes.sync.runNow`, and `title` and the optional `description` are the text the row shows.
  The part can call it at any time, its page's component too through the same context, so the rows change with what the page shows; the rows go when the part deactivates.
  The call throws, as `registerSettingsPage` does, for another module's page or row or a page its module doesn't declare, and `SettingsRow` refuses an id that isn't `<module id>.<name>` or a blank title; two rows with one id are refused too.
  The page's component marks each row's element with `data-setting="<id>"`.
  Searching matches a row's title and description, and lists the matching rows under the page's result, at Settings' edge, with the words that match highlighted.
  Opening a row opens the page, scrolls that row into view once the component draws it, and gives it the selected background until the person searches again or picks a page.
  The window also lists every page's rows for its own search, Keyboard shortcuts' among them: a row for each command, with its title, its name as the id and its key as the description; Settings opened at a row by its id marks it the same way, a command's row in the table too.
  Inside the page, the component draws its sections with Settings' own classes: a `nol-settings-group` holds an h3 `nol-settings-group-title` and `nol-settings-rows`, whose `nol-setting-row` holds a `nol-setting-row-heading` with its `nol-setting-row-title` and an optional `nol-setting-row-end` at the heading's end, then a `nol-setting-row-description` and a `nol-setting-row-control`.
  A row reaches out past the page's edge by `--nol-settings-edge`, so its title lines up with the page's other content and its hover background spans the content's width; a module page's own element that spans the content's width, such as a section's background, reaches out by the same variable, never by a length of its own.
  A row shows the hover background only while it holds something to click or change, such as a link, a button, a field, a details summary, audio or video with controls, or an element in the tab order; a row that only says something, such as an answer at its end, shows none.
- General starts with the runtime's state, outside a search: Connected, or Not connected with the startup card's title and reason.
- General's Date and time group holds the Clock row and the Time and Date and time formats, `desktop.timeFormat` and `desktop.dateTimeFormat`, as patterns such as `h:mm a` and `MMM d, yyyy, h:mm a`, the defaults.
  The Clock lists 12-hour, then 24-hour, and defaults to 12-hour.
  It isn't stored: it reads 12-hour while the time format has an `h`, `hh` or `a`, choosing a clock sets both formats to its usual shape, and its Reset resets both.
  A format the person stored keeps its shape, but a choice equal to the old 24-hour default isn't kept: a write equal to a default resets rather than stores, so a Clock set to 24-hour while that was the default, or the old patterns typed exactly, now reads 12-hour.
  Beside each format's field, a note shows the time Settings opened at in the text as it is typed, and in the stored format once it is committed or the stored format changes; a blank format goes back to its default.
  A text setting's note stands the kit's `--nol-space-2` gap from its field, on the field text's baseline, and a long one wraps under itself.
  On a row too narrow for 10rem of note beside the field, the whole note goes under it.
- About shows the app's logo left of its name and version, the icon drawn dark in light mode and the one drawn light in dark mode, then the one-line description the app gives, the platform and processor, the links to the app's website, named by its host, and to its Releases, the update's state, and the text the app gives under Licenses; it shows only what the app gives in `desktop.product.about`, as [BUILD.md](BUILD.md#an-apps-inputs) says, and its links open in the system's browser through the window's one path for links.
- Keyboard shortcuts lists every command with its owner and key; each change writes `desktop.keyBindings` whole, in one write.
  Reading `desktop.keyBindings` keeps every valid entry and skips the rest: a value that isn't an object reads as no bindings, and an entry whose command isn't a qualified name or whose key isn't a key chord it can bind or `null` is left out, so one bad entry the person wrote never loses the others.
  Each skipped value or entry goes to the window's error log with its command and the reason, each time the setting is read.
  `desktop.showShortcuts`, Show keyboard shortcuts, `Mod+Slash`, opens Settings on it, enabled while Settings is registered; a focused web view's page keeps its key, as [WEB-VIEWS.md](WEB-VIEWS.md#keys-from-a-view) says.
  While a module has a web view open in the window, a command's row whose key the module declares for its pane says under the key that the module takes it in its pages, such as "Browser takes Ctrl+L in its pages", since the pane gets the key ahead of the command while one of its views has the focus; outside its views the command keeps the key.
- The window applies the appearance settings as soon as they load and on every change; the main process keeps the device's last appearance and gives it to the window before its first frame, so a restart paints in the chosen theme without a flash.
- The Modules document shows every module the runtime reports, with what it declares and its state.
  A module's row in its list gives its description on one line, whole in a tooltip while cut; its details give each running program one line, its name, then how long it has run at the row's end before Copy path, with its path, process and start in the row's tooltip and in Copy path's after its action, Copy path or Copied, and each kind of contribution closed with its count until opened, its twistie on the section's left edge and its open list indented to its title by the theme's icon size.
  While a module is failed or blocked, a status bar item opens it; a failed module's views keep their places and say why it didn't start, and nothing retries.
  A view or document whose component fails to load shows its module's failure card in its place, saying its page could not be loaded, and the window reports the failure once; a shell page that fails to load stays empty, and the window reports it once.
  An off module, as [MODULES.md](MODULES.md#lifecycle) says, shows as off, its views and documents keep their places, their tabs marked off rather than failed, and say it is off, with its setting's checkbox to turn it on where a failed view gives its cause, and no status bar item calls for it.
  A module that depends on it, directly or through other blocked modules, is blocked by it and says so, but its tabs are marked off too, and no status bar item calls for it, since the person turned it off.
  The window writes one change to a switch at a time, in the order they were made, so a change still saving its modules before it turns them off never writes over a later one.
  The Modules document gives every module that has a switch setting its checkbox, on or off, under Switch.
  A module unavailable on the platform, as [MODULES.md](MODULES.md#lifecycle) says, shows as unavailable with its cause, its icon muted as an off module's, with no Switch, no Copy details and no Open log folder; it and the modules it blocks are marked off rather than failed, and no status bar item calls for them, since nothing can make it run there.
  Its views and documents keep their places, their tabs and cards marked with a muted block glyph, and say it didn't start with its cause.
- Help has Open log folder and Copy details, as a failed module's card has.
  Copy details copies the product's version and build, the data folder, the platform and processor, and each module's id, version, state and cause; the card's copy names only its module.
  When either fails from Help, the shell posts a `desktop.support` warning that stays until dismissed, offering to try again, the log folder's also Copy details and the details' also Open log folder, since details too long to copy fail again; runs of one command go one at a time, a run asked for while another waits joins it, and a later success takes the warning back, and copied details show a passing "Details copied".
  The window sends the platform and module lines; the main process takes them only from the window's own page, puts the build and the data folder before them and, in all but the build's line, redacts them as the logs are redacted: the home folder becomes `~`, and the user name, email addresses, accounts in addresses and tokens become `[redacted]`.

## When the runtime starts again

- Once the runtime has been ready, the window keeps its workspace while the runtime starts again: the workspace stays, inert under the startup card, only the Edit commands run, and view dialogs close.
  A dialog a window part opened itself stays open, inert under the startup card, which then sits above it over the workspace, so its actions, such as Try again, stay reachable; Escape and a backdrop click don't close it while it is covered, a plain CDK dialog too, whose `disableClose` comes back once the runtime is ready.
  Once the runtime is ready, the dialog is usable again with what was typed and where its focus was.
  When focus wasn't in a dialog, as for one that opened while the runtime started, it then moves into the topmost dialog, to its first field or, when it has none, to the dialog itself.
  When a dialog opens or closes while the runtime starts again and the startup card moves above it or back, focus on one of the card's buttons, such as Try again, moves with the card, even when the browser has already taken focus off the button, which the opening dialog made inert.
- When the runtime is ready again, the window asks each window part it keeps, in module order, whether it continues, with `reconnectAsync`.
  A part that continues keeps its views and their unsaved input, and first reads again everything it took from the runtime, since the events sent meanwhile are lost.
  A part that answers false, or fails, is built again with every part that depends on it, and only their tabs load again.
  The window tells each part that continued that a module it optionally depends on turned off right after that module's part deactivates, or, for a module without a window part, once the parts that stop have deactivated, and, once every part is active, which turned on, through `onDependencyChanged`, as [MODULES.md](MODULES.md#optional-dependencies) says; so a part never reads a withdrawn dependency as active while later parts activate.
- A request that fails with `Disconnected` while the runtime is away changes nothing and reports nothing; the window reads again once the runtime is ready.
- While the runtime is away, the window holds its layout changes and writes the newest once the runtime is ready.

## When a module turns off or on

- The window follows `desktop.modulesChanged`, in turn with the runtime's starts, so a switch never runs during one.
  It deactivates, dependents first, the window parts of the modules that are no longer active, and activates, in module order, those of the modules that became active; every other part stays as it is, without `reconnectAsync`, and a part that failed for its own reasons is not tried again.
  It also reads the runtime's commands again, and tells each part it kept, through `onDependencyChanged`, that an optional dependency turned off right after that dependency's part deactivates, or, for one without a window part, once the parts that stop have deactivated, and which turned on once every part is active.
- Before it deactivates a part, the window runs the part's save steps, as on closing; a failed save is reported, and the part deactivates all the same, since the runtime has already turned its module off.
- When the person turns a module off in the window, from its checkbox, Settings or a reset, the window first runs the save steps of the module and of every module that depends on it, as on closing, without asking.
  When one fails, it writes nothing and the module stays on; the failure is reported as `desktop.saveFailed`.
  The window's checkbox shows the person's choice while the change runs, then the setting.

## The main process

- The main process opens the window; the runtime never does.
- The main process checks its installation's launch barrier as soon as it starts, and once the barrier passes it starts the runtime at once, without waiting for Electron to be ready, the window or its saved state.
  A dialog the barrier needs waits for Electron to be ready, and a start the barrier refuses exits without starting the runtime.
  On Windows the runtime starts through an Electron utility process, which Electron creates only once it is ready, so there the start's own work runs at once and the runtime process waits for Electron to be ready.
  Until the window is open, the main process holds the start's state and the runtime's events; the window then reads the current state as it loads, as any window does, and gets the held events in order, so it works the same whether the runtime is ready before it or after, and its saved bounds are restored once.
- A new window is 1280 by 800 pixels, at most nine tenths of the primary display's work area on each side, and centred; saved bounds keep their size where they fit, and the window is never smaller than 640 by 480 pixels.
  A window manager that sizes it smaller anyway, such as a tiling one, gets it saved at that minimum.
  Saved bounds whose top row has less than 160 pixels on any display's work area, such as above the top of the only display or all but a sliver past its side, move by the least into the work area of the display that shows most of them, so the window row stays in reach.
  Under Wayland the compositor places each window it shows, so the window opens at its saved size wherever the compositor puts it.
  There its saves keep the saved position, with the window's size and maximized state, since the window's position is the compositor's: a later X11 session still opens it where the person left it.
  So a move the person makes under Wayland isn't kept, and until the saved bounds have been read nothing is saved, so a failed read never erases the saved position.
- The window has no system title bar, and the window row stands in its place.
  On macOS the system draws its traffic lights over the row's start; on Windows it draws Minimize, Maximize and Close over the row's end, in the row's colors and height.
  While a modal dialog is open, Windows draws them in the row's colors as they show under the dialog's backdrop, so they dim with the rest of the window, and in the row's own colors again once it closes.
  They change when the overlay shows or hides the backdrop, and again when a fade of its opacity ends.
  Each color is read as the page composites it, alpha included, whatever form the theme writes it in.
  On Linux the row draws those three buttons itself, because the system's overlay loads the desktop theme's images in the main process, and a loader that runs there can crash it.
  They are as Windows draws them: the row's full height, 2.8125rem wide and 0.0625rem apart, flush with the window's edge, with 0.625rem glyphs; Maximize turns into Restore while the window is maximized, and either one asks the main process to toggle, which it decides from the window's own state, so a click is right even when the label is behind.
  They take the toolbar hover, Close the error color under the danger text, are reached with Tab and pressed with Enter or Space, show their names as tooltips, and hide in full screen.
- On Windows and Linux the window's icon follows the system's theme, and changes with it: the light icon on a dark taskbar and the dark one on a light taskbar, read on Windows from the taskbar's own setting.
  An app whose icons folder has no light icon keeps the dark one; the program file's icon, which a pinned taskbar entry shows, and the macOS Dock's icon don't change.
  Under Wayland the compositor decides the window's icon: one that doesn't let an app set it, such as GNOME's, shows the icon of the app's desktop entry whatever the theme, while the tray's icon still follows it.
  On an installed Windows build the taskbar button keeps the icon of the app's Start menu shortcut, since Windows takes a button's icon from the shortcut registered for the app's ID rather than from the window.
- The window shows once its appearance is painted and its saved bounds are applied, or at once with its startup state when the runtime refuses or takes more than two seconds.
  The bounds are kept on the device too, and the ones the runtime gives are copied there when read, so after an update, or on a device whose copy is lost, only the first start waits for the runtime and may show at the default bounds before it moves; a copy that can't be written is logged and the window still takes the runtime's bounds.
  A read the runtime refuses is logged and leaves the saved bounds as they are: nothing is saved until the next time the runtime is ready reads them, unless the person moved or resized the window meanwhile, which that time saves instead: on Windows a move or resize it reports as the person's, and elsewhere bounds other than those the window showed at, so the system's placement before the window shows, or a maximize, doesn't count, and a read that ends after the window closed does nothing.
- When the page stops or stops responding, the main process shows the window and asks whether to reload or quit, offering the log folder instead when it stops again within ten seconds of a reload.
- When the main process meets an error it doesn't catch, it logs it and asks once, with the operating system's message box, whether to restart or quit.
- A packaged app started from a terminal starts itself again apart from that terminal, so closing the terminal leaves the app running.
- The main process serves the files runtime parts share on its own scheme, `desktop-file`, which it registers as standard and secure and nothing more, so a page can't fetch it, read it across origins or pass its content security policy with it.
  It serves the scheme only on the session the window gets; a web view's partition never has it.
  For each request it asks the runtime for the share with `desktop.resolveFileShare`, checks that the share's page is still the one its window shows, opens the file without waiting and, off Windows, without following a link, compares the open file's identity with the share's, and streams the file from disk.
  It serves a PNG, JPEG, GIF or WebP image with its media type and any other file as `application/octet-stream`, never as HTML or SVG, and every answer carries `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` and a content security policy that sandboxes it.
  Anything else, a request that is not a `GET` of a share's exact address, a grant the runtime refuses, a page that ended, or a file it can't open or that changed, gets a plain 404 and a log line with the reason, never the path or the grant.
- The main process encrypts and decrypts the runtime's secrets with Electron's `safeStorage`, which uses the system's keyring: the Keychain on macOS, DPAPI on Windows, and the Secret Service or KWallet on Linux.
  It refuses while encryption isn't available and, on Linux, while `safeStorage` would use its own text key, and it answers a decrypted value only to the runtime, as [RUNTIME.md](RUNTIME.md#secrets) says.
  A window saves, removes and checks a module's secrets through the runtime, which the main process forwards, and never reads one.
- The window sends each error it doesn't handle to the main process once, which redacts it and writes at most ten a minute from each window to its log.

## Notifications on screen

- While the window is focused and Do not disturb, the device setting `desktop.doNotDisturb`, is off, the window shows toasts for notifications from modules that the shared setting `desktop.mutedModules` doesn't list, at most one of a kind every 5 seconds.
- While no window is focused, the main process shows each new notification through the operating system instead, never for an update or for work in progress.
  Clicking it brings the window forward and runs the notification's command in the window.
- Every notification stays in the list, which marks them read when the person opens it.
- The app never asks for permission to notify up front; a refusal leaves the notification in the list.

## Tray

- The main process shows the app's icon in the Windows notification area, the macOS menu bar or the Linux tray while the device setting `desktop.trayIcon` is on: on by default on Windows and Linux, off on macOS.
  On Linux the icon shows only while a tray host is registered on the session bus.
- On Windows and Linux the icon follows the system's theme as the window's icon does, and a state without a light icon keeps its dark one.
- The icon shows whether work is running and whether notifications are unread, and its menu lists the running work, the newest unread notifications, Stop agents, opening the app, Turn on or Turn off Do not disturb for this device, and quitting.
  Stop agents runs `desktop.stopAgentControl`, and is disabled while the runtime is away; while agent control is stopped, Resume agents takes its place and runs `desktop.resumeAgentControl`.
  The menu has no check or radio items, so Windows leaves no empty column for a check mark.
- An app lists the menu's items in its build's `desktop.product.tray`, as [BUILD.md](BUILD.md) says, and without a list its menu is the one above.
  A built-in item keeps its behaviour, and its `text` replaces the label of Open, Quit and the work's row while no work runs.
  Stop agents and Do not disturb take `text` for the label of their usual state, Stop agents and Turn on Do not disturb, and `toggledText` for the label once switched, Resume agents and Turn off Do not disturb; each replaces only its own label, and a refused stop key's hint still follows the label.
  The notifications' rows keep the posts' titles.
  A command item runs its module's command through the runtime, as the command palette does, and a list item the window doesn't know, such as a command that isn't a module's qualified name, is left out.
  An item's `icon` shows beside its label, and on Windows and Linux its `iconDark` while the app's theme is dark; on macOS a template image follows the menu's colours.
  A separator at either end of the menu or next to another one is left out, so an item that shows no row, such as the notifications while none is unread, leaves no doubled line.
  The main process takes the stop key system-wide only when the list holds `agents`; the key works inside the app either way.
- While a downloaded update is ready, the menu starts with Restart to update, naming the version, which restarts through the same path and checks as the status bar's `desktop.restartToUpdate`, and the tooltip says that an update is ready; the item goes when no update is ready.
  The icon shows one state, in this order: running work, then a ready update, then unread notifications, then idle; so a ready update takes the icon over unread notifications, which the tooltip and the menu still list.
  The tray says so only through its icon and menu, never a system notification.
- While the icon shows on Windows or Linux, closing the last window leaves the app running behind it, and the first time on a device a notification says so.
- When the app quits, it takes back that notification and the refused stop key's, so neither stays on screen or in the system's notification list once the app is gone.
  Windows shutdown, restart and sign-out end the app without a quit event, and Electron tells only an open window of them, so these notifications can stay in the notification list then.
  When the icon goes away while no window is open, the main process opens one, so the app never runs without a way back to it.

## Closing and quitting

- Closing the last window quits the app, except on macOS and while the tray icon shows, where the window closes once it has saved.
- Closing a window, and quitting, wait for each window to save: the window runs the save steps its parts register with its own layout save.
  A part whose save fails keeps the app open and is reported as `desktop.saveFailed`; a part whose save hasn't settled after 4 seconds doesn't block closing and is reported as `desktop.saveUnfinished`.
  The main process waits at most 5 seconds for each window's answer.
- A failed save of the layout is logged and closing goes on.
- Quitting asks the runtime to stop as [RUNTIME.md](RUNTIME.md#work-and-quitting) says, and asks the person first when work is in progress; closing the window that asks answers Cancel, so the app stays open.
- On Linux and macOS the main process quits this way on SIGTERM and SIGHUP.
- An update never outweighs an unsaved change: a save that fails or doesn't settle stops the update, as [BUILD.md](BUILD.md#stopping-for-an-update) says.

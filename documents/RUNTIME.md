# Runtime

**Scope:** The runtime: how it owns a data directory, its local protocol and its clients, how it starts and stops, the programs modules start, the state it keeps, the secrets it keeps for modules, and the work that holds back a quit.
What a module declares and contributes is in [MODULES.md](MODULES.md); the window and the main process are in [WINDOW.md](WINDOW.md).

## Ownership

- One runtime owns each data directory.
  An app's data directory is in the person's home folder, under the name the app's identity gives, unless the runtime is given another; development and test runs never use the person's.
  A `--data-dir=<path>` argument names another for any build.
  Without it, a packaged build uses the one in the home folder, and a development build uses the folder its identity's data-directory variable names, or else the checkout's `_build/data`; a packaged build ignores that variable.
- The runtime takes ownership before it opens a database, activates a module, cleans up programs or publishes its endpoint, and gives it up last, after closing its databases and its log.
- Ownership is an exclusive transaction that the runtime's process holds in an ownership database of its own; nobody deletes that file to break a live lock.
- A starting runtime that finds the directory owned leaves it to an owner that has published its endpoint, and waits up to five seconds for one that hasn't, which is starting or stopping.
- The runtime publishes its endpoint atomically, naming the endpoint, its process, the program it runs from, the app's and the protocol's versions, and its build.
  A new owner removes the endpoint an earlier owner left before it listens.
- The device folder, in the operating system's local application data, keeps what belongs to the device rather than to a data directory: its random identity, its last appearance, and each installation's record and launch barrier ([BUILD.md](BUILD.md#stopping-for-an-update)).
  Devices that share a data directory keep their own state by that identity.

## Endpoint and authentication

- Windows uses loopback TCP; macOS and Linux use a local Unix socket.
  The endpoint is never offered as a remote service.
- Besides its own endpoint, the runtime listens only where an app's runtime part opens a tool endpoint for its agents, on `127.0.0.1` with a token for each agent session, as [TOOLS.md](TOOLS.md#serving-agents-over-loopback) says.
- Clients authenticate with a token that the runtime makes for each start and keeps with its endpoint, readable only by the person's account.
  Its folder is the person's alone: on Windows the runtime replaces the folder's permissions with the person's, and on macOS and Linux it sets mode `0700`.
  On macOS it also reads the access back and refuses to start when an access control entry, such as one inherited from a parent folder, still opens the folder to another account; it never removes such an entry, which whoever set it owns.
  Every line after the folder's own must read as an entry, so a line in another form refuses the folder, and so does a folder marked as having entries when none is read.
  It doesn't yet detect a macOS volume mounted with ownership ignored, where mode `0700` and the entries keep no account out.
  Binding to loopback alone is not authentication.
- The window gets neither the token nor the socket; the main process speaks for it.
- The token keeps out other clients, not other programs running as the same person.
- A part tells the main process's requests apart with `context.client === ShellClients.mainProcess`; what that proves differs by platform, as below.
  When a client of the runtime's own build names itself so, the runtime finds the connection's process, from the Unix socket's peer on macOS and Linux and from the loopback connection's owner in the TCP table on Windows.
  It answers the handshake only when that process didn't start with `ELECTRON_RUN_AS_NODE` and, on macOS and Windows, runs the runtime's own program file.
  Otherwise it answers `Unauthorized` with its handover and writes the refusal to its diagnostics; like another build's client, the connection may then only stop the runtime.
  So the same build's main process run from another copy of the program, such as one moved to Applications from a disk image while its runtime still runs from the image, stops that runtime and starts its own; a second refusal fails with a message.
  No other name is checked, and neither is another build's client.
- **macOS:** the runtime reads the peer's audit token, its process id and the process version that changes when the process runs another program, before and after it reads the program and the starting environment, `KERN_PROCARGS2`, and refuses the connection when the token changed between them.
  It keeps that token, and ends the connection when a later message comes from another one, so only the checked process can send on it.
  A process that shares the socket, by forking or by passing it, can still read the events the runtime sends on that connection; this stays open for now.
- **Windows:** the runtime reads the process that owns the loopback connection in the TCP table and refuses it when it started after the connection was made, so a later process given that process id doesn't pass.
  The environment it reads is the process's live one.
  A script the app's program runs in Node mode can delete `ELECTRON_RUN_AS_NODE` from that environment before it connects, so on Windows the check doesn't keep the app's program in Node mode out until the runtime gets its own program and the `runAsNode` fuse is turned off.
- **Linux:** the runtime accepts the name without a program check for now: any program running as the person that didn't start with `ELECTRON_RUN_AS_NODE`, such as a plain `node` script, can connect as the main process.
  An AppImage's main process and its runtime run from different mounts, so the same program is another file, and comparing the files' contents added 0.5 to 3.4 seconds to the main window's first connect.
  Without an `app.asar` check, which Electron doesn't make on Linux, a program check alone would let the app's program run on another `app.asar` through anyway.
- On every platform, code injected into the main process, or a debugger attached to it, passes the check; on macOS and Linux so does native code that rewrites the process's starting environment.

## Messages

- A connection opens with an authenticated handshake that names the protocol version.
  Requests then get their answers by correlation, and events reach every connected client, or one window of one connection.
- A request the main process forwards for a window carries that window's id, which a reload keeps, and `desktop.runCommand` passes it on to the command's handler.
  A part's handler reads it with the request's connection and its client, `ShellClients.mainProcess` for the app and `ShellClients.commandLine` for the command line.
  The command line's requests carry none, and neither do the settings, recent-command and notification requests the main process makes for the device, which the runtime answers itself.
- The main process sends `desktop.windowClosed` when a window closes for good, its web contents destroyed; a reload, including one after a page crash, sends nothing.
  The runtime then cancels that window's requests still running, tells each active part `{ connection, window }`, after every request the window sent before it has reached its handler, answers any later request from that window with `NotFound` and sends it no more events.
- Each page a window loads names itself to the main process with an id of its own before any of its requests, and its requests carry that id.
  When the next page names itself, or the page's renderer goes, the main process cancels the old page's requests still running, so their signals abort, including one the old page sent after the load started; a later request from the old page is answered `Cancelled` at once.
  A navigation the window prevents loads no page, so it cancels nothing.
- The main process also gives each page a serial of its own and sends it with the page's requests as `page`, which a part's handler reads beside the window; the runtime ends a page's file grants by it, as [File grants](#file-grants) says.
- A module's web view calls go to the main process as `desktop.webViewCommand`, sent only on its connection; the main process answers each with `desktop.webViewAnswered`, sends its views' events with `desktop.webViewEvents`, and the runtime takes both only from that connection, as [WEB-VIEWS.md](WEB-VIEWS.md#the-runtimes-controls) says.
- A module's secret calls go to the main process as `desktop.secretCommand`, sent only on its connection, and the main process answers each with `desktop.secretAnswered`, which the runtime takes only from that connection, as [Secrets](#secrets) says.
- The main process sends the whole list of the app's windows with `desktop.appWindowsChanged`, and of its shortcuts with `desktop.appShortcutsChanged`, as it connects and whenever one changes; the runtime takes both only from the main process, gives them to each runtime part's `appWindows` and `shortcuts`, and empties them when that connection closes, as [MODULES.md](MODULES.md#the-apps-own-windows-and-keys) says.
- The main process reports its main window, the first of its windows still open, with `desktop.mainWindowChanged`, a `MainWindow` of its `title` and whether it `isVisible`, as it connects and whenever either changes, and an empty title that isn't visible once no window is open; the runtime takes it only from the main process, forgets it when that connection closes, and answers it to any client with `desktop.mainWindow`, or null before one is reported.
- `desktop.agentControl` answers an `AgentControlState`, whether agent control is stopped and whether any agent session is open, and `desktop.agentControlChanged` carries it on each change, as [TOOLS.md](TOOLS.md#events) says.
- When an authenticated connection closes, by a command ending, the app quitting or the main process crashing, the runtime tells each active part `{ connection, window: null }` once; a connection that reconnects is a new connection.
- Protocol owns the frames, their size limit, deadlines, cancellation and disconnection.
  A request or answer over the limit fails with `FrameTooLarge` and the connection stays open; an event over the limit is logged once and sent to no client.
- A client answers a request it couldn't send, or whose connection ended first, with `Disconnected`; a request without an answer in time on an open connection fails with `Unavailable`.
- When its connection ends, the main process connects again at once; each further end within 30 seconds of being ready waits 1, 2, 4 and then 8 seconds first, and the sixth stops and shows why.
  Before each reconnection it writes a line to `logs/main.log` saying whether the runtime or the main process ended the connection.
- `desktop.modules` answers each module's status in the order the runtime activated them, with the modules it optionally depends on as `optionalDependencies`, apart from its `dependencies` and only when it has some; an optional dependency never blocks a module, and the runtime's log names each one a module runs without and why, as [MODULES.md](MODULES.md#optional-dependencies) says.
- Noldova Desktop checks the envelope without knowing modules' models.
  The runtime routes only methods that active parts registered, and the owning part checks the payload and reports failures as the organization's code standard, `https://github.com/noldova-com/.github/blob/main/standards/CODE.md`, says for data contracts.
- A handler's error that is neither a method failure, a protocol error nor a JSON reading error is answered `Internal` with a fixed message, and the runtime writes the method and the error, with its stack, to its log.
- Five places catch every failure, each because the value comes from a module and can fail in any way, and each logs or rethrows what it doesn't handle:
  - a permission request that can't be read is denied, and the denial and its error are logged to the tool's log (`PermissionCenter`);
  - a permission request's risk that can't be read counts as high and is logged to the tool's log (`RunningToolCall`);
  - an error that can't be described is logged as such (`RuntimeServer`);
  - a tool detail that can't be inspected is logged as unwritable (`ToolRegistry`);
  - the secret write queue only orders writes, and each caller still gets its own write's failure (`MachineSecretBackend`).

## Builds and lifetime

- The first client may start a runtime, and later clients attach only to a runtime of their own build.
- A build is newer when the app's version is higher; between builds of the same version, the one that is starting takes over.
- A newer build takes over a directory that an older build's runtime owns: it asks the older runtime to stop, the person chooses whether to wait for its work or stop it ([Work and quitting](#work-and-quitting)), and then the newer runtime starts.
  An older build that finds a newer runtime hands the person over to the newer build instead of starting.
- So that every build can stop every earlier one, every build keeps this exchange from protocol version 1:
  - A handshake from another build, of any protocol version, is answered with `BuildMismatch`, naming the runtime's build and its program.
  - That connection accepts only `desktop.stop`, with the policy "only if idle" or "stop the work".
  - "Only if idle" with work in progress is answered with `Conflict`, listing the work; otherwise the runtime answers, cancels its work and stops.
- A client of the same build may also ask the runtime to keep running while another client is connected; the runtime then touches no work and answers how many clients keep it.
  The main process's quit asks this way, so one client's quit never cancels work another client may be using.
- A runtime of the same build can be asked to prepare for an update with `desktop.update`, which [BUILD.md](BUILD.md#stopping-for-an-update) describes.
  It keeps refusing new clients until the update ends: it watches the installation's folder, so it notices the launch barrier going at once, and checks every 5 seconds whether the barrier's holder still runs, so it notices a holder that has gone before the handoff within 5 seconds; Node can't wait for the exit of a process it didn't start.
  A folder that can't be watched fails `desktop.update` with `Unavailable`, and a watch that fails later ends the update, failing `desktop.update` too if it hasn't answered.
  The main process watches the same folder while it has no runtime connection, and quits once another main process's update sets the barrier to `Closing`.
- A stop cancels the runtime's work, answers its waiters, writes its state and closes its resources; an answer to a stop doesn't prove that the process ended.
- Clients reconnect from what is kept, not from the events they missed.

## Starting a runtime

- The runtime never keeps the files, sockets or pipes of the client that started it.
- On Linux and macOS a launcher starts the runtime through the runtime's POSIX addon, with no shell: the runtime starts in a session of its own with every descriptor but its standard ones closed.
  On Linux the `close_range` system call closes them; where it fails, and on macOS, each one below the soft limit of open files, at most 65,536, is marked close-on-exec, so starting the program closes it.
  The addon's forked processes never call `close()`: Electron's main process replaces it with Chromium's check, which aborts a process that closes a descriptor Chromium owns.
  The addon names `close_range`'s number itself when the C library it is built against names none, as the older glibc of the release builds' Linux sysroot doesn't.
- **Open point:** how the Windows launcher keeps inherited handles from reaching the runtime.
- On Linux an app that runs from an AppImage starts the runtime from the runtime's own copy of the image, so the runtime keeps its files after the client quits.
  The launcher mounts the image again through the addon with `--appimage-mount`, with no shell, reads the mount's folder from the mount's output, starts the runtime from the mount with the read end of the mount process's keepalive pipe as its standard input, and then ends the mount process.
  The AppImage runtime keeps a mount while its keepalive pipe has a reader, so once the mount process has ended, the mount lasts while the runtime, or a process that inherited its standard input, still runs, whether the runtime stops or crashes.
  While the launcher hands the mount over, a copy record in the logs folder, `copy-<id>.log` beside the start log `start-<id>.log`, names the launcher by its id and start time from before the mount process starts, and the mount process by its id and start time once it has started, so a launcher that dies before it ends the mount process leaves it to the next start; the launcher removes the record once it has ended the mount process.
  Until the record names the mount process, the next start finds it by its standard output, the record's `copy-<id>.log.mount`.
  The launcher reads that output again each time the logs folder changes, and checks every 100 ms only whether the mount process still runs: the mount process isn't a child Node.js started, so its exit has no event.
  A start that can't list `/proc` keeps such a record and its `.mount` file, and writes why to its diagnostics, so a later start that can list it ends the process and removes both.
- When the image can't be mounted, the mount names no folder within 10 seconds, its process holds no single pipe to hand over, or the client runs from an extraction, the launcher extracts the image into a `desktop-runtime-` folder in the temporary folder instead.
  Its copy record names the extraction and the process that holds it, the launcher until the runtime has started and then the runtime, by its id and start time.
- The runtime removes its own extraction and copy record when it stops, and when its start fails once it owns the data directory.
  A record that still names a mount process is left for the next start, which ends that process once its launcher no longer runs.
  After a crash, the next runtime's start removes a recorded extraction, or ends a recorded mount process whose id and start time still match, only when the record's holder no longer runs.
  It keeps the record of an extraction outside its own temporary folder, for a runtime with that temporary folder to remove.
- No launcher starts a runtime while its installation's launch barrier holds.
- A launcher waits 20 seconds for a runtime it can attach to, and up to 60 while the data directory is owned, so a busy machine isn't reported as a failed start; a runtime that exits first is reported at once, with the reason from its start log.
  It watches the data directory's `discovery` folder, or its nearest existing parent until the folder is created, from before its first read, and reads the discovery file again only when that folder changes; once a watch starts it looks again, so a folder created meanwhile moves the watch down to it and the file is read again at once.
  A watch that can't start, such as at the system's limit of watches, or that fails later doesn't end the launch: the launcher writes the reason to its log once, closes the watch and, as editors do, reads again every 100 ms instead; an AppImage mount's folder is watched and falls back in the same way.
  Neither a runtime's exit nor the ownership lock's release changes a file, since the runtime it starts isn't a child Node.js keeps, and SQLite's lock is a byte-range lock: so while it waits it checks every 100 ms only whether the runtime it started still runs and, once that runtime is gone or it started none, whether the data directory is still owned, and reads again when that changes.
  A launcher taking over waits for the older runtime's lock the same way.
- The runtime's standard error is its launcher's start log, `logs/start-<id>.log`, for as long as it runs.
  A launcher that reaches the runtime it started, by its process id, renames that start log to `logs/runtime.errors.log`, after the earlier one's last 1 MiB is written, redacted, to `logs/runtime.previous.errors.log`, so what the runtime writes there later, such as the failure it ends with, is still there after it ends; the runtime keeps writing to the renamed file.
  When the earlier one can't move aside, the start log stays under its own name, and the next runtime's start removes it.
  A launcher that reaches another runtime, or none, removes its start log, as it does after it reports why the runtime exited.
- A launcher taking over waits for the older runtime to stop for as long as that stop may take: 18 seconds for its programs, which end together, when the grace and each wait take as long as they may, plus 10 for the rest of its stop; then it waits its 20 seconds again for the runtime it starts.

## Programs modules start

A runtime part starts a program only through its context, and the runtime, not the part, owns and ends it.

- **Finding it:** a name is searched for on the program's PATH, an absolute path is used as it is, and any other path is refused.
  A candidate counts when it is a file, one the person may run on Linux and macOS, or, on Windows, a link that `stat` refuses with `EACCES` or `EPERM`, as an app execution alias such as the Store's `pwsh.exe` reads; a folder, a link to nothing and a link loop don't count.
  On Windows a PATH entry may be in double quotes, which an entry holding a `;` needs: a quote opens only at an entry's start, the `;` inside the quotes is part of the entry, the outer quotes are not, and a quote left open runs to the end of PATH.
- **Batch files:** a Windows `.cmd` or `.bat`, always found with its extension, is traced to the program it runs, which then starts with no shell, only when the file is exactly one of three forms: the one line `@"%~dp0\<path>.exe" %*`, which starts that `.exe`; npm cmd-shim's shim for a program without a shebang, which starts that `.exe`; or its shim for a Node.js script, which starts `node.exe` (beside it, else on the PATH) with the script.
  Runs of blanks and the line endings may differ, but nothing may sit between the target and `%*`, and a shim with variables, fixed arguments or any other line is not traced.
  Only a batch file that can't be traced runs through `cmd.exe /d /s /c`, each argument escaped twice against cmd's parsing, and it refuses an argument holding `%`, `"`, `!`, a line break or a NUL character; that fallback is the one security exception.
  Prompts and other user text never go on a command line: they go over standard input or the protocol.
- **Verbatim arguments:** on Windows a request may ask for its arguments as they are, which the runtime joins with spaces and passes with no quoting or escaping, so a module can give `cmd.exe /d /s /c "<command>"` a command with its own quotes and operators, as Node.js's `shell: true` does; a list of arguments writes each `"` as `\"`, which `cmd.exe` doesn't read as an escape.
  The program's own path goes ahead of them in quotes, so a path with a space, such as one under `Program Files`, still names the program and leaves its arguments where they are.
  The start refuses verbatim arguments for a batch file, traced or not, which `cmd.exe` takes in its command instead; on macOS and Linux they change nothing, and each argument reaches the program as it is.
- **Responsibility:** on macOS a program a part starts has the runtime as its responsible process, which runs the app's executable and is its own responsible process, never a terminal that started the app, so the system's privacy permissions name the app; [ARCHITECTURE.md](ARCHITECTURE.md#code) says how the runtime's start disclaims responsibility.
- **Environment:** a program gets only the variables it needs: the system's basic ones, the runtime's variables the request names, and the request's own.
  The system's basic ones are `PATH`, `TEMP`, `TMP` and `TMPDIR`, then on Linux and macOS `HOME`, `LANG` and `LC_ALL`, and on Windows `SystemRoot`, `windir`, `PATHEXT`, `ComSpec` and `USERPROFILE` and the system's usual folders, `SystemDrive`, `LOCALAPPDATA`, `APPDATA`, `ProgramData` and `ProgramFiles`, each when the runtime has it.
  The list ends there because those are where the system and its programs live; Windows' other variables, such as `COMPUTERNAME`, `USERNAME` and `USERDOMAIN`, describe the machine or the person, and a program gets one only when its request names it.
  A part that wants the person's current environment, such as the PATH a new terminal would have, reads it with `context.readEnvironmentAsync` and gives it as the request's environment, as [ARCHITECTURE.md](ARCHITECTURE.md#code) says.
- **Record:** each program has a record in Noldova Desktop's database while it, or anything it started that the runtime follows, runs, with what proves its identity: its process id, its program, its start and the boot it ran in.
  A process belongs to a record only when that identity matches; a reused process id is never enough.
- **Ending:** on macOS and Linux a program leads its own process group and is ended through it; on Windows the runtime puts the program in a job object of its own as it starts, and ends the program's tree and every process in its job through the system's own functions.
  On macOS and Linux a program makes its group just after it starts; a program stopped before then is signalled itself, once the process table shows its process with the program's start, and counts as ended only once that process has gone.
  Such a program has no jobs to hang up, and a program an earlier runtime left running outside a group of its own is killed itself in the same way.
  A process that ends between that read and the signal could leave its id to another process, which the signal would then reach; that window lasts only as long as the read.
  On macOS a group whose members have all ended but are not all reaped yet refuses the signal, so when a program's group refuses it, the runtime signals the group again once the program's exit has come: at once for a group ended after its program failed, and otherwise as the exit comes, within the same grace period as the other groups, or at its end.
  A refusal after that is reported only when the process table shows a process in the group that has not ended, one the runtime may not signal; a group that holds only ended processes counts as ended.
  A program the runtime keeps after a clean exit has no exit to wait for, so its group's refusal is reported at once.
  Whatever still runs after a grace period of 3 seconds is killed, and the runtime's log names what had to be killed.
  While it ends a program the runtime asks every 50 ms whether its processes are gone, on every system: the processes aren't children Node.js started, so it has no exit event for them, and waiting on a process group on macOS and Linux, or on a process handle on Windows, would need a native wait that Node.js doesn't offer.
  When a program exits, what its group or job still holds is ended at once if it failed, and when its part's programs end if it exited cleanly; until then `desktop.programs` still lists it.
  A program's job holds what the program starts even after the process that started it has exited, and nothing can leave it; only a pseudo-terminal's job lets what its program starts leave, as its bullet says.
  The runtime puts a program in its job as soon as Windows has started it, before it records the program; a process the program starts before then stays outside the job, and so does what that process starts, and the runtime finds them only through their parents, while those still run.
- **When:** a part's programs end when it deactivates or fails to activate and when the runtime stops; once the runtime begins to stop, or to prepare for an update, no part starts a program.
  When the runtime stops, each part's programs begin to end once it deactivates, without holding up the next part, so the programs of every part end together.
- **After a crash:** on Windows the system closes a crashed runtime's jobs, which ends every process in them, so only what a program started before it was put in its job, and what a pseudo-terminal's program started without its pseudo console, can outlive the runtime.
  On every platform, before any module activates, a starting runtime ends the recorded programs that are certainly its own, and logs what it leaves running.
  On macOS and Linux, once a program's process group has lost the program, as when the program ends on the hangup of its pseudo-terminal, the starting runtime takes a process left in that group as the program's only if it started at least 1 second, the start time's margin, before the earlier runtime last recorded the program running, which it does every 5 seconds.
  So a process that outlives the hangup, such as one started with `nohup` or a server that leaves the terminal, and that started within about 6 seconds before the earlier runtime ended abruptly, is left running and logged.
  That window stays, since taking such a process by the earlier runtime's end instead could end a process group whose id was reused after the program's group ended, which is worse than leaving one running.
- **Reporting:** `desktop.programs` lists each module's running programs with the program's path, its process id and its start, and nothing else about it.
- **Pseudo-terminals:** a runtime part of a module that declares `pseudoTerminals` starts a program in a pseudo-terminal with `context.startPseudoTerminalAsync`, through the module's own node-pty, which the runtime doesn't ship.
  The runtime finds, records, ends, reports and cleans up after such a program as it does any other, with these differences.
  The program gets the request's environment whole, and the terminal is `xterm-256color`; a batch file that can't be traced is refused, because a pseudo-terminal's command line can't be escaped for `cmd.exe`.
  On Windows a request can give the command line after the program in place of the arguments, which node-pty passes as it is, so a module can give `cmd.exe /d /s /c "<command>"` a command with its own quotes and operators; a list of arguments would have each `"` written as `\"`, which `cmd.exe` doesn't read as an escape.
  The start refuses that command line on macOS and Linux, beside arguments, and for a batch file, traced or not; a batch file runs inside `cmd.exe`'s command line instead.
  Output that comes before the first listener is kept and handed to that listener in order, so a program that prints at once and exits loses nothing.
  `readForegroundProcessGroupAsync` tells which process group holds the terminal on macOS and Linux: the program's own process id while the program, such as a shell at its prompt, holds it, and a command's group while a command the shell started holds it, so a module can wait for a command to hold the terminal before it sends Ctrl+C.
  It reads `/proc/<pid>/stat`'s `tpgid` field on Linux, a file read, and runs `ps -o lstart=,tpgid= -p <pid>` on macOS, a process for each read with a 1-second limit; it answers null on Windows, which has no process groups, and once the program has exited.
  A process id alone is never enough, since it can be reused before the program's exit is reported: the same read checks that the process is still the program, by its session being its own on Linux, as a pseudo-terminal's program leads its session, and by its start on macOS, whose `ps` shows no session, and answers null when it isn't.
  On Windows the start waits until the pseudo console has started the program, because node-pty knows its process id only then.
  There the program must be a console program: a windowed one, such as Electron run as Node, never attaches to the pseudo console.
  The pseudo console asks for the terminal's attributes as it starts, and holds the program's output for about 3 seconds unless the module's terminal answers, as a terminal emulator does.
  Ending it first resumes its output; then on macOS and Linux its process group gets SIGHUP, as when a terminal closes, and on Windows its pseudo console closes; whatever still runs after the grace period is killed.
  On macOS and Linux a program still running a third of the way into the grace period, 1 second of the 3, gets SIGHUP once more, to its own process alone, since a shell can lose a hangup that comes after a command and before its next prompt and then wait at the prompt; at its prompt it takes the second one and ends as on any hangup.
  The rest of its group isn't hung up again, so a process still ending on the first hangup, such as an editor saving its work, isn't cut short.
  On macOS and Linux it then hangs up the jobs in process groups of their own, as a shell's background jobs are, that the program started or that share its controlling terminal, when they still run: a shell can lose its hangup before it passes it on.
  The runtime lists those groups before the hangup and signals only a group in which a listed process still runs with the same start, so a reused id is never signalled; a job that ignores the hangup, as `nohup` makes it, keeps running.
  It lists them without starting a program, from `/proc` on Linux and through its POSIX addon on macOS.
  A job that leaves the terminal's session, as `setsid` makes it, is found only while the program is its parent: once that parent has exited, nothing the platform shows ties the job to the terminal, so it keeps running.
  On Windows the program's job holds only the program: what the program starts leaves the job at once, so an app launched from the terminal, such as an editor that `code .` opens, outlives the terminal, the runtime's stop and a crash, as it does on macOS and Linux and from Windows' own terminals.
  Closing the pseudo console still ends the console programs attached to it, as a hangup does, and the runtime ends what it finds through the program's running descendants; an app whose launcher has exited is found through nothing, so it keeps running.
  After a crash the system closes the program's own job, which ends the program, and the closing pseudo console ends the console programs attached to it; what the program started without the pseudo console, a windowed or detached app or a program given a hidden console of its own, as Node's `windowsHide` gives one, keeps running.
  Once the program exits, the runtime closes its pseudo console on Windows and stops node-pty's output worker.
  On Windows node-pty reports the exit when the program's output closes, and that close can come before node-pty has the program's exit code, so the exit it reports may have none.
  The runtime keeps a handle to the program's process with the program's job, until the job closes, so it then waits for that process to end, up to five seconds, and reads its exit code from Windows, as the signed number node-pty gives; `exited` resolves with that code.
  When the process still runs at that limit or Windows gives no code, `exited` resolves without a code and the runtime's diagnostics say why.
  On macOS and Linux node-pty reports a program's exit only once the program's output closes, and that close may never come, as when the output was paused as the program ended, so the runtime also checks the program's process: every second while it runs, and every 50 ms while it is being ended.
  These checks stay timed: node-pty doesn't expose the exit its native side already has, and Node.js gives no exit event for a process it didn't start through `child_process`, nor a way to wait on one, so the process can only be asked again.
  Once the process is found gone and node-pty has reported no exit for a second, `exited` resolves without a code or signal, the runtime's diagnostics say so, and the runtime closes node-pty's output reader; an exit node-pty reports after that is dropped, and the program's record and its `desktop.programs` entry go as for any exit.
  An exit without a code counts as a failed one, so what the program's group still holds is ended at once.
  A program the runtime can't record is killed and watched in the same way, so its output reader closes even when node-pty reports no exit.
  A process found running proves nothing, since its id may already be another's, so only a process found gone counts.

## State

SQLite holds every durable record.

- Noldova Desktop and each module that keeps records have their own database: Noldova Desktop's for its own facilities, never for a feature's data, and each module's at `modules/<id>/<id>.sqlite` in the data directory.
- Only a database's owner opens it, defines its schema and writes its rows, and no transaction spans two databases.
- Modules keep their durable data in the data directory, never in a project's folder.
  A working folder, where the person's files live, isn't module data; a folder for work outside any project lives in the data directory's `work/<id>`.
- Records name a place on disk by an identity their owner defines, mapped to a path on each device, so moving the data directory keeps them; a missing path is reported, never treated as empty.
- Leaving a module out of a build keeps its database and files; deleting them needs the person's own request.
- Migrations are ordered, explicit and transactional.
  Before changing a database, the runtime checks that its migration history is one it knows, and backs the database up, verified, to the data directory's `backups` folder.
  Opening a database first removes the files a backup interrupted by a crash left there, unless a backup still running, in this or another process, holds the folder's guard.
  That removal is best effort: when the guard or a file can't be used, it leaves the files, writes what it left to the runtime's log, and the database opens.
  An unknown or newer schema is refused, never reset, and its module fails with its database untouched.
  Opening a database never waits for a flush to disk, so a busy disk can't hold the runtime's start: SQLite creates a new database without flushing (`synchronous` at OFF) and migrates an existing one flushing only at checkpoints (NORMAL).
  Once a database is open, every commit is flushed before it returns (FULL).
  A power loss while a database opens can roll back a migration, which the next start backs up for and applies again.
  A new database's file and log are flushed off the event loop right after it opens, and the open doesn't wait for that flush.
  The new database's first statement waits for its file's flush if that flush hasn't ended, whichever of `run`, `read` and `readAll` runs it, so no commit is on disk before the file it belongs to, even one through `read` such as `INSERT ... RETURNING`; only that first statement can wait, and a power loss before it can lose only the new database, which was empty.
  A missing or empty database file with no log beside it is created where it is.
  A file that holds only zero bytes, up to 64 KiB, as such a power loss can leave it, moves with its log to `<file>-unreadable-<timestamp>` beside it, and the database is created anew, unless SQLite reads it with its log as a database: then it opens with its data where it is.
  An empty or missing file with a log beside it moves aside with that log the same way, since SQLite would delete the log of an empty file.
  A damaged file that holds data stays an error.
- Installing an update first backs up the shell database and each module's database of every data directory the installation has used, verified, to the same `backups` folder, as `<owner>-before-update-<timestamp>.sqlite`, where the owner is `desktop` or the module's id.
  It reads each database read-only once its runtime has exited, so an update that changes no schema still leaves a copy to go back to.
  A module's database is the one its id names, so a folder in `modules` whose name is no module's id, such as `desktop`, is skipped and said so in the log.
- Each database owner keeps its newest 3 migration backups and its newest 3 update backups, by the time in their names; the two kinds are counted apart, so updates never push out the backup taken before a migration.
  The older ones are removed only once a new backup of the same owner and kind is published, while it still holds the folder's guard, so a backup that fails removes nothing.
  Only backups dated before the new one are removed, keeping the newest 2 of them beside it, so backups dated ahead by a clock set wrong stay and never push out the ones that follow.
  That removal is best effort: a backup's `-journal`, `-wal` and `-shm` go before its file, so one that can't be removed keeps its file, is written to the log, and the update or the database's opening goes on.
- Related writes and their change records commit together in one database.

| State | Owner |
|---|---|
| Keys, settings and their values per scope, each device's recent commands, and remembered permission answers | Noldova Desktop, in its database. |
| Modules' secrets, per device, module and name | Noldova Desktop, in its database, encrypted by the main process, as [Secrets](#secrets) says. |
| Layout and window bounds, per device and window | Noldova Desktop, in its database, written through the runtime. |
| A window part's view state, drafts and anything else a module keeps | The module, in its database or its folder. |
| The device's last appearance, its one-time hints and its tray and update settings | The main process, in the device folder. |
| Caches | Their owner; bounded, and never the source of truth. |
| Credentials an external tool manages | That tool, reached only through its supported interfaces. |

- A long collection, such as thousands of messages, stays in its owner's database and reaches the window by range, through the kit's virtual list.
- The runtime and the main process each keep a log in the data directory's `logs` folder, timestamped, redacted and limited in size, with the previous run's beside it.
  The running runtime's own standard error, its start log or `runtime.errors.log`, is neither timestamped nor redacted, since the runtime writes it without its log, such as when its log can't be written or when Node ends it; it holds what the runtime and its modules' runtime parts write to standard error.
  What is kept of it, `runtime.previous.errors.log`, is redacted as the log is, so only the running runtime's own file is raw.
  It is limited like the log: every 5 seconds and once more as the runtime stops, a standard error over 1 MiB has its last 1 MiB written, redacted, to `runtime.previous.errors.log` and is emptied, so it passes 1 MiB only by what is written in 5 seconds, and what is written while it is emptied can be lost.
  The check runs on the runtime's event loop, so a runtime part that writes in a synchronous loop isn't cut back until the loop ends.
  `runtime.previous.errors.log` holds only the latest cut, so a second cut in one run replaces the first.
  A start log whose launcher never reached its runtime, such as when the launcher itself ended, is removed when the next runtime starts.
  Redacting shows the home folder as `~`, even written with doubled backslashes, percent-encoded or with its Windows short name, and replaces the person's user name, email addresses, the account in an address and opaque values such as tokens with `[redacted]`.
  The user name goes wherever it stands as a word, even where it is also an ordinary word, since privacy comes before the log's reading, and without a Windows profile folder's suffix, such as `.CORP`; a user name shorter than three characters or a generic one, such as `runner`, stays, since ordinary text could hold it.
  Only names the app writes itself keep it, each where it stands as a whole word: the product's name, in the runtime's and the main process's logs, the kept standard error, the launcher's exit reason and copied details, and the company's package scopes, `@noldova-com` and `@noldova`, wherever they stand, as in a kept stack.
  A long value written as words that each start with a capital, such as the class name `WindowPartActivationFailedException`, is not opaque and stays.
  On an account named after one of the product's words, those keep the word as written, while that word elsewhere, a longer name holding the product's name, such as `Acme2` beside `Acme`, and a path under the home folder still go.
  An account named exactly as the product keeps its name wherever the product's own spelling stands, since the two can't be told apart there.
  Modules log through Noldova Desktop under their id, without secrets and without personal or project data they don't need.
- The data directory's `staged` folder holds the files the main process stages for file grants, each named by its grant; the runtime clears it when it starts.

## File grants

A module's runtime part reads a file the person picked, dropped or pasted in its window only by redeeming a grant the main process issued for it, as [WINDOW.md](WINDOW.md#the-boundary) says for the window's side.

- The main process issues each grant with `desktop.grantFile`, for one module, its own connection and one page of one window, with the file's real path, its name, media type and size, and its identity: its device, file number, size and modification time.
  The main process never grants a path that names another computer or a device, picked or dropped, nor a link or a real path that leads to one, and refuses such a path before any file system call and such a link before it follows it, as [PERMISSIONS.md](PERMISSIONS.md#file-grants) says.
  The runtime takes grants only from the main process's own requests, never a page's it forwards, and refuses a grant it already holds and one more for a window that holds 256 live grants and shares, the most it may, with `Conflict`; an older grant never ends to make room.
- A grant lives 10 minutes, or the shorter lifetime the window part asked for, timed by a monotonic clock so a wall clock set back doesn't keep it, and ends when its lifetime runs out, when its window part discards it, through `desktop.discardFileGrants` from that page, when the next page names itself, through `desktop.endFileGrants`, when its window closes, its connection ends or the runtime stops.
- A runtime part redeems a grant with its context's `files.redeemAsync(grant, request)`, at once in the request that brings it, and copies the file into its own store if it keeps it.
  Each grant is redeemed once, and only by its module, in a request from its connection, window and page, so a grant of a page that has ended is refused even when the main process's notice comes later; anything else is `NotFound`, the same for a grant that never was.
- The runtime then checks that the path is still a regular file, never a folder, a FIFO, a socket or a device, opens it read-only and compares the open file's identity with the grant's; a file that changed or was replaced is refused, with `Conflict`, and so is one that can't be read, with its reason.
  On Linux and macOS the open doesn't follow a link and doesn't wait, so a FIFO can't hang it.
  Windows has neither flag, so there the open follows a link, and the identity comparison, its device and file index above all, is what refuses a file swapped since the check.
- The part gets the file's name, media type, size and an open handle, and closes it when it has read the file.
  A file the part never closes keeps its handle until the runtime stops, and its staged copy until the next start empties the `staged` folder.
- A pasted file without a path is staged by the main process as a new file named by its grant in the `staged` folder, at most 64 MiB in one paste and 256 MiB staged in all, counted one call at a time so calls at once can't pass it; its copy is deleted when its grant ends unredeemed, when the part closes the redeemed file, and when the runtime starts.
- A runtime part shares one of its own files with its window part's page through its context's `files.shareAsync(file, request, options)`, inside the handler of the window part's request, and answers the share's grant, which the window part turns into an address on the main process's own scheme, as [WINDOW.md](WINDOW.md#the-main-process) says.
  The runtime resolves the file's real path, following any link, and shares only a regular file whose real path is inside the module's own data folder or work folder, never a folder, a FIFO, a socket or a device, nor a file a link leads out to; it records the file's identity and draws a random 128-bit grant.
  A request that doesn't come from a window's page is refused with `Unauthorized`, a file outside those folders or not a regular file with `InvalidParams`, and one that can't be read with `NotFound` and its reason.
- A share is held in the grants' table, for the request's connection, window, page and module, with the media type the part gives, and counts with the grants against the window's 256.
  It lives 10 minutes, or the shorter lifetime the part gives, and ends as a grant does, when its window part discards it or is withdrawn, its page or window ends, its connection ends or the runtime stops; resolving it doesn't end it, so the page can load the file again.
- The main process resolves a share for each request on its scheme with `desktop.resolveFileShare`, from its own requests only, never a page's it forwards, and only on the connection the share was made on; anything else, including a grant to redeem, is `NotFound`, and a runtime part can't redeem a share.
  The main process sends `desktop.endFileGrants` each time a window's next page names itself, since it doesn't know which pages hold shares.
- On Linux and macOS the main process opens a shared file without following a link and without waiting.
  Windows has neither flag, so there the open follows a link, and the comparison of the open file's identity with the share's, its device and file index above all, is what refuses a file swapped since it was shared.
- [PERMISSIONS.md](PERMISSIONS.md#file-grants) says what the grants and shares don't guard.

## Secrets

A module keeps its tokens, keys and passwords in this machine's secret store, as [ARCHITECTURE.md](ARCHITECTURE.md#secrets) says, and [MODULES.md](MODULES.md#secrets) says what its parts may do.

- The runtime keeps each value in Noldova Desktop's database, in the `secrets` table, keyed by the device, the module and the name, as the Base64 of the ciphertext the main process made with Electron's `safeStorage`; it never writes a value itself.
- A window and the command line save, remove and check a value with Noldova Desktop's methods `desktop.saveSecret`, which takes a `SecretValue`, `desktop.removeSecret` and `desktop.secretStatus`, which take a `SecretReference`; no method reads a value.
  A runtime part saves, reads, removes and checks its own module's values in its process, through its context's `secrets`.
- The runtime asks the main process through `desktop.secretCommand`, each command a `SecretCommand` with a call number:
  - `Device`, the device's identity, which only the main process knows; the runtime asks on its first secret call while the main process is connected, until it has an answer, and keeps that answer while it runs;
  - `Encrypt`, with a value of 1 to 16,384 characters, whose ciphertext the runtime stores;
  - `Decrypt`, with a stored ciphertext of at most 131,072 characters, whose value the runtime hands to the runtime part that asked.

  The main process answers each with a `SecretAnswered` of the same call, holding either the answer or a failure, `NoDevice`, `Unprotected` or `Undecryptable`.
  Removing and checking need only the database and the device's identity.
- The runtime applies the saves and removes of one name in the order they were asked: a save still waiting for its ciphertext holds back a later save or remove of that name, so a remove is never undone by a save asked before it.
- The main process encrypts and decrypts only while `safeStorage` says encryption is available and, on Linux, while its keyring is neither `basic_text`, its own text key, nor `unknown`; otherwise, and when encryption fails, it answers `Unprotected`, and nothing is written or read.
  A ciphertext it can't decrypt, such as one from before the keyring was reset, is `Undecryptable`, and the module saves the value again.
- Every refusal is `Unavailable`, and its `details` are `{ "reason": <SecretFailureReason> }`, the reason in parentheses below, which `SecretFailures.reasonOf` reads:
  - while no main process has connected since the runtime started, every call, saying to open the app, since the runtime doesn't know the device (`NotConnected`);
  - once the main process has gone, a save or a read still waiting, and later saves and reads until it connects again (`NotConnected`); removing and checking go on when the runtime already has the identity, and fail otherwise (`NotConnected`);
  - when the main process has no device identity, every call (`NoDevice`);
  - when the system has no keyring that protects a value, a save, saying nothing was saved, and a read, naming the secret it didn't read (`Unprotected`);
  - when the keyring can't decrypt a value, a read (`Undecryptable`).
- A command the main process can't read is logged without its value and left unanswered.
  A value never appears in the log, a failure's message, a notification or settings, and a model that refuses a value leaves it out of its message.

## Work and quitting

- A runtime part reports the work it has in progress through its context, and ends it when the work is done; stopping the work aborts it.
- The runtime lists the work with `desktop.work` and announces each change with an event of the same name.
- Before an app quits, restarts for an update or stops for a newer build while work is in progress, it asks the person whether to wait for the work or stop it, and never interrupts work without that choice.
  A newer build that waits for an older runtime's work asks it again every 2 seconds to stop if idle: a runtime sends events only to clients of its own build, and an older build already installed can't be changed to send its work to a newer one, so there is no event to wait for.
- Quitting first has every window save, as [WINDOW.md](WINDOW.md#closing-and-quitting) says, then asks the runtime to stop only if idle and only while no other client uses it.
- The runtime stops on SIGINT, SIGTERM and SIGHUP.

## The command line

- The command line runs on the app's own program in Node mode, so it is always the same build as a runtime it starts.
- It starts a runtime for a command that needs one, unless asked not to; reporting the runtime's state and printing the help never start one.
- It refuses another build's runtime and names it, unless asked to take over, and then takes over only an older build's idle runtime.
- `status` reports the runtime's build, its data directory, each module's state, the work in progress and the main window; `status --json` writes them as `{ build, dataDirectory, modules, work, window }`, where `modules` holds each module's `id`, `state` and, when it has one, `cause`, `work` the work's descriptions, and `window` the main window's `{ title, isVisible }`, or null while no main process has reported one.
- It quits the app through the runtime with `desktop.quit`, and never starts a runtime to do so.
- While its installation's launch barrier holds, or a runtime refuses it because an update is under way, it starts no runtime and waits up to 30 seconds for the barrier to go.
  It watches the installation's folder from before its first try and tries again as soon as that folder changes, since the barrier going and a runtime's update ending both change it.
  It also tries again every second, since a barrier whose holder has gone changes no file; a folder that can't be watched, or a watch that fails, is written to its errors once, and the wait then rests on that second alone.

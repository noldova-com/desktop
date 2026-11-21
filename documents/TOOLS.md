# Tools

**Scope:** The tool registry: how a module's runtime part offers agent tools, how an app's agents call them through agent sessions, the limits on a call and its result, and the failures every tool shares.
What a module asks the person before an agent acts is in [PERMISSIONS.md](PERMISSIONS.md); what a module declares is in [MODULES.md](MODULES.md).

## Roles

- A **tool** is an action an agent may call, such as reading a page or running a command, which a module's runtime part offers and handles.
- An **agent session** is one agent's use of the app's tools, opened by the app and ended by it; the registry gives it its id when it opens, and the id never comes from a tool's arguments.
- The **app** is the module that serves tools to its agents, through whatever agent protocol it speaks.
  It opens the sessions, decides which tools each one reaches, and passes calls on; it never changes a tool's name, schema or risk.
- The registry lives in the runtime and knows no app: a module offers tools without knowing who calls them, and the app calls them without importing the module.
- A module that offers tools runs no server and opens no port for them.
  The app may serve its agents over a loopback endpoint that its runtime part opens through its context, as [Serving agents over loopback](#serving-agents-over-loopback) says.
  Noldova Desktop doesn't check whether a part that opens an endpoint also offers tools: keeping the two apart is this rule's, and review's.

## Declaring and registering

- A module lists the names of its tools in `module.json`, under `contributes.tools`, as [MODULES.md](MODULES.md#declaration) says.
- A tool's name is snake_case, at most 64 characters, matching `^[a-z][a-z0-9_]*$`, and starts with the module's id in snake_case or the id's first word, then an underscore, such as `notes_search` for the module `notes`.
  The build refuses a tool name that two modules declare.
- A runtime part registers a tool while it is active, through its context: `context.tools.register(descriptor, handler)` returns a `Registration`, which is disposable, and disposing it withdraws the tool.
- The registry refuses a name the module doesn't declare, and a name already registered, with a `RegistrationException`; and a descriptor that breaks the rules below, a schema outside the subset included, with an `ArgumentException` that names the field.
- Once a part's deactivation starts, its tools take no new call and leave `session.listTools()`, while their calls in flight go on until it disposes every registration it holds.
  A new call fails as `Unavailable`, and so does a call still waiting for its resource's turn when the deactivation starts, without reaching the handler.
  The tools stay closed for the rest of the run, even if the module registers them again.
- Withdrawing a tool, or the app switching it off, ends its calls in flight with the abort reason `SwitchedOff`.

### The descriptor

| Field | Holds |
|---|---|
| `name` | The tool's declared name. |
| `title` | Optional: a short name people see. |
| `description` | What the tool does, for the agent. |
| `inputSchema` | A JSON Schema object whose `type` is `object`, for the arguments, in the subset that [Schemas](#schemas) lists; the registry checks every call against it before the handler runs. |
| `outputSchema` | Optional: a JSON Schema object whose `type` is `object`, for the result's structured fields, in the same subset; a result has structured fields exactly when its tool has an output schema. |
| `hints` | `isReadOnly`, `isDestructive` and `isOpenWorld`, passed on to the agents unchanged. |
| `risk` | `default` and `maximum`, each `Low`, `Medium` or `High`, the default never above the maximum; the app shows them and never changes them. |
| `isResumable` | Whether a later call can safely finish what an interrupted one began; `false` when absent. |
| `marksSending` | Whether the handler reports its point of no return; `false` when absent, and then a call reaches the point when it starts. |
| `deadline` | `default` and `maximum` in whole milliseconds: the default at least 1 and at most the maximum, and the maximum within the registry's limit. |
| `resource` | Optional: what calls take turns on, as below. |
| `limits` | Optional: the tool's own result limits, each a whole number from 1: `textCharacters`, at most 262,144; `imageBytes`, at most 1,048,576; `imageLongEdge` and `imagePixels`. |
| `nextTool` | One of the module's declared tools that tells the agent where things stand; required for a tool that is neither read-only nor resumable, and optional for the others. |

- A **point of no return** is the first step of a call that may change something outside the module, such as its first input to another program.
  A tool whose `hints.isReadOnly` is `true` has none, so its calls never end as `OutcomeUncertain`.

### Turns

- `resource` is either a JSON Pointer into the arguments, such as `/item_id` or `/items/0`, or `binding:<name>` for a target the app binds to the session.
  As in JSON Pointer, a token steps into an array only as an index without leading zeros, within the array.
- Calls with the same resource run one at a time, in arrival order, and a waiting call's wait counts against its own deadline.
  Two targets are the same when their values are equal, whatever the order of an object's keys.
- A call keeps its resource's turn while its permission request waits, so what the person is asked about can't change under it.
  A call of the same session waiting behind it keeps its own deadline running, so it may end as `TimedOut` while the first one waits.
- A call on a resource that a call of another session holds fails at once as `Unavailable`.
- A call gives up its turn, and its place among its session's calls in flight, when it ends, by its result, its failure, its deadline or an abort, even if its handler hasn't returned.
  A call that returns while its permission request still waits keeps its turn until the request is answered or withdrawn; its session's end or stop, and its tool's withdrawal, withdraw it.
  A handler that goes on after its signal aborts may then overlap the next call on the resource, so it stops at the abort.
- A call whose resource points at nothing, or at `null`, fails at once as `Refused`.
- Calls without a resource run in parallel.
- A module that holds something for one session across calls, such as a device, keeps that hold itself and refuses other sessions as `Unavailable`.

### Schemas

- A tool's schemas use a fixed subset of JSON Schema 2020-12, and the registry refuses at registration a schema that uses any other keyword, or a value a keyword can't take, so a schema never promises a check the registry doesn't make.
- The subset:

  | Kind | Keywords |
  |---|---|
  | Any value | `type` (`null`, `boolean`, `object`, `array`, `number`, `integer` or `string`, or a list of them), `enum`, `const` and `anyOf` |
  | Strings | `minLength`, `maxLength`, counted in Unicode code points, and `pattern`, a regular expression with the `u` flag that matches anywhere in the string unless it anchors itself |
  | Numbers | `minimum`, `maximum`, `exclusiveMinimum` and `exclusiveMaximum` |
  | Arrays | `items`, one schema for every item, `minItems` and `maxItems` |
  | Objects | `properties`, `required` and `additionalProperties`, `false` or a schema |
  | Annotations, never checked against a value | `$schema`, which must be `https://json-schema.org/draft/2020-12/schema`, `$comment`, `title`, `description`, `default`, `examples`, `deprecated`, `readOnly` and `writeOnly` |

- A subschema is always an object; boolean subschemas, `$ref`, `format` and every other keyword are refused.
- The registry checks each call's arguments against the input schema before the handler runs, and refuses arguments that don't fit as `Refused`, with a message that names the first value that doesn't fit, by its JSON Pointer, and the keyword it fails.
- It checks a result's structured fields against the output schema, and a result whose fields don't fit becomes `Unavailable` with `<id>.malformedResult`.

## Calls

- The app opens a session with `context.tools.openSession(scope, bindings)` and ends it with `session.end()`.
  - `scope` is the app's opaque name for what the session acts for, such as a conversation, and is at most 256 characters.
  - `bindings` is a JSON object the app fills, by binding name, with what it attaches to the session for each module, such as a folder or the items the person shared; each module's document names the bindings it reads.
- `session.listTools()` lists the registered tools' descriptors, and `session.callAsync(name, arguments, options)` calls one, with an optional deadline within the tool's maximum and an abort signal.
- The registry hands the handler one call: `session`, `scope` and `bindings` from the session, the checked `arguments`, `deadline` as an absolute time, `signal`, `markSending()` and `markNothingSent()`.
- A handler that marked sending and then knows that nothing of the call reached the outside, such as a step that checks its target in the same operation as the input and refuses before sending, calls `markNothingSent()`; the call then ends as before its point of no return, so a failure keeps its own code, such as `Stale` or `Refused`, and an abort ends it with the abort's own code, also when the handler calls it within the grace after the abort.
  It counts only for a tool whose descriptor sets `marksSending`; any other tool passes its point of no return when its handler starts, whatever it marks.
  A handler calls it only when it knows that no input was sent, never when it can't tell; a later `markSending()` undoes it.
- `call.deadline` moves later by each permission wait, so a handler reads it when it needs it, such as after a request resolves, and never keeps an earlier copy.
- The handler resolves with a result, or rejects with a `ToolFailureException` that carries a `ToolFailure`, which names a shared code and may carry a module code, content and the next tool, as [Failures](#failures) says.
  Any other rejection becomes `Unavailable` with the module code `<id>.internal`, and its message goes only to the log.
- A `ToolFailureException` may carry the error that caused it as its `cause`, such as a process's exit or an addon's message.
  When the registry takes the failure, also within the grace after an abort, it writes the tool's name, the failure's message and the cause, with its stack, to the module's log; the agent never gets the cause.
  A cause or failure that cannot be written, such as one whose custom inspection throws, leaves one fixed line naming the tool, and the call is still answered at once.
- A rejection that comes after the call has ended, such as after its deadline, is written to the module's log once, unless it is the call's own abort reason or a failure the registry takes for the ended call, as [How an aborted call ends](#how-an-aborted-call-ends) says; a failure that doesn't fit its shape is written to the log too.
- The signal aborts with one reason: `Stopped`, `Cancelled`, `SessionEnded`, `SwitchedOff` or `DeadlineReached`.
- While a permission request of the call waits, the call's deadline stops running; the request has its own expiry, as [PERMISSIONS.md](PERMISSIONS.md#limits) says.
- The registry ends a call at its deadline even if the handler hasn't returned, and answers it within the grace that [How an aborted call ends](#how-an-aborted-call-ends) gives.

### How an aborted call ends

An aborted call fails with the code its reason and its progress give; a resumable tool's call fails with the same code after its point of no return as before it, since a later call can finish its work.

| Reason | Before the point of no return, or any point of a resumable tool | After the point of no return, of a tool that isn't resumable |
|---|---|---|
| `Cancelled`, `SessionEnded` | `Cancelled` | `OutcomeUncertain` |
| `Stopped` | `Stopped` | `OutcomeUncertain` |
| `DeadlineReached` | `TimedOut` | `OutcomeUncertain` |
| `SwitchedOff` | `Unavailable` | `OutcomeUncertain` |

- Any reason that comes while the call's permission request waits ends it as `Withdrawn` when the call is before its point of no return, or its tool is resumable or read-only.
- After the point of no return, a call of a tool that isn't resumable fails only as `OutcomeUncertain`, whatever ends it, a withdrawn, denied or expired request included, since an earlier step may have taken effect; its module code may say what ended it.
- A read-only tool has no point of no return, so its calls always take the first column.
- The call gives up its turn and its place among its session's calls in flight at the abort, but when its handler has started, the registry answers the caller only after a grace of up to one second, so the handler can say what happened.
  A `ToolFailureException` the handler rejects with within the grace ends the call with the code above, and with that failure's message, module code and content; the `nextTool` stays the abort's own, none for the first column and the descriptor's for `OutcomeUncertain`, whatever the failure names.
  A failure that doesn't fit its shape, as [What fails closed](#what-fails-closed) says, a result, any other rejection, or no answer within the grace ends the call with the registry's own message for its code, such as "The call was cancelled.".

### The result

- A result is a list of content items, each `text` or `image` (PNG or JPEG, as base64), and optional structured fields that match the output schema.
- The registry puts the call's permission requests on the result it returns, as `requests`, as [A call's requests](PERMISSIONS.md#a-calls-requests) says.
- Each item says whether it is untrusted, meaning it holds content from outside the module, such as a page, a program's output or a screenshot, and if so its origin; the app passes the mark on to the agent.
  An item without the mark counts as untrusted.
- An origin is a string of at most 1,024 characters: for web content, the origin of its address as the URL standard writes it, such as `https://example.com`; for other content, `<id>:<label>`, the module's id and its own label for the source, such as `notes:import`.
- An opaque origin, such as that of `about:blank`, a `data:` address or a sandboxed frame, is written `<id>:opaque`, since the URL standard writes it as `null`.
- An item that holds content from several origins, such as a page with frames of other origins, names its top-level page's origin and writes each other origin in its text beside that content.
- A result's structured fields always count as untrusted, and the app passes them to the agent as data.
- The module cuts what is too long and marks the cut; the registry never cuts a result.

## Serving agents over loopback

- An app whose agent takes no tool server on its standard input and output serves its tools over a loopback endpoint, which its runtime part opens with `context.tools.openEndpointAsync(handler)`.
  Noldova Desktop speaks no agent protocol over it; the app's handler answers in its own, such as the Model Context Protocol over HTTP.
- The endpoint keeps these conditions, and no option changes them:
  - It listens on `127.0.0.1` alone, never `::1` or `0.0.0.0`, on a port the system picks when it opens.
  - Each agent session gets its own bearer token from `endpoint.admit(session)`, 32 random bytes kept only in the endpoint's memory and never stored or logged.
    Admitting a session again replaces its token, and a token stops working when its session ends or the endpoint closes.
  - It admits only an open session that the same part opened; admitting any other session, or admitting after the endpoint closed, throws.
  - It answers only a request addressed to `127.0.0.1:<port>` that carries no `Origin` header and carries a live token as `Authorization: Bearer <token>`.
    A request whose `Host` names anything else gets 421, one with an `Origin` gets 403, and one without a live token gets 401 with `WWW-Authenticate: Bearer`; a request without `Host` gets 400 from Node.
    None of these answers has a body, and none reaches the handler.
  - It closes when the part deactivates, or when the app disposes it, and drops its open connections.
  - Its calls still go through the registry's agent sessions: the handler gets the token's session and reaches tools only through `session.callAsync`.
- The endpoint caps a request's headers at 16 KiB, answering 431 above it, and gives a client 10 seconds to send them and 30 seconds to send the whole request, checked each second, answering 408 when either runs out, and holds at most 64 connections at once, closing any further one unanswered; the body is the handler's to read and to bound, and the handler may keep its answer open to stream, such as with server-sent events.
- The endpoint sends the handler no signal of its own: when the endpoint closes, the handler's response closes, and the handler stops at its `close` event; when the session ends, its calls in flight abort and its new calls fail as `Unavailable`.
- A handler that rejects is written to the module's log, by its error's name, message and stack alone, so a token that the error's other properties carry, such as in the request's headers, isn't logged; the endpoint then answers 500 with no body, or closes the connection when the answer has already started.
- The app hands each token to its agent, such as in the agent's configuration for that session, and never stores or logs it.

## Events

| Event | Reaches | When |
|---|---|---|
| `sessionEnded(session)` | Every runtime part that listens with `context.tools.onSessionEnded(listener)` | The app ends the session or its connection closes; each part drops the session's references, holds and requests within 5 seconds. |
| `switchedOff(name)`, `switchedOn(name)` | The tool's part | The app turns one of its tools off or on again while its module stays on. |
| `stopped(reason)`, `resumed()` | Every runtime part that registers tools | Agent control stops, or the person resumes it; stopping aborts every call in flight with `Stopped`. |
| `sessionStopped(session, reason)` | Every runtime part that listens with `context.tools.onSessionStopped(listener)` | A part stops one session's turn; the app's part, which opened the session, ends the agent's turn and says so in its reply. |

- A `sessionEnded` listener that throws is written to its module's log and stops no other listener.
- Turning a whole module off deactivates its runtime part, as [MODULES.md](MODULES.md#lifecycle) says, which releases its tools; the part then offers no tool and does no work for agents.
- The person or any runtime part stops all agent control, a part with `context.tools.stopAll(reason)`, such as when the person takes over or a part misses its own heartbeat.
- Only the person resumes: a part calls `context.tools.resumeAll()` only from a command the person runs, whose request's client it checks is `ShellClients.mainProcess`, and the registry refuses it, with an `AgentControlException`, while a tool call of that part runs, until its handler returns even past its abort, and while agent control is stopping, as in a listener of `onStopped` or of a call's abort.
- A part stops one agent session's turn with `context.tools.stopSession(session, reason)`, such as for a page's Stop or Take over, only from a command the person runs, whose request's client it checks is `ShellClients.mainProcess`, as for `resumeAll`; the session is the id a tool call gives.
  That check, in the part's own code, is the only gate: the registry can't tell a part's command from its own call, so it refuses a stop only while agent control or a session stops.
  Every call of that session in flight ends with `Stopped`, a call whose permission request waits ends with `Withdrawn` and the request is withdrawn, and every part's `onSessionStopped` listeners hear the session and the reason; the reason follows a stop's rules below.
  The session stays open: its later calls run as usual, and the person's next message starts a new turn; a session that isn't open does nothing.
  The registry refuses it, with an `AgentControlException`, while agent control or a session's turn is stopping, as in a listener of `onStopped` or `onSessionStopped` or of a call's abort, and refuses `resumeAll` then too.
  Unlike `resumeAll`, it isn't refused while one of the part's own calls runs: a stop only takes power away from an agent, and the person's Stop or Take over comes exactly while that session's call acts on the page.
- While agent control is stopped, every new call fails with `Stopped` until the person resumes it, and sessions still open; a stop while stopped, or a resume while running, does nothing.
- A part reads `context.tools.isStopped` to know whether agent control is stopped, such as when it's switched on after a stop and heard no `onStopped`; it's true from the stop until the resume, and already so in the `onStopped` and `onResumed` listeners.
- A stop's reason is one line that isn't blank, of at most 200 characters, and reaches every part's `context.tools.onStopped` listeners; `context.tools.onResumed` listeners hear the resume, and a listener that throws is written to its module's log and stops no other listener.
  An `onResumed` listener that stops agent control again ends the resume there: the later `onResumed` listeners don't hear it, so none of them shows agent control running while it's stopped, and they hear only the next resume, once.
  A listener disposed by an earlier listener of the same event doesn't hear it.
- Noldova Desktop registers the commands `desktop.stopAgentControl`, with the default key `Mod+Shift+Period`, and `desktop.resumeAgentControl`, and shows the first in the tray; the stop key is among the app's shortcuts that a part's context gives, as [MODULES.md](MODULES.md#the-apps-own-windows-and-keys) says.
  Only the app's main process, for its window and its tray, runs `desktop.resumeAgentControl`: from any other client, such as the command line, it fails with `Unauthorized`, and `desktop.commands` leaves it out of that client's list, while anyone may stop.
  The check rests on the client kind each connection names in its handshake, so like the token it keeps out other clients, not other programs running as the same person, as [RUNTIME.md](RUNTIME.md#endpoint-and-authentication) says.
- Agents act while any agent session is open, from `openSession` until its `end`.
- While agents act, Noldova Desktop also takes the stop key system-wide, so it works in every application, and it takes the same key from other applications then, such as a word processor's key that enlarges text, and the key that shows hidden files in the system's open and save panels on macOS.
- The system-wide key is the person's own binding of `desktop.stopAgentControl`: a change takes effect at once, and with no binding Noldova Desktop takes no system-wide key.
- When the system refuses the key, such as when another program holds it, Noldova Desktop says so in a notification and on the tray's Stop, which still works, and the key works only inside the app.
  On Linux under Wayland the desktop's portal decides and never tells the app, so a declined key, or a desktop without the portal, says nothing; the key then works only inside the app, as [WINDOW.md](WINDOW.md#keys-and-menus) says.
- While agent control is stopped, Noldova Desktop shows a bar with Resume above every open view and document of a module that declares tools, which runs `desktop.resumeAgentControl`, as [WINDOW.md](WINDOW.md#workspace) says.
- A window part learns whether agent control is stopped, and when that changes, from its context's `agentControl` signal, which the runtime keeps current through Noldova Desktop's event `desktop.agentControlChanged`.

A session's end aborts its calls in flight with `SessionEnded` and withdraws its waiting permission requests, also those of calls that have already returned.
A client connection's end, which a part may need for what it opened for that client, reaches the part through its runtime context, not through the registry.

## Failures

Every tool fails with one of these codes, so an agent reads every module's failures the same way.

| Code | Means |
|---|---|
| `Refused` | The input is invalid or over its limit, or the module refuses the action without asking. |
| `Denied` | The person or the app's policy said no, the person took the action over, as [PERMISSIONS.md](PERMISSIONS.md#the-decision) says, or the request couldn't be raised. |
| `Expired` | Nobody answered the permission request in time. |
| `Withdrawn` | The call was aborted while its permission request waited, as [How an aborted call ends](#how-an-aborted-call-ends) says. |
| `Cancelled` | The agent or the app cancelled the call, or its session ended, as [How an aborted call ends](#how-an-aborted-call-ends) says. |
| `Stopped` | The person stopped the call, or took over, as [How an aborted call ends](#how-an-aborted-call-ends) says. |
| `Stale` | What the person allowed changed before the module acted, so nothing ran. |
| `TimedOut` | The deadline passed, as [How an aborted call ends](#how-an-aborted-call-ends) says. |
| `OutcomeUncertain` | A call of a tool that isn't resumable ended after its point of no return, for any reason. |
| `TooLarge` | A result is over its limit even after the module cut it. |
| `Unavailable` | The tool, its target or its module can't answer: switched off, crashed, gone, or held by another session. |

- A failure carries its code, a message for the agent, and optionally:
  - a module code `<id>.<name>`, with the module's id as it is, hyphens included, and a camelCase name, such as `notes.indexBusy` or `file-index.notReady`;
  - content items, such as the output a command printed before it failed, with the same marks and limits as a result's;
  - `nextTool`, the name of one of the module's tools that tells the agent where things stand, which `OutcomeUncertain` always names: the failure's own, or else the tool's descriptor's.
- The registry puts the call's permission requests on the failure it returns, as `requests`, as [A call's requests](PERMISSIONS.md#a-calls-requests) says.
- Any code may carry a module code, `OutcomeUncertain` included, such as the reason a call ended after its point of no return.
- A module refuses an action it won't take even with permission as `Refused`, and an internal fault as `Unavailable`, each with its module code beside it; there is no other shared reason.

## Limits

A size "as JSON" is the number of UTF-8 bytes of the value written as JSON without spaces.

| What | Limit |
|---|---|
| A call's deadline | At most 120 seconds; each tool's `deadline.maximum` stays within it. |
| An ended call's grace | 1 second after its abort, for its handler's own failure; a `ToolRegistry` given another grace, as the tests give one, waits that instead. |
| A call's arguments | At most 64 KiB as JSON. |
| A text item | At most 256 KiB as UTF-8. |
| An image item | At most 1 MiB before base64. |
| A whole result or failure | At most 2 MiB as JSON. |
| A session's calls in flight | At most 16. |

## What fails closed

- Arguments over their limit or that don't fit the input schema, a deadline outside the tool's range, and a call beyond a session's calls in flight never reach the handler: `Refused`.
- Every call has a deadline, and the registry enforces it.
- A result that doesn't fit its shape or its schema becomes `Unavailable` with `<id>.malformedResult`, such as an origin that is neither a web origin nor `<id>:<label>`, an image whose size can't be read, or structured fields that the tool has no output schema for or that don't fit it.
- So does a failure whose module code isn't `<id>.<name>`, whose `nextTool` isn't one of its module's tools, whose code is `OutcomeUncertain` from a tool that can't end uncertain, or whose fields can't be checked, such as a module code that isn't a string; `ToolContent` refuses text or an origin that isn't a string where the item is made.
- A result over a limit becomes `TooLarge`.
- A call of a tool that is switched off, unregistered or whose part isn't active fails as `Unavailable`.
- An unknown abort reason counts as `Cancelled`.

## Not built yet

This document is the contract; these parts of it are not built yet:
- switching one tool off and on while its module stays on: `switchedOff` and `switchedOn`.

## What stays product-neutral

- The registry names no app, module, agent protocol or model: tools, sessions, scopes and bindings are data to it.
- A module never imports the app's packages, and the app reaches tools only through the registry.
- The app decides which tools each session sees and how it shows them, and never changes what a module declares.

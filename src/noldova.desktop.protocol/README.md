# Protocol

**Scope:** The local protocol, `src/noldova.desktop.protocol`, that an app's window, its main process, its runtime and its command line speak to each other, under the [runtime rules](../../documents/RUNTIME.md#messages).

## 1. Purpose

`@noldova/desktop.protocol` holds the messages that cross Noldova Desktop's local connections, their JSON forms and their checks, and nothing that sends them.
The runtime, the main process, the command line and the window import it, so each side reads and writes the same messages; a module's runtime and window parts import it for the names, settings, notifications, web views and keys they declare or receive.
It imports only context's core, exceptions and json packages and runs in Node.js and in the browser alike.
For that reason its source compiles without Node's types: `src/interfaces/url.d.ts` declares only the part of `URL` that `LinkPolicy` uses, which Node and the browser share, so a Node-only API fails to compile instead of failing in the window.

## 2. Use

An app or module installs it at the exact version its Noldova Desktop version pins, beside the context packages it peers on:

```ts
import { FrameReader, FrameWriter, Request, WireDecoder } from "@noldova/desktop.protocol";
```

Every model checks its values when it is made, reads its JSON form with `fromJson`, which takes any value and names the path of the first field that is missing, invalid or unknown, and writes it with `toJson`.
The second entry, `@noldova/desktop.protocol/testing`, holds `Fake`, the base of the fakes a test answers member by member, and `UnansweredCallException`, which a fake throws for a member the test gave no answer for.

## 3. Contents

| Part | What it holds |
|---|---|
| Frames | `FrameWriter` writes one message a line and `FrameReader` splits the lines back, each refusing a frame over its maximum length, 16 MiB by default, with `ProtocolException` and `FailureCode.FrameTooLarge`. |
| Messages | `Handshake`, `Request`, `Response`, `Event` and `Cancel`, the envelopes `WireDecoder` reads from a frame, with `Failure` and its `FailureCode` for a request that fails. |
| Names | `QualifiedName`, a method's or event's owner and member, such as `desktop.handshake`, and `ShellMethods`, `ShellEvents`, `ShellNotifications` and `ShellClients`, Noldova Desktop's own. |
| Payloads | The models of Noldova Desktop's own methods and events: modules' status, commands, settings, notifications, file grants, secrets, web views, windows, keys, updates, quitting and agent control. |
| Checks | `WireContract`, which a module's own models use to refuse unknown fields and to name the field a model refused; `LinkPolicy`, which allows only the links a window may open. |

## 4. Failures

Every exception the package owns extends `DesktopProtocolException`, which a caller catches to handle any of them.
`ProtocolException` carries the `FailureCode` of a connection's frames that break the protocol, `FrameTooLarge`, and the maximum length the frame exceeded; a value that isn't valid is refused with context's `ArgumentException` when a model is made and `JsonException`, naming its path, when one is read.

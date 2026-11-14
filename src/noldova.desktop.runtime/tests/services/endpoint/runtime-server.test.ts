/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  BuildIdentity,
  Cancel,
  Event,
  Failure,
  FailureCode,
  Handshake,
  ProtocolException,
  QualifiedName,
  Request,
  Response,
  RuntimeHandover,
  ShellClients,
  ShellMethods
} from "@noldova/desktop.protocol";
import {
  EndpointUnavailableException,
  MethodFailureException,
  Refusal,
  RequestContext,
  RuntimeServer,
  ServerSettings
} from "@noldova/desktop.runtime";

import { RuntimeServerFixture } from "../../fixtures/runtime-server.fixture.js";
import { SocketFolderFixture } from "../../fixtures/socket-folder.fixture.js";

@TestClass
export class RuntimeServerTests {
  private static readonly MOVE: QualifiedName = new QualifiedName("notes", "move");
  private static readonly LARGE: QualifiedName = new QualifiedName("notes", "large");
  private static readonly BROKEN: QualifiedName = new QualifiedName("notes", "broken");
  private static readonly COUNT: QualifiedName = new QualifiedName("notes", "count");
  private static readonly CLOSE: QualifiedName = new QualifiedName("notes", "close");

  @TestMethod
  public answersTheHandshakeWithItsIdentityAndServesRequests(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(64 * 1024, 100, 1_000, 2_000), async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);

      const [connection, answer] = await fixture.handshakeAsync("main");
      const silent = await fixture.connectAsync();
      await silent.waitForCloseAsync();
      connection.sendMessages(new Request("main:1", RuntimeServerFixture.ECHO, { path: "notes.md" }));
      const response = await connection.readResponseAsync();

      Assert.areEqual("main:0", answer.id);
      Assert.areEqual(JSON.stringify(RuntimeServerFixture.IDENTITY.toJson()), JSON.stringify(answer.payload));
      Assert.areEqual("main:1", response.id);
      Assert.areEqual("{\"client\":\"main\",\"payload\":{\"path\":\"notes.md\"}}", JSON.stringify(response.payload));
      Assert.areEqual(1, fixture.server.sessionCount);
    });
  }

  @TestMethod
  public countsTheAuthenticatedConnectionsBesideTheAskingOneWhateverTheirClientsAreCalled(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerTests.COUNT, { handleAsync: (context: RequestContext) => Promise.resolve(fixture.server.countOtherClients(context)) });
      const mainProcess = await fixture.authenticateAsync("main");
      await fixture.authenticateAsync("main");
      await fixture.authenticateAsync("cli");
      const [, other] = await fixture.handshakeAsync("tool", RuntimeServerFixture.OTHER_IDENTITY);
      await fixture.connectAsync();
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 5);

      mainProcess.sendMessages(new Request("main:1", RuntimeServerTests.COUNT, null));
      const counted = await mainProcess.readResponseAsync();

      Assert.areEqual(FailureCode.BuildMismatch, other.failure?.code);
      Assert.areEqual(2, counted.payload);
      Assert.areEqual(3, fixture.server.countOtherClients(new RequestContext("main", null, new AbortController().signal, 1)));
    });
  }

  @TestMethod
  public refusesAWrongToken(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const [connection, answer] = await fixture.handshakeAsync("main", RuntimeServerFixture.IDENTITY, "guess");

      RuntimeServerFixture.assertFailure(answer, FailureCode.Unauthorized, "The capability token is not valid for this runtime.", "main:0");
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public requiresTheHandshakeFirstAndIgnoresWhatFollows(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const connection = await fixture.connectAsync();

      connection.sendMessages(new Request("tester:1", RuntimeServerFixture.ECHO, null), new Request("tester:2", RuntimeServerFixture.ECHO, null));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "A connection must begin with a handshake.", null);
      await connection.waitForCloseAsync();
      await Assert.throwsAsync(() => connection.readTextAsync(), Error);
    });
  }

  @TestMethod
  public closesAConnectionThatSendsNoHandshakeInTime(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 100, 1_000, 1_000), async fixture => {
      const connection = await fixture.connectAsync();

      await connection.waitForCloseAsync();

      await Assert.throwsAsync(() => connection.readTextAsync(), Error);
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 0);
      Assert.areEqual(2, fixture.changes);
    });
  }

  @TestMethod
  public endsAConnectionWhoseFirstFrameIsInvalid(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const connection = await fixture.connectAsync();

      connection.send("not json\n");

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public keepsAnAuthenticatedConnectionAfterAnInvalidFrame(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const connection = await fixture.authenticateAsync();

      connection.send(`{"kind":"Unknown"}\n${new Request("tester:1", RuntimeServerFixture.ECHO, 1).toText()}\n`);

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      Assert.areEqual("{\"client\":\"tester\",\"payload\":1}", JSON.stringify((await connection.readResponseAsync()).payload));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public endsAConnectionThatSendsAnOversizedFrame(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      const connection = await fixture.authenticateAsync();

      connection.send("x".repeat(2_048));

      const response = await connection.readResponseAsync();
      Assert.areEqual(FailureCode.FrameTooLarge, response.failure?.code);
      Assert.isNull(response.id);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public answersAnAnswerItCannotSendWithAFailureAndKeepsTheConnection(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerTests.LARGE, { handleAsync: () => Promise.resolve("x".repeat(2_048)) });
      fixture.methods.register(RuntimeServerTests.BROKEN, { handleAsync: () => Promise.resolve(RuntimeServerTests.loop()) });
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerTests.LARGE, null),
        new Request("tester:2", RuntimeServerTests.BROKEN, null),
        new Request("tester:3", RuntimeServerFixture.ECHO, 1));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.FrameTooLarge, "A frame exceeds the maximum length of 1024 characters.", "tester:1");
      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.Internal, "The runtime failed to handle the request.", "tester:2");
      Assert.areEqual("{\"client\":\"tester\",\"payload\":1}", JSON.stringify((await connection.readResponseAsync()).payload));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public logsAnEventItCannotSendAndSendsItToNoClient(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(1_024, 1_000, 1_000, 1_000), async fixture => {
      const first = await fixture.authenticateAsync("first");
      const second = await fixture.authenticateAsync("second");

      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "x".repeat(2_048)));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, RuntimeServerTests.loop()));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "small"));

      Assert.areEqual("\"small\"|\"small\"", `${JSON.stringify((await first.readEventAsync()).payload)}|${JSON.stringify((await second.readEventAsync()).payload)}`);
      const entries = fixture.diagnostics.text.split("The runtime sent the event notes.echo to no client: ").slice(1);
      Assert.areEqual(2, entries.length);
      Assert.areEqual("ProtocolException: A frame exceeds the maximum length of 1024 characters.\n", entries[0]);
      Assert.isTrue(entries[1]?.startsWith("TypeError: Converting circular structure to JSON") === true);
      Assert.isFalse(first.isClosed || second.isClosed);
    });
  }

  @TestMethod
  public sendsAnEventToOneConnectionAndNoneToAClosedWindow(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerTests.CLOSE, {
        handleAsync: (context: RequestContext) => {
          fixture.server.closeWindow(context, 3);
          return Promise.resolve(null);
        }
      });
      const first = await fixture.authenticateAsync("main");
      const second = await fixture.authenticateAsync("main");
      first.sendMessages(new Request("main:1", RuntimeServerTests.CLOSE, null));
      await first.readResponseAsync();

      fixture.server.send(new Event(RuntimeServerFixture.ECHO, "closed window", 3), 1);
      fixture.server.send(new Event(RuntimeServerFixture.ECHO, "open window", 4), 1);
      fixture.server.send(new Event(RuntimeServerFixture.ECHO, "no window"), 2);
      fixture.server.send(new Event(RuntimeServerFixture.ECHO, "no connection"), 99);
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "all"));

      const toFirst = [await first.readEventAsync(), await first.readEventAsync()].map(t => t.toText());
      const toSecond = [await second.readEventAsync(), await second.readEventAsync()].map(t => t.toText());
      Assert.areEqual(
        "{\"kind\":\"Event\",\"name\":\"notes.echo\",\"payload\":\"open window\",\"window\":4}|{\"kind\":\"Event\",\"name\":\"notes.echo\",\"payload\":\"all\"}",
        toFirst.join("|"));
      Assert.areEqual("{\"kind\":\"Event\",\"name\":\"notes.echo\",\"payload\":\"no window\"}|{\"kind\":\"Event\",\"name\":\"notes.echo\",\"payload\":\"all\"}", toSecond.join("|"));
    });
  }

  @TestMethod
  public cancelsAClosedWindowsRequestsStillRunningBeforeReportingTheClosure(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const signals: AbortSignal[] = [];
      const heard: string[] = [];
      fixture.methods.register(RuntimeServerFixture.WAIT, RuntimeServerFixture.createWaitHandler(signals));
      fixture.methods.register(RuntimeServerTests.CLOSE, {
        handleAsync: (context: RequestContext) => {
          fixture.server.closeWindow(context, 3);
          return Promise.resolve(null);
        }
      });
      fixture.server.closures.listen(t => {
        heard.push(`${t.window}: ${signals.map(u => u.aborted).join(",")}`);
      });
      const connection = await fixture.authenticateAsync("main");

      connection.sendMessages(
        new Request("main:1", RuntimeServerFixture.WAIT, null, undefined, 3),
        new Request("main:2", RuntimeServerFixture.WAIT, null, undefined, 4),
        new Request("main:3", RuntimeServerTests.CLOSE, null));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.Cancelled, "The request was cancelled.", "main:1");
      Assert.areEqual("main:3", (await connection.readResponseAsync()).id);
      Assert.areEqual("3: true,false", heard.join("|"));
    });
  }

  @TestMethod
  public reportsEachAuthenticatedConnectionOnceWhenItEndsOrIsReset(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const closed: string[] = [];
      fixture.server.closures.listen(t => {
        closed.push(`${t.connection}:${t.window}`);
      });
      const ended = await fixture.authenticateAsync("main");
      const reset = await fixture.authenticateAsync("main");
      const [otherBuild] = await fixture.handshakeAsync("tool", RuntimeServerFixture.OTHER_IDENTITY);
      const silent = await fixture.connectAsync();

      otherBuild[Symbol.dispose]();
      silent[Symbol.dispose]();
      ended[Symbol.dispose]();
      reset.reset();
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 0);

      Assert.areEqual("1:null|2:null", closed.sort().join("|"));
    });
  }

  @TestMethod
  public answersUnknownMethodsAndUnexpectedMessages(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerFixture.ECHO, null),
        new Handshake("tester:2", RuntimeServerFixture.IDENTITY, RuntimeServerFixture.TOKEN, "tester"),
        new Event(RuntimeServerFixture.ECHO, null),
        Response.success("tester:3", null),
        new Cancel("tester:9"));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.UnknownMethod, "The method notes.echo is not registered.", "tester:1");
      for (let index = 0; index < 3; index++)
        RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "Only requests and cancellations may follow the handshake.", null);
      connection.sendMessages(new Request("tester:4", RuntimeServerFixture.ECHO, null));
      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.UnknownMethod, "The method notes.echo is not registered.", "tester:4");
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public endsRequestsAtTheirDeadline(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(64 * 1024, 1_000, 100, 200), async fixture => {
      fixture.methods.register(RuntimeServerFixture.WAIT, RuntimeServerFixture.createWaitHandler([]));
      const connection = await fixture.authenticateAsync();

      connection.sendMessages(
        new Request("tester:1", RuntimeServerFixture.WAIT, null, 20),
        new Request("tester:2", RuntimeServerFixture.WAIT, null),
        new Request("tester:3", RuntimeServerFixture.WAIT, null, 60_000));

      for (const id of ["tester:1", "tester:2", "tester:3"])
        RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.DeadlineExceeded, "The request did not finish within its time limit.", id);
    });
  }

  @TestMethod
  public describesHandlerFailures(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.NotFound, "The note does not exist.", { path: "notes.md" });
      const failures: Record<string, () => never> = {
        method: () => { throw new MethodFailureException(failure); },
        protocol: () => { throw new ProtocolException(1024); },
        json: () => { throw new JsonException("The path must be a string.", "$.path"); },
        other: () => { throw new Error("secret detail"); },
        text: () => { throw "a bare reason"; },
        stackless: () => { throw Object.assign(new Error("no stack"), { stack: undefined }); },
        nullPrototype: () => { throw Object.create(null); },
        throwingText: () => { throw { toString: (): string => { throw new Error("no text"); } }; },
        unreadable: () => { throw { [inspect.custom]: (): string => { throw new Error("no inspection"); } }; }
      };
      for (const [member, raise] of Object.entries(failures))
        fixture.methods.register(new QualifiedName("fail", member), { handleAsync: () => Promise.resolve().then(raise) });
      fixture.methods.register(new QualifiedName("fail", "sync"), { handleAsync: (): Promise<JsonValue> => { throw new Error("thrown synchronously"); } });
      const connection = await fixture.authenticateAsync();

      const unexpected = ["other", "sync", "text", "stackless", "nullPrototype", "throwingText", "unreadable"];
      connection.sendMessages(...["method", "protocol", "json", ...unexpected].map(t => new Request(t, new QualifiedName("fail", t), null)));
      const responses = new Map<string | null, Response>();
      for (let index = 0; index < 3 + unexpected.length; index++) {
        const response = await connection.readResponseAsync();
        responses.set(response.id, response);
      }

      Assert.areEqual(JSON.stringify(Response.failure("method", failure).toJson()), JSON.stringify(responses.get("method")?.toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("protocol", new Failure(FailureCode.FrameTooLarge, "A frame exceeds the maximum length of 1024 characters.")).toJson()), JSON.stringify(responses.get("protocol")?.toJson()));
      Assert.areEqual(FailureCode.InvalidParams, responses.get("json")?.failure?.code);
      for (const id of unexpected)
        Assert.areEqual(JSON.stringify(Response.failure(id, new Failure(FailureCode.Internal, "The runtime failed to handle the request.")).toJson()), JSON.stringify(responses.get(id)?.toJson()));
      const entries = fixture.diagnostics.text.split("The runtime failed to handle a ").slice(1).sort();
      Assert.areEqual(unexpected.length, entries.length, fixture.diagnostics.text);
      Assert.areEqual("fail.nullPrototype request: [Object: null prototype] {}\n", entries[0]);
      Assert.isTrue(/^fail[.]other request: Error: secret detail\n {4}at /u.test(entries[1] ?? String.empty), entries[1]);
      Assert.isTrue(/^fail[.]stackless request: .*no stack.*\n$/su.test(entries[2] ?? String.empty), entries[2]);
      Assert.isTrue(/^fail[.]sync request: Error: thrown synchronously\n {4}at /u.test(entries[3] ?? String.empty), entries[3]);
      Assert.areEqual("fail.text request: 'a bare reason'\n", entries[4]);
      Assert.areEqual("fail.throwingText request: { toString: [Function: toString] }\n", entries[5]);
      Assert.areEqual("fail.unreadable request: an error the runtime cannot describe\n", entries[6]);
    });
  }

  @TestMethod
  public letsAnotherBuildOnlyAskItToStop(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(ShellMethods.stop, RuntimeServerFixture.ECHO_HANDLER);

      const [connection, answer] = await fixture.handshakeAsync("older", RuntimeServerFixture.OTHER_IDENTITY);
      connection.sendMessages(new Request("older:1", RuntimeServerFixture.ECHO, null), new Request("older:2", ShellMethods.stop, { policy: "IfIdle" }));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "not for other builds"));

      Assert.areEqual(
        `{"kind":"Response","id":"older:0","failure":{"code":"BuildMismatch","message":"Another build of Noldova Desktop Sample owns this data directory.",`
        + `"details":{"identity":{"productVersion":"1.2.3","protocolVersion":1,"fingerprint":"server-build"},"executablePath":"/opt/noldova-desktop/noldova-desktop"}}}`,
        answer.toText());
      RuntimeServerFixture.assertFailure(
        await connection.readResponseAsync(),
        FailureCode.BuildMismatch,
        "A connection from another build may only ask the runtime to stop.",
        "older:1");
      Assert.areEqual("{\"client\":\"older\",\"payload\":{\"policy\":\"IfIdle\"}}", JSON.stringify((await connection.readResponseAsync()).payload));
      connection.sendMessages(new Request("older:3", ShellMethods.stop, { policy: "IfIdle" }));
      Assert.areEqual("older:3", (await connection.readResponseAsync()).id);
      Assert.areEqual(0, connection.frameCount);
    });
  }

  @TestMethod
  public answersALaterProtocolVersionWithTheHandover(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const later = new BuildIdentity("2.0.0", BuildIdentity.supportedProtocolVersion + 1, "later-build");

      const [connection, answer] = await fixture.handshakeAsync("later", later);

      Assert.areEqual(FailureCode.BuildMismatch, answer.failure?.code);
      Assert.areEqual(JSON.stringify(new RuntimeHandover(RuntimeServerFixture.IDENTITY, RuntimeServerFixture.EXECUTABLE).toJson()), JSON.stringify(answer.failure?.details));
      Assert.isFalse(connection.isClosed);
    });
  }

  @TestMethod
  public servesOnlyTheRefusalsMethodUntilItAdmits(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", { location: "/data" });
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerTests.MOVE, RuntimeServerFixture.ECHO_HANDLER);
      fixture.server.refuse(new Refusal(failure, RuntimeServerTests.MOVE));

      const [refused, answer] = await fixture.handshakeAsync("main");
      refused.sendMessages(new Request("main:1", RuntimeServerFixture.ECHO, null), new Request("main:2", RuntimeServerTests.MOVE, null));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "not for refused connections"));

      Assert.areEqual(JSON.stringify(Response.failure("main:0", failure).toJson()), JSON.stringify(answer.toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("main:1", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual("main:2", (await refused.readResponseAsync()).id);
      fixture.server.admit();
      await refused.waitForCloseAsync();
      await Assert.throwsAsync(() => refused.readTextAsync(), Error);
      const admitted = await fixture.authenticateAsync("main");
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "for everyone"));
      Assert.areEqual("\"for everyone\"", JSON.stringify((await admitted.readEventAsync()).payload));
    });
  }

  @TestMethod
  public servesStopButNoOtherMethodToARefusedConnection(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", { location: "/data" });
      fixture.methods.register(ShellMethods.stop, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(ShellMethods.settings, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.server.refuse(new Refusal(failure, RuntimeServerTests.MOVE));

      const [refused] = await fixture.handshakeAsync("main");
      refused.sendMessages(
        new Request("main:1", ShellMethods.settings, null),
        new Request("main:2", RuntimeServerFixture.ECHO, null),
        new Request("main:3", ShellMethods.stop, { policy: "StopWork" }));

      Assert.areEqual(JSON.stringify(Response.failure("main:1", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual(JSON.stringify(Response.failure("main:2", failure).toJson()), JSON.stringify((await refused.readResponseAsync()).toJson()));
      Assert.areEqual("{\"client\":\"main\",\"payload\":{\"policy\":\"StopWork\"}}", JSON.stringify((await refused.readResponseAsync()).payload));
    });
  }

  @TestMethod
  public listensOnALocalSocketAndRemovesItWhenClosed(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\desktop-test-${path.basename(folder)}` : path.join(folder, "runtime.sock");
      if (process.platform !== "win32")
        await writeFile(socketPath, "stale");
      const fixture = new RuntimeServerFixture();
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);

      fixture.endpoint = await fixture.server.listenSocketAsync(socketPath);
      const connection = await fixture.authenticateAsync();
      connection.sendMessages(new Request("tester:1", RuntimeServerFixture.ECHO, 7));

      Assert.areEqual(socketPath, fixture.endpoint.path);
      Assert.areEqual("{\"client\":\"tester\",\"payload\":7}", JSON.stringify((await connection.readResponseAsync()).payload));
      await fixture[Symbol.asyncDispose]();
      Assert.isFalse(existsSync(socketPath));
    });
  }

  @TestMethod
  public rejectsASocketPathTooLongForTheSystem(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const socketPath = path.join(folder, "x".repeat(104));
      const fixture = new RuntimeServerFixture();

      const exception = await Assert.throwsAsync(() => fixture.server.listenSocketAsync(socketPath), ArgumentException);

      Assert.areEqual(103, RuntimeServer.maximumSocketPathLength);
      Assert.areEqual(`The local socket path "${socketPath}" exceeds 103 bytes; use a data directory with a shorter path. (Parameter 'path')`, exception.message);
      await fixture.server.closeAsync();
    });
  }

  @TestMethod
  public rejectsAnEndpointItCannotListenOn(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      const fixture = new RuntimeServerFixture();

      await Assert.throwsAsync(() => fixture.server.listenSocketAsync(path.join(folder, "missing", "r.sock")), Error);
    });
  }

  @TestMethod
  public failsToListenWhenClosedWhileStarting(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const listening = fixture.server.listenTcpAsync();
      const closed = new Promise<void>(resolve => process.nextTick(() => process.nextTick(() => void fixture.server.closeAsync().then(resolve))));

      const exception = await Assert.throwsAsync(() => listening, EndpointUnavailableException);
      await closed;

      Assert.areEqual("The runtime's local endpoint has no address.", exception.message);
    }, false);
  }

  @TestMethod
  public closesConnectionsThatDoNotEndWithinTheGrace(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const connection = await fixture.connectAsync(true);
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 1);

      const closing = fixture.server.closeAsync();
      await connection.waitForEndAsync();
      const closedAtEnd = connection.isClosed;
      await closing;
      await fixture.server.closeAsync();

      Assert.isFalse(closedAtEnd, "the server ends the connection and leaves it open for the grace");
      await fixture.waitUntilAsync(() => fixture.server.sessionCount === 0);
    });
  }

  @TestMethod
  public checksOnlyAClientOfItsOwnBuildNamedTheMainProcess(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const [, answer] = await fixture.handshakeAsync(ShellClients.mainProcess);
      await fixture.authenticateAsync("cli");
      const [, other] = await fixture.handshakeAsync(ShellClients.mainProcess, RuntimeServerFixture.OTHER_IDENTITY);
      const [, guessed] = await fixture.handshakeAsync(ShellClients.mainProcess, RuntimeServerFixture.IDENTITY, "guess");

      Assert.areEqual(JSON.stringify(RuntimeServerFixture.IDENTITY.toJson()), JSON.stringify(answer.payload));
      Assert.areEqual(FailureCode.BuildMismatch, other.failure?.code);
      Assert.areEqual(FailureCode.Unauthorized, guessed.failure?.code);
      Assert.areEqual(1, fixture.checkedSockets.length);
      Assert.areEqual("main,cli", fixture.server.clients.map(t => t.client).join());
      Assert.areEqual(String.empty, fixture.diagnostics.text);
    });
  }

  @TestMethod
  public refusesAClientNamedTheMainProcessThatTheCheckRefusesWithTheHandoverAndLetsItOnlyAskToStop(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      fixture.methods.register(ShellMethods.stop, RuntimeServerFixture.ECHO_HANDLER);
      fixture.checkMainProcessAsync = () => Promise.resolve(false);

      const [connection, answer] = await fixture.handshakeAsync(ShellClients.mainProcess);
      connection.sendMessages(new Request("main:1", RuntimeServerFixture.ECHO, null), new Request("main:2", ShellMethods.stop, { policy: "IfIdle" }));
      fixture.server.broadcast(new Event(RuntimeServerFixture.ECHO, "not for refused main processes"));

      Assert.areEqual(
        `{"kind":"Response","id":"main:0","failure":{"code":"Unauthorized","message":"Only the app's main process may connect as the main process.",`
        + `"details":{"identity":{"productVersion":"1.2.3","protocolVersion":1,"fingerprint":"server-build"},"executablePath":"/opt/noldova-desktop/noldova-desktop"}}}`,
        answer.toText());
      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.Unauthorized, "Only the app's main process may connect as the main process.", "main:1");
      Assert.areEqual("{\"client\":\"main\",\"payload\":{\"policy\":\"IfIdle\"}}", JSON.stringify((await connection.readResponseAsync()).payload));
      Assert.areEqual(0, connection.frameCount);
      Assert.isFalse(connection.isClosed);
      Assert.areEqual("Connection 1 named itself the main process, but its process is not the app's main process, so it was refused.\n", fixture.diagnostics.text);
      Assert.areEqual(0, fixture.server.clients.length);
    });
  }

  @TestMethod
  public refusesAClientNamedTheMainProcessWithTheHandoverWhenTheCheckFails(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.checkMainProcessAsync = () => Promise.reject(new Error("The peer is gone."));

      const [connection, answer] = await fixture.handshakeAsync(ShellClients.mainProcess);

      RuntimeServerFixture.assertFailure(answer, FailureCode.Unauthorized, "Only the app's main process may connect as the main process.", "main:0");
      Assert.areEqual(JSON.stringify(new RuntimeHandover(RuntimeServerFixture.IDENTITY, RuntimeServerFixture.EXECUTABLE).toJson()), JSON.stringify(answer.failure?.details));
      Assert.isFalse(connection.isClosed);
      Assert.areEqual("Connection 1 named itself the main process, and checking its process failed, so it was refused: Error: The peer is gone.\n", fixture.diagnostics.text);
      Assert.areEqual(0, fixture.server.clients.length);
    });
  }

  @TestMethod
  public endsACheckedMainProcessOnceAnotherProcessSendsOnItsConnection(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const connection = await fixture.authenticateAsync(ShellClients.mainProcess);
      const other = await fixture.authenticateAsync("cli");
      connection.sendMessages(new Request("main:1", RuntimeServerFixture.ECHO, "own"));
      Assert.areEqual("{\"client\":\"main\",\"payload\":\"own\"}", JSON.stringify((await connection.readResponseAsync()).payload));

      fixture.isSameSender = () => false;
      connection.sendMessages(new Request("main:2", RuntimeServerFixture.ECHO, "shared"));
      other.sendMessages(new Request("cli:1", RuntimeServerFixture.ECHO, "unchecked"));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.Unauthorized, "Only the app's main process may connect as the main process.", null);
      await connection.waitForCloseAsync();
      Assert.areEqual(0, connection.frameCount);
      Assert.areEqual("{\"client\":\"cli\",\"payload\":\"unchecked\"}", JSON.stringify((await other.readResponseAsync()).payload));
      Assert.areEqual("Connection 1 was checked as the main process, but another process sent on it since, so it was ended.\n", fixture.diagnostics.text);
      await fixture.waitUntilAsync(() => fixture.server.clients.length === 1);
      Assert.areEqual("cli", fixture.server.clients.map(t => t.client).join());
    });
  }

  @TestMethod
  public endsAConnectionThatSendsARequestBeforeItsHandshakeIsAnswered(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.methods.register(RuntimeServerFixture.ECHO, RuntimeServerFixture.ECHO_HANDLER);
      const check = Promise.withResolvers<boolean>();
      fixture.checkMainProcessAsync = () => check.promise;
      const connection = await fixture.connectAsync();

      connection.sendMessages(
        new Handshake("main:0", RuntimeServerFixture.IDENTITY, RuntimeServerFixture.TOKEN, ShellClients.mainProcess),
        new Request("main:1", RuntimeServerFixture.ECHO, null));

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The handshake has not been answered yet.", null);
      await connection.waitForCloseAsync();
      check.resolve(true);
      await new Promise<void>(resolve => setImmediate(resolve));
      Assert.areEqual(0, connection.frameCount);
      Assert.areEqual(0, fixture.server.clients.length);
    });
  }

  @TestMethod
  public endsAConnectionThatSendsAnInvalidFrameBeforeItsHandshakeIsAnswered(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      fixture.checkMainProcessAsync = () => Promise.withResolvers<boolean>().promise;
      const connection = await fixture.connectAsync();

      connection.sendMessages(new Handshake("main:0", RuntimeServerFixture.IDENTITY, RuntimeServerFixture.TOKEN, ShellClients.mainProcess));
      connection.send("not json\n");

      RuntimeServerFixture.assertFailure(await connection.readResponseAsync(), FailureCode.InvalidMessage, "The frame is not a valid message.", null);
      await connection.waitForCloseAsync();
    });
  }

  @TestMethod
  public closesAConnectionWhoseCheckOutlastsTheHandshakeTime(): Promise<void> {
    return RuntimeServerFixture.runAsync(new ServerSettings(64 * 1024, 100, 1_000, 1_000), async fixture => {
      fixture.checkMainProcessAsync = () => Promise.withResolvers<boolean>().promise;
      const connection = await fixture.connectAsync();

      connection.sendMessages(new Handshake("main:0", RuntimeServerFixture.IDENTITY, RuntimeServerFixture.TOKEN, ShellClients.mainProcess));

      await connection.waitForCloseAsync();
      Assert.areEqual(0, connection.frameCount);
    });
  }

  @TestMethod
  public checksTheProcessOfTheMainProcessUnlessGivenACheck(): Promise<void> {
    return RuntimeServerTests.runInFolderAsync(async folder => {
      await using fixture = new RuntimeServerFixture(undefined, true);
      fixture.endpoint = process.platform === "win32" ? await fixture.server.listenTcpAsync() : await fixture.server.listenSocketAsync(path.join(folder, "runtime.sock"));

      const [, answer] = await fixture.handshakeAsync(ShellClients.mainProcess);

      Assert.isFalse(answer.hasFailed, answer.toText());
      Assert.areEqual(0, fixture.checkedSockets.length);
    });
  }

  @TestMethod
  public refusesACheckedMainProcessWhileTheServerRefuses(): Promise<void> {
    return RuntimeServerFixture.runAsync(undefined, async fixture => {
      const failure = new Failure(FailureCode.PreShellData, "Move the old data aside.", { location: "/data" });
      fixture.server.refuse(new Refusal(failure, RuntimeServerTests.MOVE));

      const [, answer] = await fixture.handshakeAsync(ShellClients.mainProcess);

      Assert.areEqual(JSON.stringify(Response.failure("main:0", failure).toJson()), JSON.stringify(answer.toJson()));
      Assert.areEqual(1, fixture.checkedSockets.length);
    });
  }

  private static loop(): JsonValue[] {
    const loop: JsonValue[] = [];
    loop.push(loop);
    return loop;
  }

  private static async runInFolderAsync(test: (folder: string) => Promise<void>): Promise<void> {
    await using folder = await SocketFolderFixture.createAsync("nol-srv-");
    await test(folder.path);
  }
}

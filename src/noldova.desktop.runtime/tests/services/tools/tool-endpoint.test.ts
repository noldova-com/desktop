/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Agent, type IncomingHttpHeaders, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse, request } from "node:http";
import { type Socket, connect } from "node:net";
import { networkInterfaces } from "node:os";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  EventRegistry,
  type IToolEndpointHandler,
  MethodRegistry,
  type ModuleContext,
  ServiceRegistry,
  ToolEndpointException,
  ToolRegistry,
  type ToolSession
} from "@noldova/desktop.runtime";
import { ShellEvents, WebViewBlockedPorts } from "@noldova/desktop.protocol";

import { ToolEndpoint } from "../../../src/services/tools/tool-endpoint.js";
import { ToolRegistry as SourceToolRegistry } from "../../../src/services/tools/tool-registry.js";
import { WebViewCenter } from "../../../src/services/web-views/web-view-center.js";
import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { ModuleContextFixture } from "../../fixtures/module-context.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class ToolEndpointTests {
  private static readonly LOOPBACK: string = "127.0.0.1";

  @TestMethod
  public async answersAnOpenSessionsRequestThroughTheHandlerWithItsSession(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const seen: ToolSession[] = [];
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer(seen));
    const session = context.tools.openSession("conversation-1", {});

    const [status, body] = await ToolEndpointTests.requestAsync(endpoint.url, { authorization: `Bearer ${endpoint.admit(session)}` });

    Assert.areEqual(200, status);
    Assert.areEqual("answered", body);
    Assert.areEqual(session.id, seen.map(t => t.id).join(","));
    Assert.isTrue(/^http:\/\/127\.0\.0\.1:[1-9][0-9]*\/$/.test(endpoint.url), endpoint.url);
  }

  @TestMethod
  public async listensOnTheIpv4LoopbackAloneAtAPortPickedAtEachOpen(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const first = await context.tools.openEndpointAsync(ToolEndpointTests.answer([]));
    const second = await context.tools.openEndpointAsync(ToolEndpointTests.answer([]));
    const port = Number(new URL(first.url).port);
    const others = Object.values(networkInterfaces()).flatMap(t => t ?? []).filter(t => t.family === "IPv4" && !t.internal).map(t => t.address);

    const reached = await Promise.all([ToolEndpointTests.LOOPBACK, "::1", ...others].map(t => ToolEndpointTests.connectAsync(t, port)));

    Assert.areNotEqual(first.url, second.url);
    Assert.areEqual([true, false, ...others.map(() => false)].join(","), reached.join(","));
  }

  @TestMethod
  public async refusesARequestNotAddressedToItsOwnAddressWithoutCallingTheHandler(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const seen: ToolSession[] = [];
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer(seen));
    const authorization = `Bearer ${endpoint.admit(context.tools.openSession("conversation-1", {}))}`;
    const port = Number(new URL(endpoint.url).port);

    const answers = await Promise.all([`localhost:${port}`, `127.0.0.1:${port + 1}`, ToolEndpointTests.LOOPBACK, `127.0.0.1:${port}.evil.example`]
      .map(t => ToolEndpointTests.requestAsync(endpoint.url, { authorization, host: t })));
    const [missing] = await ToolEndpointTests.requestAsync(endpoint.url, { authorization }, false);

    Assert.areEqual("421,421,421,421", answers.map(([t]) => t).join(","));
    Assert.areEqual(String.empty, answers.map(([, t]) => t).join(String.empty));
    Assert.areEqual(400, missing);
    Assert.areEqual(0, seen.length);
  }

  @TestMethod
  public async refusesARequestThatCarriesAnOriginEvenWithAValidToken(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const seen: ToolSession[] = [];
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer(seen));
    const authorization = `Bearer ${endpoint.admit(context.tools.openSession("conversation-1", {}))}`;

    const answers = await Promise.all([endpoint.url.slice(0, -1), "null", String.empty]
      .map(t => ToolEndpointTests.requestAsync(endpoint.url, { authorization, origin: t })));

    Assert.areEqual("403,403,403", answers.map(([t]) => t).join(","));
    Assert.areEqual(String.empty, answers.map(([, t]) => t).join(String.empty));
    Assert.areEqual(0, seen.length);
  }

  @TestMethod
  public async refusesARequestWithoutTheTokenOfAnOpenSessionAndNamesTheBearerScheme(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const seen: ToolSession[] = [];
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer(seen));
    const replaced = context.tools.openSession("conversation-1", {});
    const earlier = endpoint.admit(replaced);
    const current = endpoint.admit(replaced);
    const ended = context.tools.openSession("conversation-2", {});
    const endedToken = endpoint.admit(ended);
    ended.end();

    const answers = await Promise.all([undefined, `Basic ${current}`, `bearer ${current}`, "Bearer ", `Bearer ${current}x`, `Bearer ${earlier}`, `Bearer ${endedToken}`]
      .map(t => ToolEndpointTests.requestAsync(endpoint.url, Object.isUndefined(t) ? {} : { authorization: t })));
    const [currentStatus] = await ToolEndpointTests.requestAsync(endpoint.url, { authorization: `Bearer ${current}` });

    Assert.areEqual("401,401,401,401,401,401,401", answers.map(([t]) => t).join(","));
    Assert.areEqual("Bearer,Bearer,Bearer,Bearer,Bearer,Bearer,Bearer", answers.map(([, , t]) => t["www-authenticate"]).join(","));
    Assert.areEqual(String.empty, answers.map(([, t]) => t).join(String.empty));
    Assert.areEqual(200, currentStatus);
    Assert.areEqual(replaced.id, seen.map(t => t.id).join(","));
  }

  @TestMethod
  public async admitsOnlyAnOpenSessionThatItsOwnPartOpened(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const tools = new ToolRegistry();
    using context = ToolEndpointTests.create(settings, tools);
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer([]));
    const foreign = tools.openSession("conversation-1", {});
    const ended = context.tools.openSession("conversation-2", {});
    ended.end();

    const foreignFailure = Assert.throws(() => endpoint.admit(foreign), ArgumentException);
    const endedFailure = Assert.throws(() => endpoint.admit(ended), ArgumentException);

    Assert.isTrue(foreignFailure.message.startsWith("Only an open agent session that the same part opened gets a token."), foreignFailure.message);
    Assert.areEqual(foreignFailure.message, endedFailure.message);
    Assert.areEqual("session", foreignFailure.parameterName);
    Assert.areEqual("session", endedFailure.parameterName);
  }

  @TestMethod
  public async refusesToAdmitAndStopsListeningOnceDisposed(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer([]));
    const session = context.tools.openSession("conversation-1", {});

    endpoint[Symbol.dispose]();
    const failure = Assert.throws(() => endpoint.admit(session), ToolEndpointException);
    const isReached = await ToolEndpointTests.connectAsync(ToolEndpointTests.LOOPBACK, Number(new URL(endpoint.url).port));

    Assert.areEqual("The tool endpoint is closed.", failure.message);
    Assert.isFalse(isReached);
  }

  @TestMethod
  public async closesWithItsPartsDeactivationAndDropsAKeptConnection(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ToolEndpointTests.create(settings);
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer([]));
    const authorization = `Bearer ${endpoint.admit(context.tools.openSession("conversation-1", {}))}`;
    const agent = new Agent({ keepAlive: true });
    let isDropped = false;

    try {
      const [status, , , socket] = await ToolEndpointTests.requestAsync(endpoint.url, { authorization }, true, agent);
      socket.once("close", () => isDropped = true);
      context[Symbol.dispose]();
      const isClosed = await WaitFixture.untilAsync(() => isDropped, 5_000);
      const isReached = await ToolEndpointTests.connectAsync(ToolEndpointTests.LOOPBACK, Number(new URL(endpoint.url).port));

      Assert.areEqual(200, status);
      Assert.isTrue(isClosed);
      Assert.isFalse(isReached);
    }
    finally {
      agent.destroy();
    }
  }

  @TestMethod
  public async failsToOpenWhenItsPartDeactivatesWhileItOpens(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const context = ToolEndpointTests.create(settings);

    const opening = context.tools.openEndpointAsync(ToolEndpointTests.answer([]));
    context[Symbol.dispose]();
    const failure = await Assert.throwsAsync(() => opening, ToolEndpointException);

    Assert.areEqual("The tool endpoint is closed.", failure.message);
  }

  @TestMethod
  public async givesItsAddressOnlyOnceTheMainProcessAcknowledgesItsPortAndUnblocksThePortOnlyOnceItHasClosed(): Promise<void> {
    const [center, sink] = ToolEndpointTests.createCenter();
    const opening = ToolEndpoint.openAsync(ToolEndpointTests.answer([]), () => false, { write: () => undefined }, new AbortController().signal, () => undefined, center);
    await WaitFixture.untilAsync(() => sink.sent.length === 1, 10_000);
    const blocked = WebViewBlockedPorts.fromJson(sink.sent[0]?.[0].payload);

    const isPendingBeforeTheAcknowledgement = await WaitFixture.isPendingAsync(opening);
    center.answerPorts(7, blocked);
    const endpoint = await opening;
    endpoint[Symbol.dispose]();
    const listsRightAfterClosing = sink.sent.length;
    await WaitFixture.untilAsync(() => sink.sent.length === 2, 10_000);
    const acceptsOnceUnblocked = await ToolEndpointTests.connectAsync(ToolEndpointTests.LOOPBACK, Number(new URL(endpoint.url).port));

    Assert.isTrue(isPendingBeforeTheAcknowledgement);
    Assert.areEqual(`http://127.0.0.1:${blocked.ports.join(",")}/`, endpoint.url);
    Assert.areEqual(1, listsRightAfterClosing);
    Assert.areEqual("[]", JSON.stringify(WebViewBlockedPorts.fromJson(sink.sent[1]?.[0].payload).ports));
    Assert.isFalse(acceptsOnceUnblocked);
  }

  @TestMethod
  public async failsToOpenAndUnblocksItsPortOnceClosedWhenItsPartStopsBeforeTheMainProcessAcknowledges(): Promise<void> {
    const [center, sink] = ToolEndpointTests.createCenter();
    const stopping = new AbortController();
    const opening = ToolEndpoint.openAsync(ToolEndpointTests.answer([]), () => false, { write: () => undefined }, stopping.signal, () => undefined, center);
    await WaitFixture.untilAsync(() => sink.sent.length === 1, 10_000);
    const port = WebViewBlockedPorts.fromJson(sink.sent[0]?.[0].payload).ports.join(",");

    stopping.abort();
    const failure = await Assert.throwsAsync(() => opening, ToolEndpointException);
    await WaitFixture.untilAsync(() => sink.sent.length === 2, 10_000);
    const acceptsOnceUnblocked = await ToolEndpointTests.connectAsync(ToolEndpointTests.LOOPBACK, Number(port));

    Assert.areEqual("The tool endpoint is closed.", failure.message);
    Assert.areEqual("[]", JSON.stringify(WebViewBlockedPorts.fromJson(sink.sent[1]?.[0].payload).ports));
    Assert.isFalse(acceptsOnceUnblocked);
  }

  @TestMethod
  public async answersAHandlerFailureWith500AndLogsItWithoutTheToken(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    using context = ToolEndpointTests.create(settings, new ToolRegistry(), diagnostics);
    const endpoint = await context.tools.openEndpointAsync({ handleAsync: () => Promise.reject(new Error("The agent's message is malformed.")) });
    const token = endpoint.admit(context.tools.openSession("conversation-1", {}));

    const [status, body] = await ToolEndpointTests.requestAsync(endpoint.url, { authorization: `Bearer ${token}` });
    const isLogged = await WaitFixture.untilAsync(() => diagnostics.text.includes("The agent's message is malformed."), 5_000);

    Assert.areEqual(500, status);
    Assert.areEqual(String.empty, body);
    Assert.isTrue(isLogged);
    Assert.isTrue(diagnostics.text.includes("The tool endpoint's handler failed: Error: The agent's message is malformed."), diagnostics.text);
    Assert.isFalse(diagnostics.text.includes(token));
  }

  @TestMethod
  public async logsOnlyAHandlerFailuresNameMessageAndStackSoATokenItCarriesStaysOut(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    using context = ToolEndpointTests.create(settings, new ToolRegistry(), diagnostics);
    const failures: ((request: IncomingMessage) => unknown)[] = [
      t => Object.assign(new Error("The agent's message is malformed."), { request: t }),
      t => {
        const failure = Object.assign(new TypeError("The agent's call is malformed."), { headers: t.headers });
        delete failure.stack;
        return failure;
      },
      t => ({ headers: t.headers, rawHeaders: t.rawHeaders })
    ];
    const endpoint = await context.tools.openEndpointAsync({ handleAsync: (request: IncomingMessage): Promise<void> => Promise.reject(failures.shift()?.(request)) });
    const token = endpoint.admit(context.tools.openSession("conversation-1", {}));

    const answers = await Promise.all(failures.map(() => ToolEndpointTests.requestAsync(endpoint.url, { authorization: `Bearer ${token}` })));

    Assert.areEqual("500,500,500", answers.map(([t]) => t).join(","));
    Assert.isTrue(diagnostics.text.includes("The tool endpoint's handler failed: Error: The agent's message is malformed.\nnotes:     at "), diagnostics.text);
    Assert.isTrue(diagnostics.text.includes("The tool endpoint's handler failed: TypeError: The agent's call is malformed."), diagnostics.text);
    Assert.isTrue(diagnostics.text.includes("The tool endpoint's handler failed: a value of type object, not an error"), diagnostics.text);
    Assert.isFalse(diagnostics.text.includes(token));
  }

  @TestMethod
  public async answersHeadersOverItsCapOf16KiBWith431WithoutCallingTheHandler(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    using context = ToolEndpointTests.create(settings);
    const seen: ToolSession[] = [];
    const endpoint = await context.tools.openEndpointAsync(ToolEndpointTests.answer(seen));
    const port = Number(new URL(endpoint.url).port);
    const send = (padding: number): Promise<string> =>
      ToolEndpointTests.sendAsync(port, `GET / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\nX-Padding: ${"a".repeat(padding)}\r\n\r\n`);

    const [under, over] = await Promise.all([send(15 * 1024), send(16 * 1024)]);

    Assert.isTrue(under.startsWith("HTTP/1.1 401 "), under);
    Assert.isTrue(over.startsWith("HTTP/1.1 431 "), over);
    Assert.areEqual(0, seen.length);
  }

  @TestMethod
  public async cutsOffAClientThatSendsItsHeadersOrItsWholeRequestTooSlowlyWith408(): Promise<void> {
    const session = new SourceToolRegistry().openSession("conversation-1", {});
    let calls = 0;
    using endpoint = await ToolEndpoint.openAsync({
      handleAsync: (request: IncomingMessage): Promise<void> => {
        calls++;
        request.resume();
        return Promise.resolve();
      }
    }, t => t === session, { write: () => undefined }, new AbortController().signal, () => undefined, new WebViewCenter(new TextOutputFixture()),
    { headersTimeout: 100, requestTimeout: 200, connectionsCheckingInterval: 20, maxHeaderSize: 16 * 1024, maxConnections: 64 });
    const port = Number(new URL(endpoint.url).port);
    const head = `POST / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nAuthorization: Bearer ${endpoint.admit(session)}\r\nContent-Length: 10\r\n`;

    const [headers, request] = await Promise.all([ToolEndpointTests.sendAsync(port, head), ToolEndpointTests.sendAsync(port, `${head}\r\n{`)]);

    Assert.isTrue(headers.startsWith("HTTP/1.1 408 "), headers);
    Assert.isTrue(request.startsWith("HTTP/1.1 408 "), request);
    Assert.areEqual(1, calls);
  }

  @TestMethod
  public async dropsAConnectionOverItsCapWithoutCallingTheHandler(): Promise<void> {
    const session = new SourceToolRegistry().openSession("conversation-1", {});
    let calls = 0;
    using endpoint = await ToolEndpoint.openAsync({
      handleAsync: (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        calls++;
        request.resume();
        response.end();
        return Promise.resolve();
      }
    }, t => t === session, { write: () => undefined }, new AbortController().signal, () => undefined, new WebViewCenter(new TextOutputFixture()),
    { headersTimeout: 10_000, requestTimeout: 30_000, connectionsCheckingInterval: 1_000, maxHeaderSize: 16 * 1024, maxConnections: 1 });
    const port = Number(new URL(endpoint.url).port);
    const held = connect({ host: ToolEndpointTests.LOOPBACK, port });
    await new Promise(t => held.once("connect", t));
    held.write("POST / HTTP/1.1\r\n");

    const answer = await ToolEndpointTests.sendAsync(port, `POST / HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nAuthorization: Bearer ${endpoint.admit(session)}\r\nContent-Length: 0\r\n\r\n`);
    held.destroy();

    Assert.areEqual(String.empty, answer);
    Assert.areEqual(0, calls);
  }

  @TestMethod
  public opensWithHeadersCappedAt16KiBInTenSecondsAndTheRequestInThirtyCheckedEachSecondAndAtMost64Connections(): void {
    Assert.areEqual(
      JSON.stringify({ headersTimeout: 10_000, requestTimeout: 30_000, connectionsCheckingInterval: 1_000, maxHeaderSize: 16 * 1024, maxConnections: 64 }),
      JSON.stringify(ToolEndpoint.options));
  }

  @TestMethod
  public async closesTheConnectionWhenTheHandlerFailsAfterItsAnswerStarted(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    using context = ToolEndpointTests.create(settings, new ToolRegistry(), diagnostics);
    const endpoint = await context.tools.openEndpointAsync({
      handleAsync: (_request: IncomingMessage, response: ServerResponse): Promise<void> => {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write("data: started\n\n");
        return Promise.reject(new Error("The stream broke."));
      }
    });
    const token = endpoint.admit(context.tools.openSession("conversation-1", {}));

    const failure = await Assert.throwsAsync(() => ToolEndpointTests.requestAsync(endpoint.url, { authorization: `Bearer ${token}` }), Error);

    Assert.isTrue(diagnostics.text.includes("The tool endpoint's handler failed: Error: The stream broke."), diagnostics.text);
    Assert.isFalse(diagnostics.text.includes(token));
    Assert.isTrue(failure.message.length > 0);
  }

  private static create(settings: SettingsFixture, tools: ToolRegistry = new ToolRegistry(), diagnostics: TextOutputFixture = new TextOutputFixture()): ModuleContext {
    return ModuleContextFixture.create(
      settings, new MethodRegistry(), new EventRegistry(new EventSinkFixture()), new ServiceRegistry(), undefined, undefined, undefined, diagnostics, undefined, tools);
  }

  private static createCenter(): [WebViewCenter, EventSinkFixture] {
    const sink = new EventSinkFixture();
    const events = new EventRegistry(sink);
    const center = new WebViewCenter(new TextOutputFixture(), events.declare(ShellEvents.webViewCommand), events.declare(ShellEvents.webViewBlockedPorts));
    center.check(7);
    return [center, sink];
  }

  private static answer(seen: ToolSession[]): IToolEndpointHandler {
    return {
      handleAsync: (request: IncomingMessage, response: ServerResponse, session: ToolSession): Promise<void> => {
        seen.push(session);
        request.resume();
        response.end("answered");
        return Promise.resolve();
      }
    };
  }

  private static requestAsync(url: string, headers: OutgoingHttpHeaders, setHost: boolean = true, agent: Agent | false = false):
    Promise<readonly [number, string, IncomingHttpHeaders, Socket]> {
    return new Promise((resolve, reject) => {
      const sent = request(url, { method: "POST", headers, setHost, agent }, response => {
        const socket = response.socket;
        const chunks: Buffer[] = [];
        response.on("data", (t: Buffer) => chunks.push(t));
        response.on("error", reject);
        response.on("end", () => resolve([response.statusCode ?? 0, Buffer.concat(chunks).toString(), response.headers, socket]));
      });
      sent.on("error", reject);
      sent.end("{}");
    });
  }

  private static sendAsync(port: number, text: string): Promise<string> {
    return new Promise(resolve => {
      const socket = connect({ host: ToolEndpointTests.LOOPBACK, port });
      const chunks: Buffer[] = [];
      socket.on("data", (t: Buffer) => chunks.push(t));
      socket.once("error", () => undefined);
      socket.once("close", () => resolve(Buffer.concat(chunks).toString()));
      socket.write(text);
    });
  }

  private static connectAsync(host: string, port: number): Promise<boolean> {
    return new Promise(resolve => {
      const socket = connect({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
  }
}

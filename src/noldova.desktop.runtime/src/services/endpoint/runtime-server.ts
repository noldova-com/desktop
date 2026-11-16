/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import { type Server, type Socket, createServer } from "node:net";
import type { Writable } from "node:stream";
import { inspect } from "node:util";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import {
  type BuildIdentity,
  Cancel,
  type Event,
  Failure,
  FailureCode,
  FrameWriter,
  Handshake,
  ProtocolException,
  type QualifiedName,
  Request,
  Response,
  type RuntimeHandover,
  ShellClients,
  ShellMethods,
  type WireMessage
} from "@noldova/desktop.protocol";

import { SessionState } from "../../enums/session-state.js";
import { EndpointUnavailableException } from "../../exceptions/endpoint-unavailable.exception.js";
import { MethodFailureException } from "../../exceptions/method-failure.exception.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IMainProcessCheck } from "../../interfaces/i-main-process-check.js";
import type { ISessionListener } from "../../interfaces/i-session-listener.js";
import type { CapabilityToken } from "../../models/capability-token.js";
import { ClientClosure } from "../../models/client-closure.js";
import { ConnectedClient } from "../../models/connected-client.js";
import { Endpoint } from "../../models/endpoint.js";
import { ProductInfo } from "../../models/product-info.js";
import type { Refusal } from "../../models/refusal.js";
import { RequestContext } from "../../models/request-context.js";
import type { ServerSettings } from "../../models/server-settings.js";
import { Resources } from "../../resources.js";
import type { MethodRegistry } from "../registry/method-registry.js";
import { ClientClosures } from "./client-closures.js";
import { ClientSession } from "./client-session.js";
import { MainProcessCheck } from "./main-process-check.js";

export class RuntimeServer implements IEventSink {
  public static readonly maximumSocketPathLength: number = Resources.maximumSocketPathLength;
  private static readonly UPDATE_METHODS: readonly QualifiedName[] = [ShellMethods.updateSaved, ShellMethods.work, ShellMethods.stop];

  private readonly identity: BuildIdentity;
  private readonly token: CapabilityToken;
  private readonly handover: RuntimeHandover;
  private readonly methods: MethodRegistry;
  private readonly settings: ServerSettings;
  private readonly changed: () => void;
  private readonly diagnostics: Writable;
  private readonly mainProcessCheck: IMainProcessCheck;
  private readonly writer: FrameWriter;
  private readonly listener: ISessionListener;
  private readonly sessions: Set<ClientSession> = new Set();
  private readonly admitted: Set<ClientSession> = new Set();
  private readonly refusals: Map<ClientSession, Refusal> = new Map();
  private readonly verified: WeakSet<ClientSession> = new WeakSet();
  private readonly refusedMainProcesses: WeakSet<ClientSession> = new WeakSet();
  private readonly askers: WeakMap<RequestContext, ClientSession> = new WeakMap();
  private server: Server | null = null;
  private socketPath: string | null = null;
  private refusal: Refusal | null = null;
  private updating: Failure | null = null;
  private readonly saved: Set<number> = new Set();
  private nextConnection: number = 1;

  public readonly closures: ClientClosures;

  public constructor(
    identity: BuildIdentity,
    token: CapabilityToken,
    handover: RuntimeHandover,
    methods: MethodRegistry,
    settings: ServerSettings,
    changed: () => void,
    diagnostics: Writable,
    mainProcessCheck: IMainProcessCheck = MainProcessCheck.create()) {
    this.identity = identity;
    this.token = token;
    this.handover = handover;
    this.methods = methods;
    this.settings = settings;
    this.changed = changed;
    this.diagnostics = diagnostics;
    this.mainProcessCheck = mainProcessCheck;
    this.writer = new FrameWriter(settings.maximumFrameLength);
    this.closures = new ClientClosures(diagnostics);
    this.listener = {
      onMessage: (session, message) => this.handleMessage(session, message),
      onInvalidFrame: (session, error) => this.handleInvalidFrame(session, error),
      onClosed: session => this.handleClosed(session)
    };
  }

  public get sessionCount(): number {
    return this.sessions.size;
  }

  public get clients(): readonly ConnectedClient[] {
    return [...this.sessions].filter(t => t.state === SessionState.Authenticated).map(t => new ConnectedClient(t.connection, t.client));
  }

  public countOtherClients(context: RequestContext): number {
    const asker = this.askers.get(context);
    return [...this.sessions].filter(t => t !== asker && t.state === SessionState.Authenticated).length;
  }

  public async listenTcpAsync(): Promise<Endpoint> {
    const server = this.createListener();
    await RuntimeServer.listenAsync(server, () => server.listen(0, Resources.loopbackHost));
    const address = server.address();
    if (Object.isNull(address) || Object.isString(address))
      throw new EndpointUnavailableException();
    return Endpoint.tcp(address.port);
  }

  public async listenSocketAsync(socketPath: string): Promise<Endpoint> {
    const endpoint = Endpoint.socket(socketPath);
    if (Buffer.byteLength(socketPath) > RuntimeServer.maximumSocketPathLength)
      throw new ArgumentException(Resources.formatSocketPathTooLong(socketPath), Resources.pathParameterName);

    await rm(socketPath, { force: true });
    const server = this.createListener();
    await RuntimeServer.listenAsync(server, () => server.listen(socketPath));
    this.socketPath = socketPath;
    return endpoint;
  }

  public refuse(refusal: Refusal): void {
    this.refusal = refusal;
  }

  public admit(): void {
    this.refusal = null;
    for (const session of this.refusals.keys())
      session.end();
  }

  public beginUpdate(failure: Failure): void {
    this.updating = failure;
  }

  public refuseAfterSave(connection: number): void {
    this.saved.add(connection);
  }

  public endUpdate(): void {
    this.updating = null;
    this.saved.clear();
  }

  public broadcast(event: Event): void {
    const frame = this.writeEvent(event);
    if (Object.isNull(frame))
      return;
    for (const session of this.sessions)
      if (session.state === SessionState.Authenticated)
        session.write(frame);
  }

  public send(event: Event, connection: number): void {
    const session = [...this.admitted].find(t => t.connection === connection);
    if (Object.isUndefined(session) || session.state !== SessionState.Authenticated || (!Object.isUndefined(event.window) && session.hasClosedWindow(event.window)))
      return;
    const frame = this.writeEvent(event);
    if (!Object.isNull(frame))
      session.write(frame);
  }

  public closeWindow(context: RequestContext, window: number): void {
    const session = this.askers.get(context);
    if (!Object.isUndefined(session) && this.admitted.has(session) && session.closeWindow(window))
      this.closures.report(new ClientClosure(session.connection, window));
  }

  public async closeAsync(): Promise<void> {
    const server = this.server;
    if (Object.isNull(server))
      return;

    this.server = null;
    const closed = new Promise<void>(resolve => server.close(() => resolve()));
    for (const session of this.sessions)
      session.end();
    const deadline = setTimeout(() => {
      for (const session of this.sessions)
        session.close();
    }, Resources.closeGrace);
    await closed;
    clearTimeout(deadline);
    if (!Object.isNull(this.socketPath))
      await rm(this.socketPath, { force: true });
  }

  private static listenAsync(server: Server, listen: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      server.once(Resources.errorEvent, reject);
      server.once(Resources.listeningEvent, () => {
        server.off(Resources.errorEvent, reject);
        resolve();
      });
      listen();
    });
  }

  private static describeError(error: unknown): string {
    try {
      return error instanceof Error && Object.isString(error.stack) ? error.stack : inspect(error);
    }
    catch {
      return Resources.unreadableError;
    }
  }

  private answer(session: ClientSession, method: QualifiedName, response: Response): void {
    try {
      session.send(response);
    }
    catch (error) {
      session.send(Response.failure(response.id, this.describeFailure(method, error)));
    }
  }

  private describeFailure(method: QualifiedName, error: unknown): Failure {
    if (error instanceof MethodFailureException)
      return error.failure;
    if (error instanceof ProtocolException)
      return new Failure(error.code, error.message);
    if (error instanceof JsonException)
      return new Failure(FailureCode.InvalidParams, error.message);
    this.diagnostics.write(Resources.formatRequestFailed(method.text, RuntimeServer.describeError(error)));
    return new Failure(FailureCode.Internal, Resources.internalFailure);
  }

  private handleMessage(session: ClientSession, message: WireMessage): void {
    if (session.state === SessionState.AwaitingHandshake)
      this.handleHandshake(session, message);
    else if (session.state === SessionState.Verifying) {
      session.send(Response.failure(null, new Failure(FailureCode.InvalidMessage, Resources.handshakeUnanswered)));
      session.end();
    }
    else if (this.verified.has(session) && !this.mainProcessCheck.isSameSender(session.socket)) {
      this.diagnostics.write(Resources.formatMainProcessSenderChanged(session.connection));
      session.send(Response.failure(null, new Failure(FailureCode.Unauthorized, Resources.mainProcessRefused)));
      session.end();
    }
    else if (message instanceof Request)
      this.handleRequest(session, message);
    else if (message instanceof Cancel)
      session.cancelRequest(message.id, FailureCode.Cancelled);
    else
      session.send(Response.failure(null, new Failure(FailureCode.InvalidMessage, Resources.unexpectedMessage)));
  }

  private handleInvalidFrame(session: ClientSession, error: unknown): void {
    const failure = error instanceof ProtocolException ? new Failure(error.code, error.message) : new Failure(FailureCode.InvalidMessage, Resources.invalidFrame);
    session.send(Response.failure(null, failure));
    if (failure.code === FailureCode.FrameTooLarge || session.state === SessionState.AwaitingHandshake || session.state === SessionState.Verifying)
      session.end();
  }

  private handleClosed(session: ClientSession): void {
    this.sessions.delete(session);
    this.refusals.delete(session);
    if (this.admitted.delete(session))
      this.closures.report(new ClientClosure(session.connection, null));
    this.changed();
  }

  private writeEvent(event: Event): string | null {
    try {
      return this.writer.write(event);
    }
    catch (error) {
      this.diagnostics.write(Resources.formatEventNotSent(event.name.text, String(error)));
      return null;
    }
  }

  private createListener(): Server {
    const server = createServer(t => this.accept(t));
    this.server = server;
    return server;
  }

  private accept(socket: Socket): void {
    this.mainProcessCheck.accept?.(socket);
    const session = new ClientSession(socket, this.nextConnection++, this.settings.maximumFrameLength, this.listener);
    this.sessions.add(session);
    const timer = setTimeout(() => {
      if (session.state === SessionState.AwaitingHandshake || session.state === SessionState.Verifying)
        session.close();
    }, this.settings.handshakeTimeout);
    socket.once(Resources.closeEvent, () => clearTimeout(timer));
    this.changed();
  }

  private handleHandshake(session: ClientSession, message: WireMessage): void {
    if (!(message instanceof Handshake)) {
      session.send(Response.failure(null, new Failure(FailureCode.InvalidMessage, Resources.handshakeRequired)));
      session.end();
      return;
    }
    if (!this.token.matches(message.token)) {
      session.send(Response.failure(message.id, new Failure(FailureCode.Unauthorized, Resources.unauthorized)));
      session.end();
      return;
    }
    if (!Object.isNull(this.identity.findMismatch(message.identity))) {
      session.enter(SessionState.OtherBuild, message.client);
      session.send(Response.failure(message.id, new Failure(FailureCode.BuildMismatch, Resources.formatBuildMismatchFailure(ProductInfo.current.name), this.handover.toJson())));
      return;
    }
    if (message.client === ShellClients.mainProcess) {
      session.enter(SessionState.Verifying, message.client);
      void this.verifyAsync(session, message);
      return;
    }
    this.answerHandshake(session, message);
  }

  private async verifyAsync(session: ClientSession, handshake: Handshake): Promise<void> {
    const isMainProcess = await this.mainProcessCheck.isMainProcessAsync(session.socket).catch((error: unknown) => {
      this.diagnostics.write(Resources.formatMainProcessCheckFailed(session.connection, String(error)));
      return null;
    });
    if (session.state !== SessionState.Verifying)
      return;
    if (isMainProcess === true) {
      this.verified.add(session);
      this.answerHandshake(session, handshake);
      return;
    }
    if (isMainProcess === false)
      this.diagnostics.write(Resources.formatMainProcessRefused(session.connection));
    this.refusedMainProcesses.add(session);
    session.enter(SessionState.OtherBuild, handshake.client);
    session.send(Response.failure(handshake.id, new Failure(FailureCode.Unauthorized, Resources.mainProcessRefused, this.handover.toJson())));
  }

  private answerHandshake(session: ClientSession, message: Handshake): void {
    if (!Object.isNull(this.updating)) {
      session.send(Response.failure(message.id, this.updating));
      session.end();
      return;
    }
    if (!Object.isNull(this.refusal)) {
      this.refusals.set(session, this.refusal);
      session.enter(SessionState.Refused, message.client);
      session.send(Response.failure(message.id, this.refusal.failure));
      return;
    }

    session.enter(SessionState.Authenticated, message.client);
    this.admitted.add(session);
    session.send(Response.success(message.id, this.identity.toJson()));
    this.changed();
  }

  private handleRequest(session: ClientSession, request: Request): void {
    if (session.state === SessionState.OtherBuild && !request.method.equals(ShellMethods.stop)) {
      session.send(Response.failure(request.id, this.refusedMainProcesses.has(session)
        ? new Failure(FailureCode.Unauthorized, Resources.mainProcessRefused)
        : new Failure(FailureCode.BuildMismatch, Resources.otherBuildMayOnlyStop)));
      return;
    }
    const refusal = this.refusals.get(session);
    if (!Object.isUndefined(refusal) && !request.method.equals(refusal.method) && !request.method.equals(ShellMethods.stop)) {
      session.send(Response.failure(request.id, refusal.failure));
      return;
    }
    if (!Object.isNull(this.updating) && this.saved.has(session.connection) && !RuntimeServer.UPDATE_METHODS.some(t => t.equals(request.method))) {
      session.send(Response.failure(request.id, this.updating));
      return;
    }
    const handler = this.methods.find(request.method);
    if (Object.isUndefined(handler)) {
      session.send(Response.failure(request.id, new Failure(FailureCode.UnknownMethod, Resources.formatUnknownMethod(request.method.text))));
      return;
    }
    if (!Object.isUndefined(request.window) && session.hasClosedWindow(request.window)) {
      session.send(Response.failure(request.id, new Failure(FailureCode.NotFound, Resources.formatWindowClosed(request.window))));
      return;
    }
    if (session.hasRequest(request.id)) {
      session.send(Response.failure(request.id, new Failure(FailureCode.InvalidMessage, Resources.formatDuplicateRequest(request.id))));
      return;
    }

    const controller = new AbortController();
    const timeout = Math.min(request.timeoutMilliseconds ?? this.settings.defaultRequestTimeout, this.settings.maximumRequestTimeout);
    const timer = setTimeout(() => controller.abort(FailureCode.DeadlineExceeded), timeout);
    let isSettled = false;
    const settle = (response: Response): void => {
      if (isSettled)
        return;
      isSettled = true;
      clearTimeout(timer);
      session.releaseRequest(request.id);
      this.answer(session, request.method, response);
    };
    controller.signal.addEventListener(Resources.abortEvent, () => {
      const code = controller.signal.reason === FailureCode.DeadlineExceeded ? FailureCode.DeadlineExceeded : FailureCode.Cancelled;
      settle(Response.failure(request.id, new Failure(code, code === FailureCode.DeadlineExceeded ? Resources.deadlineExceeded : Resources.cancelled)));
    }, { once: true });
    session.trackRequest(request.id, controller, request.window ?? null);
    const context = new RequestContext(session.client, request.payload, controller.signal, session.connection, request.window ?? null, request.page ?? null);
    this.askers.set(context, session);
    Promise.try(() => handler.handleAsync(context)).then(
      (result: JsonValue) => settle(Response.success(request.id, result)),
      (error: unknown) => settle(Response.failure(request.id, this.describeFailure(request.method, error))));
  }
}

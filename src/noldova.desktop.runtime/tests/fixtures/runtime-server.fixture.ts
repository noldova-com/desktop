/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import type { Socket } from "node:net";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Assert } from "@noldova/context.testing";
import { BuildIdentity, type FailureCode, Handshake, QualifiedName, type Response, RuntimeHandover } from "@noldova/desktop.protocol";
import { CapabilityToken, type Endpoint, type IMethodHandler, MethodRegistry, type RequestContext, RuntimeServer, ServerSettings } from "@noldova/desktop.runtime";

import { HandshakeFailedException } from "../exceptions/handshake-failed.exception.js";
import { ServerNotListeningException } from "../exceptions/server-not-listening.exception.js";
import { RawConnectionFixture } from "./raw-connection.fixture.js";
import { TextOutputFixture } from "./text-output.fixture.js";

export class RuntimeServerFixture implements AsyncDisposable {
  public static readonly IDENTITY: BuildIdentity = new BuildIdentity("1.2.3", BuildIdentity.supportedProtocolVersion, "server-build");
  public static readonly OTHER_IDENTITY: BuildIdentity = new BuildIdentity("1.2.3", BuildIdentity.supportedProtocolVersion, "other-build");
  public static readonly TOKEN: string = "fixture-token";
  public static readonly EXECUTABLE: string = "/opt/noldova-desktop/noldova-desktop";
  public static readonly ECHO: QualifiedName = new QualifiedName("notes", "echo");
  public static readonly WAIT: QualifiedName = new QualifiedName("notes", "wait");
  public static readonly ECHO_HANDLER: IMethodHandler = {
    handleAsync: (context: RequestContext) => Promise.resolve({ client: context.client, payload: context.payload })
  };

  private readonly connections: RawConnectionFixture[] = [];
  private readonly waiters: Set<() => void> = new Set();

  public readonly methods: MethodRegistry = new MethodRegistry();
  public readonly diagnostics: TextOutputFixture = new TextOutputFixture();
  public readonly server: RuntimeServer;
  public readonly checkedSockets: Socket[] = [];
  public readonly acceptedSockets: Socket[] = [];
  public checkMainProcessAsync: () => Promise<boolean> = () => Promise.resolve(true);
  public isSameSender: () => boolean = () => true;
  public changes: number = 0;
  public endpoint: Endpoint | null = null;
  public onChange: () => void = () => undefined;

  public constructor(settings: ServerSettings = new ServerSettings(64 * 1024, 1_000, 1_000, 2_000), checksProcesses: boolean = false) {
    this.server = new RuntimeServer(
      RuntimeServerFixture.IDENTITY,
      new CapabilityToken(RuntimeServerFixture.TOKEN),
      new RuntimeHandover(RuntimeServerFixture.IDENTITY, RuntimeServerFixture.EXECUTABLE),
      this.methods,
      settings,
      () => {
        this.changes++;
        this.onChange();
        for (const waiter of [...this.waiters])
          waiter();
      },
      this.diagnostics,
      checksProcesses ? undefined : {
        accept: (socket: Socket) => {
          this.acceptedSockets.push(socket);
        },
        isMainProcessAsync: (socket: Socket) => {
          this.checkedSockets.push(socket);
          return this.checkMainProcessAsync();
        },
        isSameSender: () => this.isSameSender()
      });
  }

  public static async startAsync(settings?: ServerSettings): Promise<RuntimeServerFixture> {
    const fixture = new RuntimeServerFixture(settings);
    fixture.endpoint = await fixture.server.listenTcpAsync();
    return fixture;
  }

  public waitUntilAsync(condition: () => boolean): Promise<void> {
    if (condition())
      return Promise.resolve();
    return new Promise<void>(resolve => {
      const check = (): void => {
        if (!condition())
          return;
        this.waiters.delete(check);
        resolve();
      };
      this.waiters.add(check);
    });
  }

  public async connectAsync(allowHalfOpen: boolean = false): Promise<RawConnectionFixture> {
    if (Object.isNull(this.endpoint))
      throw new ServerNotListeningException();
    const connection = await RawConnectionFixture.connectAsync(this.endpoint, allowHalfOpen);
    this.connections.push(connection);
    return connection;
  }

  public async handshakeAsync(
    client: string = "tester",
    identity: BuildIdentity = RuntimeServerFixture.IDENTITY,
    token: string = RuntimeServerFixture.TOKEN): Promise<[RawConnectionFixture, Response]> {
    const connection = await this.connectAsync();
    connection.sendMessages(new Handshake(`${client}:0`, identity, token, client));
    return [connection, await connection.readResponseAsync()];
  }

  public async authenticateAsync(client: string = "tester"): Promise<RawConnectionFixture> {
    const [connection, answer] = await this.handshakeAsync(client);
    if (answer.hasFailed)
      throw new HandshakeFailedException(answer.toText());
    return connection;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const connection of this.connections)
      connection[Symbol.dispose]();
    await this.server.closeAsync();
  }

  public static createWaitHandler(signals: AbortSignal[], started: PromiseWithResolvers<void> = Promise.withResolvers<void>()): IMethodHandler {
    return {
      handleAsync: async (context: RequestContext): Promise<JsonValue> => {
        signals.push(context.signal);
        started.resolve();
        await once(context.signal, "abort");
        return "late";
      }
    };
  }

  public static assertFailure(response: Response, code: FailureCode, message: string, id: string | null): void {
    Assert.areEqual(id, response.id);
    Assert.areEqual(code, response.failure?.code);
    Assert.areEqual(message, response.failure?.message);
  }

  public static async runAsync(settings: ServerSettings | undefined, test: (fixture: RuntimeServerFixture) => Promise<void>, listen: boolean = true): Promise<void> {
    await using fixture = listen ? await RuntimeServerFixture.startAsync(settings) : new RuntimeServerFixture(settings);
    await test(fixture);
  }
}

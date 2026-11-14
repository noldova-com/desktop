/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash, randomBytes } from "node:crypto";
import { type IncomingMessage, type OutgoingHttpHeaders, type Server, type ServerOptions, type ServerResponse, createServer } from "node:http";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { ToolEndpointException } from "../../exceptions/tool-endpoint.exception.js";
import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IToolEndpoint } from "../../interfaces/i-tool-endpoint.js";
import type { IToolEndpointHandler } from "../../interfaces/i-tool-endpoint-handler.js";
import type { ToolSession } from "../../models/tool-session.js";
import { Resources } from "../../resources.js";

export class ToolEndpoint implements IToolEndpoint {
  public static readonly options: ServerOptions & { readonly maxConnections: number } = {
    headersTimeout: Resources.toolEndpointHeadersMilliseconds,
    requestTimeout: Resources.toolEndpointRequestMilliseconds,
    connectionsCheckingInterval: Resources.toolEndpointCheckMilliseconds,
    maxHeaderSize: Resources.maximumToolEndpointHeaderBytes,
    maxConnections: Resources.maximumToolEndpointConnections
  };

  private readonly server: Server;
  private readonly host: string;
  private readonly handler: IToolEndpointHandler;
  private readonly isAdmissible: (session: ToolSession) => boolean;
  private readonly log: IModuleLog;
  private readonly tokens: Map<string, ToolSession> = new Map();
  private isClosed: boolean = false;

  public readonly url: string;

  private constructor(server: Server, port: number, handler: IToolEndpointHandler, isAdmissible: (session: ToolSession) => boolean, log: IModuleLog) {
    this.server = server;
    this.host = Resources.formatToolEndpointHost(port);
    this.handler = handler;
    this.isAdmissible = isAdmissible;
    this.log = log;
    this.url = Resources.formatToolEndpointUrl(port);
    server.on(Resources.requestEvent, (request: IncomingMessage, response: ServerResponse) => this.answer(request, response));
  }

  public static async openAsync(handler: IToolEndpointHandler, isAdmissible: (session: ToolSession) => boolean, log: IModuleLog, stopping: AbortSignal,
    register: (endpoint: ToolEndpoint) => void, options: ServerOptions & { readonly maxConnections: number } = ToolEndpoint.options): Promise<ToolEndpoint> {
    const server = createServer(options);
    server.maxConnections = options.maxConnections;
    await ToolEndpoint.listenAsync(server);
    const address = server.address();
    if (stopping.aborted || Object.isNull(address) || Object.isString(address)) {
      server.close();
      throw new ToolEndpointException();
    }

    const endpoint = new ToolEndpoint(server, address.port, handler, isAdmissible, log);
    register(endpoint);
    return endpoint;
  }

  public admit(session: ToolSession): string {
    if (this.isClosed)
      throw new ToolEndpointException();
    if (!this.isAdmissible(session))
      throw new ArgumentException(Resources.toolSessionNotAdmissible, Resources.sessionParameterName);

    for (const [key, held] of this.tokens)
      if (held === session || !this.isAdmissible(held))
        this.tokens.delete(key);
    const token = randomBytes(Resources.toolTokenBytes).toString(Resources.toolTokenEncoding);
    this.tokens.set(ToolEndpoint.digest(token), session);
    return token;
  }

  public [Symbol.dispose](): void {
    this.isClosed = true;
    this.tokens.clear();
    this.server.close();
    this.server.closeAllConnections();
  }

  private static listenAsync(server: Server): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      server.once(Resources.errorEvent, reject);
      server.once(Resources.listeningEvent, () => {
        server.off(Resources.errorEvent, reject);
        resolve();
      });
      server.listen(0, Resources.loopbackHost);
    });
  }

  private static digest(token: string): string {
    return createHash(Resources.toolTokenDigest).update(token).digest(Resources.toolTokenEncoding);
  }

  private static describe(error: unknown): string {
    if (error instanceof Error)
      return error.stack ?? Resources.formatErrorText(error.name, error.message);
    return Resources.formatToolEndpointValue(typeof error);
  }

  private static refuse(response: ServerResponse, status: number, headers: OutgoingHttpHeaders = {}): void {
    response.writeHead(status, headers);
    response.end();
  }

  private answer(request: IncomingMessage, response: ServerResponse): void {
    if (request.headers.host !== this.host) {
      ToolEndpoint.refuse(response, Resources.misdirectedRequestStatus);
      return;
    }
    if (!Object.isUndefined(request.headers.origin)) {
      ToolEndpoint.refuse(response, Resources.forbiddenStatus);
      return;
    }
    const session = this.findSession(request.headers.authorization ?? String.empty);
    if (Object.isUndefined(session)) {
      ToolEndpoint.refuse(response, Resources.unauthorizedStatus, { [Resources.authenticateHeader]: Resources.bearerScheme });
      return;
    }
    void this.handleAsync(request, response, session);
  }

  private findSession(authorization: string): ToolSession | undefined {
    if (!authorization.startsWith(Resources.bearerPrefix))
      return undefined;
    const key = ToolEndpoint.digest(authorization.slice(Resources.bearerPrefix.length));
    const session = this.tokens.get(key);
    if (Object.isUndefined(session) || this.isAdmissible(session))
      return session;
    this.tokens.delete(key);
    return undefined;
  }

  private async handleAsync(request: IncomingMessage, response: ServerResponse, session: ToolSession): Promise<void> {
    try {
      await this.handler.handleAsync(request, response, session);
    }
    catch (error) {
      this.log.write(Resources.formatToolEndpointFailed(ToolEndpoint.describe(error)));
      if (response.headersSent)
        response.destroy();
      else
        ToolEndpoint.refuse(response, Resources.internalErrorStatus);
    }
  }
}

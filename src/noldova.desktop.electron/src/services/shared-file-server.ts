/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";

import type { CustomScheme } from "electron";

import "@noldova/context.core";
import { FileGrant, type Response as RuntimeAnswer } from "@noldova/desktop.protocol";
import { FileIdentity } from "@noldova/desktop.runtime";

import type { IWindowSession } from "../interfaces/i-window-session.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";

export class SharedFileServer {
  public static readonly scheme: CustomScheme = { scheme: Resources.sharedFileScheme, privileges: { standard: true, secure: true } };

  private static readonly OPEN_FLAGS: number = constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW;

  private readonly resolveAsync: (grant: string) => Promise<RuntimeAnswer>;
  private readonly isLive: (window: number, page: number) => boolean;
  private readonly log: (line: string) => void;

  public constructor(resolveAsync: (grant: string) => Promise<RuntimeAnswer>, isLive: (window: number, page: number) => boolean, log: (line: string) => void) {
    this.resolveAsync = resolveAsync;
    this.isLive = isLive;
    this.log = log;
  }

  public serveOn(session: IWindowSession): void {
    if (!session.protocol.isProtocolHandled(Resources.sharedFileScheme))
      session.protocol.handle(Resources.sharedFileScheme, t => this.serveAsync(t));
  }

  public async serveAsync(request: Request): Promise<Response> {
    const grant = new URL(request.url).host;
    if (request.method !== Resources.getMethod || !Resources.sharedFileHostPattern.test(grant) || request.url !== Resources.formatSharedFileAddress(grant))
      return this.refuse(Resources.sharedFileAddressRefused);
    const answer = await this.resolveAsync(grant);
    if (!Object.isUndefined(answer.failure))
      return this.refuse(answer.failure.code);
    const file = FileGrant.fromJson(answer.payload);
    if (!this.isLive(file.window, file.page))
      return this.refuse(Resources.sharedFilePageEnded);
    const handle = await open(file.path, SharedFileServer.OPEN_FLAGS).catch((error: unknown) => ErrorCode.of(error) ?? String(error));
    if (Object.isString(handle))
      return this.refuse(handle);
    const stats = await handle.stat({ bigint: true });
    if (FileIdentity.of(stats) !== file.identity) {
      await handle.close();
      return this.refuse(Resources.sharedFileChanged);
    }
    const mediaType = Resources.sharedImageTypes.includes(file.mediaType) ? file.mediaType : Resources.unknownMediaType;
    return new Response(SharedFileServer.streamOf(handle),
      { headers: { ...Resources.sharedFileHeaders, [Resources.contentTypeHeader]: mediaType, [Resources.contentLengthHeader]: String(stats.size) } });
  }

  private static streamOf(handle: FileHandle): ReadableStream<Uint8Array> {
    const chunks = handle.createReadStream()[Symbol.asyncIterator]();
    return new ReadableStream<Uint8Array>({
      pull: async controller => {
        const next = await chunks.next();
        if (next.done === true)
          controller.close();
        else
          controller.enqueue(new Uint8Array(next.value));
      },
      cancel: async () => {
        await chunks.return?.();
      }
    });
  }

  private refuse(reason: string): Response {
    this.log(Resources.formatSharedFileRefused(reason));
    return new Response(null, { status: Resources.notFoundStatus, headers: Resources.sharedFileHeaders });
  }
}

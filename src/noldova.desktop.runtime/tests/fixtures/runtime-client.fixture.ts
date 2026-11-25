/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Response } from "@noldova/desktop.protocol";
import { ClientSettings, type Endpoint, RuntimeClient } from "@noldova/desktop.runtime";

import { ClientListenerFixture } from "./client-listener.fixture.js";
import { RawServerFixture } from "./raw-server.fixture.js";
import { RuntimeServerFixture } from "./runtime-server.fixture.js";
import { ServerNotListeningException } from "../exceptions/server-not-listening.exception.js";

export class RuntimeClientFixture {
  public static readonly SETTINGS: ClientSettings = new ClientSettings();
  public static readonly SHORT_HANDSHAKE: ClientSettings = new ClientSettings(300);
  public static readonly SHORT_GRACE: ClientSettings = new ClientSettings(RuntimeClientFixture.SETTINGS.handshakeTimeout, RuntimeClientFixture.SETTINGS.callTimeout, 50);
  public static readonly AUTHENTICATED: string = Response.success("main:0", RuntimeServerFixture.IDENTITY.toJson()).toText();

  public static connectAsync(fixture: RuntimeServerFixture, listener: ClientListenerFixture): Promise<RuntimeClient> {
    return RuntimeClient.connectAsync(
      RuntimeClientFixture.endpointOf(fixture),
      RuntimeServerFixture.TOKEN,
      RuntimeServerFixture.IDENTITY,
      "main",
      listener,
      RuntimeClientFixture.SETTINGS);
  }

  public static async runAsync(test: (fixture: RuntimeServerFixture, listener: ClientListenerFixture) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeServerFixture.startAsync();
    await test(fixture, new ClientListenerFixture());
  }

  public static async runRawAsync(
    reply: (frame: string, index: number) => readonly string[] | null,
    test: (server: RawServerFixture, listener: ClientListenerFixture) => Promise<void>): Promise<void> {
    await using server = await RawServerFixture.startAsync(reply);
    await test(server, new ClientListenerFixture());
  }

  public static endpointOf(fixture: RuntimeServerFixture): Endpoint {
    if (Object.isNull(fixture.endpoint))
      throw new ServerNotListeningException();
    return fixture.endpoint;
  }
}

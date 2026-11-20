/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";

import "@noldova/context.core";
import { Assert, Category, TestClass, TestMethod } from "@noldova/context.testing";
import { FailureCode } from "@noldova/desktop.protocol";
import { CallUnansweredException, ConnectionClosedException, type RequestContext, RuntimeClient } from "@noldova/desktop.runtime";

import { RuntimeClientFixture } from "../fixtures/runtime-client.fixture.js";
import { RuntimeServerFixture } from "../fixtures/runtime-server.fixture.js";

@TestClass
export class PendingCallTests {
  @TestMethod
  public rejectsPendingCallsWhenTheConnectionCloses(): Promise<void> {
    return RuntimeClientFixture.runAsync(async (fixture, listener) => {
      fixture.methods.register(RuntimeServerFixture.WAIT, { handleAsync: (context: RequestContext) => once(context.signal, "abort").then(() => null) });
      const client = await RuntimeClientFixture.connectAsync(fixture, listener);

      const call = client.callAsync(RuntimeServerFixture.WAIT, null);
      client.close();

      const exception = await Assert.throwsAsync(() => call, ConnectionClosedException);

      Assert.areEqual("The connection to the runtime is closed.", exception.message);
      Assert.areEqual(FailureCode.Disconnected, exception.failure?.code);
    });
  }

  @Category("Timing")
  @TestMethod
  public givesUpOnACallTheRuntimeDoesNotAnswer(): Promise<void> {
    return RuntimeClientFixture.runRawAsync(
      (_frame, index) => index === 0 ? [RuntimeClientFixture.AUTHENTICATED] : [],
      async (server, listener) => {
        const client = await RuntimeClient.connectAsync(server.endpoint, "token", RuntimeServerFixture.IDENTITY, "main", listener, RuntimeClientFixture.SHORT_GRACE);
        const started = Date.now();

        const exception = await Assert.throwsAsync(() => client.callAsync(RuntimeServerFixture.ECHO, null, 50), CallUnansweredException);

        Assert.areEqual("The runtime did not answer notes.echo in time.", exception.message);
        Assert.isNull(exception.failure);
        Assert.isTrue(Date.now() - started >= 90, "A timing test: the client gives up only after the call's 50 ms limit and its 50 ms grace, with 10 ms for a timer's rounding; a busy machine only makes the wait longer, so it cannot fail this bound.");
        Assert.isTrue(client.isConnected);
      });
  }
}

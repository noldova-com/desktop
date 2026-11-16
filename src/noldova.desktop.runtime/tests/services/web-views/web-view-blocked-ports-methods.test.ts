/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import "@noldova/context.core";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellEvents, WebViewBlockedPorts } from "@noldova/desktop.protocol";

import { RequestContext } from "../../../src/models/request-context.js";
import { EventRegistry } from "../../../src/services/registry/event-registry.js";
import { ReadWebViewBlockedPortsMethod } from "../../../src/services/web-views/read-web-view-blocked-ports-method.js";
import { WebViewCenter } from "../../../src/services/web-views/web-view-center.js";
import { WebViewPortsBlockedMethod } from "../../../src/services/web-views/web-view-ports-blocked-method.js";
import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class WebViewBlockedPortsMethodsTests {
  private static readonly MAIN: number = 7;

  @TestMethod
  public async answersTheBlockedPortsOnlyToTheMainProcess(): Promise<void> {
    const center = WebViewBlockedPortsMethodsTests.create();
    center.blockPort(4600);
    const method = new ReadWebViewBlockedPortsMethod(center);

    const main = await method.handleAsync(WebViewBlockedPortsMethodsTests.context(WebViewBlockedPortsMethodsTests.MAIN, null));
    const other = await method.handleAsync(WebViewBlockedPortsMethodsTests.context(WebViewBlockedPortsMethodsTests.MAIN + 1, null));

    Assert.areEqual("{\"serial\":1,\"ports\":[4600]}", JSON.stringify(main));
    Assert.isNull(other);
  }

  @TestMethod
  public async releasesTheWaitTheMainProcesssAcknowledgementCoversAndAnswersNull(): Promise<void> {
    const center = WebViewBlockedPortsMethodsTests.create();
    const method = new WebViewPortsBlockedMethod(center);
    const waiting = center.waitForPortsAsync(center.blockPort(4600), new AbortController().signal);

    const ignored = await method.handleAsync(WebViewBlockedPortsMethodsTests.context(WebViewBlockedPortsMethodsTests.MAIN + 1, new WebViewBlockedPorts(1, [4600]).toJson()));
    const isPendingAfterAnother = await WaitFixture.isPendingAsync(waiting);
    const answer = await method.handleAsync(WebViewBlockedPortsMethodsTests.context(WebViewBlockedPortsMethodsTests.MAIN, new WebViewBlockedPorts(1, [4600]).toJson()));
    await waiting;

    Assert.isNull(ignored);
    Assert.isTrue(isPendingAfterAnother);
    Assert.isNull(answer);
  }

  @TestMethod
  public async refusesAnAcknowledgementThatIsNoList(): Promise<void> {
    const method = new WebViewPortsBlockedMethod(WebViewBlockedPortsMethodsTests.create());

    await Assert.throwsAsync(() => method.handleAsync(WebViewBlockedPortsMethodsTests.context(WebViewBlockedPortsMethodsTests.MAIN, { serial: 1 })), JsonException);
  }

  private static create(): WebViewCenter {
    const events = new EventRegistry(new EventSinkFixture());
    const center = new WebViewCenter(new TextOutputFixture(), events.declare(ShellEvents.webViewCommand), events.declare(ShellEvents.webViewBlockedPorts));
    center.check(WebViewBlockedPortsMethodsTests.MAIN);
    return center;
  }

  private static context(connection: number, payload: RequestContext["payload"]): RequestContext {
    return new RequestContext("main", payload, new AbortController().signal, connection);
  }
}

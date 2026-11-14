/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShellEvents, WebViewAction, WebViewAnswered, WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";

import { WebViewFailureException } from "../../../src/exceptions/web-view-failure.exception.js";
import { RequestContext } from "../../../src/models/request-context.js";
import { EventRegistry } from "../../../src/services/registry/event-registry.js";
import { WebViewAnsweredMethod } from "../../../src/services/web-views/web-view-answered-method.js";
import { WebViewCenter } from "../../../src/services/web-views/web-view-center.js";
import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class WebViewAnsweredMethodTests {
  private static readonly MAIN: number = 7;

  @TestMethod
  public async settlesTheCallOnlyWithTheAskedConnectionsAnswerAndAnswersNull(): Promise<void> {
    const center = WebViewAnsweredMethodTests.create();
    const method = new WebViewAnsweredMethod(center);
    let isSettled = false;

    const reloading = center.commandAsync("notes", WebViewAction.Reload, "1").finally(() => {
      isSettled = true;
    });
    const ignored = await method.handleAsync(WebViewAnsweredMethodTests.context(WebViewAnsweredMethodTests.MAIN + 1, new WebViewAnswered(1, { kind: "Started" })));
    const isSettledByAnother = isSettled;
    const answer = await method.handleAsync(WebViewAnsweredMethodTests.context(WebViewAnsweredMethodTests.MAIN, new WebViewAnswered(1, { kind: "Started" })));

    Assert.isNull(ignored);
    Assert.isFalse(isSettledByAnother);
    Assert.isNull(answer);
    Assert.areEqual("{\"kind\":\"Started\"}", JSON.stringify(await reloading));
  }

  @TestMethod
  public async turnsAFailedAnswerIntoTheCallsFailure(): Promise<void> {
    const center = WebViewAnsweredMethodTests.create();
    const method = new WebViewAnsweredMethod(center);

    const failed = Assert.throwsAsync(() => center.commandAsync("notes", WebViewAction.Reload, "1"), WebViewFailureException);
    await method.handleAsync(WebViewAnsweredMethodTests.context(WebViewAnsweredMethodTests.MAIN, new WebViewAnswered(1, null, new WebViewFailure(WebViewFailureKind.Crashed))));
    const failure = await failed;

    Assert.areEqual(WebViewFailureKind.Crashed, failure.failure.kind);
  }

  @TestMethod
  public async refusesAPayloadThatIsNoAnswer(): Promise<void> {
    const method = new WebViewAnsweredMethod(WebViewAnsweredMethodTests.create());

    await Assert.throwsAsync(() => method.handleAsync(new RequestContext("main", { value: 1 }, new AbortController().signal, WebViewAnsweredMethodTests.MAIN)), Error);
  }

  private static create(): WebViewCenter {
    const center = new WebViewCenter(new TextOutputFixture(), new EventRegistry(new EventSinkFixture()).declare(ShellEvents.webViewCommand));
    center.check(WebViewAnsweredMethodTests.MAIN);
    return center;
  }

  private static context(connection: number, answered: WebViewAnswered): RequestContext {
    return new RequestContext("main", answered.toJson(), new AbortController().signal, connection);
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliPartContext } from "@noldova/desktop.cli";
import { Fake } from "@noldova/desktop.protocol/testing";

import { FakeCliSecretsFixture } from "./fake-cli-secrets.fixture.js";

export class FakeCliPartContextFixture extends Fake<ICliPartContext> implements ICliPartContext {
  public readonly secrets: FakeCliSecretsFixture = new FakeCliSecretsFixture();
  public readonly registerCommand: ICliPartContext["registerCommand"] = (...args) => this.tell("registerCommand", args, this.answers.registerCommand);
  public readonly requestAsync: ICliPartContext["requestAsync"] = (...args) => this.respondAsync("requestAsync", args, this.answers.requestAsync);

  public get moduleId(): string {
    return this.propertyOf("moduleId", this.answers.moduleId);
  }

  protected override parts(): readonly Pick<Fake<object>, "beStrict">[] {
    return [this.secrets];
  }
}

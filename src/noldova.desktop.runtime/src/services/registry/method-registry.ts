/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QualifiedName } from "@noldova/desktop.protocol";

import { MethodRegisteredException } from "../../exceptions/method-registered.exception.js";
import type { IMethodHandler } from "../../interfaces/i-method-handler.js";
import { Registration } from "../../models/registration.js";

export class MethodRegistry {
  private readonly handlers: Map<string, IMethodHandler> = new Map();

  public register(name: QualifiedName, handler: IMethodHandler): Registration {
    if (this.handlers.has(name.text))
      throw new MethodRegisteredException(name.text);

    this.handlers.set(name.text, handler);
    return new Registration(() => this.unregister(name, handler));
  }

  public find(name: QualifiedName): IMethodHandler | undefined {
    return this.handlers.get(name.text);
  }

  private unregister(name: QualifiedName, handler: IMethodHandler): void {
    if (this.handlers.get(name.text) === handler)
      this.handlers.delete(name.text);
  }
}

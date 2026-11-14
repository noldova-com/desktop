/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { QualifiedName } from "@noldova/desktop.protocol";

import { ServicePublishedException } from "../../exceptions/service-published.exception.js";
import { Registration } from "../../models/registration.js";

export class ServiceRegistry {
  private readonly services: Map<string, object> = new Map();

  public publish(name: QualifiedName, service: object): Registration {
    if (this.services.has(name.text))
      throw new ServicePublishedException(name.text);

    this.services.set(name.text, service);
    return new Registration(() => this.withdraw(name, service));
  }

  public find(name: QualifiedName): object | undefined {
    return this.services.get(name.text);
  }

  private withdraw(name: QualifiedName, service: object): void {
    if (this.services.get(name.text) === service)
      this.services.delete(name.text);
  }
}

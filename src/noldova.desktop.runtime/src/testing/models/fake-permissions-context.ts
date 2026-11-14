/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect } from "node:util";

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IPermissionsContext } from "../../interfaces/i-permissions-context.js";
import type { PermissionRevocation } from "../../models/permission-revocation.js";
import { Registration } from "../../models/registration.js";
import { Resources } from "../../resources.js";
import { FakeModuleLog } from "./fake-module-log.js";

export class FakePermissionsContext extends Fake<IPermissionsContext> implements IPermissionsContext {
  private readonly log: IModuleLog;
  private readonly revoked: Set<(revocation: PermissionRevocation) => void> = new Set<(revocation: PermissionRevocation) => void>();

  public readonly registerAnswerer: IPermissionsContext["registerAnswerer"] = (...args) => new Registration(this.track("registerAnswerer", args));
  public readonly listRemembered: IPermissionsContext["listRemembered"] = (...args) => this.ask("listRemembered", args, this.answers.listRemembered);
  public readonly revoke: IPermissionsContext["revoke"] = (...args) => this.ask("revoke", args, this.answers.revoke);
  public readonly onRevoked: IPermissionsContext["onRevoked"] = listener => new Registration(this.listen("onRevoked", [listener], this.revoked, listener));

  public constructor(log: IModuleLog = new FakeModuleLog()) {
    super();
    this.log = log;
  }

  public raiseRevoked(revocation: PermissionRevocation): void {
    this.raiseIsolated(this.revoked, t => t(revocation), t => this.log.write(Resources.formatPermissionRevokedListenerFailed(inspect(t))));
  }
}

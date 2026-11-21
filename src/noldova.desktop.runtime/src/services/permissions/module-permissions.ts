/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "../../interfaces/i-module-log.js";
import type { IPermissionAnswerer } from "../../interfaces/i-permission-answerer.js";
import type { IPermissionsContext } from "../../interfaces/i-permissions-context.js";
import type { PermissionRevocation } from "../../models/permission-revocation.js";
import { Registration } from "../../models/registration.js";
import type { RememberedPermission } from "../../models/remembered-permission.js";
import type { PermissionCenter } from "./permission-center.js";

export class ModulePermissions implements IPermissionsContext {
  private readonly moduleId: string;
  private readonly center: PermissionCenter;
  private readonly log: IModuleLog;
  private readonly registrations: Disposable[];
  private readonly stopping: AbortSignal;

  public constructor(moduleId: string, center: PermissionCenter, log: IModuleLog, registrations: Disposable[], stopping: AbortSignal) {
    this.moduleId = moduleId;
    this.center = center;
    this.log = log;
    this.registrations = registrations;
    this.stopping = stopping;
  }

  public registerAnswerer(answerer: IPermissionAnswerer): Registration {
    return this.stopping.aborted ? ModulePermissions.released() : this.keep(this.center.registerAnswerer(this.moduleId, answerer, this.log));
  }

  public listRemembered(): readonly RememberedPermission[] {
    return this.center.listRemembered(this.moduleId);
  }

  public revoke(id: string): boolean {
    return this.center.revoke(this.moduleId, id);
  }

  public onRevoked(listener: (revocation: PermissionRevocation) => void): Registration {
    return this.stopping.aborted ? ModulePermissions.released() : this.keep(this.center.onRevoked(this.moduleId, listener, this.log));
  }

  private static released(): Registration {
    return new Registration(() => undefined);
  }

  private keep(registration: Registration): Registration {
    this.registrations.push(registration);
    return registration;
  }
}

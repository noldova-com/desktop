/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class SigningCredentials {
  public static take(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const credentials = Object.fromEntries(Resources.signingCredentialNames.filter(t => !Object.isUndefined(environment[t])).map(t => [t, environment[t]]));
    for (const name of Resources.signingCredentialNames)
      delete environment[name];
    return credentials;
  }
}

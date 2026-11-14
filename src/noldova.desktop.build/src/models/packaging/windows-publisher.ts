/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class WindowsPublisher {

  public static take(environment: NodeJS.ProcessEnv): string {
    const publisher = environment[Resources.windowsPublisherVariable] ?? String.empty;
    if (!Resources.windowsPublisherPattern.test(publisher))
      throw new BuildException(Resources.formatWindowsPublisherInvalid(publisher));
    return publisher;
  }
}

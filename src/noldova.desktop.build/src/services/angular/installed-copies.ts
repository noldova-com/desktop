/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class InstalledCopies {
  public static find(listing: string, name: string): readonly string[] {
    const refusal = Resources.formatInstalledCopiesRefusal(name, listing);
    let copies: readonly (readonly [string, string])[] | null;
    try {
      const root = JsonReader.parse(listing);
      copies = root.hasField(Resources.npmListErrorField) && !root.hasField(Resources.npmListDependenciesField) ? null : InstalledCopies.collect(root, name, []);
    }
    catch (error) {
      throw new BuildException(refusal, new ExceptionOptions(error));
    }
    if (Object.isNull(copies))
      throw new BuildException(refusal);
    const found = copies;
    return found.filter(([key], i) => found.findIndex(t => t[0] === key) === i).map(t => t[1]);
  }

  private static collect(listed: JsonReader, name: string, ancestors: readonly string[]): readonly (readonly [string, string])[] {
    if (!listed.hasField(Resources.npmListDependenciesField))
      return [];
    const dependencies = listed.readObject(Resources.npmListDependenciesField);
    return Object.keys(dependencies.toJson()).flatMap(t => {
      const dependency = dependencies.readObject(t);
      const trail = [...ancestors, t];
      const version = dependency.readOptionalString(Resources.npmListVersionField);
      const path = dependency.readOptionalString(Resources.npmListPathField);
      const description = Resources.formatInstalledCopy(String(version), trail);
      const own: readonly (readonly [string, string])[] = t === name && !Object.isUndefined(version) ? [[Object.isUndefined(path) ? description : path, description]] : [];
      return [...own, ...InstalledCopies.collect(dependency, name, trail)];
    });
  }
}

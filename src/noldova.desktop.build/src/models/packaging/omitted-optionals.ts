/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { PackagingSection } from "./packaging-section.ts";
import { Resources } from "../../resources.ts";

export class OmittedOptionals {
  private readonly dependencies: ReadonlyMap<string, ReadonlySet<string>>;

  public constructor(dependencies: ReadonlyMap<string, ReadonlySet<string>> = new Map()) {
    this.dependencies = dependencies;
  }

  public static async readAsync(root: string): Promise<OmittedOptionals> {
    return new OmittedOptionals(await PackagingSection.readAsync(root, Resources.omittedOptionalsField, Resources.omittedOptionalsShape, t => PackagingSection.readNames(t, Resources.manifestDependenciesField)));
  }

  public omits(id: string, dependency: string): boolean {
    return this.dependencies.get(id)?.has(dependency) ?? false;
  }

  public of(id: string): readonly string[] {
    return [...this.dependencies.get(id) ?? []];
  }

  public get ids(): readonly string[] {
    return [...this.dependencies.keys()];
  }
}

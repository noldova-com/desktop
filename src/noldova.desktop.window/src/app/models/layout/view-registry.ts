/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../../resources.js";
import type { ViewType } from "./view-type.js";

export class ViewRegistry {
  private readonly viewTypes: ReadonlyMap<string, ViewType>;
  private readonly documentNames: ReadonlySet<string>;
  private readonly documentPlaces: ReadonlyMap<string, string>;
  private readonly renamableDocuments: ReadonlySet<string>;

  public constructor(views: readonly ViewType[], documents: readonly string[], documentPlaces: ReadonlyMap<string, string> = new Map(),
    renamableDocuments: ReadonlySet<string> = new Set()) {
    if (documents.some(t => !Resources.contributionNamePattern.test(t)))
      throw new ArgumentException(Resources.invalidContributionName, Resources.documentsParameterName);
    if (new Set(views.map(t => t.name)).size !== views.length || new Set(documents).size !== documents.length)
      throw new ArgumentException(Resources.repeatedViewType);
    if ([...documentPlaces].some(([name, place]) => !documents.includes(name) || !Resources.contributionNamePattern.test(place)))
      throw new ArgumentException(Resources.invalidContributionName, Resources.documentPlacesParameterName);
    if ([...renamableDocuments].some(t => !documents.includes(t)))
      throw new ArgumentException(Resources.invalidContributionName, Resources.renamableDocumentsParameterName);

    this.viewTypes = new Map(views.map(t => [t.name, t]));
    this.documentNames = new Set(documents);
    this.documentPlaces = documentPlaces;
    this.renamableDocuments = renamableDocuments;
  }

  public static createEmpty(): ViewRegistry {
    return new ViewRegistry([], []);
  }

  public get views(): readonly ViewType[] {
    return [...this.viewTypes.values()];
  }

  public hasView(name: string): boolean {
    return this.viewTypes.has(name);
  }

  public hasDocument(name: string): boolean {
    return this.documentNames.has(name);
  }

  public documentTabRowPlace(name: string): string | null {
    return this.documentPlaces.get(name) ?? null;
  }

  public isRenamableView(name: string): boolean {
    return this.viewTypes.get(name)?.isRenamable === true;
  }

  public isRenamableDocument(name: string): boolean {
    return this.renamableDocuments.has(name);
  }

  public view(name: string): ViewType {
    const type = this.viewTypes.get(name);
    if (Object.isUndefined(type))
      throw new ArgumentException(Resources.formatUnregisteredView(name), Resources.nameParameterName);
    return type;
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DocumentHeading } from "./document-heading.js";

export class PendingDocument {
  public readonly moduleId: string;
  public readonly name: string;
  public readonly instance: string;
  public readonly heading: DocumentHeading;
  public readonly isPreview: boolean;
  public readonly after: string | null;
  public readonly isEarly: boolean;

  public constructor(moduleId: string, name: string, instance: string, heading: DocumentHeading, isPreview: boolean, after: string | null, isEarly: boolean) {
    this.moduleId = moduleId;
    this.name = name;
    this.instance = instance;
    this.heading = heading;
    this.isPreview = isPreview;
    this.after = after;
    this.isEarly = isEarly;
  }

  public kept(moduleId: string, name: string, instance: string): PendingDocument {
    return this.isFor(moduleId, name, instance) ? new PendingDocument(this.moduleId, this.name, this.instance, this.heading, false, this.after, this.isEarly) : this;
  }

  public updated(moduleId: string, name: string, instance: string, title: string | null, breadcrumb: readonly string[] | null, breadcrumbIcon: string | null = null): PendingDocument {
    return this.isFor(moduleId, name, instance) ? new PendingDocument(this.moduleId, this.name, this.instance, this.heading.with(title, breadcrumb, breadcrumbIcon), this.isPreview, this.after, this.isEarly) : this;
  }

  public isFor(moduleId: string, name: string, instance: string): boolean {
    return this.moduleId === moduleId && this.name === name && this.instance === instance;
  }
}

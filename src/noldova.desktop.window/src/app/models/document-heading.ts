/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";
import { ProductName } from "./product-name.js";

export class DocumentHeading {
  public readonly title: string;
  public readonly breadcrumb: readonly string[];
  public readonly icon: string | null;

  public constructor(title: string, breadcrumb: readonly string[] = [], icon: string | null = null) {
    this.title = DocumentHeading.requireTitle(title);
    this.breadcrumb = DocumentHeading.requireBreadcrumb(breadcrumb);
    this.icon = DocumentHeading.requireIcon(icon);
  }

  public static requireTitle(title: string): string {
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);
    return title;
  }

  public static requireBreadcrumb(breadcrumb: readonly string[]): readonly string[] {
    if (breadcrumb.some(t => String.isNullOrWhitespace(t)))
      throw new ArgumentException(Resources.invalidBreadcrumb, Resources.breadcrumbParameter);
    return [...breadcrumb];
  }

  public static requireIcon(icon: string | null): string | null {
    if (!Object.isNull(icon))
      ArgumentException.throwIfNullOrWhitespace(icon, Resources.breadcrumbIconParameter);
    return icon;
  }

  public static requireUpdateIcon(icon: string | null, breadcrumb: readonly string[] | null): string | null {
    if (!Object.isNull(icon) && Object.isNull(breadcrumb))
      throw new ArgumentException(Resources.breadcrumbIconWithoutBreadcrumb, Resources.breadcrumbIconParameter);
    return DocumentHeading.requireIcon(icon);
  }

  public get text(): string {
    return [...this.breadcrumb, this.title].join(Resources.breadcrumbSeparator);
  }

  public get windowTitle(): string {
    return Resources.formatWindowTitle(ProductName.current, this.title);
  }

  public with(title: string | null, breadcrumb: readonly string[] | null, icon: string | null = null): DocumentHeading {
    return Object.isNull(breadcrumb) ? new DocumentHeading(title ?? this.title, this.breadcrumb, this.icon) : new DocumentHeading(title ?? this.title, breadcrumb, icon);
  }
}

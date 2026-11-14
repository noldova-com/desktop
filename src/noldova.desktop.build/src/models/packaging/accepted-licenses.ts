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

export class AcceptedLicenses {
  private readonly licenses: ReadonlyMap<string, string>;

  public constructor(licenses: ReadonlyMap<string, string> = new Map()) {
    this.licenses = licenses;
  }

  public static async readAsync(root: string): Promise<AcceptedLicenses> {
    return new AcceptedLicenses(await PackagingSection.readAsync(root, Resources.acceptedLicensesField, Resources.acceptedLicensesShape, t => {
      t.readNonBlankString(Resources.packagingReasonField);
      return t.readNonBlankString(Resources.licenseField);
    }));
  }

  public of(id: string): string | null {
    return this.licenses.get(id) ?? null;
  }

  public get ids(): readonly string[] {
    return [...this.licenses.keys()];
  }

  public listOtherVersions(id: string): readonly string[] {
    const name = AcceptedLicenses.nameOf(id);
    return this.ids.filter(t => t !== id && AcceptedLicenses.nameOf(t) === name);
  }

  private static nameOf(id: string): string {
    return id.slice(0, id.lastIndexOf(Resources.packageVersionSeparator));
  }
}

/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.ts";

export class DependencyPinCheckResources {
  public static readonly title: string = "Dependency pins";
  public static readonly lockfile: string = "package-lock.json";
  public static readonly npmConfiguration: string = ".npmrc";
  public static readonly saveExact: string = "save-exact=true";
  public static readonly sections: readonly string[] = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "overrides"];
  public static readonly overridesSection: string = "overrides";
  public static readonly overrideSelf: string = ".";
  public static readonly ownVersion: string = "__VERSION__";
  public static readonly exactVersion: RegExp = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
  public static readonly shippedSection: string = "dependencies";
  public static readonly toolSection: string = "devDependencies";
  public static readonly binField: string = "bin";
  public static readonly peerSection: string = "peerDependencies";
  public static readonly windowAppFolder: string = "src/noldova.desktop.window.app";
  public static readonly lockedFolder: string = "node_modules/";
  public static readonly pinSections: readonly string[] = ["dependencies", "devDependencies"];
  public static readonly versionField: string = "version";
  public static readonly lockedPackagesField: string = "packages";
  public static readonly noPin: string = "none";
  public static readonly noLockedVersion: string = "no version";
  public static readonly rootSource: string = "packaging ships it from the root lockfile.";

  public static formatChecked(manifests: number, lockfiles: number): string {
    return `Checked the dependency versions of ${manifests} manifests and the npm configuration of ${lockfiles} lockfiles.${Resources.lineEnd}`;
  }

  public static formatUnreadable(file: string, error: unknown): string {
    return `${file}: could not be read as a JSON object: ${String(error)}`;
  }

  public static formatNotRecord(file: string, section: string): string {
    return `${file}: ${section} is not an object of names and versions.`;
  }

  public static formatPeerForm(file: string, name: string, value: string, rangeForm: string): string {
    return `${file}: ${DependencyPinCheckResources.peerSection} ${name} is "${value}"; a peer on context's packages or the kit takes a range of the form ${rangeForm}, `
      + "ending at the next version that may break it, never an exact version or another form.";
  }

  public static formatPeerPin(file: string, name: string, value: string, pin: string | undefined): string {
    return `${file}: ${DependencyPinCheckResources.peerSection} ${name} is "${value}", but the version of it Noldova Desktop installs, `
      + `builds and tests with is ${pin ?? DependencyPinCheckResources.noPin}; the range must hold that version, its lowest at or below it.`;
  }

  public static formatNoVersion(file: string, location: string, name: string): string {
    return `${file}: ${location} ${name} has no version string.`;
  }

  public static formatOwnPeer(file: string, name: string, value: string, range: string): string {
    return `${file}: ${DependencyPinCheckResources.peerSection} ${name} is "${value}"; Noldova's own packages take a peer at "${range}", which the build stamps.`;
  }

  public static formatOwnVersion(file: string, location: string, name: string, value: string): string {
    return `${file}: ${location} ${name} is "${value}"; Noldova's own packages take "${DependencyPinCheckResources.ownVersion}", which the build stamps.`;
  }

  public static formatNotExact(file: string, location: string, name: string, value: string): string {
    return `${file}: ${location} ${name} is "${value}", which is not an exact version; an external dependency takes an exact version from the registry, such as 1.2.3, never a range, tag, alias, path, Git or URL source.`;
  }

  public static formatRootFile(file: string): string {
    return `the root ${file}`;
  }

  public static formatWindowSource(folder: string, lockfile: string): string {
    return `the window app in ${folder}/ installs it from the root ${lockfile}.`;
  }

  public static formatUnpinnedShipped(file: string, name: string, version: string, pinning: string, source: string): string {
    return `${file}: dependencies ${name} is "${version}", so ${pinning} must pin it to the same version in its dependencies; ${source}`;
  }

  public static formatUnpinnedTool(file: string, name: string, version: string, pinning: string): string {
    return `${file}: dependencies ${name} is "${version}", so ${pinning} must pin it to the same version in its devDependencies; the package's command line builds the app and never ships in it.`;
  }

  public static formatLockMismatch(file: string, name: string, version: string, locking: string, lockedVersion: JsonValue | undefined): string {
    return `${file}: dependencies ${name} is "${version}", but ${locking} locks `
      + `${Object.isString(lockedVersion) ? `version ${lockedVersion}` : DependencyPinCheckResources.noLockedVersion} of it; run npm install.`;
  }

  public static formatMissingConfiguration(file: string): string {
    return `${file}: is missing; a folder with a lockfile keeps "${DependencyPinCheckResources.saveExact}" there, so npm saves exact versions.`;
  }

  public static formatMissingSaveExact(file: string): string {
    return `${file}: lacks the line "${DependencyPinCheckResources.saveExact}", which makes npm save exact versions.`;
  }
}

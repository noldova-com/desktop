/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { ReleaseRequest } from "../../models/release/release-request.ts";
import type { SourceArchive } from "../../models/packaging/source-archive.ts";
import { Resources } from "../../resources.ts";

export class ReleaseNotes {
  public static compose(product: ProductIdentity, targets: readonly PackageTarget[], supported: readonly PackageTarget[], signed: readonly string[], request: ReleaseRequest,
    runUrl: string, unstarted: readonly PackageTarget[], sources: readonly SourceArchive[]): string {
    if (!URL.canParse(runUrl) || new URL(runUrl).protocol !== Resources.secureProtocol)
      throw new BuildException(Resources.formatReleaseRunInvalid(runUrl));
    const name = product.name;
    const ciOnly = targets.filter(t => !supported.some(u => u.id === t.id));
    const paragraphs = [Resources.formatReleaseSummary(name, request.version.text, ReleaseNotes.formatTargets(targets), ReleaseNotes.describeSigning(signed))];
    if (supported.length === 0)
      paragraphs.push(Resources.releaseNoneSupported);
    else if (ciOnly.length > 0)
      paragraphs.push(Resources.formatReleaseCiOnly(ReleaseNotes.formatTargets(ciOnly)));
    if (!request.isBuiltApart)
      paragraphs.push(unstarted.length === 0 ? Resources.formatReleaseRunCheck(runUrl) : Resources.formatReleaseRunCheckExcept(runUrl, ReleaseNotes.formatTargets(unstarted)));
    if (request.isSeparate)
      paragraphs.push(Resources.formatReleaseSource(request.sourceRepository, request.revision));
    if (sources.length > 0)
      paragraphs.push(Resources.formatReleaseSourceArchives(sources.map(t => Resources.formatReleaseSourceArchive(t.fileName, t.url, t.sha256))));
    if (!product.isReleaseRepository(request.repository))
      paragraphs.unshift(Resources.formatUnsignedTestRelease(name, request.repository));
    return paragraphs.join(Resources.paragraphSeparator);
  }

  private static describeSigning(signed: readonly string[]): string {
    const platforms = [...Resources.releasePlatformNames.keys()];
    const unsigned = platforms.filter(t => !signed.includes(t));
    if (unsigned.length === 0)
      return Resources.releasePackagesSigned;
    if (unsigned.length === platforms.length)
      return Resources.releasePackagesUnsigned;
    return Resources.formatReleasePartlySigned(ReleaseNotes.namePlatforms(platforms.filter(t => signed.includes(t))), ReleaseNotes.namePlatforms(unsigned));
  }

  private static namePlatforms(platforms: readonly string[]): readonly (string | undefined)[] {
    return platforms.map(t => Resources.releasePlatformNames.get(t));
  }

  private static formatTargets(targets: readonly PackageTarget[]): string {
    const names = targets.map(t => Resources.formatReleaseTargetName(Resources.releasePlatformNames.get(t.platform), Resources.releaseArchitectureNames.get(t.architecture)));
    return Resources.formatReleaseTargetNames(names);
  }
}

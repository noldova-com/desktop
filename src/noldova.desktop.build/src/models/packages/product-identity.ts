/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../exceptions/build.exception.ts";
import { UpdateFeed } from "../../services/packages/update-feed.ts";
import { ProductAbout } from "./product-about.ts";
import { ProductCategories } from "./product-categories.ts";
import { ProductDeviceFolders } from "./product-device-folders.ts";
import { ProductTitleBar } from "./product-title-bar.ts";
import { Resources } from "../../resources.ts";

export class ProductIdentity {
  public readonly name: string;
  public readonly publisher: string;
  public readonly slug: string;
  public readonly applicationId: string;
  public readonly developmentApplicationId: string;
  public readonly dataFolder: string;
  public readonly windowsDeviceFolder: string;
  public readonly macosDeviceFolder: string;
  public readonly linuxDeviceFolder: string;
  public readonly dataDirectoryVariable: string;
  public readonly icons: string;
  public readonly releaseRepository: string;
  public readonly macCategory: string;
  public readonly linuxCategory: string;
  public readonly windowsSigning: Readonly<Record<string, unknown>> | null;
  public readonly permissionsModule: string | null;
  public readonly about: ProductAbout;
  public readonly namedUpdateFeed: string | null;
  public readonly installFolder: string | null;
  public readonly titleBarName: string | null;
  public readonly titleBarIcon: string | null;
  public readonly isTitleBarDocumentTabs: boolean;

  public constructor(
    name: string,
    publisher: string,
    slug: string,
    applicationId: string,
    developmentApplicationId: string,
    dataFolder: string,
    deviceFolders: ProductDeviceFolders,
    dataDirectoryVariable: string,
    icons: string,
    releaseRepository: string,
    categories: ProductCategories = ProductCategories.DEFAULT,
    windowsSigning: Readonly<Record<string, unknown>> | null = null,
    permissionsModule: string | null = null,
    about: ProductAbout = ProductAbout.NONE,
    namedUpdateFeed: string | null = null,
    installFolder: string | null = null,
    titleBar: ProductTitleBar = ProductTitleBar.NONE) {
    const titleBarName = titleBar.name;
    const titleBarIcon = titleBar.icon;
    ProductIdentity.require(name.trim().length > 0 && !Resources.productUnsafeNamePattern.test(name), Resources.productNameField, Resources.productNameExpected);
    ProductIdentity.require(publisher.trim().length > 0 && !Resources.productUnsafePublisherPattern.test(publisher), Resources.productPublisherField, Resources.productPublisherExpected);
    ProductIdentity.require(Resources.productSlugPattern.test(slug), Resources.productSlugField, Resources.productSlugExpected);
    ProductIdentity.require(Resources.productApplicationIdPattern.test(applicationId), Resources.productApplicationIdField, Resources.productApplicationIdExpected);
    ProductIdentity.require(Resources.productApplicationIdPattern.test(developmentApplicationId) && developmentApplicationId !== applicationId,
      Resources.productDevelopmentApplicationIdField, Resources.productDevelopmentApplicationIdExpected);
    ProductIdentity.requireRelativeFolder(dataFolder, Resources.productDataFolderField);
    ProductIdentity.requireRelativeFolder(deviceFolders.windows, Resources.productWindowsDeviceFolderPath);
    ProductIdentity.requireRelativeFolder(deviceFolders.macos, Resources.productMacosDeviceFolderPath);
    ProductIdentity.requireRelativeFolder(deviceFolders.linux, Resources.productLinuxDeviceFolderPath);
    ProductIdentity.requireRelativeFolder(icons, Resources.productIconsField);
    ProductIdentity.require(Resources.productVariablePattern.test(dataDirectoryVariable), Resources.productDataDirectoryVariableField, Resources.productVariableExpected);
    ProductIdentity.require(Resources.productRepositoryPattern.test(releaseRepository), Resources.productReleaseRepositoryField, Resources.productRepositoryExpected);
    ProductIdentity.require(Resources.productMacCategoryPattern.test(categories.macos), Resources.productMacCategoryPath, Resources.productMacCategoryExpected);
    ProductIdentity.require(Resources.productLinuxCategoryPattern.test(categories.linux), Resources.productLinuxCategoryPath, Resources.productLinuxCategoryExpected);
    ProductIdentity.require(Object.isNull(about.description) || (about.description.trim().length > 0 && !Resources.productLineBreakPattern.test(about.description)),
      Resources.productDescriptionPath, Resources.productDescriptionExpected);
    ProductIdentity.requireSecureAddress(about.website, Resources.productWebsitePath);
    ProductIdentity.requireSecureAddress(about.releases, Resources.productReleasesPath);
    ProductIdentity.require(Object.isNull(about.licenses) || about.licenses.trim().length > 0, Resources.productLicensesPath, Resources.productLicensesExpected);
    ProductIdentity.require(Object.isNull(namedUpdateFeed) || UpdateFeed.isNamed(namedUpdateFeed), Resources.productUpdateFeedField, Resources.productUpdateFeedExpected);
    ProductIdentity.require(Object.isNull(installFolder) || Resources.productInstallFolderPattern.test(installFolder), Resources.productInstallFolderField,
      Resources.productInstallFolderExpected);
    ProductIdentity.require(Object.isNull(titleBarName) || (titleBarName.trim().length > 0 && !Resources.productLineBreakPattern.test(titleBarName)),
      Resources.productTitleBarNameField, Resources.productTitleBarNameExpected);
    ProductIdentity.require(Object.isNull(titleBarIcon) || ProductIdentity.isTitleBarIcon(titleBarIcon), Resources.productTitleBarIconField, Resources.productTitleBarIconExpected);

    this.name = name;
    this.publisher = publisher;
    this.slug = slug;
    this.applicationId = applicationId;
    this.developmentApplicationId = developmentApplicationId;
    this.dataFolder = dataFolder;
    this.windowsDeviceFolder = deviceFolders.windows;
    this.macosDeviceFolder = deviceFolders.macos;
    this.linuxDeviceFolder = deviceFolders.linux;
    this.dataDirectoryVariable = dataDirectoryVariable;
    this.icons = icons;
    this.releaseRepository = releaseRepository;
    this.macCategory = categories.macos;
    this.linuxCategory = categories.linux;
    this.windowsSigning = windowsSigning;
    this.permissionsModule = permissionsModule;
    this.about = about;
    this.namedUpdateFeed = namedUpdateFeed;
    this.installFolder = installFolder;
    this.titleBarName = titleBarName;
    this.titleBarIcon = titleBarIcon;
    this.isTitleBarDocumentTabs = titleBar.isDocumentTabs;
  }

  public static async readAsync(root: string): Promise<ProductIdentity> {
    let manifest: JsonReader;
    try {
      manifest = JsonReader.parse(await readFile(path.join(root, Resources.packageManifestFileName), Resources.textEncoding));
    }
    catch (error) {
      throw new BuildException(Resources.productMissing, new ExceptionOptions(error));
    }
    return ProductIdentity.fromManifest(manifest);
  }

  public static fromManifest(manifest: JsonReader): ProductIdentity {
    const product = ProductIdentity.readRecord(ProductIdentity.readRecord(manifest, Resources.manifestDesktopField), Resources.productField);
    if (Object.isNull(product))
      throw new BuildException(Resources.productMissing);
    if (product.hasField(Resources.productWindowsPublisherField))
      throw new BuildException(Resources.productWindowsPublisherRemoved);
    const folders = ProductIdentity.readRecord(product, Resources.productDeviceFoldersField);
    const categories = ProductIdentity.readRecord(product, Resources.productCategoriesField);
    const about = ProductIdentity.readRecord(product, Resources.productAboutField);
    ProductIdentity.require(!product.hasField(Resources.productAboutField) || !Object.isNull(about), Resources.productAboutField, Resources.productAboutExpected);
    const permissionsModule = product.hasField(Resources.productPermissionsModuleField) ? product.readValue(Resources.productPermissionsModuleField) : null;
    return new ProductIdentity(
      ProductIdentity.readText(product, Resources.productNameField),
      ProductIdentity.readText(product, Resources.productPublisherField),
      ProductIdentity.readText(product, Resources.productSlugField),
      ProductIdentity.readText(product, Resources.productApplicationIdField),
      ProductIdentity.readText(product, Resources.productDevelopmentApplicationIdField),
      ProductIdentity.readText(product, Resources.productDataFolderField),
      new ProductDeviceFolders(ProductIdentity.readText(folders, Resources.windowsTarget), ProductIdentity.readText(folders, Resources.macosTarget),
        ProductIdentity.readText(folders, Resources.linuxTarget)),
      ProductIdentity.readText(product, Resources.productDataDirectoryVariableField),
      ProductIdentity.readText(product, Resources.productIconsField),
      ProductIdentity.readText(product, Resources.productReleaseRepositoryField),
      new ProductCategories(ProductIdentity.readText(categories, Resources.macosTarget, Resources.productDefaultMacCategory),
        ProductIdentity.readText(categories, Resources.linuxTarget, Resources.productDefaultLinuxCategory)),
      ProductIdentity.readRecord(product, Resources.productWindowsSigningField)?.toJson() ?? null,
      Object.isString(permissionsModule) ? permissionsModule : null,
      new ProductAbout(ProductIdentity.readOptionalText(about, Resources.productDescriptionField), ProductIdentity.readOptionalText(about, Resources.productWebsiteField),
        ProductIdentity.readOptionalText(about, Resources.productReleasesField), ProductIdentity.readOptionalText(about, Resources.productLicensesField)),
      ProductIdentity.readOptionalText(product, Resources.productUpdateFeedField),
      ProductIdentity.readOptionalText(product, Resources.productInstallFolderField),
      new ProductTitleBar(ProductIdentity.readOptionalText(product, Resources.productTitleBarNameField), ProductIdentity.readOptionalText(product, Resources.productTitleBarIconField),
        ProductIdentity.readFlag(product, Resources.productTitleBarDocumentTabsField, Resources.productTitleBarDocumentTabsExpected)));
  }

  public get updateFeed(): string {
    return this.namedUpdateFeed ?? UpdateFeed.ofRepository(this.releaseRepository);
  }

  public get checkoutVariable(): string {
    return `${this.slug.toUpperCase().replaceAll(Resources.kebabSeparator, Resources.snakeSeparator)}${Resources.checkoutVariableSuffix}`;
  }

  public isReleaseRepository(repository: string): boolean {
    return repository.toLowerCase() === this.releaseRepository.toLowerCase();
  }

  public formatDevelopmentApplicationId(checkout: string): string {
    const hash = createHash(Resources.hashAlgorithm).update(realpathSync(checkout)).digest(Resources.hashEncoding).slice(0, Resources.checkoutHashLength);
    return Resources.formatCheckoutApplicationId(this.developmentApplicationId, hash);
  }

  private static isRelativeFolder(folder: string): boolean {
    return folder.split(Resources.pathSegmentSeparator).every(t => t.length > 0 && t !== Resources.currentFolderSegment && t !== Resources.parentFolderSegment
      && !Resources.productUnsafeSegmentPattern.test(t));
  }

  private static requireRelativeFolder(folder: string, field: string): void {
    ProductIdentity.require(ProductIdentity.isRelativeFolder(folder), field, Resources.productFolderExpected);
  }

  private static requireSecureAddress(address: string | null, field: string): void {
    ProductIdentity.require(Object.isNull(address) || ProductIdentity.isSecureAddress(address), field, Resources.productAddressExpected);
  }

  private static isTitleBarIcon(icon: string): boolean {
    return Resources.productTitleBarIconDataPattern.test(icon) || (ProductIdentity.isRelativeFolder(icon) && Resources.productTitleBarIconFilePattern.test(icon));
  }

  private static isSecureAddress(address: string): boolean {
    return URL.canParse(address) && new URL(address).protocol === Resources.secureProtocol && !Resources.productWhitespacePattern.test(address);
  }

  private static readRecord(value: JsonReader | null, field: string): JsonReader | null {
    if (Object.isNull(value) || !value.hasField(field))
      return null;
    const child = value.readValue(field);
    return Object.isPlainObject(child) ? value.readObject(field) : null;
  }

  private static readText(record: JsonReader | null, field: string, fallback: string = String.empty): string {
    return ProductIdentity.readOptionalText(record, field) ?? fallback;
  }

  private static readOptionalText(record: JsonReader | null, field: string): string | null {
    if (Object.isNull(record) || !record.hasField(field))
      return null;
    const value = record.readValue(field);
    return Object.isString(value) ? value : String.empty;
  }

  private static readFlag(record: JsonReader, field: string, expected: string): boolean {
    if (!record.hasField(field))
      return false;
    const value = record.readValue(field);
    ProductIdentity.require(Object.isBoolean(value), field, expected);
    return value === true;
  }

  private static require(isValid: boolean, field: string, expected: string): void {
    if (!isValid)
      throw new BuildException(Resources.formatProductFieldInvalid(field, expected));
  }
}

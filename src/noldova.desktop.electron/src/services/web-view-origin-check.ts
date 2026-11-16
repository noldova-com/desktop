/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isIP } from "node:net";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { WebAddressKind } from "../enums/web-address-kind.js";
import { Resources } from "../resources.js";
import { WebViewOriginCheckResources } from "./web-view-origin-check.resources.js";

export class WebViewOriginCheck {
  private readonly localOrigins: ReadonlySet<string>;
  private readonly readNeverAllowedPorts: () => ReadonlySet<number> | null;

  public constructor(localOrigins: readonly string[] = [], neverAllowedPorts: readonly number[] | (() => ReadonlySet<number> | null) = []) {
    this.localOrigins = new Set(localOrigins);
    if (Object.isFunction(neverAllowedPorts))
      this.readNeverAllowedPorts = neverAllowedPorts;
    else {
      const ports = new Set(neverAllowedPorts);
      this.readNeverAllowedPorts = () => ports;
    }
  }

  public static classify(address: string): WebAddressKind {
    const plain = WebViewOriginCheck.plainHost(address);
    if (isIP(plain) === WebViewOriginCheckResources.ipv4Version)
      return WebViewOriginCheck.classifyIpv4(plain);
    if (isIP(plain) !== WebViewOriginCheckResources.ipv6Version)
      throw new ArgumentException(Resources.formatNotAnAddress(address), Resources.addressParameter);

    const hextets = WebViewOriginCheck.expandIpv6(plain);
    const at = (index: number): number => Number(hextets[index]);
    const isZero = (from: number, to: number): boolean => hextets.slice(from, to).every(t => t === 0);
    const last = Resources.webViewHextets - 1;
    if (isZero(0, Resources.webViewHextets))
      return WebAddressKind.Unspecified;
    if (isZero(0, last) && at(last) === 1)
      return WebAddressKind.Loopback;
    const isMapped = isZero(0, WebViewOriginCheckResources.mappedMarkerHextet) && at(WebViewOriginCheckResources.mappedMarkerHextet) === WebViewOriginCheckResources.mappedIpv4Marker;
    const isNat64 = at(0) === WebViewOriginCheckResources.nat64First && at(1) === WebViewOriginCheckResources.nat64Second && isZero(WebViewOriginCheckResources.nat64PrefixHextets, WebViewOriginCheckResources.embeddedIpv4Hextet);
    if (isMapped || isZero(0, WebViewOriginCheckResources.embeddedIpv4Hextet) || isNat64)
      return WebViewOriginCheck.classifyIpv4(WebViewOriginCheckResources.formatIpv4(at(WebViewOriginCheckResources.embeddedIpv4Hextet) >> WebViewOriginCheckResources.byteBits, at(WebViewOriginCheckResources.embeddedIpv4Hextet) & WebViewOriginCheckResources.byteMask,
        at(last) >> WebViewOriginCheckResources.byteBits, at(last) & WebViewOriginCheckResources.byteMask));
    if ((at(0) & WebViewOriginCheckResources.uniqueLocalMask) === WebViewOriginCheckResources.uniqueLocalPrefix)
      return WebAddressKind.Private;
    if ((at(0) & WebViewOriginCheckResources.linkLocalMask) === WebViewOriginCheckResources.linkLocalPrefix)
      return WebAddressKind.LinkLocal;
    return WebAddressKind.Public;
  }

  public static isEntry(text: string): boolean {
    if (text.length > Resources.webViewAddressLimit)
      return false;
    const isWildcard = text.includes(`${Resources.webViewOriginSeparator}${Resources.webViewWildcardPrefix}`);
    const url = URL.parse(isWildcard ? text.replace(Resources.webViewWildcardPrefix, String.empty) : text);
    if (Object.isNull(url) || !Resources.webViewSchemes.includes(url.protocol))
      return false;
    const origin = isWildcard ? url.origin.replace(Resources.webViewOriginSeparator, `${Resources.webViewOriginSeparator}${Resources.webViewWildcardPrefix}`) : url.origin;
    return origin === text && (!isWildcard || isIP(WebViewOriginCheck.plainHost(url.hostname)) === 0);
  }

  public allowsRequest(url: string, allowed: readonly string[]): boolean {
    const parsed = url.length > Resources.webViewAddressLimit ? null : URL.parse(url);
    if (Object.isNull(parsed))
      return false;
    if (Resources.webViewSubresourceSchemes.includes(parsed.protocol))
      return true;
    const socketScheme = Resources.webViewSocketSchemes.get(parsed.protocol);
    if (!Resources.webViewSchemes.includes(parsed.protocol) && Object.isUndefined(socketScheme))
      return false;
    if (parsed.username.length > 0 || parsed.password.length > 0)
      return false;
    const host = WebViewOriginCheck.plainHost(parsed.hostname);
    const kind = isIP(host) !== 0 ? WebViewOriginCheck.classify(host) : WebViewOriginCheck.isLoopbackName(host) ? WebAddressKind.Loopback : WebAddressKind.Public;
    if (kind === WebAddressKind.LinkLocal || kind === WebAddressKind.Unspecified)
      return false;
    if (kind === WebAddressKind.Loopback && this.isNeverAllowed(parsed))
      return false;
    const origin = Object.isUndefined(socketScheme) ? parsed.origin : `${socketScheme}${Resources.webViewOriginSeparator}${parsed.host}`;
    if (kind === WebAddressKind.Loopback || kind === WebAddressKind.Private)
      return allowed.includes(origin);
    return Object.isUndefined(socketScheme) || WebViewOriginCheck.matches(origin, allowed);
  }

  public allowsNavigation(url: string, allowed: readonly string[], isFrame: boolean): boolean {
    if (url === Resources.blankPage || (isFrame && url === Resources.sourceDocument))
      return true;
    const parsed = URL.parse(url);
    if (Object.isNull(parsed) || !Resources.webViewSchemes.includes(parsed.protocol))
      return false;
    return this.allowsRequest(url, allowed) && WebViewOriginCheck.matches(parsed.origin, allowed);
  }

  public allowsConnection(url: string, allowed: readonly string[], address: string | null): boolean {
    const parsed = URL.parse(url);
    if (Object.isNull(parsed) || Object.isNull(address) || isIP(WebViewOriginCheck.plainHost(address)) === 0)
      return false;
    const kind = WebViewOriginCheck.classify(address);
    if (kind === WebAddressKind.Public)
      return true;
    if (kind === WebAddressKind.LinkLocal || kind === WebAddressKind.Unspecified || (kind === WebAddressKind.Loopback && this.isNeverAllowed(parsed)))
      return false;
    const host = WebViewOriginCheck.plainHost(parsed.hostname);
    const isLocalHost = isIP(host) !== 0 || WebViewOriginCheck.isLoopbackName(host) || this.localOrigins.has(parsed.origin);
    return isLocalHost && allowed.includes(parsed.origin);
  }

  private isNeverAllowed(url: URL): boolean {
    return this.readNeverAllowedPorts()?.has(WebViewOriginCheck.readPort(url)) ?? true;
  }

  private static matches(origin: string, allowed: readonly string[]): boolean {
    if (allowed.includes(origin))
      return true;
    const url = new URL(origin);
    const prefix = `${url.protocol}${Resources.webViewOriginSeparator}${Resources.webViewWildcardPrefix}`;
    return isIP(WebViewOriginCheck.plainHost(url.hostname)) === 0 && allowed.some(t => {
      if (!t.startsWith(prefix))
        return false;
      const pattern = URL.parse(t.replace(Resources.webViewWildcardPrefix, String.empty));
      return !Object.isNull(pattern) && pattern.port === url.port && url.hostname.endsWith(WebViewOriginCheckResources.formatSubdomainSuffix(pattern.hostname));
    });
  }

  private static readPort(url: URL): number {
    if (url.port.length > 0)
      return Number(url.port);
    return Number(Resources.webViewDefaultPorts.get(url.protocol));
  }

  private static classifyIpv4(address: string): WebAddressKind {
    const [a = 0, b = 0] = address.split(WebViewOriginCheckResources.ipv4Separator).map(Number);
    if (a === 0)
      return WebAddressKind.Unspecified;
    if (a === WebViewOriginCheckResources.loopbackFirst)
      return WebAddressKind.Loopback;
    if (a === WebViewOriginCheckResources.privateClassAFirst || (a === WebViewOriginCheckResources.privateClassBFirst && b >= WebViewOriginCheckResources.privateClassBSecondLow && b <= WebViewOriginCheckResources.privateClassBSecondHigh)
      || (a === WebViewOriginCheckResources.privateClassCFirst && b === WebViewOriginCheckResources.privateClassCSecond) || (a === WebViewOriginCheckResources.sharedAddressFirst && b >= WebViewOriginCheckResources.sharedAddressSecondLow && b <= WebViewOriginCheckResources.sharedAddressSecondHigh))
      return WebAddressKind.Private;
    if (a === WebViewOriginCheckResources.linkLocalFirst && b === WebViewOriginCheckResources.linkLocalSecond)
      return WebAddressKind.LinkLocal;
    return WebAddressKind.Public;
  }

  private static expandIpv6(address: string): readonly number[] {
    const parse = (part: string): number[] => part === String.empty
      ? []
      : part.split(WebViewOriginCheckResources.ipv6Separator).flatMap(t => {
        if (!t.includes(WebViewOriginCheckResources.ipv4Separator))
          return [Number.parseInt(t, WebViewOriginCheckResources.hextetRadix)];
        const [a = 0, b = 0, c = 0, d = 0] = t.split(WebViewOriginCheckResources.ipv4Separator).map(Number);
        return [(a << WebViewOriginCheckResources.byteBits) | b, (c << WebViewOriginCheckResources.byteBits) | d];
      });
    const [head = String.empty, tail] = address.split(WebViewOriginCheckResources.ipv6ZeroRun);
    const first = parse(head);
    const last = Object.isUndefined(tail) ? [] : parse(tail);
    return [...first, ...new Array<number>(Resources.webViewHextets - first.length - last.length).fill(0), ...last];
  }

  private static plainHost(host: string): string {
    const [plain = String.empty] = host.toLowerCase().replace(Resources.webViewBracketsPattern, String.empty).replace(Resources.webViewTrailingDotPattern, String.empty).split(Resources.webViewZoneSeparator);
    return plain;
  }

  private static isLoopbackName(host: string): boolean {
    return host === Resources.webViewLoopbackName || host.endsWith(Resources.webViewLoopbackSuffix);
  }
}

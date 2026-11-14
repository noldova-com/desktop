/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WebViewOriginCheckResources {
  public static readonly ipv4Version: number = 4;
  public static readonly ipv6Version: number = 6;
  public static readonly ipv4Separator: string = ".";
  public static readonly ipv6Separator: string = ":";
  public static readonly ipv6ZeroRun: string = "::";
  public static readonly hextetRadix: number = 16;
  public static readonly mappedMarkerHextet: number = 5;
  public static readonly mappedIpv4Marker: number = 0xffff;
  public static readonly embeddedIpv4Hextet: number = 6;
  public static readonly nat64PrefixHextets: number = 2;
  public static readonly byteBits: number = 8;
  public static readonly byteMask: number = 0xff;
  public static readonly nat64First: number = 0x64;
  public static readonly nat64Second: number = 0xff9b;
  public static readonly uniqueLocalMask: number = 0xfe00;
  public static readonly uniqueLocalPrefix: number = 0xfc00;
  public static readonly linkLocalMask: number = 0xffc0;
  public static readonly linkLocalPrefix: number = 0xfe80;
  public static readonly loopbackFirst: number = 127;
  public static readonly privateClassAFirst: number = 10;
  public static readonly privateClassBFirst: number = 172;
  public static readonly privateClassBSecondLow: number = 16;
  public static readonly privateClassBSecondHigh: number = 31;
  public static readonly privateClassCFirst: number = 192;
  public static readonly privateClassCSecond: number = 168;
  public static readonly sharedAddressFirst: number = 100;
  public static readonly sharedAddressSecondLow: number = 64;
  public static readonly sharedAddressSecondHigh: number = 127;
  public static readonly linkLocalFirst: number = 169;
  public static readonly linkLocalSecond: number = 254;

  public static formatIpv4(first: number, second: number, third: number, fourth: number): string {
    return `${first}.${second}.${third}.${fourth}`;
  }

  public static formatSubdomainSuffix(hostname: string): string {
    return `.${hostname}`;
  }
}

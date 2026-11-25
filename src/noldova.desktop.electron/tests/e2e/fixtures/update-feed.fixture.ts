/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { once } from "node:events";
import path from "node:path";

import "@noldova/context.core";
import type { FeedSource } from "@noldova/desktop.electron";
import { ProductInfo } from "@noldova/desktop.runtime";

import { FeedHostMissingException } from "../exceptions/feed-host-missing.exception.ts";
import { FeedNotWrittenException } from "../exceptions/feed-not-written.exception.ts";
import { UpdatePackageUndefinedException } from "../exceptions/update-package-undefined.exception.ts";
import { installedElectron } from "./installed-electron.fixture.ts";

export class UpdateFeedFixture {
  public static readonly VARIANT: string = "update-feed";

  private static readonly HOST: string = "127.0.0.1";
  private static readonly RELEASE_DATE: string = "2026-10-06T00:00:00.000Z";
  private static readonly COOKIE: string = "feed-visit=1; Path=/; Max-Age=3600";

  public readonly folder: string;
  public readonly url: string;
  public readonly requests: readonly string[];
  public readonly headers: readonly IncomingHttpHeaders[];

  private readonly server: Server;

  private constructor(server: Server, folder: string, url: string, requests: readonly string[], headers: readonly IncomingHttpHeaders[]) {
    this.server = server;
    this.folder = folder;
    this.url = url;
    this.requests = requests;
    this.headers = headers;
  }

  public static get source(): FeedSource {
    const source = installedElectron.FeedSource.create(`http://${UpdateFeedFixture.HOST}/`, ProductInfo.current.name, process.platform, process.arch, () => Promise.reject(new Error("The fixture never fetches.")));
    if (Object.isNull(source))
      throw new UpdatePackageUndefinedException(process.platform, process.arch);
    return source;
  }

  public static sha512(contents: Buffer): string {
    return createHash("sha512").update(contents).digest("base64");
  }

  public static async startAsync(folder: string): Promise<UpdateFeedFixture> {
    const feed = ProductInfo.read(ProductInfo.file).updateFeed;
    if (Object.isNull(feed) || new URL(feed).hostname !== UpdateFeedFixture.HOST)
      throw new FeedHostMissingException(UpdateFeedFixture.HOST, UpdateFeedFixture.VARIANT);
    await mkdir(folder, { recursive: true });
    const requests: string[] = [];
    const headers: IncomingHttpHeaders[] = [];
    const server = createServer((request, response) => {
      const name = decodeURIComponent(new URL(request.url ?? "/", `http://${UpdateFeedFixture.HOST}`).pathname.slice(1));
      requests.push(name);
      headers.push({ ...request.headers });
      if (requests.length === 1)
        response.setHeader("Set-Cookie", UpdateFeedFixture.COOKIE);
      const file = path.join(folder, name);
      if (name.length === 0 || name.includes("/") || name.includes("\\")) {
        response.writeHead(404).end();
        return;
      }
      stat(file).then(found => {
        response.writeHead(200, { "Content-Length": found.size });
        createReadStream(file).pipe(response);
      }, () => response.writeHead(404).end());
    });
    server.listen(0, UpdateFeedFixture.HOST);
    await once(server, "listening");
    const feedFixture = new UpdateFeedFixture(server, folder, UpdateFeedFixture.urlOf(server), requests, headers);
    try {
      const product = await readFile(ProductInfo.file, "utf8");
      const named = product.replace(JSON.stringify(feed), JSON.stringify(feedFixture.url));
      if (named === product)
        throw new FeedNotWrittenException(feed);
      await writeFile(ProductInfo.file, named);
      return feedFixture;
    }
    catch (error) {
      await feedFixture.disposeAsync();
      throw error;
    }
  }

  public async publishAsync(version: string, contents: Buffer): Promise<string> {
    const source = UpdateFeedFixture.source;
    const sha512 = UpdateFeedFixture.sha512(contents);
    const file = source.formatReleasedFile(version);
    await writeFile(path.join(this.folder, file), contents);
    await writeFile(path.join(this.folder, source.channelFile), [
      `version: ${version}`,
      "files:",
      `  - url: ${file}`,
      `    sha512: ${sha512}`,
      `    size: ${contents.length}`,
      `path: ${file}`,
      `sha512: ${sha512}`,
      `releaseDate: '${UpdateFeedFixture.RELEASE_DATE}'`,
      String.empty
    ].join("\n"));
    return sha512;
  }

  public async disposeAsync(): Promise<void> {
    this.server.closeAllConnections();
    this.server.close();
    await once(this.server, "close");
  }

  private static urlOf(server: Server): string {
    const address = server.address();
    return Object.isNull(address) || Object.isString(address) ? String.empty : `http://${UpdateFeedFixture.HOST}:${address.port}/`;
  }
}

/**
 * DigitalOcean Spaces (S3-compatible) client.
 *
 * Workspace files live at /workspace/[client-slug]/... in the bucket. The worker
 * writes generated content here; the API reads it for the file browser and
 * generates presigned download URLs for the web client.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env.js";

const client = new S3Client({
  region: env.spaces.region,
  endpoint: env.spaces.endpoint,
  forcePathStyle: env.spaces.forcePathStyle,
  credentials: {
    accessKeyId: env.spaces.key,
    secretAccessKey: env.spaces.secret,
  },
});

const BUCKET = env.spaces.bucket;

/** Builds the canonical workspace key for a client file. */
export function workspaceKey(clientSlug: string, relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, "");
  return `workspace/${clientSlug}/${clean}`;
}

export async function putFile(
  key: string,
  body: string | Uint8Array | Buffer,
  contentType = "text/plain"
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getFileText(key: string): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = res.Body as { transformToString?: () => Promise<string> } | undefined;
  if (!body || typeof body.transformToString !== "function") return "";
  return body.transformToString();
}

export interface SpacesObject {
  key: string;
  size: number;
  lastModified: Date | undefined;
}

export async function listFiles(prefix: string): Promise<SpacesObject[]> {
  const res = await client.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (res.Contents ?? []).map((o) => ({
    key: o.Key ?? "",
    size: o.Size ?? 0,
    lastModified: o.LastModified,
  }));
}

export async function presignDownload(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function deleteFile(key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export { client as spacesClient, BUCKET as spacesBucket };

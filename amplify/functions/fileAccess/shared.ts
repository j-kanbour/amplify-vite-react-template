import type { AppSyncIdentityCognito } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { type Schema } from '../../data/resource';

export type FileAction = 'get' | 'put' | 'delete' | 'list';
export type OrgRole = 'admin' | 'tutor' | 'parent';
type Db = ReturnType<typeof generateClient<Schema>>;

// How long a presigned URL stays valid
const URL_TTL_SECONDS = 300;

// Built on first invoke, not at import time: see the note in
// amplify/auth/post-confirmation/handler.ts.
let dbPromise: Promise<Db> | undefined;

export const getDb = (env: Parameters<typeof getAmplifyDataClientConfig>[0]) => {
  dbPromise ??= (async () => {
    const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
    Amplify.configure(resourceConfig, libraryOptions);
    return generateClient<Schema>();
  })();
  return dbPromise;
};

export interface Caller {
  userId: string;
  // every org the caller belongs to, with their role in it
  orgRoles: Map<string, OrgRole>;
}

/** Looks up the signed-in caller's User record and the orgs they belong to. */
export async function getCaller(db: Db, identity: unknown): Promise<Caller> {
  const { sub, username } = (identity ?? {}) as Partial<AppSyncIdentityCognito>;
  if (!sub || !username) throw new Error('Unauthorized');

  const { data, errors } = await db.models.User.listUserByProfileOwner(
    { profileOwner: `${sub}::${username}` },
    { selectionSet: ['id', 'orgId', 'role', 'memberships.orgId', 'memberships.role'] }
  );
  if (errors) throw new Error(`Failed to look up user: ${JSON.stringify(errors)}`);
  const user = data[0];
  if (!user) throw new Error('Unauthorized');

  const orgRoles = new Map<string, OrgRole>();
  if (user.orgId && user.role) {
    orgRoles.set(user.orgId, user.role.toLowerCase() as OrgRole);
  }
  for (const m of user.memberships) {
    if (m.role) orgRoles.set(m.orgId, m.role);
  }
  return { userId: user.id, orgRoles };
}

/**
 * Splits an S3 key into its folders, rejecting anything that could escape the
 * folder it claims to be in. A trailing '/' (a folder, for 'list') is kept off
 * the segments.
 */
export function parsePath(path: string, action: FileAction): string[] {
  const isFolder = path.endsWith('/');
  const segments = (isFolder ? path.slice(0, -1) : path).split('/');
  if (segments.some((s) => !s || s === '.' || s === '..')) {
    throw new Error('Invalid path');
  }
  if ((action === 'list') !== isFolder) {
    throw new Error(action === 'list' ? 'List needs a folder path ending in /' : 'Path must be a file');
  }
  return segments;
}

// Otherwise the SDK puts the checksum of an empty body in presigned PUT URLs,
// and S3 rejects the browser's upload as not matching it
const s3 = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED' });

export interface ActionOptions {
  /** put: the only type and size (bytes) the URL accepts. */
  upload?: { contentType: string; size: number };
  /**
   * get: serve as a download, so opening the URL in a tab saves the file
   * rather than rendering it (an uploaded HTML or SVG file can't run there).
   * <img> and fetch() ignore this.
   */
  asAttachment?: boolean;
}

/**
 * Carries out an action the caller has already been authorised for. get and
 * put return a short-lived URL the browser uses directly; list and delete run
 * here.
 */
export async function runAction(bucket: string, path: string, action: FileAction, options: ActionOptions = {}) {
  switch (action) {
    case 'get':
      return {
        url: await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: bucket,
            Key: path,
            ResponseContentDisposition: options.asAttachment ? 'attachment' : undefined,
          }),
          { expiresIn: URL_TTL_SECONDS }
        ),
      };
    case 'put': {
      const { upload } = options;
      return {
        url: await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: bucket,
            Key: path,
            ContentType: upload?.contentType,
            ContentLength: upload?.size,
          }),
          {
            expiresIn: URL_TTL_SECONDS,
            // The presigner leaves content-type unsigned by default, which
            // would let the browser send any type. Signed, S3 rejects a PUT
            // whose type or length differs from what was checked.
            signableHeaders: upload ? new Set(['content-type', 'content-length']) : undefined,
          }
        ),
      };
    }
    case 'delete':
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
      return {};
    case 'list': {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const page = await s3.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: path, ContinuationToken: token })
        );
        keys.push(...(page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : [])));
        token = page.NextContinuationToken;
      } while (token);
      return { keys };
    }
  }
}

export const isRead = (action: FileAction) => action === 'get' || action === 'list';

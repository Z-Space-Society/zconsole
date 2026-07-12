/**
 * R2 presigned-URL helpers (S3 API via aws4fetch)
 *
 * Photos never transit the Worker: the browser PUTs straight to R2 with a
 * presigned URL, and displays images via presigned GET URLs. We sign against
 * the remote bucket named by R2_BUCKET_NAME, so dev and prod are consistent
 * (no R2 binding, which would point at local simulated storage in dev).
 */

import { AwsClient } from 'aws4fetch'
import type { Env } from './types'

// Presigned URLs are valid for 1 hour.
const EXPIRES_SECONDS = 3600

function client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: 'auto',
    service: 's3',
  })
}

function objectUrl(env: Env, key: string): string {
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
}

async function presign(env: Env, key: string, method: 'PUT' | 'GET'): Promise<string> {
  const url = `${objectUrl(env, key)}?X-Amz-Expires=${EXPIRES_SECONDS}`
  const signed = await client(env).sign(url, {
    method,
    aws: { signQuery: true },
  })
  return signed.url
}

/**
 * Presigned PUT URL. Content-Type is intentionally left unsigned so the URL can
 * be generated before the file (and its type) is known, and any image type works.
 */
export function presignPut(env: Env, key: string): Promise<string> {
  return presign(env, key, 'PUT')
}

/**
 * Presigned GET URL for displaying / downloading a stored photo.
 */
export function presignGet(env: Env, key: string): Promise<string> {
  return presign(env, key, 'GET')
}

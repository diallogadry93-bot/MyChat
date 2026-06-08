import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomBytes } from 'crypto'
import mime from 'mime-types'

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env['R2_ACCOUNT_ID'] ?? 'dev'}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env['R2_ACCESS_KEY_ID']     ?? 'dev',
    secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? 'dev',
  },
})

const BUCKET = process.env['R2_BUCKET_NAME'] ?? 'mychat-media'
const CDN    = process.env['R2_PUBLIC_URL']  ?? 'http://localhost:3001/media'

export type MediaFolder = 'avatars' | 'attachments' | 'voice' | 'thumbnails'

/**
 * Generate a presigned URL so the client can upload directly to R2
 * The server never touches the file bytes — bandwidth stays with Cloudflare
 */
export async function getUploadUrl(
  folder: MediaFolder,
  filename: string,
  contentType: string,
  expiresIn = 300, // 5 minutes
): Promise<{ uploadUrl: string; storageKey: string }> {
  const ext        = mime.extension(contentType) || 'bin'
  const uid        = randomBytes(12).toString('hex')
  const storageKey = `${folder}/${uid}.${ext}`

  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         storageKey,
    ContentType: contentType,
    Metadata:    { originalName: encodeURIComponent(filename) },
  })

  const uploadUrl = await getSignedUrl(R2, command, { expiresIn })
  return { uploadUrl, storageKey }
}

/**
 * Get a presigned download URL for private objects
 */
export async function getDownloadUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: storageKey })
  return getSignedUrl(R2, command, { expiresIn })
}

/**
 * Public CDN URL for public objects (avatars, thumbnails)
 */
export function getPublicUrl(storageKey: string): string {
  return `${CDN}/${storageKey}`
}

/**
 * Delete an object from R2
 */
export async function deleteObject(storageKey: string): Promise<void> {
  await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storageKey }))
}

/**
 * Delete multiple objects (used by self-destruct jobs)
 */
export async function deleteObjects(storageKeys: string[]): Promise<void> {
  await Promise.allSettled(storageKeys.map(deleteObject))
}

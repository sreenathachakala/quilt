import * as FP from 'fp-ts'
import lodashTemplate from 'lodash/template'
import * as R from 'ramda'

import * as s3paths from 'utils/s3paths'

// TODO: use two types: {bucket, name} and {bucket,name,hash}
//       PackageHandleBase and PackageHandle
//       or PackageHandle and PackageHandleRevision/PackageHandleRevisioned
export interface PackageHandle {
  bucket: string
  name: string
  hash: string
}

export const emptyPackageHandle: PackageHandle = {
  bucket: '',
  name: '',
  hash: '',
}

export function fromS3Handle(s3Handle: s3paths.S3HandleBase): PackageHandle {
  return {
    bucket: s3Handle.bucket,
    name: s3Handle.key,
    hash: s3Handle.version || '', // Hmmmmmm
  }
}

export function toS3Handle(packageHandle: PackageHandle): s3paths.S3HandleBase {
  return {
    bucket: packageHandle.bucket,
    key: packageHandle.name,
    version: packageHandle.hash,
  }
}

// TODO: return null when empty
export function toS3Url(packageHandle?: PackageHandle): string {
  if (!packageHandle) return ''
  return FP.function.pipe(packageHandle, toS3Handle, s3paths.handleToS3Url)
}

export function fromS3Url(url?: string): PackageHandle | null {
  if (!url) return null
  return FP.function.pipe(url, s3paths.parseS3Url, fromS3Handle)
}

export function shortenRevision(fullRevision: string): string {
  return R.take(10, fullRevision)
}

type Context = 'files' | 'packages'

export type NameTemplates = Partial<Record<Context, string>>

type Options = {
  username?: string
  directory?: string
}

export function execTemplateItem(template: string, options?: Options): string | null {
  try {
    return lodashTemplate(template)(options)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Template for default package name is invalid')
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

export function execTemplate(
  templatesDict: NameTemplates,
  context: Context,
  options?: Options,
): string | null {
  if (!templatesDict || !templatesDict[context]) return null
  return execTemplateItem(templatesDict[context] || '', options)
}

// TODO: replace with includes
export function areEqual(a: PackageHandle, b: PackageHandle) {
  // console.log('areEqual', a, b)
  // FIXME
  // return a.bucket === b.bucket && a.name == b.name && a.hash && b.hash
  return a.bucket === b.bucket && a.name == b.name
}

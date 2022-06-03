import * as FP from 'fp-ts'
import lodashTemplate from 'lodash/template'
import * as R from 'ramda'

import * as s3paths from 'utils/s3paths'

export interface PackageHandleBase {
  bucket: string
  name: string
}

export interface PackageHandle extends PackageHandleBase {
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

export function toS3Handle(
  packageHandle: PackageHandleBase | PackageHandle,
): s3paths.S3HandleBase {
  const s3Handle: s3paths.S3HandleBase = {
    bucket: packageHandle.bucket,
    key: packageHandle.name,
  }
  if ((packageHandle as PackageHandle).hash) {
    s3Handle.version = (packageHandle as PackageHandle).hash
  }
  return s3Handle
}

// TODO: return null when empty
export function toS3Url(packageHandle?: PackageHandleBase | PackageHandle): string {
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
export function areEqual(
  a: PackageHandleBase | PackageHandle,
  b: PackageHandleBase | PackageHandle,
) {
  if (a.bucket !== b.bucket) return false
  if (a.name !== b.name) return false
  if (
    (a as PackageHandle).hash &&
    (b as PackageHandle).hash &&
    (a as PackageHandle).hash !== (b as PackageHandle).hash
  )
    return false
  return true
}

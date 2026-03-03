// Stub for @aws-sdk/client-s3 — prevents ERR_MODULE_NOT_FOUND in vitest
export class S3Client { constructor(_config: any) {} send(_cmd: any) { return Promise.resolve({}); } }
export class PutObjectCommand { constructor(_input: any) {} }
export class GetObjectCommand { constructor(_input: any) {} }
export class DeleteObjectCommand { constructor(_input: any) {} }

import 'server-only';
import { mkdir, readFile as fsReadFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';

// STORAGE_DRIVER=local: write into the .local-storage/ folder (local dry runs only).
// Default: Cloud Storage, with the bucket name taken from GCS_BUCKET.
const useLocal = process.env.STORAGE_DRIVER === 'local';
const localRoot = path.join(process.cwd(), '.local-storage');

let storage: Storage | null = null;
function bucket() {
  const name = process.env.GCS_BUCKET;
  if (!name) throw new Error('Missing environment variable GCS_BUCKET');
  storage ??= new Storage();
  return storage.bucket(name);
}

export async function saveFile(filePath: string, data: Buffer, contentType: string): Promise<void> {
  if (useLocal) {
    const target = path.join(localRoot, filePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return;
  }
  await bucket().file(filePath).save(data, { contentType, resumable: false });
}

export async function readFile(filePath: string): Promise<Buffer> {
  if (useLocal) return fsReadFile(path.join(localRoot, filePath));
  const [buf] = await bucket().file(filePath).download();
  return buf;
}

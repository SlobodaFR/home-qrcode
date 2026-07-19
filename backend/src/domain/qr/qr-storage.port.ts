export abstract class QrStoragePort {
  abstract uploadPng(id: string, buffer: Buffer): Promise<void>;
  abstract uploadSvg(id: string, content: string): Promise<void>;
  abstract streamPng(id: string): Promise<NodeJS.ReadableStream>;
  abstract streamSvg(id: string): Promise<NodeJS.ReadableStream>;
  abstract exists(id: string): Promise<boolean>;
}

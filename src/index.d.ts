export interface WorkerOptions {
  /** Public static HTML; no login or personal data. */
  fallback: string;
  scope?: string;
  /** Public CSS, fonts or images required by the fallback. */
  assets?: string[];
  timeoutMs?: number;
  namespace?: string;
  /** Change when fallback content changes to refresh its cache. */
  version?: string;
}
export declare function createWorker(options: WorkerOptions): string;
export declare function writeWorker(options: WorkerOptions & { outDir: string; worker?: string }): Promise<string>;

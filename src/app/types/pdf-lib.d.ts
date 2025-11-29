/**
 * Minimal pdf-lib module declarations for environments without installed typings.
 */
declare module 'pdf-lib' {
  export const PageSizes: Record<string, [number, number]>;
  export function rgb(r: number, g: number, b: number): unknown;

  export interface PDFPage {
    getWidth(): number;
    getHeight(): number;
    drawImage(image: unknown, options: {x: number; y: number; width: number; height: number}): void;
    drawRectangle(options: {
      x: number;
      y: number;
      width: number;
      height: number;
      borderColor?: unknown;
      borderWidth?: number;
    }): void;
  }

  export class PDFDocument {
    static create(): Promise<PDFDocument>;
    addPage(size?: [number, number]): PDFPage;
    embedPng(data: Uint8Array): Promise<unknown>;
    saveAsBase64(options?: {dataUri?: boolean}): Promise<string>;
  }
}

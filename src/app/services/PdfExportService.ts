import {PageSizes, PDFDocument, rgb} from 'pdf-lib';
import html2canvas from 'html2canvas';
import {buildPreviewDocument} from '../components/CardPreviewPanel/useCardPreview';
import {type PdfExportConfig, type Project, type ResolvedCard} from '../types/project';
import {logService} from './LogService';
import {joinPathSegments} from '../utils/path';
import {exportStatusService} from './ExportStatusService';

type RenderedCardImage = {
  card: ResolvedCard;
  imagePath: string;
};

class PdfExportService {
  /**
   * Exports the provided project cards to individual images before compiling them into a PDF,
   * yielding to the event loop between renders to keep the UI responsive.
   *
   * @param project - Project containing resolved cards to export.
   * @param onProgress - Callback invoked with the current completion ratio.
   * @returns Promise that resolves when the export is finished or cancelled.
   */
  async exportToPdf(project: Project, onProgress: (progress: number) => void): Promise<void> {
    const {export: exportConfig, layout} = project.config ?? {};
    const {pdf: pdfConfig} = exportConfig ?? {};
    const {
      pageSize = 'a4', orientation = 'portrait', border: borderConfig,
    } = pdfConfig ?? {};
    const {
      thickness: borderThickness = 0.1, color: borderColor = '#000000',
    } = borderConfig ?? {};
    const {width: cardWidthPx = 750, height: cardHeightPx = 1050} = layout ?? {};
    const dpi = exportConfig?.dpi ?? 300;

    const outputDirectory = joinPathSegments(project.rootPath, 'output');
    const imagesDirectory = joinPathSegments(outputDirectory, 'images');
    const pdfPath = joinPathSegments(outputDirectory, 'deck.pdf');

    exportStatusService.beginExport();
    const prepareDirectoriesStepId = exportStatusService.startStep('Prepare export directories');

    try {
      await this.ensureDirectoryExists(outputDirectory);
      await this.ensureDirectoryExists(imagesDirectory);
      exportStatusService.completeStep(prepareDirectoriesStepId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      exportStatusService.failStep(prepareDirectoriesStepId, reason);
      throw error;
    }

    const previewContainer = this.createOffscreenContainer(cardWidthPx, cardHeightPx);
    const iframe = this.createOffscreenIframe(previewContainer, cardWidthPx, cardHeightPx);
    const iframeWindow = iframe.contentWindow;

    if (!iframeWindow) {
      logService.error('Preview iframe not found. Aborting PDF export.');
      this.removeOffscreenContainer(previewContainer);
      exportStatusService.failExport('Preview iframe not found. Aborting PDF export.');
      return;
    }

    const cardWidthMm = (cardWidthPx / dpi) * 25.4;
    const cardHeightMm = (cardHeightPx / dpi) * 25.4;
    const margin = (pdfConfig?.margin ?? 0) + (borderThickness * 2);
    const totalCards = project.resolvedCards.length;
    const renderedImages: RenderedCardImage[] = [];

    const renderImagesStepId = exportStatusService.startStep('Render card images');

    try {
      for (const [index, card] of project.resolvedCards.entries()) {
        await this.yieldToEventLoop();
        const imagePath = joinPathSegments(imagesDirectory, `${index}.png`);

        try {
          const renderedImage = await this.renderCardToImageFile({
            card,
            iframe,
            dpi,
            imagePath,
            cardWidthPx,
            cardHeightPx,
          });

          renderedImages.push(renderedImage);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          logService.error(reason);
        }

        onProgress((index + 1) / totalCards);
        exportStatusService.updateStepDetail(
          renderImagesStepId,
          `Rendered ${index + 1} of ${totalCards}`,
        );
      }

      if (renderedImages.length === 0) {
        const message = 'No card images were rendered.';
        exportStatusService.failStep(renderImagesStepId, message);
        throw new Error(message);
      }

      exportStatusService.completeStep(
        renderImagesStepId,
        `Rendered ${renderedImages.length} of ${totalCards} cards`,
      );

      const assembleStepId = exportStatusService.startStep('Assemble PDF document');
      const pdfCreated = await this.composePdfFromImages({
        pageSize,
        orientation,
        cardWidthMm,
        cardHeightMm,
        borderColor,
        borderThickness,
        margin,
        images: renderedImages,
        pdfPath,
        stepId: assembleStepId,
      });

      if (pdfCreated) {
        exportStatusService.completeStep(
          assembleStepId,
          `Added ${renderedImages.length} of ${renderedImages.length} images • PDF saved to output directory`,
        );
        exportStatusService.completeExport();
        logService.info(`Successfully exported PDF to ${pdfPath}`);
      } else {
        const message = 'PDF export failed because no images were added to the document.';
        exportStatusService.failStep(assembleStepId, message);
        logService.error(message);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (exportStatusService.getStatus().result !== 'error') {
        exportStatusService.failExport(reason);
      }
      throw error;
    } finally {
      this.removeOffscreenContainer(previewContainer);
    }
  }

  /**
   * Creates an offscreen container sized for card rendering.
   *
   * @param cardWidthPx - Target card width in pixels.
   * @param cardHeightPx - Target card height in pixels.
   * @returns Offscreen container element.
   */
  private createOffscreenContainer(cardWidthPx: number, cardHeightPx: number): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-10000px';
    container.style.top = '0';
    container.style.width = `${cardWidthPx}px`;
    container.style.height = `${cardHeightPx}px`;
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.style.opacity = '0';
    container.style.pointerEvents = 'none';
    container.style.overflow = 'hidden';
    container.style.zIndex = '-1';

    document.body.appendChild(container);

    return container;
  }

  /**
   * Creates an offscreen iframe used to render cards.
   *
   * @param container - Parent container element for the iframe.
   * @param cardWidthPx - Target card width in pixels.
   * @param cardHeightPx - Target card height in pixels.
   * @returns Prepared iframe element.
   */
  private createOffscreenIframe(
    container: HTMLDivElement,
    cardWidthPx: number,
    cardHeightPx: number,
  ): HTMLIFrameElement {
    const iframe = document.createElement('iframe');
    iframe.width = `${cardWidthPx}`;
    iframe.height = `${cardHeightPx}`;
    iframe.style.width = `${cardWidthPx}px`;
    iframe.style.height = `${cardHeightPx}px`;
    iframe.style.border = 'none';
    iframe.style.flex = '0 0 auto';

    container.appendChild(iframe);

    return iframe;
  }

  /**
   * Removes the offscreen rendering container from the DOM.
   *
   * @param container - Container element to remove.
   */
  private removeOffscreenContainer(container: HTMLDivElement): void {
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  }

  /**
   * Defers execution to the event loop to keep the UI responsive during long-running tasks.
   *
   * @returns Promise that resolves on the next macrotask.
   */
  private async yieldToEventLoop(): Promise<void> {
    await new Promise(resolve => {
      window.setTimeout(resolve, 0);
    });
  }

  /**
   * Renders a card into an image file on disk.
   *
   * @param params - Rendering configuration for the card.
   * @returns Mapping between the rendered card and its saved image path.
   */
  private async renderCardToImageFile(params: {
    card: ResolvedCard;
    iframe: HTMLIFrameElement;
    dpi: number;
    imagePath: string;
    cardWidthPx: number;
    cardHeightPx: number;
  }): Promise<RenderedCardImage> {
    const {
      card,
      iframe,
      dpi,
      imagePath,
      cardWidthPx,
      cardHeightPx,
    } = params;

    const iframeWindow = iframe.contentWindow;

    if (!iframeWindow) {
      throw new Error('Failed to locate preview iframe.');
    }

    try {
      await this.populateIframeDocument({
        iframe,
        cardHtml: card.html,
        cardWidthPx,
        cardHeightPx,
      });
      await this.waitForAssetsToLoad(iframeWindow);

      const body = iframeWindow.document.body;
      const canvas = await html2canvas(body, {
        useCORS: true,
        allowTaint: true,
        scale: dpi / 96,
        width: cardWidthPx,
        height: cardHeightPx,
      });

      const imgData = canvas.toDataURL('image/png');
      const base64 = imgData.substring(imgData.indexOf(',') + 1);
      await window.api.writeBinaryFile(imagePath, base64);

      return {card, imagePath};
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to render card "${card.card.id}" to image: ${reason}`);
    }
  }

  /**
   * Populates the offscreen iframe with card HTML and styling.
   *
   * @param params - Parameters describing the target iframe and card content.
   */
  private async populateIframeDocument(params: {
    iframe: HTMLIFrameElement;
    cardHtml: string;
    cardWidthPx: number;
    cardHeightPx: number;
  }): Promise<void> {
    const {iframe, cardHtml, cardWidthPx, cardHeightPx} = params;

    await new Promise<void>((resolve, reject) => {
      const onLoad = () => {
        iframe.removeEventListener('load', onLoad);

        const iframeWindow = iframe.contentWindow;

        if (!iframeWindow) {
          reject(new Error('Preview iframe window unavailable.'));
          return;
        }

        const {document: iframeDocument} = iframeWindow;
        const style = iframeDocument.createElement('style');
        style.textContent = this.buildCenteredStyleBlock(cardWidthPx, cardHeightPx);
        iframeDocument.head.appendChild(style);

        resolve();
      };

      iframe.addEventListener('load', onLoad, {once: true});
      iframe.srcdoc = buildPreviewDocument(cardHtml);
    });
  }

  /**
   * Builds the inline style block applied to the offscreen iframe document.
   *
   * @param cardWidthPx - Card width in pixels.
   * @param cardHeightPx - Card height in pixels.
   * @returns Style text content.
   */
  private buildCenteredStyleBlock(cardWidthPx: number, cardHeightPx: number): string {
    return `html, body { margin: 0; padding: 0; width: 100%; height: 100%; }\n`
      + `body { display: flex; align-items: center; justify-content: center; width: ${cardWidthPx}px; height: ${cardHeightPx}px; background: transparent; overflow: hidden; }\n`
      + `* { box-sizing: border-box; }`;
  }

  /**
   * Combines rendered images into a PDF saved to disk.
   *
   * @param params - Composition configuration for the PDF document.
   */
  private async composePdfFromImages(params: {
    images: RenderedCardImage[];
    pdfPath: string;
    pageSize: string;
    orientation: PdfExportConfig['orientation'];
    cardWidthMm: number;
    cardHeightMm: number;
    margin: number;
    borderColor: string;
    borderThickness: number;
    stepId: string;
  }): Promise<boolean> {
    const {
      images,
      pdfPath,
      pageSize,
      orientation,
      cardWidthMm,
      cardHeightMm,
      margin,
      borderColor,
      borderThickness,
      stepId,
    } = params;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage(this.resolvePageSize(pageSize, orientation));

    let pageWidth = page.getWidth();
    let pageHeight = page.getHeight();

    const cardWidthPts = this.mmToPoints(cardWidthMm);
    const cardHeightPts = this.mmToPoints(cardHeightMm);
    const marginPts = this.mmToPoints(margin);
    const borderThicknessPts = this.mmToPoints(borderThickness);
    const color = this.hexToRgb(borderColor);

    let x = marginPts;
    let y = pageHeight - marginPts - cardHeightPts;
    let placedImages = 0;

    exportStatusService.updateStepDetail(stepId, `Added ${placedImages} of ${images.length} images`);

    for (const image of images) {
      try {
        const base64Image = await window.api.readBinaryFile(image.imagePath);
        const pngBytes = this.base64ToUint8Array(base64Image);
        const pngImage = await pdfDoc.embedPng(pngBytes);

        if (x + cardWidthPts > pageWidth - marginPts) {
          x = marginPts;
          y -= cardHeightPts + marginPts;
        }

        if (y < marginPts) {
          page = pdfDoc.addPage(this.resolvePageSize(pageSize, orientation));
          pageWidth = page.getWidth();
          pageHeight = page.getHeight();
          x = marginPts;
          y = pageHeight - marginPts - cardHeightPts;
        }

        page.drawImage(pngImage, {
          x,
          y,
          width: cardWidthPts,
          height: cardHeightPts,
        });

        if (borderThicknessPts > 0) {
          page.drawRectangle({
            x: x - borderThicknessPts,
            y: y - borderThicknessPts,
            width: cardWidthPts + borderThicknessPts * 2,
            height: cardHeightPts + borderThicknessPts * 2,
            borderColor: color,
            borderWidth: borderThicknessPts,
          });
        }

        x += cardWidthPts + marginPts;
        placedImages++;
        exportStatusService.updateStepDetail(stepId, `Added ${placedImages} of ${images.length} images`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.error(`Failed to add image for card "${image.card.card.id}" to PDF: ${reason}`);
      }
    }

    if (placedImages === 0) {
      logService.error('No rendered images were available to include in the PDF.');
      return false;
    }

    const base64Pdf = await pdfDoc.saveAsBase64({dataUri: false});
    await window.api.writeBinaryFile(pdfPath, base64Pdf);

    return true;
  }

  /**
   * Ensures a directory exists, ignoring errors when it is already present.
   *
   * @param directoryPath - Absolute path of the directory to create.
   */
  private async ensureDirectoryExists(directoryPath: string): Promise<void> {
    try {
      await window.api.createDirectory(directoryPath);
    } catch (error) {
      const errorWithCode = error as NodeJS.ErrnoException;
      if (errorWithCode?.code === 'EEXIST') {
        return;
      }

      throw error;
    }
  }

  /**
   * Awaits all images and fonts within the iframe to finish loading before rendering.
   *
   * @param iframeWindow - Window containing the card HTML content.
   */
  private async waitForAssetsToLoad(iframeWindow: Window): Promise<void> {
    await Promise.all([
      this.waitForImagesToLoad(iframeWindow),
      this.waitForFontsToLoad(iframeWindow),
    ]);
  }

  /**
   * Awaits all images within the iframe to finish loading before rendering.
   *
   * @param iframeWindow - Window containing the card HTML content.
   */
  private async waitForImagesToLoad(iframeWindow: Window): Promise<void> {
    await new Promise(resolve => {
      const images = iframeWindow.document.querySelectorAll('img');
      if (!images?.length) {
        resolve(null);
        return;
      }

      let loadedImages = 0;
      const onImageLoad = () => {
        loadedImages++;
        if (loadedImages === images.length) {
          resolve(null);
        }
      };

      images.forEach(img => {
        if (img.complete) {
          onImageLoad();
        } else {
          img.onload = onImageLoad;
          img.onerror = onImageLoad;
        }
      });
    });
  }

  /**
   * Waits for all fonts declared within the iframe to finish loading.
   *
   * @param iframeWindow - Target iframe window.
   */
  private async waitForFontsToLoad(iframeWindow: Window): Promise<void> {
    const fonts = iframeWindow.document.fonts;

    if (fonts?.status === 'loaded') {
      return;
    }

    if (fonts?.ready) {
      await fonts.ready;
    }
  }

  /**
   * Converts millimeters to PDF points.
   *
   * @param mm - Measurement in millimeters.
   * @returns Measurement in points.
   */
  private mmToPoints(mm: number): number {
    return (mm / 25.4) * 72;
  }

  /**
   * Resolves the page size for pdf-lib based on configuration.
   *
   * @param pageSize - Named page size.
   * @param orientation - Page orientation.
   * @returns Tuple describing page width and height in points.
   */
  private resolvePageSize(pageSize: string, orientation: PdfExportConfig['orientation']): [number, number] {
    const normalized = pageSize.toUpperCase();
    const defaultSize = PageSizes.A4;
    const sizeMap: Record<string, [number, number]> = {
      A0: PageSizes.A0,
      A1: PageSizes.A1,
      A2: PageSizes.A2,
      A3: PageSizes.A3,
      A4: PageSizes.A4,
      A5: PageSizes.A5,
      A6: PageSizes.A6,
      LETTER: PageSizes.Letter,
      LEGAL: PageSizes.Legal,
      TABLOID: PageSizes.Tabloid,
    };

    const [width, height] = sizeMap[normalized] ?? defaultSize;

    if (orientation === 'landscape') {
      return [Math.max(width, height), Math.min(width, height)];
    }

    return [Math.min(width, height), Math.max(width, height)];
  }

  /**
   * Converts a base64 string into a Uint8Array.
   *
   * @param base64 - Base64-encoded content.
   * @returns Decoded bytes.
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const length = binaryString.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return bytes;
  }

  /**
   * Converts a hex color string to an rgb tuple usable by pdf-lib.
   *
   * @param hex - Hex color string.
   * @returns pdf-lib RGB color object.
   */
  private hexToRgb(hex: string): ReturnType<typeof rgb> {
    const sanitized = hex.replace('#', '');
    const bigint = Number.parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return rgb(r / 255, g / 255, b / 255);
  }
}

export const pdfExportService = new PdfExportService();

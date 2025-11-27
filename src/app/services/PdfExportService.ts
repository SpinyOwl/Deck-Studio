import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {type Project, type ResolvedCard, type PdfExportConfig} from '../types/project';
import {logService} from './LogService';
import {joinPathSegments} from '../utils/path';

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

    await this.ensureDirectoryExists(outputDirectory);
    await this.ensureDirectoryExists(imagesDirectory);

    const iframe = this.getPreviewIframe();
    const iframeWindow = iframe?.contentWindow;
    if (!iframeWindow) {
      logService.error('Preview iframe not found. Aborting PDF export.');
      return;
    }

    const cardWidthMm = (cardWidthPx / dpi) * 25.4;
    const cardHeightMm = (cardHeightPx / dpi) * 25.4;
    const margin = (pdfConfig?.margin ?? 0) + (borderThickness * 2);
    const totalCards = project.resolvedCards.length;
    const renderedImages: RenderedCardImage[] = [];

    for (const [index, card] of project.resolvedCards.entries()) {
      await this.yieldToEventLoop();
      const imagePath = joinPathSegments(imagesDirectory, `${index}.png`);

      try {
        const renderedImage = await this.renderCardToImageFile({
          card,
          iframeWindow,
          dpi,
          imagePath,
        });

        renderedImages.push(renderedImage);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.error(reason);
      }

      onProgress((index + 1) / totalCards);
    }

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
    });

    if (pdfCreated) {
      logService.info(`Successfully exported PDF to ${pdfPath}`);
    } else {
      logService.error('PDF export failed because no images were added to the document.');
    }
  }

  /**
   * Retrieves the preview iframe element used for rendering cards.
   *
   * @returns The iframe element when found, otherwise null.
   */
  private getPreviewIframe(): HTMLIFrameElement | null {
    return document.querySelector<HTMLIFrameElement>('.card-preview__iframe');
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
    iframeWindow: Window;
    dpi: number;
    imagePath: string;
  }): Promise<RenderedCardImage> {
    const {
      card,
      iframeWindow,
      dpi,
      imagePath,
    } = params;

    try {
      iframeWindow.document.body.innerHTML = card.html;
      await this.waitForImagesToLoad(iframeWindow);

      const canvas = await html2canvas(iframeWindow.document.body, {
        useCORS: true, allowTaint: true, scale: dpi / 96,
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
    } = params;

    const doc = new jsPDF({
      orientation, unit: 'mm', format: pageSize,
    });

    const pageDimensions = doc.internal.pageSize;
    const pageHeight = pageDimensions.height;
    const pageWidth = pageDimensions.width;

    let x = margin;
    let y = margin;

    let placedImages = 0;

    for (const image of images) {
      try {
        const base64Image = await window.api.readBinaryFile(image.imagePath);
        const imageDataUrl = `data:image/png;base64,${base64Image}`;

        if (x + cardWidthMm > pageWidth) {
          x = margin;
          y += cardHeightMm + margin;
        }

        if (y + cardHeightMm > pageHeight) {
          doc.addPage();
          x = margin;
          y = margin;
        }

        doc.addImage(imageDataUrl, 'PNG', x, y, cardWidthMm, cardHeightMm);

        if (borderThickness > 0) {
          doc.setDrawColor(borderColor);
          doc.setLineWidth(borderThickness);
          doc.setLineDashPattern([1, 1], 0);
          doc.rect(
            x - borderThickness,
            y - borderThickness,
            cardWidthMm + borderThickness * 2,
            cardHeightMm + borderThickness * 2,
            'S',
          );
        }

        x += cardWidthMm + margin;
        placedImages++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.error(`Failed to add image for card "${image.card.card.id}" to PDF: ${reason}`);
      }
    }

    if (placedImages === 0) {
      logService.error('No rendered images were available to include in the PDF.');
      return false;
    }

    const pdfOutput = doc.output('datauristring');
    const base64Pdf = pdfOutput.substring(pdfOutput.indexOf(',') + 1);
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
}

export const pdfExportService = new PdfExportService();

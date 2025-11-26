import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {type Project} from '../types/project';
import {logService} from './LogService';
import {joinPathSegments} from '../utils/path';

class PdfExportService {
  async exportToPdf(project: Project, onProgress: (progress: number) => void) {
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

    const defaultPath = joinPathSegments(project.rootPath, 'deck.pdf');
    const filePath = await window.api.savePdfDialog(defaultPath);

    if (!filePath) {
      logService.add('PDF export cancelled.', 'info');
      return;
    }

    const doc = new jsPDF({
      orientation, unit: 'mm', format: pageSize,
    });

    const pageDimensions = doc.internal.pageSize;
    const pageHeight = pageDimensions.height;
    const pageWidth = pageDimensions.width;
    const margin = 10;
    let x = margin;
    let y = margin;

    const totalCards = project.resolvedCards.length;
    let renderedCards = 0;

    for (const card of project.resolvedCards) {
      const iframe = document.querySelector<HTMLIFrameElement>('.card-preview__iframe');
      if (!iframe?.contentWindow) {
        logService.add('Preview iframe not found. Aborting PDF export.', 'error');
        return;
      }

      try {
        iframe.contentWindow.document.body.innerHTML = card.html;

        await new Promise(resolve => {
          const images = iframe.contentWindow?.document.querySelectorAll('img');
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

        const canvas = await html2canvas(iframe.contentWindow.document.body, {
          useCORS: true, allowTaint: true, scale: dpi / 96,
        });

        const cardWidthMm = (cardWidthPx / dpi) * 25.4;
        const cardHeightMm = (cardHeightPx / dpi) * 25.4;

        if (x + cardWidthMm > pageWidth) {
          x = margin;
          y += cardHeightMm + margin;
        }

        if (y + cardHeightMm > pageHeight) {
          doc.addPage();
          x = margin;
          y = margin;
        }

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', x, y, cardWidthMm, cardHeightMm);

        if (borderThickness > 0) {
          doc.setDrawColor(borderColor);
          doc.setLineWidth(borderThickness);
          doc.setLineDashPattern([1, 1], 0);
          doc.rect(x - borderThickness, y - borderThickness, cardWidthMm + borderThickness * 2, cardHeightMm + borderThickness * 2, 'S');
        }
        x += cardWidthMm + margin;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        logService.add(`Failed to render card "${card.card.id}": ${reason}`, 'error');
      }

      renderedCards++;
      onProgress(renderedCards / totalCards);
    }

    const pdfOutput = doc.output('datauristring');
    const base64 = pdfOutput.substring(pdfOutput.indexOf(',') + 1);
    await window.api.writeBinaryFile(filePath, base64);
    logService.add(`Successfully exported PDF to ${filePath}`, 'info');
  }
}

export const pdfExportService = new PdfExportService();

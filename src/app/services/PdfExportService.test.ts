import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {mmToPoints, scaleCardToFitPage} from './pdfScaling';

describe('PdfExportService.scaleCardToFitPage', () => {
  test('does not scale when the card already fits the page', () => {
    const result = scaleCardToFitPage({
      cardWidthMm: 50,
      cardHeightMm: 80,
      pageWidthPts: mmToPoints(210),
      pageHeightPts: mmToPoints(297),
      marginPts: 0,
      borderThicknessMm: 0.1,
    });

    assert.equal(result.widthMm, 50);
    assert.equal(result.heightMm, 80);
  });

  test('scales down card that exceeds page dimensions', () => {
    const result = scaleCardToFitPage({
      cardWidthMm: 300,
      cardHeightMm: 400,
      pageWidthPts: mmToPoints(210),
      pageHeightPts: mmToPoints(297),
      marginPts: 0,
      borderThicknessMm: 0,
    });

    assert.ok(Math.abs(result.widthMm - 210) < 0.0001);
    assert.ok(Math.abs(result.heightMm - 280) < 0.0001);
  });

  test('includes border thickness when scaling to fit', () => {
    const result = scaleCardToFitPage({
      cardWidthMm: 200,
      cardHeightMm: 200,
      pageWidthPts: mmToPoints(210),
      pageHeightPts: mmToPoints(297),
      marginPts: 0,
      borderThicknessMm: 10,
    });

    const totalWidthMm = result.widthMm + 2 * 10 * result.scale;
    const totalHeightMm = result.heightMm + 2 * 10 * result.scale;

    assert.ok(Math.abs(totalWidthMm - 210) < 0.001);
    assert.ok(Math.abs(totalHeightMm - 210) < 0.001);
  });
});

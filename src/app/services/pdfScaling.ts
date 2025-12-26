/**
 * Converts millimeters to PDF points.
 *
 * @param mm - Measurement in millimeters.
 * @returns Measurement in points.
 */
export const mmToPoints = (mm: number): number => (mm / 25.4) * 72;

type ScaleCardToFitPageParams = {
  cardWidthMm: number;
  cardHeightMm: number;
  pageWidthPts: number;
  pageHeightPts: number;
  marginPts: number;
  borderThicknessMm: number;
};

/**
 * Scales a card to fit within the available page area.
 *
 * The calculation accounts for configured margins and border thickness to avoid overflow when only
 * a single card should be placed on the page.
 *
 * @param params - Measurements of the card and page in mixed units.
 * @returns Scaled card dimensions in millimeters.
 */
export const scaleCardToFitPage = (params: ScaleCardToFitPageParams): {
  widthMm: number;
  heightMm: number;
  scale: number;
} => {
  const {
    cardWidthMm,
    cardHeightMm,
    pageWidthPts,
    pageHeightPts,
    marginPts,
    borderThicknessMm,
  } = params;

  const cardWidthPts = mmToPoints(cardWidthMm + borderThicknessMm * 2);
  const cardHeightPts = mmToPoints(cardHeightMm + borderThicknessMm * 2);

  const availableWidth = Math.max(pageWidthPts - marginPts, 0);
  const availableHeight = Math.max(pageHeightPts - marginPts, 0);

  if (cardWidthPts <= 0 || cardHeightPts <= 0 || availableWidth <= 0 || availableHeight <= 0) {
    return {widthMm: 0, heightMm: 0, scale: 0};
  }

  const widthScale = availableWidth / cardWidthPts;
  const heightScale = availableHeight / cardHeightPts;
  const scale = Math.min(1, widthScale, heightScale);

  return {
    widthMm: cardWidthMm * scale,
    heightMm: cardHeightMm * scale,
    scale,
  };
};

/**
 * Minimal CSV parsing implementation providing the subset of PapaParse API used by Deck Studio.
 * It supports header rows, configurable header transforms, and empty-line skipping.
 */
function parseLine(line, delimiter) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);

  if (inQuotes) {
    throw new Error('Unterminated quoted field detected while parsing CSV.');
  }

  return values;
}

/**
 * Parses CSV text into structured records.
 *
 * @param {string} content - CSV content to parse.
 * @param {object} options - Parsing options.
 * @param {boolean} [options.header=false] - Whether the first row should be treated as headers.
 * @param {boolean|string} [options.skipEmptyLines=false] - Whether to skip empty lines.
 * @param {(header: string) => string} [options.transformHeader] - Optional header transformer.
 * @returns {{data: object[], errors: Array<{type: string, code: string, message: string, row?: number}>}}
 */
function parse(content, options = {}) {
  const {
    header = false,
    skipEmptyLines = false,
    transformHeader,
  } = options;

  const delimiter = ',';
  const lines = content.split(/\r?\n/);
  const errors = [];
  const data = [];

  const processedLines = skipEmptyLines
    ? lines.filter(line => line.trim().length > 0)
    : lines;

  if (processedLines.length === 0) {
    return {data: [], errors};
  }

  let headers = [];

  processedLines.forEach((line, index) => {
    try {
      const parsed = parseLine(line, delimiter).map(value => value.trim());

      if (header && index === 0) {
        headers = transformHeader ? parsed.map(transformHeader) : parsed;
        return;
      }

      if (header) {
        const record = {};
        headers.forEach((key, position) => {
          if (!key) {
            return;
          }
          record[key] = parsed[position] ?? '';
        });
        data.push(record);
        return;
      }

      data.push(parsed);
    } catch (error) {
      errors.push({
        type: 'Delimiter',
        code: 'ParseError',
        message: error instanceof Error ? error.message : String(error),
        row: index,
      });
    }
  });

  return {data, errors};
}

export default {parse};

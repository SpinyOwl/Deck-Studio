import assert from 'node:assert/strict';
import {describe, test} from 'node:test';
import {CARDS_FILENAME, CsvParser} from './CsvParser';

const parser = new CsvParser();

describe('CsvParser', () => {
  test('parses CSV content and trims values', () => {
    const records = parser.parse(' id , template ,name\n1 , card.html , Example ');

    assert.equal(records.length, 1);
    assert.deepEqual(records[0], {id: '1', template: 'card.html', name: 'Example'});
  });

  test('throws a descriptive error when parsing fails', () => {
    assert.throws(
      () => parser.parse('id,name\n"1'),
      new RegExp(`Unable to parse ${CARDS_FILENAME}`),
    );
  });

  test('resolves column names from configuration', () => {
    const templateColumn = parser.getTemplateColumnName({csv: {templateColumn: 'layout'}} as never);
    const idColumn = parser.getIdColumnName({csv: {idColumn: 'slug'}} as never);

    assert.equal(templateColumn, 'layout');
    assert.equal(idColumn, 'slug');
  });
});

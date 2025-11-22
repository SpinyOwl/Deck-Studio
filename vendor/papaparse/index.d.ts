export interface ParseError {
  type: string;
  code: string;
  message: string;
  row?: number;
}

export interface ParseConfig {
  header?: boolean;
  skipEmptyLines?: boolean | 'greedy';
  transformHeader?: (header: string) => string;
}

export interface ParseResult<T> {
  data: T[];
  errors: ParseError[];
}

export interface PapaParse {
  parse<T = unknown>(content: string, config?: ParseConfig): ParseResult<T>;
}

declare const Papa: PapaParse;
export default Papa;

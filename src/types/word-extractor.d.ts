declare module "word-extractor" {
  interface HeaderOptions {
    includeFooters?: boolean;
  }

  interface TextboxOptions {
    includeHeadersAndFooters?: boolean;
    includeBody?: boolean;
  }

  interface ExtractedWordDocument {
    getBody(): string;
    getFootnotes(): string;
    getEndnotes(): string;
    getHeaders(options?: HeaderOptions): string;
    getFooters(): string;
    getAnnotations(): string;
    getTextboxes(options?: TextboxOptions): string;
  }

  export default class WordExtractor {
    extract(input: string | Buffer): Promise<ExtractedWordDocument>;
  }
}

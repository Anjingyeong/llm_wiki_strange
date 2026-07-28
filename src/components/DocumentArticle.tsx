import { getPageTitle, type WikiDocument } from '../lib/types';
import { DocumentEvidencePanel } from './DocumentEvidencePanel';
import { MarkdownRenderer } from './MarkdownRenderer';

type DocumentArticleProps = {
  readonly document: WikiDocument;
  readonly onSelectDocument: (slug: string) => void;
};

export function DocumentArticle({ document, onSelectDocument }: DocumentArticleProps) {
  const pageTitle = getPageTitle(document);

  return (
    <article className="docCard">
      <header className="docHeader">
        <span>{document.category}</span>
        <h1>{pageTitle}</h1>
        <div className="tagRow">
          {(document.tags ?? []).map((tag) => (
            <small key={tag}>{tag}</small>
          ))}
        </div>
      </header>
      <DocumentEvidencePanel document={document} onSelectDocument={onSelectDocument} />
      <MarkdownRenderer
        markdown={document.body}
        documentTitle={document.title}
        displayTitle={pageTitle}
        documentSlug={document.slug}
      />
    </article>
  );
}

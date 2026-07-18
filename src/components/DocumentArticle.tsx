import { getDisplayTitle, type WikiDocument } from '../lib/types';
import { DocumentEvidencePanel } from './DocumentEvidencePanel';
import { MarkdownRenderer } from './MarkdownRenderer';

type DocumentArticleProps = {
  readonly document: WikiDocument;
  readonly onSelectDocument: (slug: string) => void;
};

export function DocumentArticle({ document, onSelectDocument }: DocumentArticleProps) {
  const displayTitle = getDisplayTitle(document);

  return (
    <article className="docCard">
      <header className="docHeader">
        <span>{document.category}</span>
        <h1>{displayTitle}</h1>
        {displayTitle !== document.title ? (
          <p className="formalTitle">정식 제목: {document.title}</p>
        ) : null}
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
        displayTitle={displayTitle}
        documentSlug={document.slug}
      />
    </article>
  );
}

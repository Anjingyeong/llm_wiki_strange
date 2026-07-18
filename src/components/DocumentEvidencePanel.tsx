import type { MouseEvent } from 'react';
import { documentRelationshipGraph, documentsBySlug } from '../lib/documents';
import {
  WIKI_BACKLINK_RELATION_LABELS,
  WIKI_DOCUMENT_STATUS_LABELS,
  WIKI_DOCUMENT_TYPE_LABELS,
  WIKI_EVIDENCE_LEVEL_LABELS,
  WIKI_OUTGOING_RELATION_LABELS,
  getDocumentAnswer,
  getVerificationLabel,
} from '../lib/wikiEvidence';
import { wikiLink } from '../lib/wikiHash';
import { shouldHandleWikiLinkClick } from '../lib/wikiLinkActivation.mjs';
import { getDisplayTitle, type WikiDocument, type WikiRelationKind } from '../lib/types';

type DocumentEvidencePanelProps = {
  readonly document: WikiDocument;
  readonly onSelectDocument: (slug: string) => void;
};

type DocumentRelationLinkProps = {
  readonly directionLabel: string;
  readonly document: WikiDocument;
  readonly kind: WikiRelationKind;
  readonly onSelectDocument: (slug: string) => void;
};

function DocumentRelationLink({
  directionLabel,
  document,
  kind,
  onSelectDocument,
}: DocumentRelationLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!shouldHandleWikiLinkClick(event)) return;
    event.preventDefault();
    onSelectDocument(document.slug);
  };

  return (
    <li className="documentRelationItem" data-relation-kind={kind}>
      <span className="documentRelationDirection">{directionLabel}</span>
      <a href={wikiLink(document.slug)} onClick={handleClick}>
        {getDisplayTitle(document)}
      </a>
    </li>
  );
}

export function DocumentEvidencePanel({
  document,
  onSelectDocument,
}: DocumentEvidencePanelProps) {
  const graphEntry = documentRelationshipGraph.get(document.slug);
  const outgoing = (graphEntry?.outgoing ?? []).flatMap((relation) => {
    const target = documentsBySlug.get(relation.targetSlug);
    return target ? [{ relation, target }] : [];
  });
  const backlinks = (graphEntry?.backlinks ?? []).flatMap((backlink) => {
    const source = documentsBySlug.get(backlink.sourceSlug);
    return source ? [{ backlink, source }] : [];
  });
  const replacement = document.supersededBy
    ? documentsBySlug.get(document.supersededBy)
    : undefined;

  return (
    <section className="documentEvidence" aria-labelledby="document-evidence-title">
      <div className="documentAnswer">
        <h2 id="document-evidence-title">핵심 답변</h2>
        <p>{getDocumentAnswer(document)}</p>
      </div>

      <dl className="documentFacts" aria-label="문서 근거 상태">
        <div>
          <dt>문서 유형</dt>
          <dd>{document.type ? WIKI_DOCUMENT_TYPE_LABELS[document.type] : '미기재'}</dd>
        </div>
        <div>
          <dt>문서 상태</dt>
          <dd>{document.status ? WIKI_DOCUMENT_STATUS_LABELS[document.status] : '미기재'}</dd>
        </div>
        <div>
          <dt>근거 수준</dt>
          <dd>
            {document.evidenceLevel
              ? WIKI_EVIDENCE_LEVEL_LABELS[document.evidenceLevel]
              : '미기재'}
          </dd>
        </div>
        <div>
          <dt>검증</dt>
          <dd>{getVerificationLabel(document.verifiedAt)}</dd>
        </div>
        <div>
          <dt>마지막 업데이트</dt>
          <dd className="documentFactDate">{document.updatedAt || '미기재'}</dd>
        </div>
      </dl>

      {document.status === 'superseded' ? (
        <p className="documentReplacement" role="note">
          <strong>대체 문서</strong>{' '}
          {replacement ? (
            <a
              href={wikiLink(replacement.slug)}
              onClick={(event) => {
                if (!shouldHandleWikiLinkClick(event)) return;
                event.preventDefault();
                onSelectDocument(replacement.slug);
              }}
            >
              {getDisplayTitle(replacement)}
            </a>
          ) : (
            '미지정'
          )}
        </p>
      ) : null}

      {outgoing.length > 0 || backlinks.length > 0 ? (
        <div className="documentRelationships" aria-label="문서 관계">
          {outgoing.length > 0 ? (
            <section aria-labelledby="outgoing-relations-title">
              <h3 id="outgoing-relations-title">이 문서가 가리키는 문서</h3>
              <ul>
                {outgoing.map(({ relation, target }) => (
                  <DocumentRelationLink
                    key={`${relation.kind}:${target.slug}`}
                    directionLabel={WIKI_OUTGOING_RELATION_LABELS[relation.kind]}
                    document={target}
                    kind={relation.kind}
                    onSelectDocument={onSelectDocument}
                  />
                ))}
              </ul>
            </section>
          ) : null}
          {backlinks.length > 0 ? (
            <section aria-labelledby="backlink-relations-title">
              <h3 id="backlink-relations-title">이 문서를 가리키는 문서</h3>
              <ul>
                {backlinks.map(({ backlink, source }) => (
                  <DocumentRelationLink
                    key={`${backlink.kind}:${source.slug}`}
                    directionLabel={WIKI_BACKLINK_RELATION_LABELS[backlink.kind]}
                    document={source}
                    kind={backlink.kind}
                    onSelectDocument={onSelectDocument}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

---
title: Evidence Wiki - LLM Wiki RAG
category: Project
tags: [portfolio, evidence, rag, markdown, embedding, grounded-answer]
relatedDocs: [Overview, Glossary]
relatedFiles: [docs/rag-portfolio.md, scripts/generate-rag-index.mjs, scripts/lib/rag/chunks.mjs, scripts/lib/rag/embedding.mjs, scripts/lib/rag/search.mjs, scripts/lib/rag/answer.mjs, server.mjs, portfolio/project-evidence-map.md, portfolio/resume-bullets.md, portfolio/interview-answers.md]
updatedAt: 2026-06-30
project: llm-wiki
type: evidence
portfolio_use: true
evidence_type: RAG
---

# LLM Wiki RAG Evidence Wiki

## 문제 정의

LLM Wiki는 프로젝트 문서, 실험 결과, ADR, 장애 기록을 검색 가능한 지식베이스로 만들기 위한 Wiki다. 단순 챗봇은 모델의 일반 지식으로 답을 보완할 수 있으므로, 프로젝트 내부 근거와 다른 답을 만들 위험이 있다. 그래서 질문 전에 Markdown 문서를 검색하고, 검색된 chunk를 근거로만 답하는 RAG 구조가 필요했다.

## 내가 구현/설계한 내용

- `content/*.md`를 RAG 검색 대상으로 삼고, `npm run rag:index`로 `data/ragVectorIndex.json` 파일 기반 vector store를 생성하는 구조를 추가했다.
- Markdown heading을 기준으로 section을 분리하고, plain text로 정리한 뒤 기본 1100자 chunk를 만드는 chunking 방식을 구현했다.
- 외부 embedding API 없이 256차원 local hash embedding을 생성하는 무료/저비용 검색 구조를 구현했다.
- vector similarity와 keyword overlap을 조합해 top-k chunk를 검색하는 search flow를 구현했다.
- 검색 결과가 없으면 answered를 반환하지 않고 insufficient_context로 응답해 hallucination을 막는 grounded answer policy를 추가했다.
- 외부 LLM은 기본값이 아니라 선택 사항으로 두고, `RAG_LLM_API_KEY`가 있을 때만 서버 측에서 호출하도록 설계했다.

## 기술 선택 이유

Markdown chunking은 Wiki 문서의 heading 구조를 그대로 활용할 수 있어 ADR, 실험 결과, 작업 로그를 section 단위로 검색하기 쉽다. code fence 내부 내용은 chunk에서 제거되므로 중요한 JSON payload나 Mermaid 흐름은 코드 블록 밖 설명 문장으로도 요약해야 한다.

local hash embedding은 전문 semantic embedding보다 검색 품질은 제한적이지만, 무료/저비용으로 재현 가능하고 테스트가 deterministic하다. 현재 vector store는 전용 DB가 아니라 `data/ragVectorIndex.json` 파일이다. 따라서 작은 포트폴리오 Wiki 규모에서는 단순하고 투명하지만, 대규모 동시 reindex에는 적합하지 않다.

외부 LLM 호출은 서버 측에서만 수행한다. 브라우저의 `RagPanel`은 `/api/rag/ask`만 호출하고 API Key를 전달받지 않는다. 외부 LLM에는 전체 원문이 아니라 검색된 chunk 중 최대 4개, 최대 3600자만 context로 전달한다.

## 실험 또는 검증 근거

- `tests/rag.test.mjs`는 chunk metadata와 embedding 생성, grounded answer source, 근거 부족 응답을 검증한다.
- `tests/rag-evaluation.test.mjs`는 10개 대표 질문의 top-k 검색 결과에 기대 문서가 포함되는지 검증한다.
- `docs/rag-portfolio.md`는 RAG 구조, 보안 고려사항, 검증 결과, 한계와 후속 작업을 포트폴리오 문서로 정리한다.
- `npm run build`는 search index와 RAG vector store를 함께 재생성한다.
- 최근 검증에서 search index는 26개 문서, RAG vector store는 255 chunks를 생성했다.

## 발생한 문제와 해결 과정

첫 번째 문제는 LLM이 문서에 없는 내용을 일반 지식으로 보완할 수 있다는 점이었다. 해결은 검색 결과가 없을 때 insufficient_context로 답하고 sources를 빈 배열로 반환하는 것이다.

두 번째 문제는 개인정보나 민감정보가 Wiki 문서에 포함될 수 있다는 점이었다. 해결은 전체 원문을 외부 LLM에 보내지 않고 검색된 관련 chunk만 전달하는 것이다.

세 번째 문제는 code fence 검색 한계다. `chunks.mjs`는 code fence를 제거하므로 Mermaid나 JSON payload 내부 토큰만으로는 RAG 검색이 약할 수 있다. 따라서 중요한 payload 구조와 Mermaid 흐름은 코드 블록 밖에도 설명 문장으로 요약해야 한다.

## 포트폴리오에 활용할 수 있는 문장

- Markdown 기반 Wiki 문서를 heading 단위로 chunking하고 local hash embedding을 생성해 파일 기반 RAG 검색 구조를 구현했습니다.
- 외부 유료 embedding API 없이 256차원 local hash vector와 keyword overlap을 조합한 deterministic retrieval evaluation을 구성했습니다.
- 검색 결과가 없을 때 insufficient_context로 응답하고 sources를 비워 hallucination을 방지하는 grounded answer policy를 구현했습니다.
- 외부 LLM 호출은 서버 측으로 제한하고, API Key가 frontend에 노출되지 않도록 `/api/rag/ask` 구조로 분리했습니다.

## 면접에서 받을 수 있는 질문과 답변

Q. 왜 그냥 챗봇이 아니라 RAG를 썼나요?
A. 프로젝트의 모델 선택, MQTT 계약, frame evidence chain은 일반 지식이 아니라 내부 문서 근거가 중요합니다. RAG는 저장된 문서를 먼저 검색하고 검색된 chunk만 답변 근거로 쓰기 때문에 답변의 출처를 제시할 수 있습니다.

Q. vector DB를 썼나요?
A. 현재는 완전한 vector DB가 아니라 `data/ragVectorIndex.json` 파일 기반 vector store를 사용합니다. 작은 Wiki에는 단순하고 재현 가능하지만, 대규모 문서나 동시 reindex에는 후속 개선이 필요합니다.

Q. 외부 LLM이 기본인가요?
A. 아닙니다. `RAG_LLM_API_KEY`가 없으면 local extractive answer를 사용합니다. 키가 있을 때만 서버에서 OpenAI 호환 chat completions API를 선택적으로 호출합니다.

Q. hallucination은 어떻게 줄였나요?
A. 검색된 chunk가 없으면 answered가 아니라 insufficient_context를 반환합니다. 검색된 경우에도 sources를 함께 반환하고, 외부 LLM에는 검색된 chunk만 context로 전달합니다.

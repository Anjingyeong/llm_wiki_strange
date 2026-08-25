---
title: Evidence Wiki - LLM Wiki RAG
navTitle: Wiki RAG
shortTitle: Wiki RAG
category: Project
tags: [portfolio, evidence, rag, markdown, embedding, grounded-answer]
relatedDocs: [Overview, Glossary]
relatedFiles: [docs/rag-portfolio.md, scripts/generate-rag-index.mjs, scripts/lib/rag/chunks.mjs, scripts/lib/rag/embedding.mjs, scripts/lib/rag/search.mjs, scripts/lib/rag/answer.mjs, server.mjs, portfolio/project-evidence-map.md, portfolio/resume-bullets.md, portfolio/interview-answers.md]
updatedAt: 2026-06-30
project: llm-wiki
type: evidence
status: partial
evidenceLevel: unit-test
portfolio_use: true
evidence_type: RAG
---

# LLM Wiki RAG Evidence Wiki

## 먼저 말로 외우기

**한 줄로:** 프로젝트 문서를 먼저 찾아보고, 찾은 내용 안에서만 답하게 만든 검색형 챗봇이다.

**면접에서 이렇게 말하기:**

> "그냥 LLM한테 프로젝트 질문을 하면 없는 내용도 그럴듯하게 말할 수 있어서 RAG를 붙였습니다. 질문이 들어오면 먼저 제 Wiki 문서를 검색하고, 관련된 chunk를 찾은 다음 그 내용만 근거로 답하게 했습니다. 문서에 근거가 없으면 억지로 답하지 않고 `insufficient_context`로 끊도록 만든 게 핵심입니다."

**왜 이렇게 했나:** 이 Wiki에서 중요한 건 일반 지식이 아니라 실제 프로젝트에서 어떤 모델을 골랐고, MQTT payload를 어떻게 정했고, 어떤 장애가 있었는지 같은 내부 근거이기 때문이다.

**내가 직접 한 부분:** Markdown section 분리, chunk 생성, local embedding/vector store, 검색 점수 조합, 근거 부족 응답, 선택적 외부 LLM 호출 구조를 구현했다.

**기억할 단어 3개:** `문서 먼저 검색`, `근거만 답변`, `없으면 모른다고 하기`

**바로 나올 꼬리질문:**

- 왜 vector DB를 안 썼나요?
- local hash embedding이면 semantic 검색이 약하지 않나요?
- hallucination을 완전히 막을 수 있나요?
- chunk 크기는 왜 그렇게 정했나요?

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
- 최근 검증에서 search index는 49개 문서, RAG vector store는 `npm run rag:index` 실행 시 chunk 수를 `data/rag/index-manifest.json`에서 확인한다.

## 발생한 문제와 해결 과정

첫 번째 문제는 LLM이 문서에 없는 내용을 일반 지식으로 보완할 수 있다는 점이었다. 해결은 검색 결과가 없을 때 insufficient_context로 답하고 sources를 빈 배열로 반환하는 것이다.

두 번째 문제는 개인정보나 민감정보가 Wiki 문서에 포함될 수 있다는 점이었다. 해결은 전체 원문을 외부 LLM에 보내지 않고 검색된 관련 chunk만 전달하는 것이다.

세 번째 문제는 code fence 검색 한계다. `chunks.mjs`는 code fence를 제거하므로 Mermaid나 JSON payload 내부 토큰만으로는 RAG 검색이 약할 수 있다. 따라서 중요한 payload 구조와 Mermaid 흐름은 코드 블록 밖에도 설명 문장으로 요약해야 한다.

## 포트폴리오에 활용할 수 있는 문장

- 포트폴리오용 한 줄 요약은 `portfolio/resume-bullets.md` 및 `docs/rag-portfolio.md`를 참고한다. (본문 §「내가 구현/설계한 내용」과 중복 서술하지 않음.)

## 면접에서 받을 수 있는 질문과 답변

Q. 왜 그냥 챗봇이 아니라 RAG를 썼나요?
A. "이 Wiki는 일반 지식을 묻는 서비스가 아니라 제가 실제로 한 프로젝트를 다시 찾는 용도였습니다. 그래서 LLM 기억에 맡기기보다 문서를 먼저 검색하고, 검색된 내용 안에서만 답하게 했습니다. 이렇게 해야 '왜 YOLO26n을 골랐는지' 같은 질문에 실제 실험 문서를 근거로 답할 수 있습니다."

Q. vector DB를 썼나요?
A. "아니요. 지금 규모에서는 전용 DB까지 쓰는 게 오히려 복잡하다고 봐서 `ragVectorIndex.json` 파일로 시작했습니다. 문서가 많지 않을 때는 구조가 단순하고 결과를 재현하기도 쉬웠습니다. 대신 문서가 훨씬 많아지거나 여러 사용자가 동시에 색인해야 하면 그때는 vector DB로 옮기는 게 맞다고 생각합니다."

Q. 외부 LLM이 기본인가요?
A. "아닙니다. 키가 없어도 검색과 로컬 답변은 돌아가게 했습니다. 외부 LLM은 답변을 더 자연스럽게 만들고 싶을 때만 서버에서 선택적으로 쓰고, 프론트에는 API Key가 노출되지 않게 했습니다."

Q. hallucination은 어떻게 줄였나요?
A. "완전히 없앤다고 말하긴 어렵습니다. 대신 답할 근거가 없을 때 억지로 생성하지 않는 쪽으로 막았습니다. 검색 결과가 부족하면 `insufficient_context`를 반환하고, LLM을 쓰더라도 검색된 chunk만 넘겨서 답변 범위를 좁혔습니다."

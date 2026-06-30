---
title: Evidence Wiki - Portfolio Resume Usage
category: Project
tags: [portfolio, resume, interview, evidence-map, bullets, qa]
relatedDocs: [Evidence-Smart-Safety-System, Evidence-LLM-Wiki-RAG, Interview-Resume-Notes]
relatedFiles: [portfolio/project-evidence-map.md, portfolio/resume-bullets.md, portfolio/interview-answers.md]
updatedAt: 2026-06-30
---

# 포트폴리오/이력서 활용 문장 Evidence Wiki

## 문제 정의

기술 프로젝트를 포트폴리오에 옮길 때 가장 위험한 점은 구현, 설계, 검토, 실험을 섞어 과장하는 것이다. 이 Evidence Wiki는 각 프로젝트의 주장, 근거, 검증, 포트폴리오 문장을 연결해 면접에서 다시 설명 가능한 형태로 정리한다.

## 내가 구현/설계한 내용

- `portfolio/project-evidence-map.md`에 프로젝트별 주장, 근거, 검증, 포트폴리오 문장 구조를 추가했다.
- `portfolio/resume-bullets.md`에 바로 사용할 수 있는 이력서 bullet을 프로젝트별로 정리했다.
- `portfolio/interview-answers.md`에 예상 면접 질문과 답변을 프로젝트별로 정리했다.
- RAG 검색이 포트폴리오 근거를 찾을 수 있도록 이 문서와 각 Evidence Wiki 문서에서 핵심 표현을 code fence 밖 자연어로 반복했다.

## 기술 선택 이유

Evidence map은 면접에서 "정말 했는가", "어떤 근거가 있는가", "어디까지 구현했고 어디부터 설계인가"를 빠르게 확인하기 위한 구조다. Resume bullet은 짧고 강해야 하지만, 과장 없이 구현, 설계, 검토, 실험을 구분해야 한다. Interview answer는 답변이 길어질 때도 근거 문서와 연결되도록 작성한다.

## 실험 또는 검증 근거

Smart Safety 근거는 `AI-Pipeline`, `Model-Decision-YOLO26n`, `Model-Comparison`, `LSTM-Experiment-Results`, `WebRTC-vs-HLS`, `MQTT-Event-Schema`, `2026-06-30-Overlay-Tracking-Evidence-Log`에 연결된다.

LLM Wiki RAG 근거는 `docs/rag-portfolio.md`, `scripts/generate-rag-index.mjs`, `scripts/lib/rag/chunks.mjs`, `scripts/lib/rag/embedding.mjs`, `scripts/lib/rag/search.mjs`, `scripts/lib/rag/answer.mjs`, `tests/rag.test.mjs`, `tests/rag-evaluation.test.mjs`에 연결된다.



## 발생한 문제와 해결 과정

문제는 포트폴리오 문장이 기술 성과처럼 보이기 쉽지만, 실제 구현 완료와 설계 검토가 섞여 있다는 점이다. 해결은 각 bullet에 "구현", "설계", "검토", "실험", "계획" 표현을 명시적으로 사용하고, 문서별 근거 링크를 유지하는 것이다.

## 포트폴리오에 활용할 수 있는 문장

- 실시간 AI 관제 시스템에서 모델 선택, 영상 송출, 이벤트 metadata, evidence chain을 연결한 기술 의사결정 근거를 Wiki 문서로 구조화했습니다.
- LLM Wiki에 Markdown chunking, local hash embedding, JSON vector store 기반 RAG 질의응답 구조를 구현하고 grounded answer policy를 검증했습니다.

## 면접에서 받을 수 있는 질문과 답변

Q. 포트폴리오 문장과 실제 구현 범위를 어떻게 구분했나요?
A. 완료된 것은 구현, 수치가 있는 것은 실험 또는 검증, 아직 코드가 없는 것은 설계/검토/계획으로 표현했습니다. 특히 VLM, Synthetic Data, Self-Improving AI 항목은 완료처럼 쓰지 않도록 구분했습니다.

Q. Evidence Wiki가 왜 필요한가요?
A. 이력서 bullet만 있으면 근거가 약합니다. Evidence Wiki는 주장, 근거 문서, 검증 명령, 포트폴리오 문장을 연결해 면접 답변에서 바로 근거를 꺼낼 수 있게 합니다.

Q. RAG 검색에는 어떤 도움이 되나요?
A. RAG는 `content/*.md`만 인덱싱하므로, portfolio 폴더의 요약을 찾게 하려면 핵심 근거를 content Evidence 문서에도 넣어야 합니다. 이 문서는 포트폴리오/이력서 문장을 RAG 검색 대상으로 연결하는 역할을 합니다.

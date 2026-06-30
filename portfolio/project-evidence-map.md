# Project Evidence Map

이 문서는 각 프로젝트별 주장, 근거, 검증, 포트폴리오 문장을 연결한다. 구현 완료, 설계, 검토, 실험 계획은 의도적으로 구분한다.

## 스마트 안전 관제 시스템

| 주장 | 근거 | 검증 | 포트폴리오 문장 |
| --- | --- | --- | --- |
| YOLO Pose + ByteTrack + LSTM 기반 AI pipeline을 구성했다. | `AI-Pipeline`, `AI-Output-JSON`, `Architecture` | 문서상 RTSP reader, YOLO26n-pose, ByteTrack, LSTM, MQTT 흐름 확인 | RTSP 입력부터 YOLO Pose, ByteTrack, LSTM, MQTT event까지 이어지는 AI 관제 파이프라인을 구성했습니다. |
| YOLO26n-pose 선택은 Faint Recall 우선 정책에 근거한다. | `Model-Decision-YOLO26n`, `Model-Comparison`, `LSTM-Experiment-Results` | yolo26n-pose Faint Recall 0.750877, FN 142 fast comparison 근거 | 모델 선택을 accuracy가 아니라 실신 미탐 방지 기준으로 비교하고 yolo26n-pose 선택 근거를 정리했습니다. |
| WebRTC primary, HLS fallback 구조를 설계했다. | `WebRTC-vs-HLS`, `ADR-001-WebRTC` | WHEP WebRTC는 1초 이하 목표, HLS는 fallback 문서 확인 | 저지연 관제를 위해 WebRTC를 primary live view로, HLS를 fallback으로 분리 설계했습니다. |
| MQTT overlay/event metadata 분리 구조를 정리했다. | `MQTT-Event-Schema`, `ADR-002-MQTT-Metadata-Separation` | eventId, timestampMs, streamId, camera_login_id와 민감정보 제외 원칙 확인 | AI event metadata와 사용자/기관 권한 resolve 책임을 분리한 MQTT 계약을 정리했습니다. |
| frameId/timestamp 기반 evidence chain이 필요하다. | `2026-06-30-Overlay-Tracking-Evidence-Log`, `Multi-Camera-Frame-Latency-Report` | evidenceId = cameraLoginId-frameId-capturedAtMs 문서 확인 | frameId, capturedAtMs, evidenceId 기반으로 overlay와 event, clip metadata를 묶는 evidence chain을 설계했습니다. |
| Self-Improving AI, VLM, Synthetic Data는 확장 계획이다. | `2026-06-30-Overlay-Tracking-Evidence-Log`, `Interview-Resume-Notes` | 구현 완료가 아니라 hard negative, VLM 보조 설명, synthetic augmentation 계획으로 확인 | Self-Improving AI와 Synthetic Data는 구현 완료가 아니라 FP/FN 기반 데이터 개선 계획으로 구분해 정리했습니다. |

## LLM Wiki RAG

| 주장 | 근거 | 검증 | 포트폴리오 문장 |
| --- | --- | --- | --- |
| Markdown heading 기반 chunking을 구현했다. | `scripts/lib/rag/chunks.mjs`, `docs/rag-portfolio.md` | `npm test`에서 chunk metadata와 embedding 생성 검증 | Markdown 문서를 heading 단위로 chunking해 RAG 검색 가능한 근거 단위로 변환했습니다. |
| local hash embedding 기반 무료/저비용 검색을 구현했다. | `scripts/lib/rag/embedding.mjs`, `scripts/lib/rag/search.mjs` | 256차원 local-hash-tfidf, cosine similarity, keyword overlap 확인 | 외부 embedding API 없이 local hash vector와 keyword overlap을 조합한 검색 구조를 구현했습니다. |
| JSON 기반 vector store를 사용한다. | `data/ragVectorIndex.json`, `scripts/generate-rag-index.mjs` | `npm run rag:index`로 JSON vector store 생성 | 별도 상용 vector DB 없이 JSON 파일 기반 vector store로 작은 Wiki RAG를 구성했습니다. |
| grounded answer와 hallucination 방지 응답을 구현했다. | `scripts/lib/rag/answer.mjs`, `tests/rag.test.mjs`, `tests/rag-evaluation.test.mjs` | 근거 부족 질문은 insufficient_context와 빈 sources 반환 | 검색 결과가 없을 때 추측하지 않고 insufficient_context로 응답하는 grounded answer policy를 구현했습니다. |
| 외부 LLM은 서버 측 선택 호출이다. | `server.mjs`, `scripts/lib/rag/answer.mjs`, `docs/rag-portfolio.md` | `RAG_LLM_API_KEY`가 있을 때만 서버에서 호출 | API Key를 frontend에 노출하지 않고 서버 측에서만 선택적으로 외부 LLM을 호출하도록 설계했습니다. |



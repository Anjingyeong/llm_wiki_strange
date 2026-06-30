# Resume Bullets

총 12개 bullet 초안이다. 제출 전 직무와 검증 상태에 맞춰 "구현", "설계", "검토", "실험", "계획" 표현을 유지한다.

## 스마트 안전 관제 시스템

1. RTSP 입력부터 YOLO26n-pose, ByteTrack, LSTM, MQTT event까지 이어지는 실시간 AI 관제 파이프라인을 구성했습니다.
2. YOLO pose 모델 후보를 downstream LSTM 기준으로 비교하고, Faint Recall 우선 정책에 따라 yolo26n-pose 선택 근거를 정리했습니다.
3. WebRTC를 primary live view로, HLS를 fallback으로 두는 저지연 관제 영상 송출 구조를 설계 검토했습니다.
4. MQTT payload에는 event metadata만 싣고 사용자/기관 권한 resolve는 Backend에서 처리하는 metadata 분리 구조를 정리했습니다.
5. frameId, capturedAtMs, evidenceId 기반 evidence chain으로 overlay, event, frame_sync, clip metadata 추적 가능성을 높이는 방향을 설계했습니다.
6. ByteTrack tracking 품질과 overlay sync 문제를 fallbackIdRate, missingBBoxRate, trackSwitchCount, avgSelectedDeltaMs 같은 지표로 진단하는 기준을 정리했습니다.
7. Self-Improving AI, VLM, Synthetic Data는 구현 완료가 아니라 FP/FN 기반 데이터 개선과 사건 설명 생성의 확장 계획으로 구분해 정리했습니다.

## LLM Wiki RAG

8. Markdown 문서를 heading 단위로 chunking하고 JSON 기반 vector store를 생성하는 RAG indexing pipeline을 구현했습니다.
9. 외부 embedding API 없이 256차원 local hash embedding과 keyword overlap을 조합한 무료/저비용 검색 구조를 구현했습니다.
10. 검색 결과가 없을 때 insufficient_context와 빈 sources를 반환해 문서 근거 없는 답변을 방지하는 grounded answer policy를 구현했습니다.
11. 외부 LLM 호출을 서버 측으로 제한하고 API Key가 frontend에 노출되지 않도록 `/api/rag/ask` 구조로 분리했습니다.
12. 10개 대표 질문 기반 retrieval evaluation을 추가해 expected document가 top-k에 포함되는지 deterministic하게 검증했습니다.



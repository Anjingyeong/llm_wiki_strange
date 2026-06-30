# Interview Answers

총 14개 예상 질문과 답변이다. 완료 구현과 확장 계획을 명확히 구분한다.

## 스마트 안전 관제 시스템

### Q1. YOLO26n-pose를 선택한 근거는 무엇인가요?

A. 실신 감지는 미탐 비용이 크기 때문에 Faint Recall을 우선했습니다. fast comparison 기준 yolo26n-pose는 Faint Recall 0.750877, F1 0.612303, FP 400, FN 142로 기록되어 기본 후보로 유지했습니다. 다만 FP도 함께 증가하므로 threshold, cooldown, 알림 scope와 함께 검증해야 한다고 정리했습니다.

### Q2. 왜 YOLO Pose + ByteTrack + LSTM 구조인가요?

A. YOLO Pose는 사람 bbox와 keypoint를 추출하고, ByteTrack은 동일 인물의 track continuity를 유지합니다. LSTM은 track별 keypoint sequence를 받아 Normal/Faint를 판단하므로 단일 프레임보다 행동 변화 관찰에 적합합니다.

### Q3. WebRTC와 HLS는 어떻게 나누었나요?

A. WebRTC는 MediaMTX WHEP 경로로 저지연 live view에 적합해 primary로 두었습니다. HLS는 segment와 buffer 때문에 지연이 크지만 안정적인 fallback으로 유지했습니다.

### Q4. MQTT metadata 분리는 왜 필요한가요?

A. AI payload가 사용자 권한이나 기관 scope를 직접 결정하면 보안과 책임 경계가 흐려집니다. MQTT에는 eventId, timestampMs, streamId, camera_login_id, events 같은 metadata만 담고, Backend가 camera registry를 기준으로 권한과 알림 scope를 resolve하도록 분리했습니다.

### Q5. evidenceId는 왜 별도로 필요한가요?

A. 관제 시스템에서는 특정 overlay, event, frame_sync, clip metadata가 같은 프레임을 가리키는지 추적해야 합니다. cameraLoginId, frameId, capturedAtMs를 묶은 evidenceId는 디버깅과 감사 가능성을 높이는 기준입니다.

### Q6. Self-Improving AI는 구현됐나요?

A. 구현 완료가 아니라 확장 설계와 실험 계획입니다. 먼저 evidence chain 정합성을 확보한 뒤, FP/FN을 review_status 기반 후보 데이터로 수집해 training_manifest_v2를 만드는 방향입니다.

### Q7. Synthetic Data는 어떻게 사용할 계획인가요?

A. 생성형 영상 모델보다 기존 clip 기반 brightness, noise, blur, compression, occlusion 같은 vision augmentation부터 검토합니다. parent_clip_id를 보존하고 train/test split을 parent 단위로 유지해 leakage를 막는 것이 핵심입니다.

### Q8. VLM은 어떤 역할인가요?

A. 현재 구현 완료가 아니라 snapshot 또는 clip 기반 사건 설명을 보조하는 확장 방향입니다. VLM이 최종 판단을 대신하기 전에 frame evidence chain과 clip metadata 정합성이 먼저 필요합니다.

## LLM Wiki RAG

### Q9. 왜 단순 챗봇이 아니라 RAG인가요?

A. 이 프로젝트의 답변은 내부 문서의 근거가 중요합니다. RAG는 질문 전에 Wiki 문서를 검색하고 검색된 chunk만 답변 context로 사용하므로, 모델이 일반 지식으로 아는 척할 위험을 줄일 수 있습니다.

### Q10. Markdown chunking은 어떻게 하나요?

A. `content/*.md`를 읽고 frontmatter와 본문을 분리한 뒤, `#`, `##`, `###` heading 기준으로 section을 나눕니다. code fence와 일부 Markdown 기호를 제거한 plain text를 기본 1100자 chunk로 나눕니다.

### Q11. local hash embedding은 어떤 구조인가요?

A. 외부 embedding API를 쓰지 않고 토큰을 stable hash로 256차원 vector bucket에 누적한 뒤 정규화합니다. 검색에서는 cosine similarity 0.7과 keyword overlap 0.3을 조합합니다.

### Q12. vector DB를 사용했나요?

A. 전용 vector DB는 사용하지 않았습니다. 현재는 `data/ragVectorIndex.json` 파일 기반 vector store입니다. 작은 Wiki에는 단순하고 재현 가능하지만 대규모 문서나 동시 reindex에는 한계가 있습니다.

### Q13. hallucination은 어떻게 막나요?

A. 검색 결과가 없으면 `answered`가 아니라 `insufficient_context`를 반환하고 sources를 빈 배열로 둡니다. 외부 LLM을 쓸 때도 검색된 chunk만 context로 전달합니다.

### Q14. API Key는 frontend에 노출되나요?

A. 노출되지 않습니다. frontend는 `/api/rag/ask`만 호출하고, `RAG_LLM_API_KEY`는 서버 측 `answer.mjs`에서만 사용합니다.

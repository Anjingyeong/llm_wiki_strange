# RAG System Performance Benchmark Report

This report compares the performance of the Baseline (Vector-only) retrieval versus the optimized Hybrid RAG pipeline.

## Quantitative Comparison Summary

| Metric | Baseline | Hybrid | Change |
| :--- | :---: | :---: | :---: |
| **Hit@1** | 0.455 | 0.409 | **-0.045** |
| **Hit@3** | 0.455 | 0.591 | **+0.136** |
| **Hit@5** | 0.455 | 0.682 | **+0.227** |
| **MRR@5** | 0.455 | 0.520 | **+0.066** |
| **Context Precision@5** | 0.355 | 0.273 | **-0.082** |
| **Keyword Coverage** | 0.389 | 0.493 | **+0.104** |
| **Avg Search Latency** | 1.48ms | 31.13ms | **+29.654**ms |

> [!NOTE]
> Dataset Size: 22 evaluation questions. due to the small scale, results show indicative progress but statistical margins apply.

## Detailed Question-by-Question Results

| ID | Question | Baseline Hit@5 | Hybrid Hit@5 | Baseline MRR@5 | Hybrid MRR@5 | Outcome |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| q001 | RTSP overlay 밀림 원인은? | 0 | 1 | 0.00 | 0.25 | 🟢 **Hybrid Fixed Fail** |
| q002 | cameraLoginId 동적 할당은 왜 필요했어? | 0 | 0 | 0.00 | 0.00 | No Change |
| q003 | YOLO26n을 최종 선택한 이유는? | 0 | 1 | 0.00 | 0.50 | 🟢 **Hybrid Fixed Fail** |
| q004 | MQTT 이벤트 payload 구조 설명해줘 | 0 | 0 | 0.00 | 0.00 | No Change |
| q005 | 프레임 동기화에서 frameId와 timestamp가 왜 중요해? | 1 | 1 | 1.00 | 1.00 | No Change |
| q006 | MJPEG stream not ready 문제는 왜 발생했어? | 1 | 1 | 1.00 | 1.00 | No Change |
| q007 | Cloudflare Functions에서 405 오류는 왜 났어? | 0 | 0 | 0.00 | 0.00 | No Change |
| q008 | LLM Wiki에서 Hybrid RAG를 적용한 이유는? | 0 | 1 | 0.00 | 0.50 | 🟢 **Hybrid Fixed Fail** |
| q009 | GraphRAG는 왜 지금 바로 도입하지 않았어? | 0 | 0 | 0.00 | 0.00 | No Change |
| q010 | Langfuse는 이 구조에서 어디에 붙이면 좋아? | 0 | 0 | 0.00 | 0.00 | No Change |
| q011 | LSTM 시퀀스 길이 비교 결과는? | 1 | 1 | 1.00 | 0.50 | 📉 **Hybrid Ranked Lower** |
| q012 | WebRTC와 HLS 성능 비교해줘 | 1 | 1 | 1.00 | 0.50 | 📉 **Hybrid Ranked Lower** |
| q013 | 피처 벡터 51차원과 54차원 차이는? | 0 | 0 | 0.00 | 0.00 | No Change |
| q014 | ByteTrack 트래커의 프레임 레이트 미스매치 문제 해결 방법은? | 0 | 0 | 0.00 | 0.00 | No Change |
| q015 | 알림 범위(Notification Scope) 버그 수정 내용이 뭐야? | 1 | 1 | 1.00 | 1.00 | No Change |
| q016 | 코드블록이 화면에서 안 보였던 버그는? | 1 | 1 | 1.00 | 1.00 | No Change |
| q017 | RTSP 스트림 404 에러의 주된 원인은? | 1 | 1 | 1.00 | 1.00 | No Change |
| q018 | 모니터링 대시보드의 mjpeg 포트 할당 공식은? | 1 | 1 | 1.00 | 1.00 | No Change |
| q019 | ADR-002에서 설계한 메타데이터 분리 장점은? | 1 | 1 | 1.00 | 1.00 | No Change |
| q020 | 이 위키의 구현 목표와 포트폴리오 활용법 알려줘 | 1 | 1 | 1.00 | 1.00 | No Change |
| q_mjpeg_rollback | 왜 WebRTC/HLS 대신 MJPEG로 원복했어? | 0 | 1 | 0.00 | 0.20 | 🟢 **Hybrid Fixed Fail** |
| q_mjpeg_scope_control | MJPEG로 원복한 결정이 기능 축소가 아니라 우선순위 재조정인 이유는? | 0 | 1 | 0.00 | 1.00 | 🟢 **Hybrid Fixed Fail** |

## LLM Judge Evaluations (Optional)
LLM Judge is currently **DISABLED**.

To enable OpenAI GPT evaluations, set `ENABLE_LLM_JUDGE=true` in environment variables.
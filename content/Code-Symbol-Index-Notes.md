---
title: Code Symbol Index Notes
navTitle: 코드 심볼 인덱스
shortTitle: 코드 심볼
category: AI Pipeline
tags: [code-symbol, vlm, clip, scheduler, index]
relatedDocs: [Evidence-VLM-RAG-Event-Search-Decision, VLM-RAG-DBless-Mock-MVP, Multi-Camera-Worker-Session-Reliability, MQTT-Event-Schema]
relatedFiles: [strange_ai/ai/vlm/processing_scheduler.py, strange_ai/ai/vlm/clip_window.py, strange_ai/ai/worker_session.py]
entities: [VlmProcessingScheduler, clip_end_sec, clip_start_sec, reset_analysis_session]
updatedAt: 2026-07-18
type: evidence
portfolio_use: true
implementation_status: implemented
---

# Code Symbol Index Notes

Wiki Hybrid 검색이 클래스명·설정 키 같은 exact symbol을 안정적으로 찾도록, 코드 계약에 등장하는 식별자를 문서화한다. 이 문서는 신규 검색 엔진이 아니라 **기존 BM25 exact-term 경로가 심볼을 색인할 수 있게 하는 최소 근거 문서**다.

## VlmProcessingScheduler

`VlmProcessingScheduler`는 알림 이후 VLM 후처리 job을 스케줄하는 컴포넌트 이름이다.

- 역할: incident/snapshot job queue 관리, rate limit, worker claim
- 검색 키: `VlmProcessingScheduler`, VLM scheduler, processing scheduler
- 관련 문서: `Evidence-VLM-RAG-Event-Search-Decision`, `VLM-RAG-DBless-Mock-MVP`
- 관련 코드 경로(레포 외부 참조): `strange_ai/ai/vlm/processing_scheduler.py`

운영 GPU VLM 품질 수치 자체는 이 문서에서 확정하지 않는다. 심볼·계약 위치만 고정한다.

## clip_end_sec / clip_start_sec

이벤트 클립 구간의 끝·시작 시각 필드다.

- `clip_start_sec`: clip window 시작(초)
- `clip_end_sec`: clip window 끝(초)
- 용도: VLM keyframe 선정, 알림 전후 context window, 검색 문서 타임라인
- 검색 키: `clip_end_sec`, `clip_start_sec`, clip window

관련 코드 경로(레포 외부 참조): `strange_ai/ai/vlm/clip_window.py`

## tracker reset 관련 심볼

영상이 바뀌거나 끝났을 때 tracker/sequence 상태를 초기화하는 경로는 `reset_analysis_session`이다.

- 트리거 예: `VIDEO_EOF`, source change, RTSP reconnect 이후 세션 경계
- 목적: 이전 track_id / LSTM sequence / Fall 상태가 새 세션으로 섞이지 않게 함
- 상세 근거 문서: `Multi-Camera-Worker-Session-Reliability`

## 검색 검증용 심볼 목록

| 심볼 | 종류 | 설명 |
| --- | --- | --- |
| `VlmProcessingScheduler` | class | VLM 후처리 스케줄러 |
| `clip_end_sec` | field | clip 종료 시각(초) |
| `clip_start_sec` | field | clip 시작 시각(초) |
| `reset_analysis_session` | function | 영상 변경/EOF 시 분석 상태 초기화 |
| `cameraLoginId` | id | 런타임 카메라 식별자 |
| `build_safety_event` | function | MQTT safety event payload builder |

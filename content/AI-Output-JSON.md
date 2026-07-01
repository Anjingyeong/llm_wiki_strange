---
title: AI Output JSON
category: AI Pipeline
relatedDocs: [AI-Pipeline, MQTT-Event-Schema, Architecture]
relatedFiles: [strange_ai/.env.example, PROJECT_CONTRACT.md, docs/wiki/data/modelMetrics.json]
updatedAt: 2026-06-26
---

## 목적

AI worker가 영상 분석 결과를 어떤 JSON 구조로 Backend에 전달해야 하는지 LLM이 빠르게 확인할 수 있게 정리한다.

## 배경

AI는 관제자를 대체하는 시스템이 아니라 판단 공백을 줄이는 보조 시스템이다. 따라서 이벤트 JSON은 "무엇을 봤는가"와 "어느 카메라에서 봤는가"를 명확히 전달해야 하며, 사용자 권한과 알림 범위 판단은 Backend의 camera registry에서 해결한다.

## 핵심 내용

- Topic은 `safety/events`를 사용한다.
- `streamId`와 `camera_login_id`는 MediaMTX RTSP path의 `{cameraLoginId}`와 일치해야 한다.
- `events` 배열에는 한 frame 또는 한 판단 window에서 발생한 후보 이벤트를 넣는다.
- 원본 RTSP URL, 토큰, 비밀번호는 payload에 넣지 않는다.

## 입력

- Camera/RTSP stream
- `YOLO26n-pose` bbox/keypoint 결과
- ByteTrack track id
- LSTM `Normal/Faint` probability
- threshold와 cooldown 결과

## 출력

```json
{
  "schemaVersion": "1.0",
  "eventId": "evt-20260623-cam_01-000001",
  "timestampMs": 1782180000123,
  "streamId": "cam_01",
  "camera_login_id": "cam_01",
  "frameWidth": 640,
  "frameHeight": 360,
  "events": [
    {
      "type": "faint",
      "confidence": 0.87,
      "bbox": [120, 80, 260, 360],
      "trackId": 3,
      "memoText": "실신 의심"
    }
  ]
}
```

## 동작 흐름

```text
RTSP frame
-> YOLO26n-pose
-> ByteTrack
-> keypoint sequence
-> LSTM Normal/Faint
-> threshold and cooldown
-> MQTT JSON publish
```

## 관련 파일

- `strange_ai/.env.example`
- `PROJECT_CONTRACT.md`
- `docs/wiki/data/modelMetrics.json`

## 관련 문서

- [AI-Pipeline](AI-Pipeline.md)
- [MQTT-Event-Schema](MQTT-Event-Schema.md)
- [Architecture](Architecture.md)

## 주의사항

`cameraLoginId`와 RTSP path가 어긋나면 Frontend 영상은 열리는데 Backend 이벤트 매핑은 실패할 수 있다. `cam1` 같은 임시 path는 운영 문서 예시로 쓰지 않는다.

## 후속 작업

Backend DTO alias와 AI publisher 출력 필드를 같은 sample payload로 스냅샷 테스트한다.

---
#ai-output #json #mqtt #event-schema #inference

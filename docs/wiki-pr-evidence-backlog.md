# PR → Wiki Evidence Backlog

별도 Wiki 문서로 **승격 가치 높음**. 작은 수정은 PR Evidence Map에만 기록.

## AI

| 주제 | PR | Wiki 후보 slug (신규) |
|------|-----|----------------------|
| Standing Faint 오탐·자세 Gate | #83 | `ED-Upright-Faint-Gate` 또는 Bug 스타일 |
| Recovery relink Motion Spike | #82 | `ED-Recovery-Motion-Spike-Mask` |
| Timestamp LSTM sequence 보강 | #80 | `ED-LSTM-Timestamp-Sequence` |
| MQTT Durable Outbox | #80 | `ED-MQTT-Durable-Outbox` |
| Incident Recovery track 이관 | #77~80 | Tracking 문서 § 보강 |
| VLM 8 keyframes | #85~87 | `ED-VLM-Eight-Keyframes` |

## Backend

| 주제 | PR | Wiki 후보 |
|------|-----|-----------|
| Least-used 가상 카메라 배정 | #10·#11 | `ED-Virtual-Camera-Least-Used` |
| VLM token filter | #9 | Incident 또는 backlog only |
| Acknowledge → S3 → VLM job | #12 | `ED-Incident-Acknowledge-VLM-Pipeline` |

## Frontend

| 주제 | PR | Wiki 후보 |
|------|-----|-----------|
| 중복 streamUrl 바인딩 | #16 | `Bug-Duplicate-Stream-Binding` |
| Stale stream 자동 재연결 | #13 | Realtime-Camera § 또는 신규 Incident |
| Incident 의미 검색 UI | #14·#15 | VLM-RAG-DBless § UI |

## PR 본문 최소 형식

Problem → Decision → Changes → Result (수치) → Not verified → Evidence (Wiki slug)

## PR 제목 예

```text
fix(ai): 재연결 구간 motion spike를 차단해 standing Faint 오탐 방지
feat(back): 사고 승인 시 S3 클립 저장과 VLM 작업 생성 연결
fix(front): 중복 streamUrl 바인딩 감지 및 stale stream 자동 복구
```
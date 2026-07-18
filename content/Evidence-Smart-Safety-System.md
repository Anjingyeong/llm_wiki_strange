---
title: Evidence Wiki - Smart Safety Monitoring
navTitle: "시스템 근거"
shortTitle: "시스템 근거"
category: Project
tags: [portfolio, evidence, smart-safety, yolo26n, bytetrack, lstm, webrtc, mqtt]
relatedDocs: [Overview, Architecture, AI-Pipeline, Model-Decision-YOLO26n, Model-Comparison, LSTM-Experiment-Results, WebRTC-vs-HLS, MQTT-Event-Schema, 2026-06-30-Overlay-Tracking-Evidence-Log]
relatedFiles: [portfolio/project-evidence-map.md, portfolio/resume-bullets.md, portfolio/interview-answers.md]
updatedAt: 2026-06-30
project: smart-safety-ai
type: evidence
status: partial
evidenceLevel: code-only
portfolio_use: true
evidence_type: STAR
---

# 스마트 안전 관제 시스템 Evidence Wiki

## 문제 정의

스마트 안전 관제 시스템은 CCTV 또는 RTSP 카메라 영상을 실시간으로 분석해 실신, 쓰러짐 같은 안전 이벤트를 감지하고 관제 화면과 알림 흐름으로 전달하는 프로젝트다. 핵심 문제는 단순히 AI 모델이 Faint를 맞히는 것이 아니라, 어떤 프레임에서 어떤 사람이 왜 이벤트로 판단되었는지 overlay, event, frame_sync, clip metadata까지 추적 가능한 evidence chain을 유지하는 것이다.

실시간 관제에서는 미탐이 관제 공백으로 이어지고, 오탐은 알림 피로도와 신뢰도 저하로 이어진다. 따라서 모델 선택, threshold, tracking, 영상 송출, MQTT metadata, frontend overlay는 모두 하나의 기술 근거 흐름으로 설명되어야 한다.

## 내가 구현/설계한 내용

- RTSP 입력에서 YOLO Pose, ByteTrack, LSTM, MQTT event로 이어지는 AI 파이프라인 구조를 문서화하고 검증 기준을 정리했다.
- YOLO26n-pose를 기본 pose extractor 후보로 선택한 근거를 Faint Recall, F1, FP, FN 관점에서 정리했다.
- WebRTC를 기본 live view로 두고 HLS를 fallback으로 유지하는 영상 송출 판단을 ADR과 비교 문서로 정리했다.
- MQTT payload에는 event metadata만 싣고 사용자/기관 권한과 알림 scope는 Backend에서 resolve하는 metadata 분리 구조를 정리했다.
- frameId, capturedAtMs, evidenceId를 중심으로 overlay, event, frame_sync, clip metadata를 묶는 evidence chain 필요성을 정리했다.
- ByteTrack과 supervision tracking 품질을 점검하고 fallbackIdRate, missingBBoxRate, trackSwitchCount, avgSelectedDeltaMs 같은 진단 지표를 정리했다.
- Self-Improving AI, VLM, Synthetic Data는 구현 완료가 아니라 frame evidence chain 정합성 이후 붙일 확장 설계와 실험 계획으로 분리했다.

## 기술 선택 이유

YOLO Pose + ByteTrack + LSTM 구조를 선택한 이유는 사람 bbox와 17개 COCO keypoint를 먼저 추출하고, 같은 사람의 track별 sequence를 유지한 뒤, 시간 흐름을 보는 LSTM으로 Normal/Faint를 판단하기 위해서다. 단일 프레임 pose 판단보다 sequence 기반 판단이 쓰러짐 같은 행동 변화에 더 적합하다.

YOLO26n-pose는 fast downstream LSTM 비교에서 Faint Recall 0.750877, F1 0.612303, FP 400, FN 142를 기록했다. 같은 비교에서 yolo11n-pose는 F1과 Accuracy가 더 좋지만 Faint Recall이 0.657293으로 낮아, "실신 미탐 방지" 우선 정책에서는 yolo26n-pose를 유지하는 판단을 했다.

WebRTC는 MediaMTX WHEP 경로로 1초 이하 저지연 관제 목표에 적합하고, HLS는 segment와 buffering 때문에 지연이 커 fallback으로 둔다. MQTT는 영상 binary 전송이 아니라 안전 이벤트 metadata 전송에 집중하고, 영상 clip은 별도 HLS/S3 구조로 분리하는 설계를 채택했다.

## 실험 또는 검증 근거

- `AI-Pipeline` 문서는 RTSP reader, YOLO26n-pose, ByteTrack, keypoint sequence, LSTM, event decision, MQTT publish 흐름을 설명한다.
- `Model-Decision-YOLO26n` 문서는 2026-06-26 GPU benchmark 기준 yolo26n-pose 선택 근거를 Faint Recall 우선 정책으로 기록한다.
- `Model-Comparison` 문서는 여섯 개 pose extractor의 downstream LSTM 비교 결과와 FP/FN을 정리한다.
- `LSTM-Experiment-Results` 문서는 최종 split audit에서 threshold 0.5 기준 Accuracy 0.773186, Precision 0.738662, Faint Recall 0.774547, F1 0.756179를 기록한다.
- `WebRTC-vs-HLS`와 `ADR-001-WebRTC`는 WebRTC primary live view, HLS fallback 판단을 정리한다.
- `MQTT-Event-Schema`와 `ADR-002-MQTT-Metadata-Separation`은 eventId, timestampMs, streamId, camera_login_id, events 중심 payload와 민감정보 제외 원칙을 정리한다.
- `2026-06-30-Overlay-Tracking-Evidence-Log`는 evidenceId = cameraLoginId-frameId-capturedAtMs 구조, frameId=n/a 문제 진단, hard negative와 synthetic data 계획을 기록한다.

## 발생한 문제와 해결 과정

첫 번째 문제는 RTSP latest-frame queue에서 오래된 프레임을 drop하는 구조가 실시간성에는 맞지만, payload가 reader의 최신 프레임 기준으로 만들어지면 AI가 실제 처리한 프레임과 event metadata가 어긋날 수 있다는 점이었다. 해결 방향은 processedAtMs 시점의 실제 처리 FramePacket 내부 frameId, capturedAtMs, cameraLoginId, evidenceId, traceId, droppedFrameCount를 기준으로 payload를 만드는 것이다.

두 번째 문제는 overlay-sync 로그에서 frameId=n/a, capturedAtMs=n/a, publishedAtMs=n/a가 관측된 것이다. 이 문제는 AI raw payload builder, Backend clear overlay 로직, Frontend normalization 파싱 로직 중 어디에서 필드가 유실되는지 분리 진단해야 하는 문제로 정리했다.

세 번째 문제는 일반 bbox가 FAINT 12%, FAINT 17%처럼 이벤트 박스로 표시되는 UI 혼선이었다. confidence 값이 12, 12%, 0.12처럼 섞여 들어올 수 있으므로 confidence normalization과 event 여부 판단을 분리해야 한다는 근거를 남겼다.

## 확장 설계와 실험 계획

Self-Improving AI는 현재 구현 완료가 아니라 hard negative mining과 faint reinforcement 후보 수집을 위한 확장 방향이다. 오탐 False Positive는 Normal 후보로 export하되 review_status=pending으로 두고, 사람이 승인한 데이터만 training_manifest_v2에 포함시키는 human-in-the-loop 구조가 필요하다.

VLM 기반 사건 설명 생성은 현재 구현 완료가 아니라 snapshot 또는 clip 기반 보조 설명 후보로 검토하는 방향이다. VLM을 최종 판단기로 두기 전에 frame evidence chain과 clip metadata 정합성이 먼저 보장되어야 한다.

Synthetic Data는 현재 구현 완료가 아니라 hard case 보강 계획이다. Brightness, Noise, Blur, Compression, Scale down, Partial occlusion, Horizontal flip 같은 고전적 vision augmentation을 우선 검토하고, parent_clip_id를 보존해 Train/Test split leakage를 막으며, max_synthetic_ratio=0.3 같은 비율 통제를 계획한다.

## 포트폴리오에 활용할 수 있는 문장

- RTSP 입력부터 YOLO26n-pose, ByteTrack, LSTM, MQTT event까지 이어지는 실시간 AI 관제 파이프라인의 판단 근거와 데이터 흐름을 문서화했습니다.
- YOLO pose 모델 선택을 단순 accuracy가 아니라 Faint Recall, FP/FN, 운영 오탐 비용 기준으로 비교하고 yolo26n-pose 선택 근거를 정리했습니다.
- WebRTC를 primary live view로, HLS를 fallback으로 두는 저지연 관제 영상 송출 구조를 설계 검토했습니다.
- frameId, capturedAtMs, evidenceId 기반 evidence chain을 정의해 overlay, event, frame_sync, clip metadata의 추적 가능성을 높이는 방향을 설계했습니다.
- Self-Improving AI와 Synthetic Data는 구현 완료가 아니라 FP/FN 기반 재학습 후보 수집과 데이터 누수 방지 계획으로 구분해 정리했습니다.

## 면접에서 받을 수 있는 질문과 답변

Q. 왜 YOLO26n-pose를 선택했나요?
A. 이 프로젝트는 실신 미탐 비용이 크기 때문에 Faint Recall을 우선했습니다. fast comparison 기준 yolo26n-pose는 Faint Recall 0.750877로 가장 높고 FN이 142로 가장 낮아 기본 후보로 유지했습니다. 다만 FP가 400개라 threshold, cooldown, 알림 scope와 함께 검증해야 한다고 문서화했습니다.

Q. WebRTC와 HLS를 어떻게 나누었나요?
A. WebRTC는 MediaMTX WHEP 기반 저지연 live view에 적합해 primary로 두고, HLS는 segment buffering으로 지연이 크지만 안정적인 fallback으로 유지했습니다. AI to MQTT to Backend 이벤트 경로는 영상 송출 경로와 분리했습니다.

Q. evidenceId가 왜 필요한가요?
A. 관제 시스템에서는 어떤 프레임의 어떤 bbox가 어떤 이벤트와 clip으로 이어졌는지 추적해야 합니다. cameraLoginId, frameId, capturedAtMs를 묶은 evidenceId를 기준으로 overlay, event, frame_sync, clip metadata를 연결하면 디버깅과 감사 가능성이 높아집니다.

Q. Self-Improving AI는 구현됐나요?
A. 아닙니다. 현재는 확장 설계와 실험 계획 단계입니다. 먼저 evidence chain 정합성을 확보하고, 그 다음 FP/FN을 review_status 기반 후보 데이터로 수집해 training_manifest_v2를 만드는 방향입니다.

---
title: Plan - WebRTC DataChannel based Video-Overlay Synchronization
navTitle: DataChannel Sync
shortTitle: DataChannel Sync
category: Architecture
relatedDocs: [ADR-001-WebRTC, WebRTC-vs-HLS, Bug-AI-Tracker-FrameRate-Mismatch]
relatedFiles: [strange_ai/scripts/serve_ai_overlay.py, strange_front/src/features/dashboard/pages/UserDashboard.tsx]
updatedAt: 2026-07-03
project: smart-safety-ai
type: architecture-plan
portfolio_use: true
---

## 1. 현황 및 문제 제기 (Background)

### 1.1 전송 이원화로 인한 동기화 어긋남
* 현재 시스템은 영상 스트림과 AI 분석 메타데이터(Bounding Box 오버레이 등)가 서로 물리적으로 분리된 전송 경로를 사용하여 클라이언트로 유입됨.
  * **영상 경로**: RTSP 카메라 $\rightarrow$ MediaMTX $\rightarrow$ WebRTC/HLS $\rightarrow$ 프론트엔드 비디오 렌더링
  * **오버레이 경로**: RTSP 카메라 $\rightarrow$ AI Worker $\rightarrow$ MQTT $\rightarrow$ 백엔드 $\rightarrow$ STOMP/WebSocket $\rightarrow$ 프론트엔드 Canvas 오버레이 렌더링
* 이 구조로 인해 데이터 큐 적체, MQTT 브로커 전송 지연, 웹소켓 릴레이 속도 차이가 합산되며 화면에 그려지는 영상의 프레임과 오버레이 박스의 시간축 불일치가 **최대 5~6초** 수준 발생함.

### 1.2 프레임 식별 정보 부재
* MediaMTX/HLS 영상 프레임 내에 AI 추론 단계의 고유한 `frameId`가 주입되지 않음.
* HTML5 비디오 태그 렌더링 과정에서 현재 디코딩되고 있는 비주얼 프레임의 정확한 프레임 ID를 역산하거나 바인딩하는 방법이 부재하여 클라이언트 단의 정밀 동기화가 불가능한 구조임.

---

## 2. WebRTC DataChannel 기반 동기화 전략 (Key Strategy)

실시간 고정밀 동기화를 달성하기 위해, **동일한 WebRTC Connection 세션** 내부에서 비디오 트랙과 메타데이터 채널을 단일 파이프라인으로 바인딩하여 릴레이하는 설계를 수립함.

```text
+-----------------------+
|      RTSP Camera      |
+-----------------------+
            |
            v
+-----------------------+
|       AI Worker       |
|  - RTSP Read & Frame  |
|  - AI Inference       |
|  - Local WebRTC Pub   |
+-----------------------+
      /           \
     / (Video)     \ (DataChannel)
    v               v
 [Video Track]  [DataChannel]  ==> 단일 WebRTC Connection (WHEP)
    \               /
     \             /
      v           v
+-----------------------+
|  Frontend Client UX   |
|  - Render & Buffer    |
|  - Sync by frameId    |
+-----------------------+
```

* **동기화 타겟 제한**: 비동기 청크 구조인 HLS/LL-HLS 등은 본 초정밀 동기화 규격에서 제외하고, 실시간성 세션인 WebRTC(WHEP) 전용으로 설계함.
* **단일 피어 세션 결합**: AI Worker 단에서 분석용 원본 프레임을 WebRTC Video Track으로 발행하는 것과 동시에, 동일 프레임에서 도출된 BBOX 및 Keypoint 메타데이터를 해당 Connection의 WebRTC DataChannel로 병행 발송함.
* **백엔드 리소스 절감**: 실시간 대용량 메타데이터가 백엔드(Spring)와 STOMP 브로커를 거치지 않고, AI 워커로부터 클라이언트로 P2P(혹은 미디어 릴레이) 직접 전송되므로 서버 자원 사용량을 대폭 절감함. 백엔드는 WHEP 시그널링 릴레이와 연결 토큰 관리 등의 관리 영역만 담당함.
* **캔버스 드로잉 유지**: 비디오 프레임 자체에 BBOX를 입혀 인코딩(Burning-in)하지 않고, 프론트엔드 캔버스 오버레이 기법을 유지하여 렌더링 해상도 독립성과 프론트엔드 단의 개별 제어권을 보존함.

---

## 3. 컴포넌트별 상세 변경 설계 (Component Architecture)

### 3.1 AI Worker

* **가동 CLI 옵션 추가**:
  * `--webrtc-sync-enabled` (동기화 활성화 플래그)
  * `--webrtc-port` (로컬 WHEP/WebRTC 포트)
  * `--sync-stream-id` (채널 스트림 구분 식별자, 예: `cam_02_ai`)
* **추론 루프 파이프라인 연장**:
  1. RTSP 프레임 캡처 후 로컬 고유 `frameId` 및 `capturedAtMs` 생성.
  2. 추론 루프 기동 및 BBOX 연산 수행.
  3. 완료 후, `aiortc` 등 WebRTC 라이브러리를 통해 결과 프레임을 비디오 큐로 푸시하여 WebRTC Video Track으로 전송.
  4. 동시에 동일한 `frameId`를 키값으로 묶은 오버레이 정보(JSON)를 DataChannel로 실시간 브로드캐스트.
* **송신 메타데이터 스키마 정의**:
  ```json
  {
    "messageType": "overlay_frame",
    "cameraLoginId": "cam_02",
    "streamId": "cam_02_ai",
    "frameId": 1234,
    "capturedAtMs": 1783030000000,
    "processedAtMs": 1783030000100,
    "videoQueuedAtMs": 1783030000110,
    "metadataSentAtMs": 1783030000112,
    "frameWidth": 1280,
    "frameHeight": 720,
    "events": []
  }
  ```
* **백업 이중화**: 장애 및 통계 수집, 영구 로깅을 위해 기존 MQTT 및 백엔드 알림 경로는 잔존하여 병행 발송함.

### 3.2 Backend (Java/Spring)

* **카메라 스키마 갱신**: 카메라 정보 조회 API에 AI sync WebRTC URL 및 활성화 여부를 조회할 수 있도록 스펙 확장.
  ```json
  {
    "cameraLoginId": "cam_02",
    "streamUrl": "http://.../cam_02/index.m3u8",
    "webrtcUrl": "http://.../cam_02/whep",
    "aiSyncWebrtcUrl": "http://[AI-Worker-IP]:[Port]/webrtc/cam_02_ai",
    "aiSyncEnabled": true
  }
  ```
* **역할 제한**: 시그널링 인증(Short TTL Signed Token 생성 등) 및 메타데이터 조회 설정값 전파에 집중하며, 실시간 드로잉 좌표 데이터의 중계 연산에서는 완전히 배제함.

### 3.3 Frontend

* **스트림 모드 확장**:
  ```typescript
  type StreamMode = "origin-webrtc" | "origin-hls" | "ai-sync-webrtc";
  ```
* **프레임 렌더 동기화 매칭 링 버퍼(Ring Buffer)**:
  * DataChannel을 통해 들어오는 실시간 JSON 메타데이터 패킷을 카메라 단위 로컬 Ring Buffer에 보관함.
  * `requestVideoFrameCallback` API를 사용하여 HTML5 Video 태그의 디스플레이 프레임 업데이트 주기와 일치시켜 렌더 루프를 트리거함.
  * 화면에 디스플레이될 비디오 프레임 정보와 메타데이터의 `frameId`가 일치하면 즉시 캔버스에 드로잉을 갱신함.
  * `frameId` 불일치 시, `capturedAtMs`를 비교해 가장 오차가 적은 메타데이터(허용 오차 임계치: **150ms**)를 추출하여 보정 정합 처리함.
* **장애 복구(Fallback)**: WebRTC DataChannel 단선 혹은 세션 협상 실패 시, 기존 STOMP 웹소켓 기반 릴레이 메타데이터 및 타임스탬프 기반 매칭 보정 방식으로 자동 Fallback하도록 설계함.

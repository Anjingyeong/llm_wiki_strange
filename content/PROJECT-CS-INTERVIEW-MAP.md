---
title: 프로젝트 × CS 면접 맵
navTitle: 프로젝트 CS 면접맵
shortTitle: CS 면접맵
category: 면접·이력서 정리
tags: [interview, cs, portfolio, problem-solving, tradeoff, backend, realtime]
relatedDocs: [Interview-Resume-Notes, Evidence-LLM-Wiki-RAG, Evidence-Smart-Safety-System]
updatedAt: 2026-08-22
type: meta
status: partial
evidenceLevel: code-only
portfolio_use: true
---

# 프로젝트 × CS 면접 맵

이 문서는 CS 이론을 따로 외우기보다 **내가 실제 프로젝트에서 겪은 문제를 기준으로 CS를 역으로 공부하기 위한 면접용 마스터 노트**다.

각 사건은 다음 순서로 본다.

**문제상황 → 왜 그렇게 했나 → 코드에서는 어떻게 처리했나 → 연결되는 CS → Trade-off → 30초 답변 → 꼬리질문**

면접 전날에는 모든 내용을 외우려 하지 말고, 각 프로젝트에서 대표 사건 2~3개만 입으로 설명할 수 있으면 된다.

---

## 0. 한눈에 보는 프로젝트별 CS

- **스마트 안전 관제**: Queue, Buffer, Backpressure, Pub/Sub, Tracking State, Timestamp Sync, 실시간 시스템
- **JK**: State Machine, Idempotency, Job Resume, Concurrency, 분산 실행, Git 기반 일관성, DAG
- **VibeCheck**: Job Queue, 상태 영속화, Retry/Recovery, SSRF 방어, Rate Limit, 결정론적 검증
- **SongSong**: Server Authority, Race Condition, Durable State, WebSocket, Set, TTL, Presence
- **LLM Wiki**: Index, BM25, Vector Search, RRF, Chunking, Precision/Recall, Graceful Fallback
- **CleanTube**: WebView/App Lifecycle, Back Stack, 상태머신, 모바일 패키징, 업데이트 채널

---

# 1. 스마트 안전 관제

## 1-1. 처리 속도보다 영상 입력이 빨라지면 왜 프레임을 버렸나?

**문제상황**  
RTSP 영상은 계속 들어오는데 AI 추론이 잠깐이라도 느려지면 Queue에 과거 프레임이 쌓였다. 모든 프레임을 순서대로 처리하면 정확히 처리하고는 있지만 관제 화면은 몇 초 전 상황을 보고 있게 된다.

**왜 그렇게 했나**  
이 시스템의 핵심 요구사항은 모든 프레임 보존이 아니라 **현재 위험 상황을 최대한 빨리 감지하는 것**이었다. 따라서 처리 완전성보다 최신성을 우선했다.

**코드에서는**  
최신 프레임 중심의 buffer/queue를 두고 오래된 프레임은 drop할 수 있게 했다. 단, 이벤트 payload의 `frameId`, `capturedAtMs`는 reader의 최신 프레임이 아니라 **실제로 모델이 처리한 FramePacket**을 기준으로 연결해야 증거 정합성이 깨지지 않는다.

**연결되는 CS**  
Queue, Buffer, Producer-Consumer, Backpressure, Throughput vs Latency.

**Trade-off**  
일부 프레임을 잃지만 지연 누적을 막는다. 저장/증거 목적의 영상과 실시간 추론 Queue는 역할을 분리해야 한다.

**30초 면접 답변**  
“실시간 관제에서는 3초 전 프레임을 전부 처리하는 것보다 현재 프레임을 빠르게 보는 것이 중요했습니다. 입력 FPS가 처리 FPS를 계속 넘으면 Queue가 누적돼 latency가 커지기 때문에 오래된 프레임을 버리고 최신 프레임을 우선했습니다. 대신 이벤트 metadata는 실제 처리한 프레임 기준으로 유지해서 실시간성과 증거 정합성을 분리했습니다.”

**꼬리질문**  
- Queue 크기만 크게 하면 해결되지 않나요?
- 프레임 drop이 데이터 손실인데 괜찮나요?
- 저장용 영상 Queue도 같은 정책을 사용하면 안 되는 이유는?

---

## 1-2. Track ID가 흔들리면 왜 LSTM까지 문제가 생기나?

**문제상황**  
한 사람의 동작을 여러 프레임에 걸쳐 LSTM으로 판단하는데, tracking ID가 중간에 바뀌면 서로 다른 사람의 keypoint가 한 sequence에 섞일 수 있었다.

**왜 그렇게 했나**  
Detection 정확도만 좋아도 sequence 모델의 입력 정합성이 깨지면 행동 분류가 틀릴 수 있다. 그래서 detection → tracking → sequence buffer를 하나의 흐름으로 봤다.

**코드에서는**  
`track_id`를 key로 사용해 사람별 sequence buffer를 따로 유지하고, ByteTrack 결과를 해당 buffer에 연결했다. `trackSwitchCount`, `lost_tracks`, `fallbackIdRate`처럼 ID 안정성을 보는 지표도 별도로 두었다.

**연결되는 CS**  
HashMap/Dictionary, Key-Value 상태 관리, Sliding Window, Stateful Processing.

**Trade-off**  
Tracking 상태를 유지해야 하므로 단순 frame-by-frame 추론보다 복잡하지만 시간축 정보의 일관성을 얻는다.

**30초 면접 답변**  
“LSTM은 한 사람의 연속 keypoint를 받아야 하는데 track ID가 흔들리면 다른 사람의 sequence가 섞일 수 있습니다. 그래서 track ID별 buffer를 분리하고 tracking 단계의 안정성을 행동 분류 입력의 전제조건으로 관리했습니다.”

**꼬리질문**  
- HashMap을 쓴다면 key는 무엇인가요?
- 사람이 화면에서 사라졌을 때 buffer는 언제 삭제하나요?
- ID switch를 완전히 막을 수 없다면 어떻게 완화하나요?

---

## 1-3. AI가 Backend를 직접 호출하지 않고 MQTT를 둔 이유

**문제상황**  
AI Worker에서 위험 이벤트가 발생했을 때 Backend와 Frontend까지 전달해야 했다. AI가 Backend 구현에 직접 강하게 의존하면 한쪽 변경이 다른 쪽 장애로 이어질 수 있었다.

**왜 그렇게 했나**  
AI 추론과 서비스 Backend를 느슨하게 연결하고, 이벤트 생성과 소비 속도를 분리하고 싶었다.

**코드에서는**  
AI는 `safety/events` 같은 topic으로 이벤트 metadata를 publish하고, Backend subscriber가 이를 받아 저장/브로드캐스트하도록 구성했다. Frontend는 Backend가 전달한 이벤트를 실시간으로 받는다.

**연결되는 CS**  
Publish/Subscribe, Message Broker, 비동기 처리, Loose Coupling, Event-driven Architecture.

**Trade-off**  
중간 broker라는 운영 요소가 하나 늘어나지만 producer와 consumer의 결합도를 낮춘다.

**30초 면접 답변**  
“AI Worker가 Backend API에 직접 종속되지 않게 MQTT를 중간 이벤트 버스로 사용했습니다. AI는 이벤트만 발행하고 Backend가 이를 소비하도록 해서 추론 파이프라인과 서비스 계층의 변경 영향을 줄였습니다.”

**꼬리질문**  
- MQTT 메시지가 중복 전달되면 어떻게 처리하나요?
- Broker가 죽으면 어떻게 되나요?
- REST API와 비교했을 때 장단점은?

---

## 1-4. bbox가 늦게 따라오는 문제를 왜 timestamp 문제로 봤나?

**문제상황**  
관제 화면에서 사람 bbox가 실제 영상보다 늦게 따라오거나 엉뚱한 위치에 표시되는 현상이 있었다.

**왜 그렇게 했나**  
화면 렌더링만의 문제가 아니라 영상 프레임과 AI 결과가 서로 다른 시간 기준의 데이터를 선택하고 있을 가능성이 있었다.

**코드에서는**  
AI의 `capturedAtMs`, frame metadata, Backend relay 시각, Frontend overlay buffer 선택을 단계별로 나누고 `avgSelectedDeltaMs`, `maxSelectedDeltaMs`처럼 영상과 overlay의 시간 차이를 측정했다.

**연결되는 CS**  
Timestamp, Event Ordering, Buffer Selection, 분산 시스템의 시간 정합성.

**Trade-off**  
항상 가장 최신 AI 결과를 쓰면 구현은 단순하지만 영상과 맞지 않을 수 있다. 반대로 정확한 timestamp matching은 상태와 buffer 관리가 더 필요하다.

**30초 면접 답변**  
“overlay 지연을 CSS나 렌더링 문제로만 보지 않고 영상과 AI 이벤트의 timestamp 정합성 문제로 분리했습니다. 각 계층에서 timestamp를 유지하고 Frontend에서 영상 시점과 가장 가까운 결과를 선택하도록 진단 지표를 만들었습니다.”

**꼬리질문**  
- 서버와 클라이언트 시간이 다르면 어떻게 하나요?
- 가장 가까운 timestamp를 찾을 때 어떤 자료구조를 쓸 수 있나요?

---

# 2. JK

## 2-1. 승인했는데 같은 명령이 다시 실행되는 문제

**문제상황**  
사용자가 명령을 승인했고 실제 job은 `succeeded / exitCode 0`인데 결과가 채팅으로 돌아오지 않으면 같은 명령을 다시 호출해 또 승인을 요구하는 문제가 생길 수 있었다.

**왜 그렇게 했나**  
명령 실행과 채팅 응답을 하나의 순간적인 함수 호출로만 보면 네트워크/승인 경계에서 결과를 잃는다. 실행 자체를 **독립적인 job 상태**로 관리해야 했다.

**코드에서는**  
`approvalId`와 `jobId`를 연결하고, 승인 후 새 명령을 생성하는 대신 기존 job을 resume해서 stdout/result를 조회하도록 설계했다. 승인 대기 중 동일 command의 중복 호출도 막는 방향으로 처리했다.

**연결되는 CS**  
State Machine, Idempotency, Job Queue, Exactly-once가 어려운 이유, Retry Safety.

**Trade-off**  
상태 저장과 복구 로직이 복잡해지지만 중복 실행 위험을 크게 줄인다.

**30초 면접 답변**  
“승인과 실행 결과 반환이 분리돼 있어 성공한 명령을 다시 실행하는 문제가 있었습니다. 그래서 명령을 일회성 요청이 아니라 job으로 보고 approvalId/jobId를 기준으로 기존 실행을 resume하도록 바꿨습니다. 핵심은 retry를 다시 실행으로 해석하지 않는 idempotent한 흐름입니다.”

**꼬리질문**  
- Idempotency란 무엇인가요?
- HTTP POST도 idempotent하게 만들 수 있나요?
- job 결과를 언제까지 보관해야 하나요?

---

## 2-2. 왜 `pending → approved → running → succeeded/failed` 같은 상태가 필요한가?

**문제상황**  
승인, 실행, 결과 조회, 실패 복구가 각각 다른 시점에 발생한다. boolean 하나로 `done=true/false`만 관리하면 현재 어느 단계인지 알기 어렵다.

**왜 그렇게 했나**  
허용 가능한 상태 전이를 명확하게 만들어야 중복 승인, 성공 후 재실행, 실행 중 취소 같은 예외를 제어할 수 있다.

**코드에서는**  
job/approval 상태를 명시적인 상태값으로 저장하고 각 API/tool 동작이 현재 상태에서 허용되는지 확인하는 방식으로 구성했다.

**연결되는 CS**  
Finite State Machine, Transition, Invariant.

**Trade-off**  
상태 종류가 늘어나지만 복잡한 비동기 워크플로우를 추적하기 쉬워진다.

**30초 면접 답변**  
“승인과 실제 실행이 분리된 비동기 작업이라 boolean으로는 상태를 표현하기 부족했습니다. 명시적인 상태머신으로 전이를 제한해서 이미 성공한 job을 다시 실행하거나 승인 대기 상태를 건너뛰는 문제를 막았습니다.”

**꼬리질문**  
- 잘못된 상태 전이는 어떻게 막나요?
- 프로세스가 재시작돼도 상태를 유지하려면?

---

## 2-3. Windows와 OCI를 왜 Git을 기준으로 연결했나?

**문제상황**  
로컬 PC가 켜져 있을 때는 Windows에서 개발하고, 꺼져 있을 때는 OCI에서 작업하고 싶었다. 두 머신의 폴더를 무조건 양방향 실시간 복제하면 미커밋 변경을 덮어쓸 위험이 있었다.

**왜 그렇게 했나**  
실행 위치는 여러 곳이어도 **공유되는 확정 코드의 기준은 하나**여야 했다.

**코드에서는**  
Git remote의 확정 branch를 source of truth로 두고 OCI는 clean checkout에서 fast-forward 가능한 경우에만 동기화하도록 했다. dirty/diverged 상태에서는 자동 덮어쓰기를 막았다.

**연결되는 CS**  
Distributed State, Consistency, Source of Truth, Optimistic Safety, Version Control.

**Trade-off**  
미커밋 파일은 자동으로 다른 머신에 생기지 않지만 잘못된 자동 merge/overwrite를 피할 수 있다.

**30초 면접 답변**  
“하이브리드 환경에서 폴더 자체를 양방향 동기화하면 로컬 작업을 덮어쓸 수 있어서 Git을 확정 상태의 기준으로 뒀습니다. OCI는 clean하고 fast-forward 가능한 경우에만 따라가고 dirty/diverge면 중단하도록 했습니다.”

**꼬리질문**  
- Strong consistency와 eventual consistency 차이는?
- 두 환경에서 동시에 수정하면 어떻게 하나요?

---

## 2-4. 병렬 실행을 무조건 많이 하지 않는 이유

**문제상황**  
Mass ULW처럼 여러 작업을 병렬로 실행하면 빨라질 수 있지만, 같은 파일이나 같은 배포 자원을 동시에 만지면 충돌이 늘어난다.

**왜 그렇게 했나**  
병렬화의 이득은 작업들이 독립적일 때만 크다. dependency가 있는 일을 억지로 병렬화하면 오히려 검증/복구 비용이 더 커진다.

**코드에서는**  
작업 간 dependency, overlapping write/read scope, shared exclusive resource 여부를 보고 병렬 lane을 허용하거나 순차 실행으로 내리는 gate를 둔다.

**연결되는 CS**  
Concurrency, Race Condition, DAG, Critical Section, Amdahl’s Law.

**Trade-off**  
최대 동시 실행 수를 포기하는 대신 충돌과 롤백 비용을 줄인다.

**30초 면접 답변**  
“병렬화는 작업이 독립적일 때만 이득이라 파일 쓰기 범위나 배포 자원이 겹치면 순차 실행으로 내립니다. 단순히 agent 수를 늘리는 것보다 dependency graph와 critical section을 먼저 보는 구조입니다.”

**꼬리질문**  
- Race Condition이란?
- Lock을 많이 쓰면 생기는 단점은?
- Amdahl’s Law를 쉽게 설명해보세요.

---

# 3. VibeCheck

## 3-1. 브라우저 QA를 왜 즉시 HTTP 응답 하나로 끝내지 않았나?

**문제상황**  
실제 브라우저를 띄워 desktop/mobile profile을 돌고 screenshot, console, network evidence를 수집하면 일반 API 요청보다 오래 걸린다.

**왜 그렇게 했나**  
긴 작업을 하나의 HTTP request lifetime에 묶으면 timeout이나 연결 종료가 곧 작업 실패로 이어질 수 있다.

**코드에서는**  
웹 서비스에서 `queued → running → completed/failed` 상태를 관리하고 완료 job을 `artifacts/web/jobs.json`에 저장한다. 재시작 중 끊긴 작업을 복구하고 job TTL도 둔다.

**연결되는 CS**  
Job Queue, Async Processing, Durable State, Recovery, TTL.

**Trade-off**  
polling/상태 조회가 필요하지만 긴 작업을 요청 연결과 분리할 수 있다.

**30초 면접 답변**  
“Playwright 기반 QA는 수 초 이상 걸릴 수 있어서 요청 하나가 끝날 때까지 기다리는 구조보다 job으로 분리했습니다. queued/running/completed/failed 상태를 저장하고 완료 결과는 영속화해서 서버가 재시작돼도 결과를 관리할 수 있게 했습니다.”

**꼬리질문**  
- 비동기 job API는 보통 어떤 HTTP 구조로 만드나요?
- polling 대신 WebSocket/SSE를 쓰면 어떤 차이가 있나요?

---

## 3-2. AI가 찾은 버그를 바로 확정하지 않은 이유

**문제상황**  
LLM이 화면을 보고 이상해 보이는 점을 잘 제안하더라도 실제 버그가 아닐 수 있다.

**왜 그렇게 했나**  
QA 도구가 신뢰를 얻으려면 “AI가 그렇게 말했다”가 아니라 재현 가능한 증거가 필요하다.

**코드에서는**  
AI 결과는 `candidate`로만 두고 severity/evidence/confirmation을 스스로 채울 수 없게 했다. confirmed finding은 network, console, screenshot, assertion 같은 machine-verifiable evidence와 독립 실행의 반복 재현을 요구한다.

**연결되는 CS**  
Separation of Concerns, Trust Boundary, Determinism, Validation Pipeline.

**Trade-off**  
탐지 수는 줄 수 있지만 false positive를 제어하고 결과를 설명할 수 있다.

**30초 면접 답변**  
“AI는 탐색 후보를 넓히는 역할만 하고 버그 확정 권한은 주지 않았습니다. 실제 확정은 브라우저에서 수집한 network/console/screenshot/assertion과 반복 재현을 통과해야 하도록 분리했습니다.”

**꼬리질문**  
- Deterministic test와 probabilistic model의 차이는?
- False Positive와 False Negative 중 어떤 걸 더 줄여야 하나요?

---

## 3-3. 사용자 URL을 바로 Playwright로 열면 왜 위험한가?

**문제상황**  
외부 사용자가 URL을 입력하는 서비스에서 서버가 그 URL을 그대로 열면 내부망이나 localhost 같은 주소에 접근하는 SSRF 문제가 생길 수 있다.

**왜 그렇게 했나**  
브라우저 자동화 서버는 일반 사용자의 브라우저보다 네트워크 권한이 클 수 있으므로 입력 URL 자체가 보안 경계다.

**코드에서는**  
public HTTPS만 허용하고 credentials/custom port, private/loopback/link-local 등 비공개 대역을 거부한다. 탐색은 same-origin, bounded, read-only로 제한하고 browser request 단계에서도 재검증한다.

**연결되는 CS**  
SSRF, Input Validation, Network Boundary, Allowlist, DNS Rebinding.

**Trade-off**  
일부 특수 사이트를 검사하지 못하지만 공개 QA 서비스의 공격면을 줄인다.

**30초 면접 답변**  
“서버가 사용자가 입력한 URL을 대신 접속하기 때문에 SSRF가 핵심 위험이었습니다. HTTPS 공개 주소만 허용하고 private/loopback 대역과 위험한 포트를 거부했으며 browser request도 다시 검증했습니다.”

**꼬리질문**  
- SSRF를 설명해보세요.
- URL 문자열만 검사하면 DNS rebinding을 막을 수 있나요?

---

## 3-4. 같은 검사를 여러 번 돌리는 이유

**문제상황**  
웹 오류는 네트워크 타이밍, lazy load, race condition 때문에 한 번만 발생하거나 한 번만 정상일 수 있다.

**왜 그렇게 했나**  
단발 관찰보다 독립 실행에서 반복되는 현상을 더 강한 증거로 봤다.

**코드에서는**  
Desktop + Mobile browser scan을 독립 run으로 반복하고, 재현 가능한 관찰만 confirmed finding으로 승격한다. per-client rate limit과 scan concurrency cap으로 자원 폭주도 제한한다.

**연결되는 CS**  
Reproducibility, Flaky Test, Concurrency Limit, Rate Limiting.

**Trade-off**  
한 번 검사보다 느리지만 우연한 실패를 버그로 확정할 가능성을 낮춘다.

**30초 면접 답변**  
“브라우저 오류는 timing에 따라 flaky할 수 있어서 한 번 관찰된 현상을 바로 확정하지 않았습니다. 독립 실행을 반복해 재현성을 확인하고, 반복 실행 비용은 concurrency cap과 rate limit으로 통제했습니다.”

**꼬리질문**  
- Flaky test의 원인은 무엇인가요?
- Rate Limit 알고리즘에는 무엇이 있나요?

---

# 4. SongSong

## 4-1. 여러 휴대폰의 방 상태를 왜 서버 한 곳에서 판단했나?

**문제상황**  
멀티폰 게임에서는 여러 사용자가 거의 동시에 입장/정답/다음 라운드 요청을 보낼 수 있다. 각 클라이언트가 자기 상태를 정답으로 믿으면 서로 다른 결과가 생긴다.

**왜 그렇게 했나**  
게임 결과와 점수는 하나의 authoritative state에서 순서대로 결정해야 한다.

**코드에서는**  
Cloudflare Durable Object의 room 단위 storage에 상태를 두고 `applyPartyLiveAction`처럼 서버에서 action을 현재 state에 적용한 뒤 저장한다. 클라이언트는 서버가 반환한 room view를 사용한다.

**연결되는 CS**  
Race Condition, Critical Section, Server Authority, Serialized State Mutation.

**Trade-off**  
서버 의존성은 커지지만 클라이언트 간 상태 충돌을 줄일 수 있다.

**30초 면접 답변**  
“멀티플레이 점수와 라운드는 클라이언트가 각각 판단하면 race condition이 생길 수 있어서 room 상태를 Durable Object 한 곳에 두고 서버를 권위 있는 상태로 사용했습니다.”

**꼬리질문**  
- 서버가 여러 대라면 같은 문제를 어떻게 해결하나요?
- DB transaction과 어떤 점이 비슷한가요?

---

## 4-2. 같은 노래가 반복되는 문제에서 왜 Set을 썼나?

**문제상황**  
랜덤 선곡을 했는데 사용자는 같은 곡이 반복되면 랜덤하지 않다고 느꼈다. 단순 random은 중복 방지를 보장하지 않는다.

**왜 그렇게 했나**  
“무작위 선택”과 “최근 곡 중복 금지”는 서로 다른 요구사항이므로 별도로 상태를 관리해야 했다.

**코드에서는**  
`previousSongIds`, `excludedSongIds`를 `Set`으로 바꿔 빠르게 포함 여부를 검사하고, 먼저 fresh song만 후보로 만든 뒤 충분하지 않을 때만 전체 enabled pool로 fallback한다. 이후 crypto 기반 random key로 shuffle한다.

**연결되는 CS**  
Set, Membership Test, Random Shuffle, Time Complexity.

**Trade-off**  
완전한 독립 랜덤은 아니지만 사용자 체감 중복을 줄인다. 후보가 부족하면 fallback 정책이 필요하다.

**30초 면접 답변**  
“랜덤 함수만 쓰면 이전 곡이 다시 뽑힐 수 있어서 최근 재생 곡을 Set으로 관리하고 후보군에서 먼저 제외했습니다. fresh 후보가 부족할 때만 전체 pool로 fallback해서 중복 방지와 게임 지속성을 같이 챙겼습니다.”

**꼬리질문**  
- Array `includes`와 Set `has`의 차이는?
- Fisher-Yates shuffle은 무엇인가요?

---

## 4-3. WebSocket 연결 직후 인증 timeout을 둔 이유

**문제상황**  
실시간 방을 위해 WebSocket을 열었지만 연결만 하고 인증하지 않는 socket이 계속 남으면 자원을 차지할 수 있다.

**왜 그렇게 했나**  
연결 수립과 사용자 인증을 분리하되 인증되지 않은 연결의 수명을 제한해야 했다.

**코드에서는**  
WebSocket accept 후 attachment에 아직 `playerToken`이 없는 상태로 시작하고, 일정 시간 안에 `auth` 메시지가 오지 않으면 `auth timeout`으로 닫는다. 인증 성공 시 socket attachment에 token을 저장하고 player connection state를 갱신한다.

**연결되는 CS**  
WebSocket, Session, Authentication State, Timeout, Resource Management.

**Trade-off**  
네트워크가 매우 느린 사용자는 timeout에 걸릴 수 있지만 유령 연결을 제한한다.

**30초 면접 답변**  
“WebSocket 연결 자체와 방 사용자 인증은 별도라 인증되지 않은 socket이 무한히 남지 않게 timeout을 뒀습니다. auth 성공 후에만 playerToken을 socket state에 붙이고 이후 메시지를 처리했습니다.”

**꼬리질문**  
- WebSocket과 HTTP의 차이는?
- 연결이 끊겼다가 재연결되면 session을 어떻게 복구하나요?

---

## 4-4. 방/접속자 상태에 TTL과 alarm을 둔 이유

**문제상황**  
사용자가 앱을 강제 종료하면 정상적인 leave 요청이 오지 않을 수 있다. 이런 상태가 영원히 남으면 유령 방과 유령 접속자가 쌓인다.

**왜 그렇게 했나**  
분산 환경에서는 “정상 종료 이벤트가 반드시 온다”고 가정할 수 없다.

**코드에서는**  
방 만료 시각을 storage에 저장하고 Durable Object alarm으로 정리한다. Presence도 마지막 `lastSeenAt`과 TTL을 기준으로 세고 만료된 key는 삭제한다.

**연결되는 CS**  
TTL, Lease, Garbage Collection, Heartbeat/Presence, Failure Detection.

**Trade-off**  
TTL이 너무 짧으면 정상 사용자를 끊긴 것으로 오판하고, 너무 길면 stale state가 오래 남는다.

**30초 면접 답변**  
“모바일에서는 정상 leave가 항상 보장되지 않아서 상태 정리를 이벤트에만 의존하지 않았습니다. room과 presence에 TTL을 두고 alarm/lastSeenAt 기준으로 오래된 상태를 정리했습니다.”

**꼬리질문**  
- Heartbeat는 왜 필요한가요?
- TTL 값은 어떻게 정하나요?

---

# 5. LLM Wiki

## 5-1. 왜 Vector Search 하나만 쓰지 않고 BM25와 합쳤나?

**문제상황**  
기술 문서는 `FrameSyncBuffer`, 포트 번호, 환경변수처럼 정확한 문자열 검색이 중요한 경우와 “영상이 늦게 뜨는 이유”처럼 의미가 비슷한 문서를 찾아야 하는 경우가 섞여 있다.

**왜 그렇게 했나**  
Lexical과 semantic retrieval의 강점이 달라 둘 중 하나만 고르면 일부 질문 품질이 떨어졌다.

**코드에서는**  
BM25/Exact lexical 결과와 Vector/Cosine 결과를 각각 얻은 뒤 RRF로 순위를 결합하고 document dedupe/diversity를 거쳐 Top-K context를 만든다.

**연결되는 CS**  
Index, Information Retrieval, Ranking, BM25, Vector Similarity, Ensemble.

**Trade-off**  
retrieval pipeline이 복잡해지지만 exact term과 의미 검색을 함께 커버한다.

**30초 면접 답변**  
“기술 문서는 정확한 클래스명 검색과 자연어 의미 검색이 둘 다 필요해서 BM25와 vector retrieval을 함께 썼습니다. 두 점수의 scale이 달라 raw score 합산 대신 rank 기반 RRF로 결합했습니다.”

**꼬리질문**  
- BM25와 TF-IDF 차이는?
- Cosine similarity는 무엇인가요?
- RRF를 왜 썼나요?

---

## 5-2. Markdown을 왜 구조 기반으로 chunking했나?

**문제상황**  
고정 글자 수로만 문서를 자르면 heading과 설명, 결정 이유와 결과가 서로 다른 chunk로 갈라질 수 있다.

**왜 그렇게 했나**  
검색 단위는 작아야 하지만 원래 문맥의 경계도 최대한 보존해야 했다.

**코드에서는**  
Markdown heading/section 구조를 이용하는 structure-aware chunking을 만들고, 검색 가능한 크기와 문맥 보존 사이를 실험했다.

**연결되는 CS**  
Parsing, Segmentation, Locality, Index Granularity, Precision/Recall.

**Trade-off**  
큰 chunk는 context가 풍부하지만 잡음이 많고, 작은 chunk는 정밀하지만 맥락이 끊길 수 있다.

**30초 면접 답변**  
“RAG chunk를 단순 고정 길이로 자르면 제목과 결정 근거가 분리되는 문제가 있어서 Markdown section을 기준으로 나누는 구조를 사용했습니다. chunk 크기는 retrieval precision과 문맥 보존의 trade-off로 봤습니다.”

**꼬리질문**  
- Chunk가 너무 작으면 왜 문제가 되나요?
- Overlap을 두는 이유는?

---

## 5-3. 외부 LLM이 실패해도 검색은 왜 살아 있게 했나?

**문제상황**  
LLM provider quota나 장애가 발생하면 자연어 생성은 실패할 수 있다. 검색 기능까지 같이 죽으면 Wiki의 핵심 가치가 사라진다.

**왜 그렇게 했나**  
검색을 core capability, 생성형 답변을 optional capability로 분리했다.

**코드에서는**  
기본은 retrieval + local grounded answer로 동작하고 외부 LLM이 설정됐을 때만 retrieved context를 전달한다. 관련 근거가 부족하면 답을 꾸며내는 대신 abstain/insufficient context 정책을 사용한다.

**연결되는 CS**  
Graceful Degradation, Fault Isolation, Dependency Failure, Precision vs Recall.

**Trade-off**  
provider가 없을 때 답변 표현력은 낮아지지만 핵심 검색 서비스의 가용성은 유지한다.

**30초 면접 답변**  
“외부 LLM은 장애나 quota가 있을 수 있어서 검색과 생성 기능을 분리했습니다. 검색은 로컬에서도 계속 동작하고, 근거가 부족하면 억지로 생성하지 않고 abstain하도록 했습니다.”

**꼬리질문**  
- Graceful degradation이 무엇인가요?
- 가용성과 정확성 중 무엇을 우선했나요?

---

# 6. CleanTube

> CleanTube는 면접에서는 서비스 목적 자체보다 **모바일/데스크톱 앱 shell과 lifecycle 문제를 해결한 경험** 위주로 설명하는 편이 좋다.

## 6-1. 뒤로가기를 누르면 앱이 바로 종료되는 문제

**문제상황**  
WebView 기반 앱에서 Android의 시스템 뒤로가기를 그대로 앱 종료로 연결하면 웹 내부 navigation history가 있어도 사용자는 앱이 갑자기 꺼졌다고 느낀다.

**왜 그렇게 했나**  
모바일에서는 시스템 lifecycle과 WebView의 navigation stack을 따로 이해해야 한다.

**코드에서는**  
MainActivity/WebView shell에서 현재 fullscreen/player/navigation 상태를 먼저 확인하고, WebView가 뒤로 갈 수 있으면 history를 소비한 뒤 실제로 더 이상 돌아갈 곳이 없을 때 activity 종료로 넘어가는 형태로 상태를 분기한다.

**연결되는 CS**  
Stack, Navigation History, Event Handling, Application Lifecycle.

**Trade-off**  
상태 분기가 늘어나지만 모바일 사용자가 기대하는 back navigation을 맞출 수 있다.

**30초 면접 답변**  
“WebView 앱에서는 Android back event와 웹 history가 별도라 시스템 이벤트를 바로 종료로 연결하면 UX가 깨집니다. 현재 player/fullscreen/history 상태를 확인하고 웹 history를 먼저 소비하도록 lifecycle을 분리했습니다.”

**꼬리질문**  
- Stack이 뒤로가기와 어떤 관계가 있나요?
- Android Activity lifecycle을 설명해보세요.

---

## 6-2. 모바일과 데스크톱 패키징을 왜 별도 실행환경으로 봤나?

**문제상황**  
같은 웹 UI를 사용해도 Windows shell, Android WebView/Gecko 계열, iOS WKWebView는 lifecycle, fullscreen, PIP, package/build 방식이 다르다.

**왜 그렇게 했나**  
“웹이 돌아간다”와 “네이티브 앱처럼 안정적으로 동작한다”는 다른 문제다.

**코드에서는**  
플랫폼별 shell을 분리하고 Android release/QA assembly·publish 스크립트와 update channel 검증을 별도로 둔다. iOS도 SwiftUI `App`과 `CleanTubeWebView` shell을 분리한다.

**연결되는 CS**  
Abstraction Layer, Platform Lifecycle, Build Pipeline, Compatibility.

**Trade-off**  
플랫폼 코드가 늘어나지만 각 OS의 native lifecycle 문제를 독립적으로 다룰 수 있다.

**30초 면접 답변**  
“웹 코드는 공유하지만 앱 shell은 OS마다 lifecycle과 패키징 조건이 달라 플랫폼별로 분리했습니다. 공통 UI 재사용과 native 안정성 사이에서 얇은 플랫폼 adapter를 두는 구조로 접근했습니다.”

**꼬리질문**  
- WebView와 네이티브 앱의 장단점은?
- 추상화를 너무 많이 하면 어떤 문제가 생기나요?

---

# 7. 이 문서를 실제 면접에서 쓰는 방법

## 1단계 — 사건을 한 문장으로 기억한다

예: **“관제 영상이 밀려서 Queue의 오래된 프레임을 버렸다.”**

## 2단계 — 왜를 붙인다

예: **“실시간 관제는 모든 프레임 처리보다 최신성이 중요했기 때문이다.”**

## 3단계 — CS 이름을 붙인다

예: **“Queue, Producer-Consumer, Backpressure 문제다.”**

## 4단계 — Trade-off를 말한다

예: **“프레임 일부를 포기하지만 latency 누적을 막았다.”**

이 4개만 자연스럽게 말할 수 있으면 단순히 CS 정의를 외운 답변보다 훨씬 강하다.

---

# 8. 자주 나올 CS 꼬리질문 빠른 체크

- Queue와 Stack의 차이
- Array와 Linked List의 차이
- HashMap/Set의 평균 탐색 시간
- Process와 Thread의 차이
- 동기와 비동기의 차이
- Race Condition과 Critical Section
- Lock/Mutex/Semaphore 차이
- HTTP와 WebSocket 차이
- REST와 Message Queue 차이
- Pub/Sub 구조의 장단점
- Idempotency의 의미
- State Machine이 필요한 이유
- TTL과 Cache 만료
- Rate Limiting이 필요한 이유
- Index를 쓰면 검색이 빨라지는 이유
- Precision과 Recall의 차이
- Vector similarity가 무엇인지
- DB Transaction과 ACID
- Scale-up과 Scale-out
- Strong consistency와 eventual consistency

---

# 9. 우선순위

면접 직전에는 아래 순서로 공부한다.

1. **스마트 안전 관제** — 전공/AI + 실시간 Backend를 함께 보여주기 좋음
2. **JK** — 상태머신, idempotency, 분산 실행 등 CS 꼬리질문이 가장 많이 나옴
3. **VibeCheck** — Backend/API/QA/보안 관점 설명에 좋음
4. **SongSong** — 동시성/WebSocket/상태 관리 설명에 좋음
5. **LLM Wiki** — RAG/검색/검색 품질 질문에 대비
6. **CleanTube** — 모바일 lifecycle/패키징 경험 보조 사례

핵심은 프로젝트 수를 자랑하는 것이 아니라, **각 프로젝트에서 어떤 문제를 보고 어떤 CS 원리를 이용해 선택을 했는지 설명하는 것**이다.

---
title: VLM RAG Event Search Decision Evidence
navTitle: VLM·RAG 사고 검색 결정 근거
shortTitle: VLM Search
category: Project
tags: [portfolio, evidence, ai, vlm, rag, semantic-search, alert, ux, decision]
relatedDocs: [Benchmark-Evidence-Hub, AI-Pipeline, Evidence-LLM-Wiki-RAG, Evidence-TensorRT-Adoption-Decision, Realtime-Camera-Runtime-Stabilization, VLM-RAG-DBless-Mock-MVP]
relatedFiles: [plans/vlm-rag-event-search.md, strange_ai/docs/vlm-rag, strange_ai/ai/vlm/mock_adapter.py]
updatedAt: 2026-07-09
project: smart-safety-ai
type: evidence
status: partial
evidenceLevel: code-only
summary: "VLM을 실시간 감지와 분리된 비동기 사고 설명·검색 경로로 설계한 결정 근거이며, 현재는 코드 기준의 부분 검증으로 운영 통합을 주장하지 않는다."
relations: [supports:VLM-RAG-DBless-Mock-MVP, related:Benchmark-Evidence-Hub]
portfolio_use: true
evidence_type: decision
---

# VLM-RAG 알림 검색 도입 판단 기록
## Stabilization 구현 수치 (2026-07-16)

- 키워드 검색: 성공한 VLM 설명 필드에 **LIKE** (원문 §7).
- Semantic: 결과에 첫 이벤트 스냅샷 **presigned URL** (원문 §7).
- 임베딩: `text-embedding-004` → **`gemini-embedding-001`**, 차원 **768** (원문 §9).
- 클립 worker·8프레임 메모리·advisory lock: [VLM-RAG-DBless-Mock-MVP](VLM-RAG-DBless-Mock-MVP.md) stabilization §, [Benchmark-Evidence-Hub](Benchmark-Evidence-Hub.md).

## 문제 정의

기존 시스템은 CCTV에서 이상행동을 감지하고 알림을 생성할 수 있다. 하지만 운영자 관점에서는 알림이 쌓인 뒤의 문제가 남는다. 특정 상황을 다시 찾거나, 여러 알림 중 무엇이 중요한지 빠르게 이해하거나, 과거 유사 상황을 자연어로 검색하는 경험이 부족하다.

예를 들어 운영자는 "복도 근처에서 쓰러진 작업자", "노란 안전모 착용자가 바닥에 누운 상황", "조끼 입은 사람이 움직임 없이 쓰러진 알림"처럼 상황 중심으로 찾고 싶다. 기존 키워드/필터 검색만으로는 이런 질의를 잘 처리하기 어렵다.

따라서 VLM 도입의 핵심은 감지 모델을 대체하는 것이 아니라, 이미 생성된 알림에 대해 사람이 이해할 수 있는 설명과 검색 가능한 의미 정보를 추가하는 것이다.

## 내가 한 판단

첫 번째 판단은 VLM의 역할을 실시간 감지 모델이 아니라, 알림 이후의 상황 이해를 보조하는 후처리 기능으로 정의한 것이다. 기존 AI 파이프라인은 낙상·실신·이상행동 여부를 빠르게 감지하고 알림을 생성하는 데 집중하고, VLM은 해당 알림에 연결된 영상이나 스냅샷을 바탕으로 운영자가 상황을 더 쉽게 이해하고 검색할 수 있도록 설명 정보를 생성하는 역할로 분리했다.

두 번째 판단은 VLM을 실시간 감지 경로에 직접 포함하지 않는 것이다. VLM은 상대적으로 처리 비용이 크고, 외부 API나 별도 GPU 자원을 사용할 가능성이 있기 때문에 알림 생성 시점에 즉시 실행하면 실시간 감지 파이프라인의 안정성을 해칠 수 있다. 따라서 백엔드 스케줄러가 `PENDING` 상태의 분석 job을 가져가고, 저장된 `clipUrl` 또는 `snapshotUrl`을 기반으로 비동기 후처리하는 구조로 설계했다.

세 번째 판단은 분석 대상의 우선순위를 명확히 한 것이다. 알림에 `clipUrl` 또는 `clipPath`가 존재하면 영상 클립을 우선 분석하고, 영상이 없고 `snapshotUrl`만 존재하는 경우에만 스냅샷 이미지를 분석한다. 영상은 단일 이미지보다 시간 흐름과 행동 전후 맥락을 포함하므로, VLM이 더 풍부한 상황 설명을 생성할 수 있다.

네 번째 판단은 프론트엔드가 저장소 구조나 S3 권한 로직을 직접 다루지 않게 한 것이다. 프론트엔드는 백엔드 API가 반환한 URL과 분석 결과만 표시하며, S3 key 관리, presigned URL 생성, 권한 확인, mock/production 분기는 백엔드가 책임진다. 이를 통해 저장소 구조 변경이나 권한 정책 변경이 발생해도 프론트엔드 영향 범위를 줄일 수 있다.

다섯 번째 판단은 개인정보 보호와 설명 범위를 제한한 것이다. VLM 결과에는 얼굴, 신원, 정확한 나이, 성별, 의료 원인 추정과 같은 민감하거나 단정적인 내용을 포함하지 않는다. 또한 검색 결과에는 원본 클립 전체를 직접 노출하기보다, 비식별 keyframe 또는 백엔드가 허용한 preview URL만 제공하여 안전한 조회 흐름을 유지한다.


## MVP 범위

MVP는 "이상행동 알림을 VLM 설명과 embedding으로 검색 가능하게 만드는 것"이다.

- 1순위: `clipUrl` 또는 `clipPath`가 있으면 영상 클립 분석
- 2순위: `snapshotUrl`만 있으면 스냅샷 이미지 분석
- VLM 처리: 백엔드 스케줄러가 `PENDING` job을 잡고 presigned GET URL을 AI/VLM processor에 전달
- 저장: VLM description, structured JSON, embedding, de-identified preview key 저장
- 검색: VLM description + embedding 기반 semantic search
- 프론트: 백엔드 API가 반환한 URL로 검색 결과와 preview 표시
- 기존 알림 히스토리 keyword/date/camera filter는 유지

## 설계 방향

전체 흐름은 다음과 같다.

1. YOLO/LSTM 기반 이상행동 감지로 알림 이벤트가 생성된다.
2. 백엔드는 알림에 연결된 `clipPath`, `clipUrl`, 또는 `snapshotUrl`을 확인한다.
3. 처리 가능한 미디어가 있으면 `PENDING` VLM description job을 생성한다.
4. 스케줄러가 job을 lock하고 presigned GET URL을 발급한다.
5. AI processor는 URL로 클립/스냅샷을 받아 VLM 분석을 수행한다.
6. 얼굴/개인 식별 가능 영역은 비식별화한 preview로 저장한다.
7. 백엔드는 VLM description과 embedding을 저장한다.
8. 운영자는 프론트에서 자연어로 알림을 검색하고, 의미적으로 가까운 알림 결과를 확인한다.

이 구조는 실시간 감지와 후처리 검색을 분리한다. 감지는 빠르고 안정적으로 유지하고, VLM은 알림이 저장된 뒤 비동기적으로 부가 가치를 만든다.

## 필요한 결과수치

VLM은 TensorRT처럼 단순 latency만으로 판단하기 어렵다. 도입 근거는 검색 품질, 처리 안정성, 운영 편의성, 개인정보 안전성으로 나누어 측정하는 것이 좋다.

### 1. 검색 품질 지표

| 지표 | 의미 | 목표 예시 |
| --- | --- | --- |
| Hit@1 | 가장 위 결과가 정답 알림인지 | 70% 이상 |
| Hit@3 | 상위 3개 안에 정답 알림이 있는지 | 85% 이상 |
| Hit@5 | 상위 5개 안에 정답 알림이 있는지 | 90% 이상 |
| MRR@5 | 정답이 얼마나 높은 순위에 나오는지 | 0.75 이상 |
| keyword 대비 semantic 개선율 | 기존 키워드 검색 대비 찾을 수 있는 알림 증가율 | +20%p 이상 |

측정 방법:

- 실제 알림 또는 mock 알림 30~50개를 준비한다.
- 각 알림마다 사람이 찾을 법한 자연어 질문을 2~3개 만든다.
- 예: "안전모 쓴 사람이 쓰러진 상황", "복도에서 사람이 바닥에 누워 있는 알림"
- keyword search와 semantic search의 Hit@K를 비교한다.

### 2. VLM 처리 성능 지표

| 지표 | 의미 | 목표 예시 |
| --- | --- | --- |
| job success rate | PENDING job 중 SUCCESS 비율 | 95% 이상 |
| avg processing time | 알림 1건 VLM 처리 평균 시간 | MVP 기준 30초 이내 |
| p95 processing time | 느린 케이스 포함 처리 시간 | MVP 기준 60초 이내 |
| retry rate | 실패 후 재시도 비율 | 5% 이하 |
| skipped rate | credential/media 없음으로 건너뛴 비율 | 원인 분류 가능해야 함 |

측정 방법:

- `PENDING -> PROCESSING -> SUCCESS/FAILED/SKIPPED` 상태 전이를 기록한다.
- clip 기반과 snapshot 기반을 분리해서 평균 처리 시간을 본다.
- 실패 원인을 `S3 download`, `VLM API`, `JSON parse`, `upload`, `timeout` 등으로 나눈다.

### 3. 운영 편의성 지표

| 지표 | 의미 | 목표 예시 |
| --- | --- | --- |
| search task time | 특정 과거 알림을 찾는 데 걸리는 시간 | 기존 대비 50% 이상 단축 |
| query success rate | 운영자가 원하는 알림을 찾은 비율 | 80% 이상 |
| summary usefulness score | 상황요약이 판단에 도움이 됐는지 | 5점 만점 4점 이상 |
| click depth | 알림 확인까지 필요한 클릭 수 | 기존 대비 감소 |

측정 방법:

- 운영자 시나리오를 5~10개 만든다.
- 기존 히스토리 필터만 사용했을 때와 VLM semantic search를 사용했을 때 시간을 비교한다.
- "이 설명만 보고 상황을 이해할 수 있는가?"를 1~5점으로 평가한다.

### 4. 개인정보/안전 지표

| 지표 | 의미 | 목표 예시 |
| --- | --- | --- |
| sensitive phrase count | 성별, 나이, 얼굴, 신원, 의료원인 추정 표현 발생 수 | 0건 |
| raw media exposure count | 검색 결과에서 원본 클립/원본 snapshot이 직접 노출된 횟수 | 0건 |
| de-identified preview rate | 검색 결과 preview가 비식별 처리된 비율 | 100% |
| permission violation count | 권한 없는 시설/회사 알림 노출 | 0건 |

측정 방법:

- VLM output에 금지어/금지 추정 표현 검사를 추가한다.
- 검색 API response에서 원본 S3 key나 내부 key가 직접 노출되지 않는지 확인한다.
- facility/company scoped endpoint로 권한 필터가 유지되는지 확인한다.

## 기대 결과

VLM-RAG 도입 후 기대하는 변화는 다음과 같다.

- 운영자는 "쓰러진 사람", "안전모 착용자", "복도 근처", "움직임 없는 작업자"처럼 상황 중심으로 알림을 검색할 수 있다.
- 알림 목록은 단순 이벤트 타입이 아니라 VLM description과 similarity score를 함께 제공한다.
- 프론트는 백엔드가 반환한 preview URL만 표시하므로 S3 내부 구조나 권한 로직을 몰라도 된다.
- 실시간 감지 파이프라인은 그대로 유지되고, VLM 처리는 비동기 후처리로 분리된다.
- 개인정보 추정과 원본 미디어 노출을 제한하면서도 검색 편의성을 높일 수 있다.

## 보고서용 문장

- 기존 이상행동 감지 시스템은 알림 생성 이후 과거 상황을 자연어로 다시 찾거나 빠르게 요약해 이해하는 기능이 부족했다.
- 이를 해결하기 위해 알림에 저장된 `clipUrl`/`clipPath`를 우선 분석하고, 클립이 없을 때만 `snapshotUrl`을 분석하는 VLM 후처리 구조를 설계했다.
- VLM은 실시간 감지 경로에 직접 연결하지 않고, 백엔드 스케줄러가 `PENDING` job을 처리하며 presigned GET URL을 AI processor에 전달하는 비동기 구조로 분리했다.
- VLM description과 embedding을 저장해 기존 keyword/date/camera filter는 유지하면서 semantic search를 추가하는 방식으로 검색 편의성을 확장했다.
- 프론트엔드는 백엔드 API가 반환한 URL만 표시하도록 설계해 S3 권한, presigned URL, 비식별 preview 처리를 백엔드 책임으로 분리했다.
- 도입 효과는 Hit@K, MRR@5, 검색 소요 시간, VLM job success rate, 개인정보 노출 0건 여부로 검증할 계획이다.

## 내가 잘한 점

가장 잘한 점은 VLM을 "실시간 감지 모델을 더 똑똑하게 만드는 기능"으로 보지 않고, "알림을 사람이 다시 찾고 이해하기 쉽게 만드는 기능"으로 정의한 것이다. 덕분에 VLM을 감지 루프에 무리하게 넣지 않고 비동기 후처리로 설계할 수 있었다.

두 번째로 잘한 점은 영상 클립과 스냅샷의 우선순위를 정한 것이다. 클립은 상황의 전후 맥락을 담고 있으므로 VLM 설명 품질이 더 좋을 가능성이 높다. 그래서 `clipUrl`/`clipPath`가 있으면 클립 분석을 우선하고, 클립이 없을 때만 snapshot fallback을 쓰도록 범위를 정했다.

세 번째로 잘한 점은 프론트와 백엔드의 책임을 분리한 것이다. 프론트가 S3 URL을 직접 조립하거나 내부 key를 알 필요 없이, 백엔드가 권한이 반영된 URL을 반환하고 프론트는 그 URL만 표시하게 했다.

네 번째로 잘한 점은 결과수치를 미리 정한 것이다. VLM은 FPS보다 검색 품질과 운영 편의성이 중요하므로 Hit@K, MRR, 검색 시간 단축, job success rate, 개인정보 노출 0건 같은 지표로 평가해야 한다고 판단했다.

마지막으로, 기존 keyword search를 지우지 않고 semantic search를 별도 기능으로 추가하기로 했다. 이는 새 기능 도입 중에도 기존 운영 흐름을 깨지 않는 안전한 확장 방식이다.

## 면접 답변 예시

Q. VLM을 왜 도입하려고 했나요?

A. 기존 시스템은 이상행동을 감지하고 알림을 만들 수는 있었지만, 알림이 쌓인 뒤 운영자가 과거 상황을 자연어로 찾거나 빠르게 이해하는 기능이 부족했습니다. 그래서 VLM을 실시간 감지 모델 대체가 아니라, 알림 후처리와 검색 편의성을 높이는 레이어로 정의했습니다.

Q. VLM을 실시간 파이프라인에 바로 넣지 않은 이유는 무엇인가요?

A. VLM은 YOLO/LSTM보다 무겁고 외부 API나 별도 GPU 자원을 사용할 수 있어서 실시간 감지 루프에 직접 넣으면 안정성을 해칠 수 있습니다. 그래서 알림이 저장된 뒤 백엔드 스케줄러가 `PENDING` job을 잡고 presigned GET URL을 AI processor에 넘기는 비동기 구조로 분리했습니다.

Q. 영상 클립과 스냅샷 중 무엇을 우선하나요?

A. 클립을 우선합니다. 클립은 행동의 전후 맥락을 담고 있어서 "쓰러짐", "움직임 없음", "주변 상황" 같은 설명을 만들기 좋습니다. 그래서 `clipUrl`이나 `clipPath`가 있으면 클립을 분석하고, 없을 때만 `snapshotUrl` 기반 분석으로 fallback합니다.

Q. VLM 도입 효과는 어떤 수치로 증명할 건가요?

A. TensorRT처럼 FPS만 보는 것이 아니라 검색 품질과 운영 편의성을 봐야 합니다. 상위 검색 결과에 정답 알림이 포함되는지 Hit@1, Hit@3, Hit@5로 보고, 정답 순위는 MRR@5로 봅니다. 또 운영자가 알림을 찾는 시간이 얼마나 줄었는지, VLM job success rate가 충분히 높은지, 개인정보나 원본 미디어가 노출되지 않았는지도 함께 측정합니다.

Q. 프론트엔드는 어떤 역할을 하나요?

A. 프론트는 백엔드 API가 반환한 결과를 표시하는 역할에 집중합니다. 검색어를 입력하고, 유사도 순으로 받은 알림 카드와 VLM 설명, preview URL을 보여줍니다. S3 key 조립, presigned URL 생성, 권한 체크, 비식별 preview 여부는 백엔드가 책임지게 해서 보안과 책임 경계를 분리했습니다.

## VLM 판단 로직 상세

VLM 판단 로직은 단순히 이미지를 모델에 던져서 설명을 받는 구조가 아니다. 이 프로젝트에서는 알림 이벤트, 영상 클립, 포즈 추적 메타데이터, 비식별 keyframe, VLM JSON, embedding 검색까지 이어지는 후처리 판단 흐름으로 설계한다.

### 1. 분석 대상 선택

분석 대상은 알림 이벤트에 저장된 미디어 정보를 기준으로 결정한다.

1. `clipPath`가 있으면 S3 object key로 정규화해서 영상 클립을 분석한다.
2. `clipPath`가 없고 `clipUrl`이 있으면 URL에서 S3 object key를 추출해 영상 클립을 분석한다.
3. 영상 클립이 없고 `snapshotUrl`만 있으면 스냅샷 이미지를 fallback으로 분석한다.
4. 분석 가능한 미디어가 없으면 VLM job을 만들지 않거나 `SKIPPED`로 분류한다.

이 판단의 이유는 영상 클립이 스냅샷보다 행동의 전후 맥락을 더 잘 담기 때문이다. 쓰러짐, 움직임 없음, 주변 이동, 최종 자세 같은 설명은 한 장의 이미지보다 여러 시점의 keyframe에서 더 안정적으로 판단할 수 있다.

### 2. keyframe 샘플링

영상 클립은 전체를 VLM에 넣지 않고 대표 keyframe으로 줄인다. 기본 전략은 10초 내외 클립에서 8장을 뽑는 것이다.

샘플링 위치:

- 시작: `0%`
- 초반: `15%`, `30%`
- 중간: `45%`, `60%`
- 후반: `75%`, `90%`
- 종료: `100%`

이렇게 나누면 VLM이 한 순간의 자세만 보는 것이 아니라, 시작 상태, 변화 과정, peak 시점, 최종 상태를 함께 볼 수 있다. 비용과 rate limit을 줄이면서도 상황요약에 필요한 시간 흐름은 유지하는 절충안이다.

### 3. 비식별화 판단

VLM API로 보내기 전 keyframe은 비식별화한다. 비식별화는 정확도와 개인정보 보호를 동시에 고려해 3단계 fallback으로 설계한다.

1순위는 YOLO Pose keypoint 기반 head bbox 마스킹이다. 이벤트 metadata에 nose, eyes, ears 같은 COCO keypoint가 있으면, keyframe 시점과 가장 가까운 pose frame을 찾고 얼굴/head 영역을 계산해 검은색 박스로 가린다.

2순위는 Haar Cascade face detector다. pose keypoint가 없거나 keyframe과 1초 이상 차이나 stale하다고 판단되면, 사람 bbox 내부에서 OpenCV Haar face detector를 실행하고 감지된 얼굴 영역을 가린다.

3순위는 bbox 상단 15% mosaic fallback이다. pose와 Haar 모두 실패하면 사람 bbox의 상단 15%를 mosaic 처리한다. 이 방법은 안전모 같은 상단 장비 판별 confidence를 낮출 수 있지만, 얼굴 노출을 막는 쪽을 우선한다.

이 구조의 판단 기준은 명확하다. 얼굴 정보 보호가 우선이고, 가능한 경우 pose keypoint를 이용해 누워 있거나 기울어진 CCTV 자세에서도 얼굴 영역을 더 안정적으로 가린다.

### 4. VLM이 판단하는 내용

VLM은 사람의 신원이나 의학적 원인을 판단하지 않는다. VLM이 판단하는 것은 영상에서 관찰 가능한 시각적 사실이다.

판단 대상:

- visual event type: 예를 들어 `person_lying_on_floor`
- people count: 보이는 사람 수
- clothing: 상의/하의 색, 안전모, 조끼 등 관찰 가능한 착의
- posture sequence: 앞 프레임과 뒤 프레임에서 보이는 자세 변화
- final posture: 마지막 시점의 자세
- visible action: 움직임이 보이는지, 바닥에 누워 있는지 등
- environment: 복도, 출입구, 바닥, 문, 벽, 주변 물체
- visible hazards: 화면에서 확인 가능한 장애물이나 위험 요소
- uncertainty notes: 영상만으로 확정할 수 없는 내용

금지 대상:

- 신원 추정
- 얼굴 특징 설명
- 정확한 나이 추정
- 성별 추정
- 의료 원인 추정
- 의식 여부 단정
- 질병명 또는 진단 표현

즉 VLM 판단은 "이 사람은 왜 쓰러졌는가"가 아니라, "선택된 프레임들에서 한 사람이 바닥에 누워 있고, 주변은 복도/출입구로 보이며, 안전모가 보일 수 있고, 움직임은 명확하지 않다"처럼 관찰 가능한 표현으로 제한된다.

### 5. JSON 구조화 판단

VLM 출력은 자유 문장이 아니라 정해진 JSON schema를 따른다. 이 구조화가 중요한 이유는 검색과 UI 표시, 후속 평가를 안정적으로 하기 위해서다.

핵심 필드:

- `visual_event_type`
- `people_count`
- `visible_people`
- `clothing`
- `posture_sequence`
- `final_posture`
- `visible_action`
- `environment`
- `visible_objects`
- `visible_hazards`
- `korean_search_keywords`
- `uncertainty_notes`
- `detailed_description_ko`

`detailed_description_ko`는 운영자가 읽는 상황요약이고, `korean_search_keywords`는 한국어 검색 질의를 잘 받기 위한 보조 필드다. `uncertainty_notes`는 모델이 확정하지 말아야 할 내용을 명시해 과잉 판단을 줄인다.

### 6. embedding과 semantic search 판단

VLM description이 생성되면 description text를 embedding으로 변환한다. MVP 기본 설계는 Gemini `text-embedding-004` 기준 `vector(768)`을 사용한다.

검색 시에는 운영자 query도 같은 embedding model로 vector화하고, DB의 `description_embedding`과 cosine distance를 비교한다. PostgreSQL pgvector의 `<=>` 연산으로 거리를 계산하고, similarity score는 `1 - distance`로 환산한다.

검색 대상은 다음 조건을 만족해야 한다.

- `status = SUCCESS`
- `description_embedding IS NOT NULL`
- similarity score가 `minSimilarity` 이상
- facility/company/camera/date 같은 권한 및 메타데이터 필터를 통과
- production에서는 mock embedding 결과를 기본 제외

이 판단 구조 덕분에 사용자는 정확한 이벤트 타입명을 몰라도 "안전모 쓴 사람이 바닥에 누운 상황"처럼 의미 중심으로 과거 알림을 찾을 수 있다.

### 7. scheduler 상태 판단

VLM 처리는 실시간 감지 루프 밖에서 백그라운드 job으로 처리한다. 상태는 다음처럼 나뉜다.

- `PENDING`: 처리 대기
- `PROCESSING`: scheduler가 lock을 잡고 처리 중
- `SUCCESS`: VLM JSON, description, embedding 저장 완료
- `FAILED`: 다운로드, VLM API, JSON parsing, upload, timeout 등 실제 실행 중 실패
- `SKIPPED`: production mode에서 credential이 없거나 분석할 미디어가 없어 의도적으로 건너뜀

동시 실행 충돌을 막기 위해 DB row를 atomic update로 lock한다. `PROCESSING` 상태에서 `locked_until`이 지나면 stuck job으로 보고 retry 대상이 된다. retry count가 max를 넘으면 `FAILED`로 종료한다.

이 판단은 운영 안정성 측면에서 중요하다. VLM이 실패해도 실시간 알림 생성은 계속되고, 실패 원인은 별도 job 상태로 추적된다.

### 8. mock mode 판단

개발/검증 환경에서는 실제 VLM API 없이 mock mode를 쓴다. mock mode도 random으로 만들지 않고 deterministic하게 만든다.

- event type과 metadata에 따라 고정된 schema JSON을 반환한다.
- embedding도 random vector가 아니라 keyword mapping 기반 deterministic vector를 사용한다.
- 예를 들어 `yellow`, `blue`, `floor` 같은 keyword가 특정 dimension에 매핑된다.

이렇게 해야 검색 테스트가 재현 가능하다. 같은 query와 같은 mock event에 대해 매번 같은 similarity 결과가 나와야 Hit@K, MRR, threshold 테스트를 안정적으로 만들 수 있다.

### 9. 최종 판단 단위

최종적으로 VLM은 알림을 다음과 같은 검색 가능한 단위로 바꾼다.

- 원본 이벤트: YOLO/LSTM이 만든 이상행동 알림
- 대표 장면: 8개 de-identified keyframes
- 구조화 설명: VLM JSON
- 운영자 요약: `detailed_description_ko`
- 검색 단서: `korean_search_keywords`
- semantic vector: `description_embedding`
- UI preview: 백엔드가 발급한 de-identified preview URL

따라서 이 기능의 본질은 "VLM이 사고를 판정한다"가 아니다. YOLO/LSTM이 만든 알림을 사람이 다시 찾고 이해할 수 있는 문서형/검색형 데이터로 변환하는 것이다.

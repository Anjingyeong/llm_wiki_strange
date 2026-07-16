---
role: experiment-and-implementation-notes
wikiCanonicalHub: Benchmark-Evidence-Hub
updatedAt: 2026-07-14
structure: "Part A changes 1-10; Part B benchmarks"
doNotCompareAcrossSections: true
---

1. VLM 키프레임 처리 방식 변경

가장 중요한 변경입니다.

기존 구조처럼 비식별 키프레임 8장을 S3에 각각 PUT하는 방식이 제거됐습니다.

현재 최종 흐름은 다음과 같습니다.

S3 클립
→ AI가 클립 다운로드
→ 이벤트 구간에서 8프레임 추출
→ 메모리에서 비식별화
→ Gemini에 바로 전달
→ VLM 요약·임베딩만 백엔드에 반환

따라서 전에 나왔던 “presigned PUT URL 8개가 모두 유효해야 한다”는 조건은 최종 코드에서는 없어졌습니다. AI의 --output-urls도 선택값으로 바뀌었고, 백엔드도 키프레임용 PUT URL을 만들거나 AI에 전달하지 않습니다.

다만 비식별화가 활성화된 경우에는 다음 조건이 생겼습니다.

keypoint_data 또는 pose sidecar 메타데이터 필요
프레임과 매칭되는 사람 pose가 하나도 없으면 비식별화 실패
즉, 단순 bbox 없는 원본 영상만 넘기면 VLM 작업이 실패할 수 있음
2. 백엔드 ↔ AI VLM Worker HTTP 연결

AI 저장소에 내부 API가 추가됐습니다.

POST /internal/vlm/jobs
X-Service-Token: ...

백엔드가 다음 정보를 AI Worker에 전달합니다.

jobId
incidentId
cameraLoginId
클립 Presigned GET URL
이벤트 종류와 심각도
발생 시각
clipStartSec, clipEndSec

AI는 클립 분석 결과와 임베딩을 JSON으로 반환합니다. 서비스 토큰이 없거나 틀리면 401로 거부됩니다.

Gemini 키가 있으면 실모드가 자동 활성화되고, 키가 없거나 VLM_FORCE_MOCK=true이면 Mock 모드로 동작하도록 정리됐습니다.

3. 클립 소스 계약 안정화

이벤트에 clipObjectKey 필드가 추가됐습니다.

이제 백엔드는 VLM 입력 소스를 다음 우선순위로 선택합니다.

clipObjectKey
정상적인 AWS S3 HTTP URL에서 추출한 object key
스냅샷 object key

반대로 다음 값은 VLM 소스로 거부합니다.

C:\... 같은 로컬 절대경로
/home/... 같은 서버 로컬경로
file://...
일반 HTTP URL
S3가 아닌 임의 URL

즉, DB에는 S3 object key를 명확하게 저장하고, 로컬 clipPath를 VLM 입력으로 착각하지 않도록 수정됐습니다.

또한 clip_end_sec은 선택값으로 변경됐습니다.

시작값 미지정: 0초
종료값 미지정: 전체 클립 사용
종료값이 있으면 시작값보다 커야 함

따라서 백엔드가 clip_end_sec 없이 보내도 전체 클립 기준으로 키프레임을 추출할 수 있습니다.

4. VLM 작업 큐 처리 안정화

VLM Scheduler의 책임도 분리됐습니다.

작업 조회·선점
→ VlmClipJobClaimService

성공·실패 저장
→ VlmClipJobCompletionService

실제 AI 요청
→ AiVlmWorkerClient

주요 변화는 다음과 같습니다.

처리할 작업을 먼저 선점해 중복 실행 방지
CLIP 소스만 정식 VLM 큐에 등록
성공·실패 저장을 별도 트랜잭션으로 처리
AI Worker가 설정되어 있으면 HTTP 방식 우선 사용
실패 사유를 Job에 저장하고 로그 출력
5. Gemini 스냅샷 보조 분석 추가

클립 VLM과 별개로, 이벤트 발생 순간의 JPEG 한 장을 분석하는 Snapshot Assist가 추가됐습니다.

AI에서는 다음 처리가 이루어집니다.

추론 스레드와 분리된 비동기 큐 사용
bbox·keypoint 기반 얼굴 비식별화
동일 eventId 중복 업로드 방지
이벤트 종류, track ID, confidence, faint probability 등 메타데이터 전달
큐가 가득 차면 추론을 막지 않고 스냅샷 요청만 버림

백엔드는 스냅샷과 이벤트 메타를 저장한 뒤 Gemini 분석을 비동기로 수행합니다. 일시적인 Gemini 오류는 최대 2번 재시도합니다.

중요한 점은 이 기능이 기존 낙상·실신 판단을 수정하지 않는 보조 설명 기능이라는 것입니다. 스냅샷 분석이 늦거나 실패해도 안전 이벤트는 그대로 저장·표시됩니다.

6. 이벤트 중복 저장 오류 수정

같은 MQTT eventId가 거의 동시에 들어올 때 이벤트가 두 번 저장되는 문제를 막았습니다.

PostgreSQL에서는 eventId를 기반으로 transaction advisory lock을 획득한 뒤 기존 이벤트 존재 여부를 확인합니다.

동일 eventId 동시 수신
→ 하나씩 직렬 처리
→ 기존 이벤트가 있으면 새 행을 만들지 않고 클립 정보만 연결

다중 백엔드 인스턴스 환경에서도 같은 이벤트 ID의 중복 INSERT를 막는 구조입니다.

7. 이벤트 상세·검색에 VLM 설명 연결

백엔드 이벤트 상세 응답에 vlmDescription이 추가됐습니다.

또한 일반 이벤트 목록의 keyword 검색 범위가 다음처럼 넓어졌습니다.

카메라명
+ 이벤트 유형
+ 기존 메모
+ 성공한 VLM 설명의 LIKE 검색

예를 들어 VLM 설명에 “작업자가 바닥에 누워 있음”이 들어 있다면, 해당 문구로 이벤트를 찾을 수 있습니다.

Semantic Search 결과에는 첫 번째 이벤트 스냅샷의 Presigned URL도 포함되도록 변경됐습니다.

8. 프론트 VLM 표시 방식 개선

이벤트 모달은 이제 두 종류의 VLM 결과를 처리합니다.

클립 전체를 분석한 vlmDescription
이벤트 순간 한 장을 분석한 Snapshot Assist 결과

표시 우선순위는 다음과 같습니다.

클립 VLM 설명
→ 스냅샷 Gemini 설명
→ 규칙 기반 감지 사유

Snapshot Assist가 아직 처리 중이면 2초 간격으로 다시 조회합니다. 실패해도 “기존 안전 이벤트는 정상 처리됐다”는 안내를 보여줍니다.

추가로 수정된 부분은 다음과 같습니다.

alertEventId: DB 상세 조회용 숫자 ID
sourceEventId: Snapshot Assist 조회용 원본 이벤트 ID
등록되지 않은 카메라 이벤트도 목록에서 버리지 않고 카메라명 fallback 표시
clipUrl이 있으면 동영상, snapshotUrl만 있으면 이미지로 표시
검색 결과에서 받은 vlmDescription을 모달로 그대로 전달
사용자 문구를 “VLM 스냅샷 분석”에서 “AI 감지 근거”로 변경
9. Gemini 모델 오류 수정

더 이상 사용하기 어려운 기존 embedding 모델을 교체했습니다.

text-embedding-004
→ gemini-embedding-001

임베딩 차원은 기존 DB 계약에 맞춰 768로 명시했습니다. Snapshot Assist 기본 모델도 다음처럼 변경됐습니다.

gemini-2.0-flash
→ gemini-2.5-flash

AI와 백엔드 양쪽의 모델명이 동일하게 수정됐습니다.

10. 성능 측정 스크립트 추가

기능 외에도 GPU PC 검증 도구가 추가됐습니다.

PyTorch와 TensorRT preflight
TensorRT vs PyTorch 지연시간·FPS 비교
keypoint51 vs motion54 LSTM 비교
트래킹 A/B 리플레이
회귀 테스트 일괄 실행
RTSP 큐 지연 avg/p50/p95/max 수집
MQTT 알림 E2E 지연 측정

단, 측정 기능만 추가된 것이며 TensorRT 성능 수치가 새로 확정된 것은 아닙니다. GPU PC에서 스크립트를 실행해 결과 JSON을 확보해야 합니다.

최종적으로 시스템이 이렇게 바뀜
AI 이벤트 탐지
→ MQTT 이벤트 저장
→ 동일 eventId 중복 방지
→ S3 클립 object key 연결
→ VLM 작업 선점
→ 백엔드가 AI Worker HTTP 호출
→ AI가 클립에서 8프레임을 메모리 추출·비식별화
→ Gemini 요약 및 임베딩 생성
→ 백엔드 DB 저장
→ 이벤트 상세·키워드 검색·의미 검색 제공
→ 프론트 모달에 AI 장면 설명 표시

동시에:

이벤트 순간 스냅샷
→ 비식별화
→ Gemini 보조 분석
→ 프론트가 별도로 폴링해 AI 감지 근거 표시

TensorRT 적용 전후 성능 비교
동일한 영상의 3,000프레임을 대상으로 PyTorch와 TensorRT 전체 추론 파이프라인을 비교했다. 두 실험 모두 YOLO26n Pose와 동일한 51D LSTM 체크포인트, Sequence Length 30, Stride 15 조건을 사용했다.
지표
PyTorch
TensorRT
변화
전체 처리 시간
26.72초
15.32초
42.69% 감소
Offline 처리량
112.26 FPS
195.87 FPS
74.48% 증가
YOLO 평균 지연
7.02ms
3.82ms
45.54% 감소
YOLO p50 지연
6.36ms
3.51ms
44.77% 감소
YOLO p95 지연
10.92ms
5.88ms
46.14% 감소
전체 프레임 평균 처리 시간
8.79ms
4.79ms
45.52% 감소

TensorRT 실행 로그에서 actual_backend=tensorrt, fallback=false를 확인하여 실제 TensorRT Engine이 사용되었음을 검증했다.
검출 결과 비교에서는 매칭된 Bounding Box의 평균 IoU가 0.9925로 나타났으며, Keypoint Confidence 차이도 평균 0.0022로 작았다. PyTorch와 TensorRT 모두 최종 이벤트를 3건 생성해 전체적인 이벤트 탐지 결과도 유사하게 유지됐다.
결과적으로 TensorRT 적용을 통해 YOLO 추론 지연을 약 45% 줄이고, Offline 전체 처리량을 약 74% 높였다. 이를 통해 모델의 주요 탐지 결과를 유사하게 유지하면서 실시간 다중 카메라 처리에 필요한 추론 성능 여유를 확보했다.
본 결과는 단일 영상 기반 Offline Benchmark이며, 실제 운영 성능은 다중 RTSP 카메라 환경에서 추가 검증한다.

Tracking Association 개선 전후 비교
동일한 Detection Cache와 영상 구간을 사용하여 기존 Tracking 설정인 A_current와 개선 설정인 M_I_hybrid_kp_safe를 비교했다.
지표
기존 설정
개선 설정
변화
Total ID Switch Events
8건
1건
87.5% 감소
다중 객체 프레임 ID 집합 변화
39건
0건
100% 감소
Mean Track Coverage
0.3576
0.4970
약 39.0% 증가
Hijack Proxy Count
0건
0건
동일
Mean Track Purity
0.6883
0.5122
감소

개선 설정 적용 후 ID Switch가 8건에서 1건으로 감소했으며, 여러 사람이 동시에 검출된 165개 프레임에서 활성 Tracking ID 집합이 변경된 횟수도 39건에서 0건으로 감소했다.
Mean Track Coverage는 0.3576에서 0.4970으로 약 39% 증가해, 하나의 객체가 동일한 Track ID로 유지되는 범위가 확대됐다. 또한 Hijack Proxy Count가 두 설정 모두 0건으로 나타나, Tracking 안정화 과정에서 다른 객체의 ID를 강제로 빼앗는 현상은 관찰되지 않았다.
Mean Track Purity는 감소했지만, 해당 지표는 다중 객체 프레임에서 사람을 왼쪽부터 P1·P2로 구분하는 Pseudo Identity 기반 지표다. 사람이 서로 교차하거나 화면상 좌우 위치가 변경되면 실제 ID 유지 여부와 관계없이 Purity가 낮아질 수 있으므로, 정식 Ground Truth 기반 Tracking Accuracy가 아닌 보조지표로 해석했다.
결과적으로 M_I_hybrid_kp_safe 설정은 기존 설정 대비 ID Switch를 87.5% 줄이고, 다중 객체 구간의 ID 집합 변화를 제거했으며, Track Coverage를 약 39% 높였다. 이를 통해 객체 재연결 및 Tracking ID 유지 안정성이 개선됐음을 확인했다.

51D에서 54D Motion Feature로 확장
기존 51D Keypoint Feature는 관절의 위치와 신뢰도는 표현할 수 있었지만, 프레임 간 움직임 변화가 직접 포함되지 않아 일부 Faint 동작을 놓치는 한계가 있었다. 이를 개선하기 위해 움직임 정보를 추가한 54D Motion Feature로 입력 구조를 확장했다.
동일한 평가 조건에서 54D 모델은 51D 모델 대비 Accuracy를 89.20%에서 93.45%로 4.25%p, Recall을 90.50%에서 94.20%로 3.70%p, F1-score를 89.29%에서 93.49%로 4.20%p 향상시켰다.
특히 False Negative는 108건에서 66건으로 42건, 약 38.9% 감소해 기존 모델이 놓치던 Faint 사례의 탐지 성능이 개선됐다. False Positive 역시 132건에서 81건으로 약 38.6% 감소해 Recall 향상과 함께 오탐도 줄었다.
실제 추론 파이프라인에서도 54D 체크포인트가 정상적으로 로딩됐으며, 3,000프레임 처리 과정에서 Keypoint Missing 없이 동일한 3건의 이벤트를 탐지했다. LSTM 평균 추론 지연은 약 1.02ms, 전체 처리량은 약 109.7 FPS로 측정돼 실시간 처리 가능 범위도 유지했다.
결과적으로 54D Motion Feature는 약 0.1ms의 LSTM 연산 비용 증가로 FN과 FP를 모두 약 39% 줄이며, Faint 분류 성능과 운영 안정성을 함께 개선했다.


Metric
51차원
54차원
변화
Accuracy
89.20%
93.45%
+4.25%p
Precision
88.10%
92.80%
+4.70%p
Recall
90.50%
94.20%
+3.70%p
F1
89.29%
93.49%
+4.20%p
FP
132
81
-51
FN
108
66
-42

속도: 51D가 더 빠름
51D: 0.917ms
54D: 1.024ms
차이: 약 0.107ms, 즉 51D가 약 0.1ms 빠름
분류 성능: 54D가 더 좋음
Accuracy: +4.25%p
Precision: +4.70%p
Recall: +3.70%p
F1: +4.20%p
FP: 132 → 81, 약 38.6% 감소
FN: 108 → 66, 약 38.9% 감소

핵심 지표
PyTorch
TensorRT
결과
YOLO 평균 지연
9.454ms
4.723ms
50.04% 감소
최악 카메라 p95
14.719ms
7.159ms
51.36% 감소
전체 프레임 처리 지연
11.789ms
6.101ms
48.25% 감소
Dropped Frames
40
34
6개·15% 감소

2카메라 실시간 RTSP Queue 및 TensorRT 성능 검증
실제 개발 환경과 동일하게 cam_03, cam_04 두 개의 RTSP 스트림을 동시에 처리했다. 실시간 관제에서는 오래된 프레임을 모두 처리하는 것보다 최신 상황을 빠르게 분석하는 것이 중요하므로, 카메라별 Frame Queue 크기를 3으로 제한하고 처리 지연 시 오래된 프레임을 폐기하는 Latest Frame 정책을 적용했다.
각 Backend는 카메라별 1,800프레임, 총 3,600프레임을 처리했다.
지표
PyTorch
TensorRT
변화
동시 카메라
2대
2대
동일
Frame Queue Maxsize
3
3
동일
총 처리 프레임
3,600
3,600
동일
YOLO 평균 지연
9.454ms
4.723ms
50.04% 감소
최악 카메라 YOLO p95
14.719ms
7.159ms
51.36% 감소
전체 프레임 평균 처리 지연
11.789ms
6.101ms
48.25% 감소
Dropped Frame
40
34
15% 감소
추정 Drop 비율
약 1.10%
약 0.94%
약 0.16%p 감소

TensorRT 적용 후 YOLO와 전체 파이프라인 처리 지연은 약 50% 감소했으며, Queue에서 폐기된 프레임도 40개에서 34개로 감소했다.
Aggregate 처리량은 PyTorch 28.701FPS, TensorRT 28.339FPS로 유사했다. 이는 TensorRT 처리 성능의 한계가 아니라 카메라당 약 14.5FPS로 공급되는 RTSP 입력 속도가 전체 처리량의 상한선으로 작용했기 때문이다.
PyTorch Worker 두 개와 TensorRT Worker 두 개에서 각각 실제 Backend 적용을 확인했으며, TensorRT Fallback은 발생하지 않았다.
이벤트 발생 건수는 Live RTSP의 서로 다른 시간 구간을 순차적으로 처리한 결과이므로 Backend 정확도 비교 지표에서는 제외했다.


MQTT End-to-End Alert Latency 검증
두 개의 RTSP 카메라 cam_03, cam_04를 동시에 처리하는 TensorRT 환경에서, AI Worker가 프레임을 수신한 시점부터 MQTT Subscriber가 이벤트를 수신한 시점까지 End-to-End Alert Latency를 측정했다.
총 29개의 이벤트를 기준으로 AI 처리 지연은 평균 8.586ms, p95 12ms로 측정됐다. AI 처리 완료 후 MQTT 발행 시작까지의 대기 시간은 평균 11.759ms, p95 15.6ms였으며, MQTT Broker에서 Subscriber까지의 전송 지연은 평균 0.586ms, p95 1ms였다.
최종 End-to-End Alert Latency는 평균 20.931ms, p50 21ms, p95 26ms, 최대 27ms로 측정됐다. 전체 이벤트의 100%가 프로젝트 목표인 1초 이내에 MQTT Subscriber까지 전달됐다.
측정 지표
결과
측정 이벤트
29건
AI 처리 평균
8.586ms
AI 처리 p95
12ms
처리 완료 → MQTT 발행 p95
15.6ms
MQTT 전송 p95
1ms
E2E 평균
20.931ms
E2E p50
21ms
E2E p95
26ms
E2E 최대
27ms
1초 이내 전달 비율
100%

Frame Queue 크기는 3으로 제한했으며, 두 카메라 모두 Queue Lag p50 3ms, p95 5ms를 기록했다. 실험 중 Dropped Frame은 발생하지 않았다.
일부 프레임에서 최대 Queue Lag가 259~283ms까지 증가했지만, 전체 프레임의 95%가 5ms 이내에 처리됐고 프레임 손실도 없었으므로 지속적인 Queue 적체는 발생하지 않은 것으로 판단했다.


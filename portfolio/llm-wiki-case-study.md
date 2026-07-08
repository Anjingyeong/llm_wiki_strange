# LLM Wiki: Hybrid RAG와 기술 의사결정 기록 시스템 (Case Study)

> **문서 성격**: 본 문서는 스마트 안전 관제 시스템 프로젝트의 포트폴리오, 이력서, 기술 면접 및 경험 정리를 위해 작성된 내부 포트폴리오 전용 Case Study 아카이브 문서입니다. Wiki 검색 UI상에서는 직접 노출되지 않도록 설계되었으며, RAG 검색 인덱스 대상에서 제외되어 순수 포트폴리오 참고 자료로만 관리됩니다.

---

## 1. 프로젝트 한 줄 요약

스마트 안전 관제 시스템 개발 과정에서 누적된 복잡한 기술 의사결정, 비디오 스트리밍 프로토콜 롤백, AI 추론 파이프라인의 프레임 정합성 보강 및 버그 해결 기록들을 36개의 Wiki로 구조화하고, 관련 기술 문서의 정확한 정보 격리 및 탐색을 위해 **Metadata Filtering, BM25-style Lexical Search, Vector Search, RRF(Reciprocal Rank Fusion), Heuristic Re-ranking**을 유기적으로 결합한 **Hybrid RAG** 기반 검색 및 답변 생성 시스템을 구축한 프로젝트입니다.

---

## 2. 문제 정의

1. **지식 파편화 및 문맥 붕괴**: AI, Frontend, Backend, Infra, Streaming, 버그 예외 트래킹 결과가 여러 디렉터리에 분산되어 프로젝트 규모 팽창에 따른 설계 정합성 검증 비용이 증가했습니다.
2. **단순 키워드 검색의 한계**: 개발 담당자가 `cameraLoginId`, `frameId`, `OverlaySyncBuffer` 등 정확한 코드 레벨 식별자를 질문할 때는 어휘적(Lexical) 매칭이 유리하고, “화면이 뒤늦게 따라오는 현상”이나 “실시간 관제 지연 원인” 같은 개념 중심 질문에는 의미적(Semantic) 매칭이 유리하지만, 개별 검색 방식만으로는 이 두 극단적인 질문 유형을 하나의 RAG 파이프라인에서 동시에 고품질로 소화하기 어려웠습니다.
3. **기술적 근거의 휘발성**: 관제 시스템의 핵심이었던 스트리밍 프로토콜 판단 과정(WebRTC/HLS 도입과 실패 요인, 그리고 MJPEG로의 최종 원복 결정)에 대한 복합적 engineering trade-off의 결정 이유와 배경 기록이 단선적으로 흩어져 포트폴리오 관점에서 “왜 그런 결정을 내렸는지” 설명하기 부족했습니다.
4. **LLM 서비스 불안정 및 의존성 위험**: 클라우드 LLM API(Gemini, OpenAI 등)를 실시간 관제 백엔드에 다이렉트로 결합할 경우, API 키 누락, 무료 티어 쿼터 만료, 네트워크 타임아웃 등으로 인해 전체 관제 서비스 검색 기능 자체가 마비될 수 있는 잠재적 위험이 존재했습니다.

---

## 3. 내가 해결하려 한 핵심 질문

- “왜 특정 AI 모델(YOLO26n-pose + LSTM)을 안전성 지표를 기반으로 최종 선택했는가?”
- “RTSP/WebRTC/HLS/MJPEG 중 개발 환경의 제약조건과 publisher lifecycle 한계를 극복하기 위해 왜 MJPEG를 기본 표시 경로로 최종 원복했는가?”
- “프레임 레이트 미스매치나 BBox 차원 확장(51D -> 54D)과 같은 AI 분석 버그가 발생했을 때 어떻게 진단하고 격리했는가?”
- “수집된 이벤트 스냅샷 정보와 DB 데이터가 일관되게 동기화되었는지 자연어로 즉각 검색해낼 수 있는가?”
- “실제 테스트 코퍼스 상에서 단순 벡터 검색보다 Hybrid RAG가 실질적인 검색 정확도(Hit@K, MRR) 향상을 이끌어내는가?”
- “LLM API 키가 없거나 네트워크 연결이 단절된 프로덕션 서버 환경에서도 RAG 시스템이 안전하게 Fallback하여 작동하는가?”

---

## 4. 주요 기능

### 4.1. Wiki 문서 구조화
- **36개 마크다운 문서 체계화**: 시스템 전반의 핵심 설계 및 버그 극복 스토리를 유기적으로 조망할 수 있는 구조화된 지식창고를 구축했습니다.
- **9단계 문맥 흐름 구성**: 
  1. 개요 (Overview / Glossary)
  2. 아키텍처 (Architecture / ADR)
  3. AI 파이프라인 (AI-Pipeline / Model-Decision)
  4. 스트리밍 (WebRTC-vs-HLS / Normalization)
  5. 프레임 동기화 (Frame-Matching / Debug-Report)
  6. 모델 개선 (LSTM-Sequence / Experiment)
  7. 버그 기록 (Bug-Tracker / Notification-Scope)
  8. 운영 안정화 (Realtime-Stabilization / Rollback-Decision)
  9. 회고/확장 (Resume-Notes / Evidence)
- **제목 체계 정규화**: 카드 및 사이드바 렌더링에 적합하도록 정교하게 축약된 `navTitle`, `shortTitle`과 공식 문서 제목인 `title`을 분리 적용하여 UI의 일관성을 유지하면서도 검색 엔진 매핑이 어긋나지 않도록 `slug` 지향적 RAG 맵핑을 구현했습니다.

### 4.2. Hybrid RAG 검색 파이프라인
사용자의 질문 문맥을 두 갈래의 검색 강점으로 동시 융합하여 상호 보완하도록 설계했습니다.
1. **Metadata Hint Filtering**: 쿼리 내 키워드(`cam_05`, `webrtc`, `lstm` 등) 분석을 기반으로 특정 카테고리를 추론해 힌트 필터를 부여합니다.
2. **Lexical Search (어휘적 매칭)**: 정확한 코드 클래스 명칭 및 환경변수 매칭을 위해 BM25 스타일의 텍스트 스코어링을 수행합니다.
3. **Vector Search (의미적 매칭)**: 텍스트 세그먼트를 384차원 조밀 벡터로 임베딩하여 사용자 질문의 추상적 의도와 맥락을 비교 분석합니다.
4. **RRF (Reciprocal Rank Fusion) 병합**: 식 `RRF = 1 / (60 + Rank_bm25) + 1 / (60 + Rank_vector)` 에 따라 두 순위를 결합하여 순위를 재조정합니다.
5. **Local Heuristic Re-ranking**: 문서의 정렬 메타데이터(`order`) 및 텍스트 구조적 매칭도(가중치)를 합산하여 최종 상위 5개의 Context Chunk를 추출합니다.

### 4.3. RAG-only + 선택적 LLM Answer Mode
- **Zero-Dependency RAG-only Default**: LLM API 호출 없이 로컬 검색 인덱스에서 수집된 가장 연관성 높은 텍스트를 구조화된 템플릿 형태로 변환해 제공합니다. API 비용이 들지 않으며 인터넷망 단절 시에도 100% 정상 작동하는 핵심 Fallback 모드입니다.
- **선택적 자연어 생성 (LLM Answer Mode)**: `ENABLE_LLM_ANSWER=true` 활성화 시 Gemini, Cloudflare Workers AI, OpenAI 등의 멀티 프로바이더 허브를 통해 자연어 답변을 자동 생성합니다.
- **Fail-safe Fallback 메커니즘**: LLM API 호출 과정에서 네트워크 타임아웃, API 키 부재, 쿼터 제한 초과 에러 등이 포착되면, 서비스 크래시 없이 즉시 RAG-only 모드로 복귀하여 검색된 증거와 소스 링크를 정상 반환합니다.

### 4.4. Cloudflare Pages 배포 안정화
- **V8 샌드박스 환경변수 래퍼 구현**: Cloudflare Pages Functions가 표준 Node.js의 `process.env` 글로벌 객체에 접근할 수 없어 발생하는 `process is not defined` 에러를 디버깅하기 위해, 크로스 플랫폼 래핑 헬퍼인 [env.mjs](file:///c:/Users/user/Documents/최종%20쉴더스/docs/wiki/scripts/lib/rag/env.mjs)를 개발했습니다.
- **이중 런타임 호환**: Cloudflare Functions 구동 시 `context.env`를 최우선으로 읽고, 로컬 테스트나 벤치마크 평가 시에는 Node.js의 `process` 상태를 안전하게 참조하도록 분기하여 동일 코드가 웹서버와 로컬 테스트 스위트 양쪽에서 예외 없이 실행됩니다.

### 4.5. MJPEG Display Rollback 결정 (Strategic Engineering Trade-off)
- **배경**: 초기 검토했던 WebRTC(WHEP) 및 HLS 중심 실시간 전송은 MediaMTX의 publisher lifecycle 불안정성, HLS/WHEP 404 에러, ffmpeg publisher의 잦은 비정상 종료로 인해 제한된 일정 속에서 실시간 디버깅 및 안정화 비용이 지나치게 커지는 문제에 직면했습니다.
- **결정**: 시연의 최고 우선순위인 "끊김 없는 비디오 화면 렌더링"을 확보하기 위해 브라우저 표시 transport 단계를 MJPEG 스트림으로 롤백하고, WebRTC/HLS는 예비 fallback 모드로 보존했습니다.
- **효과**: 절약된 엔지니어링 에너지를 이상행동 감지 모델 오탐/미탐 개선, 스냅샷 정합성 보강, VLM/RAG 기반 자연어 검색 기능 고도화에 집중 배치하여 전체 프로젝트의 실질적인 가치 향상을 유도했습니다.

---

## 5. 정량 성과

### 5.1. RAG Benchmark 결과 (22개 다차원 질문 평가)
신규 추가된 MJPEG 롤백 관련 질문 2개(`q_mjpeg_rollback`, `q_mjpeg_scope_control`)를 포함한 22문항 데이터셋 평가 결과입니다. Vector-only 검색 단일 모델(Baseline) 대비 Lexical + Vector + RRF + Re-ranking 모델(Hybrid)의 정량 비교 결과는 다음과 같습니다.

| 평가 지표 | 단일 벡터 검색 (Baseline) | 하이브리드 RAG (Hybrid) | 성능 개선폭 (Diff) |
| :--- | :---: | :---: | :---: |
| **Hit@1** (1순위 매칭율) | 45.45% | 40.91% | -4.54% |
| **Hit@3** (3순위 내 매칭율) | 45.45% | 59.09% | **+13.64%** |
| **Hit@5** (5순위 내 매칭율) | 45.45% | 68.18% | **+22.73%** |
| **MRR@5** (평균 상호 순위) | 0.455 | 0.520 | **+0.065** |
| **Context Precision@5** (맥락 정밀도) | 0.355 | 0.273 | -0.082 |
| **Keyword Coverage** (핵심어 커버리지) | 38.94% | 49.32% | **+10.38%** |
| **Avg Search Latency** (평균 검색 시간) | 2.22 ms | 44.15 ms | +41.93 ms |

> [!NOTE]
> 하이브리드 RAG는 다차원 RRF 정렬 및 로컬 리랭킹 알고리즘이 적용되면서 단일 벡터 검색 대비 40ms 내외의 약간의 검색 대기 시간이 증가했으나, 최종적으로 시연에 유효한 정보가 상위 5위 안에 들어올 확률인 **Hit@5가 45.45%에서 68.18%로 22.73%p 대폭 향상**되었으며 핵심어 커버리지 역시 **10.38%p 증가**하여 의도한 고품질 검색이 안정적으로 수행됨을 과학적으로 증명했습니다.

### 5.2. 최종 검증 합격 현황
- **Unit Tests (`npm test`)**: 12개 테스트 스위트 전원 통과 (100% PASS)
- **Static Assets Compilation**: Vite 프로덕션 빌드 빌드 완료
- **Wrangler Pages Dev Sandbox**: wrangler dev 기반 에뮬레이터 환경에서 process ReferenceError 없이 RAG API 200 OK 수신 확인 완료

---

## 6. 대표 기술적 판단

### 6.1. GraphRAG 대신 Hybrid RAG 우선 안정화
- **문제**: 지식 그래프 구조(GraphRAG)가 최신 유행이지만, 문서 개수가 36개 내외인 국면에서는 문서 간 관계 추론 오버헤드보다 개별 문서 내 핵심 어휘(코드 매핑, 예외 문구)의 정확한 retrieval이 훨씬 더 결정적이었습니다.
- **판단**: 정밀도가 검증된 BM25 기반 텍스트 매핑과 시맨틱 벡터 거리를 RRF 알고리즘으로 합성하는 하이브리드 모델을 먼저 완벽하게 안정화하기로 결정했습니다.
- **결과**: 평가 지표상 Hit@5 68.18%를 확보하여 데모 수준의 정보 추출 정확도를 먼저 선제 검증했습니다.
- **후속**: 추후 수천 개 단위로 의사결정 사례 및 현장 안전 보고서가 확대되는 시점에 엔티티 관계도를 추출하는 GraphRAG 확장을 검토할 예정입니다.

### 6.2. LLM Answer Mode를 기본이 아닌 선택 기능으로 설계
- **문제**: 외부 LLM 호출을 기본으로 두면, 무료 티어 한계나 망 장애 시 전체 관제 대시보드 내 검색 기능이 크래시되어 시연 중 치명적인 리스크로 작용할 우려가 컸습니다.
- **판단**: 로컬 임베딩과 가벼운 검색 구조를 바탕으로 응답하는 RAG-only를 기본 모드로 채택하고, LLM API는 어댑터 패턴으로 결합하여 예외 발생 시 RAG-only 템플릿으로 무진동 자동 폴백되도록 설계했습니다.
- **결과**: API 키가 없어도 100% 가동 가능한 실무 위주의 고가용성 위키 검색 구조를 확립했습니다.

### 6.3. 초저지연 스트리밍에서 디버깅이 쉬운 MJPEG로의 전략적 롤백
- **문제**: WebRTC/HLS는 실시간 관제에 적합하지만, MediaMTX의 퍼블리싱 오류(WHEP/HLS 404) 및 ffmpeg 프로세스 중복 크래시로 인해 전체 프로젝트가 불통이 되는 현상이 잦았습니다.
- **판단**: 초저지연 기술 도입보다 "시연 현장에서 카메라 화면이 100% 항상 렌더링되어 보이는 것"이 더 높은 비즈니스적 가치를 가진다고 정의하고, 화면 전송은 직관적이고 격리가 용이한 MJPEG 스트림으로 롤백했습니다.
- **결과**: `cameraLoginId` 숫자 suffix 기반 포트 계산 공식으로 8010~8014번 포트 등의 경로 매핑이 단순해져 장애가 발생했을 때 1초 이내에 문제의 격리 판정이 가능해졌습니다.

---

## 7. 아키텍처 요약

```text
[마크다운 위키 문서군 (36개)]
        ↓ (Frontmatter Parser)
[검색 인덱스 생성 (searchIndex.ts) + RAG 벡터 인덱스 (ragVectorIndex.json)]
        ↓
[하이브리드 정보 검색 파이프라인]
   ├─ Metadata Category Hint 필터링
   ├─ BM25 스타일 어휘적 텍스트 검색 스코어 산출
   ├─ 384차원 벡터 시맨틱 코사인 유사도 검색
   ├─ RRF (Reciprocal Rank Fusion) 순위 합성
   └─ Heuristic Re-ranking (정렬 가중치 보정)
        ↓ (Context Formatter)
   [RAG-only Default 모드] ──(LLM 비활성/에러/타임아웃 시)──> [구조화된 마크다운 템플릿 답변]
   [LLM Answer Mode] ───────(API 정상 & 환경변수 켬)───────> [Gemini / OpenAI / CF AI 자연어 답변]
        ↓
[관제 웹 UI 프레임워크 (React / Vite) 답변 렌더링 + 출처 칩 카드 매핑]
```

---

## 8. 포트폴리오용 요약 문장

### 8.1. 이력서 한 줄 요약
> “스마트 안전 관제 개발 의사결정 및 AI 정합성 버그 해결 과정을 36개 Wiki 문서로 구조화하고, BM25-style 렉시컬 매칭과 벡터 유사도에 기반한 Hybrid RAG 시스템을 구축하여 검색 매칭 정확도(Hit@5)를 Baseline 대비 22.73%p 향상시켰습니다.”

### 8.2. 프로젝트 세 줄 요약
- **지식 구조화 및 우선순위 정비**: AI 추론 차원 확장(54D), 스트리밍 프로토콜 롤백 등 36가지 핵심 아키텍처 결정을 9단계 문맥으로 체계화하여 지식 전파 속도를 단축했습니다.
- **고가용성 RAG 및 하이브리드 설계**: BM25와 시맨틱 벡터를 상호 결합한 RRF 융합 검색을 자바스크립트 환경에 최적화하여 구현했으며, API 에러에 무진동 대처하는 RAG-only 자동 fallback 구조를 고안했습니다.
- **서버리스 배포 안정화**: Cloudflare Pages Functions 환경에서 전역 `process` 참조 예외를 해결하기 위해 크로스플랫폼 환경변수 브리지 어댑터를 적용하여 V8과 Node 환경 동시 실행성을 증명했습니다.

### 8.3. 면접 답변 가이드
> “트렌디한 기술을 쫓아 GraphRAG 등을 성급히 도입하기 전에, 저희 프로젝트 코퍼스 규모에 적합한 데이터 매칭 정밀도를 올리는 것이 시급하다고 판단했습니다. 따라서 BM25 스타일의 텍스트 스코어러와 임베딩 거리 분석을 Reciprocal Rank Fusion으로 결합하고 heuristic re-ranking 가중치를 얹어 하이브리드 RAG를 우선 구축했습니다. 그 결과 Hit@5 지표가 기존 단순 벡터 검색 성능인 45.45% 대비 68.18%로 22.73%p 향상되었고, 이 의사결정의 성공을 수치로 증명하여 포트폴리오 가치를 높였습니다.”

---

## 9. 사용 기술

- **프론트엔드/엔진**: React, Vite, TypeScript, Vanilla CSS
- **배포 및 서버리스**: Cloudflare Pages, wrangler dev emulator, Cloudflare Pages Functions
- **RAG 파이프라인**: Local 384-dimensional Vector Embeddings, Custom BM25-style search indexer, Reciprocal Rank Fusion (RRF), Context custom template parser
- **LLM API 연동**: Gemini API, Cloudflare Workers AI API, OpenAI ChatCompletions API
- **테스트 및 자동화**: Node.js Test runner, RAG benchmark evaluation suite

---

## 10. 한계와 후속 계획

### 10.1. 현재 한계
- **작은 평가셋 규모**: RAG 정량 평가 벤치마크 셋이 22개 문항으로 구성되어, 실제 다양한 관제 시나리오 질문을 포괄하기에는 한계가 있습니다.
- **Reranker 성능의 한계**: GPU 메모리 및 클라이언트 연산 제한으로 인해 딥러닝 기반 Cross-Encoder 리랭커를 적용하지 못하고 Heuristic 스코어 합산 방식으로 대체하고 있습니다.
- **MJPEG 다중 렌더링 오버헤드**: 관제 센터에서 한 명의 운영자가 십여 개 이상의 다중 카메라를 하나의 탭에서 관찰할 때, MJPEG 기반 개별 포트 스트림의 병렬 디코딩 연산으로 인해 브라우저의 대역폭 소모와 브라우저 렌더링 스레드 지연이 증가할 수 있습니다.

### 10.2. 후속 계획
- **벤치마크 셋 50문항 이상 증설 및 Golden Answer 정교화**: 오답 방지를 위한 핵심 키워드 일관성 매칭 풀을 정비합니다.
- **Langfuse LLM Observability 도입**: API 응답 대기 지연(Latency), 토큰 사용량, 그리고 검색된 맥락의 관련도(Context Relevancy) 및 충실도(Faithfulness)를 실시간 대시보드로 시각화합니다.
- **Cross-Encoder Reranker 경량 모델 포팅**: 로컬 브라우저 혹은 가벼운 서버 수준에서 기동하는 ONNX 기반 Reranker 모듈 탑재를 준비합니다.
- **VLM 자동 스냅샷 캡셔닝 및 이벤트 다차원 통합 검색**: 이상행동 감지 시 VLM이 캡쳐된 이미지 스냅샷을 텍스트 캡션으로 자동 번역하여 DB에 인입하고, RAG 위키와 연계하여 "작업장 2구역에서 쓰러짐 사고의 원인 및 대처는?" 같은 복합 조회가 가능한 자연어 통합 검색 창구를 개설할 계획입니다.

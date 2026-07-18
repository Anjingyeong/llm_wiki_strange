# LLM Wiki RAG Technical Note

이 문서는 LLM Wiki에 구현된 RAG(Retrieval-Augmented Generation) 기반 질의응답 시스템의 기술적 아키텍처, 개선 결정, 그리고 정량적 평가 결과를 포트폴리오 관점에서 상세히 설명합니다. 본 시스템은 외부 상용 Vector DB 인프라 없이 경량의 **파일 기반 Vector Store**와 **Local Hash Embedding**을 활용하여 비용 효율적이고 독립적인 검색 구성을 실현했습니다.

---

## 1. 문제 정의

LLM Wiki는 스마트 안전 관제(Smart Safety Monitoring) 프로젝트의 시스템 설계, 아키텍처 결정, 벤치마크 결과, 그리고 장애 조치 기록을 정적 Markdown 문서로 통합 관리합니다. 그러나 다음과 같은 한계가 존재했습니다.

- **의사결정 맥락 파편화**: YOLO26n-pose 모델 선정 근거, MJPEG 스트리밍 선택 이유, MQTT 이벤트 스크림 구조 등 핵심 엔지니어링 의사결정이 다수의 문서에 흩어져 있어 필요한 정보를 빠르고 정확하게 찾아내기 어려웠습니다.
- **일반 지식 기반 Hallucination**: 단순 LLM 질의응답을 적용할 경우, 모델이 내부 세부 사양이나 벤치마크 수치를 일반적인 인터넷 지식으로 메우거나 사실과 다른 오답(Hallucination)을 생성할 위험이 매우 높았습니다.
- **근거 없는 오응답**: 질문에 해당하는 사내 정보가 위키 내에 부재하더라도, 유사도가 가장 높은 관련 없는 청크를 토대로 강제로 그럴듯한 거짓 답변을 생성하는 부작용이 있었습니다.

따라서 내부 문서만을 진실의 원천(Source of Truth)으로 삼아, **충분한 근거가 확보된 경우에만 참고 문헌 출처(Citation)를 명확히 제시하며 답변**하고, 근거가 없을 시에는 모르는 상태로 대답을 보류하는 신뢰할 수 있는 RAG 시스템이 필수적이었습니다.

---

## 2. 초기 접근

프로젝트 초기에는 다음과 같은 단순화된 RAG 파이프라인을 구축했습니다.

- **Ingestion**: 정적 위키 문서를 문단 및 일정 글자 수(1,100자) 단위로 분할하여 기본 청크를 생성했습니다.
- **Vector Search**: 단어 가중치(TF-IDF)를 256차원의 안정 해시(Stable Hash) 버킷에 누적 및 magnitude 정규화하는 **Local Hash Embedding** 기술을 적용했습니다. 질문과 청크 간의 코사인 유사도(Cosine Similarity)를 계산하여 검색 결과를 반환했습니다.
- **Scale**: 초기 인덱스는 **26개 문서, 255개 청크** 규모였습니다.

---

## 3. 검색 실패 분석

초기 Vector 검색 단독 경로를 Golden Query Dataset으로 평가한 결과, 다음과 같은 심각한 성능 저하 및 한계가 파악되었습니다.

1. **정밀 키워드 매칭 실패 (Keyword Miss)**: `yolo26n-pose`, `WIKI_ACCESS_KEY`, `cameraLoginId`, `MediaMTX` 등 고유 명사, 설정 파라미터명, 소스코드 파일명 등 정밀 검색이 필요한 경우 의미 벡터 임베딩 점수만으로는 원하는 문서가 누락되는 현상이 빈발했습니다.
2. **검색 결과의 문서 편중 (Information Redundancy)**: 유사도가 가장 높은 상위 청크들을 정렬할 때, 특정 1~2개 문서에서 중복되거나 유사한 내용의 청크가 검색 지면을 모두 차지했습니다. 그 결과, 다른 핵심 연관 문서의 청크들이 순위권 밖으로 밀려나 Context의 다양성과 정보 밀도가 낮아졌습니다.
3. **무응답 정책의 부재**: 데이터셋에 없는 사외의 질문("사내 급여 정책은 무엇인가?")에 대해 코사인 유사도 최고점을 가진 무관한 위키 청크가 주입되어 거짓 정보를 조작하는 현상이 100% 발생했습니다.

---

## 4. 개선 판단

발견된 retrieval 실패 패턴을 극복하기 위해 단계별 고도화 전략을 수립했습니다.

- **BM25 Lexical Retrieval 병렬 통합**: 고유 코드명 및 키워드 매칭 성능을 극대화하기 위해 exact-term 부스팅 가중치를 결합한 BM25 어휘 검색 엔진을 추가했습니다.
- **Reciprocal Rank Fusion (RRF) 도입**: 상이한 점수 체계를 가진 Lexical 검색 순위와 Vector 검색 순위를 조화롭게 병합하기 위해 가중 RRF 알고리즘을 도입했습니다.
- **문서 레벨 다양화 (Result Diversification)**: 하나의 문서에서 최종 Context로 진입할 수 있는 청크 개수를 최대 2개(`maxChunksPerDocument: 2`)로 제한하여 상위 결과에 여러 문서의 정보가 고루 섞이도록 설계했습니다.
- **Structure-aware Markdown Chunking**: 본문을 기계적으로 쪼개는 대신 Markdown의 `#`, `##`, `###` 헤더 계층 구조를 인식하여 섹션 단위로 나누고, 상위 맥락(Header Path)을 각 청크에 포함시켜 정보의 유실을 최소화했습니다.
- **Abstention Policy (무응답 정책) 수립**: 검색 결과의 키워드 정합도와 매칭 품질 지표를 분석해 질문을 지원할 근거가 부족하면 답변을 거부하는 `insufficient_context` 처리 알고리즘(`abstention.mjs`)을 추가했습니다.

---

## 5. 최종 아키텍처

개선이 반영된 RAG 위키의 최종 데이터 처리 및 질의 경로 아키텍처는 다음과 같습니다.

```text
Markdown 문서 Ingestion
  → Heading 기반 Structure-aware Chunking
  → Local Hash TF-IDF Vector Retrieval (256차원)
  + BM25 / Exact-term Lexical Retrieval
  → Reciprocal Rank Fusion (RRF, K=60, 후보 검색 Limit=40)
  → 문서 수준 중복 제거 및 다양화 (문서별 최대 2개 청크)
  → 최종 Context 구성 (Limit=6, 최대 4800자 제한)
  → Grounded RAG-only (Local Heuristic) 또는 선택적 LLM 답변 (Gemini/OpenAI 등 외부 API)
  → 참고 문서 & Wiki 링크 표시
```

### 아키텍처 핵심 키워드 정리

- **파일 기반 Vector Store**: 복잡한 외부 Vector Database 서버 인프라를 요구하지 않고, 컴파일된 정적 JSON 파일(`data/ragVectorIndex.json`)에 벡터 인덱스를 캐싱하여 로드하고 즉각 서빙하는 고성능 파일 형태의 임베딩 저장소입니다.
- **Local Hash Embedding**: 어떠한 외부 API 네트워크 지연 없이, 브라우저와 Node.js 독립 환경에서 결정론적으로 256차원 텍스트 특이 벡터를 빌드하고 유사도를 비교 연산하는 고속 경량 임베딩 체계입니다.
- **Hybrid Retrieval & RRF**: BM25의 exact 키워드 식별 장점과 벡터 서치의 어휘 변형 대응 장점을 가중 결합하여 단일 검색 한계를 극복했습니다.
- **Abstention & insufficient_context**: 위키 내에 답변을 증명할 수 있는 근거 문헌이 매칭되지 않거나, 수치 정보의 근거가 박약한 경우 답변을 보류하고 `insufficient_context` 구조화 응답을 반환하여 Hallucination을 효과적으로 차단합니다.
- **Graceful Fallback**: 외부 거대 언어 모델(LLM) 연동을 기본 분리하여 API Key 미지정, 네트워크 장애, 요금 제한 발생 시에도 서비스 장애로 이어지지 않고, 검색된 청크 문장을 추출 결합하는 로컬 정교화 답변으로 매끄럽게 대체 동작합니다.

---

## 6. 정량 평가

RAG 질의 성능의 정량 평가는 61개의 실무 엔지니어링 질의로 구성된 Golden Query Dataset(`golden_queries.v1.jsonl`)을 기준으로 지속 검증합니다.

### 1) 초기 스냅샷 비교 평가 (2026-07-10 데이터셋 기준: 26개 문서, 255개 청크)
동일한 평가 환경 조건 하에 초기 Vector 단독 모델과 개선된 Hybrid RRF(결과 다양화 포함) 경로를 비교한 지표입니다.

| 평가 지표 | 초기 Vector Baseline (Legacy Chunking) | 개선 Hybrid RRF + Diversification (max2) | 개선 수준 |
| --- | --- | --- | --- |
| **Hit@1** | 0.5200 | 0.6200 | +10.0%p |
| **Hit@5** | 0.6200 | 0.8600 | **+24.0%p** |
| **Recall@5** | 0.4467 | 0.6233 | +17.66%p |
| **MRR** | 0.5617 | 0.7167 | **+0.1550** |
| **nDCG@5** | 0.4572 | 0.6093 | +0.1521 |
| **No-result Accuracy** | 0.00 (0%) | 1.00 (100%) | **+100%p** |

> **성과 요약**: 동일한 골든 쿼리 평가 조건에서 초기 Vector Baseline 대비 **Hit@5를 62%에서 86%로 24%p 대폭 개선**했으며, **MRR 또한 0.562에서 0.717로 대폭 향상**시켰습니다. 특히 사외 무관 질문에 대한 **무응답 정확도(No-result Accuracy)를 0%에서 100%로 끌어올려** 신뢰도를 대폭 확보했습니다.

### 2) 최종 확장 데이터 평가 (2026-07-18 최신 인덱스 기준: 48개 문서, 658개 청크)
문서 수 48개, 청크 수 658개로 전체 지식 저장소의 규모가 커진 상황에서 Rerun한 최신 벤치마크 결과입니다. (각각 동일 환경 및 인덱스 조건 하에 측정되었습니다.)

| 평가 지표 | 최종 Vector Baseline (Structure-aware) | 최종 Hybrid Contextual + Diversification (max2) |
| --- | --- | --- |
| **Hit@1** | 0.5179 | 0.6071 |
| **Hit@5** | 0.6250 | 0.8036 |
| **Recall@5** | 0.4167 | 0.5774 |
| **MRR** | 0.5580 | 0.6875 |
| **nDCG@5** | 0.4270 | 0.5701 |
| **No-result Accuracy** | 0.00 (0%) | 1.00 (100%) |

### 3) 청킹 기법 단독 정량 평가 (동일한 Vector Baseline 조건 하 비교)
단순 Paragraph 분할(Legacy Chunking) 방식과 Markdown 구조 계층을 반영하는 Structure-aware Chunking 방식의 비교 지표입니다.

- **Legacy Chunking 적용 시**: Hit@5: 0.6200 | Recall@5: 0.4467 | MRR: 0.5617
- **Structure-aware Chunking 적용 시**: Hit@5: 0.7800 | Recall@5: 0.5267 | MRR: 0.6457
- **분석 결과**: 검색 알고리즘 고정 상태에서도 제목 계층 구조와 문서 메타데이터 맥락을 보존하는 Chunking 설계만으로 **Hit@5 성능이 16%p 개선**됨을 증명했습니다.

---

## 7. 장애 대응과 fallback

본 시스템은 네트워크 단절, LLM API 할당량 부족(Rate Limit), 외부 서버 에러 상황에서도 안정적인 사용자 경험을 보장합니다.

- **RAG-only Mode 자동 Fallback**: 외부 LLM 호출 환경변수(`ENABLE_LLM_ANSWER`)가 비활성화되어 있거나 API 호출이 실패할 경우, 시스템은 오류 화면을 노출하는 대신 **로컬 추출식 요약 답변 모드**로 즉시 전환됩니다.
- **로컬 요약 (Local Heuristic)**: 검색된 Context 청크들 중에서 사용자 질문의 핵심 어휘 토큰이 포함된 대표 문장들을 유기적으로 조합하여 답변을 구성합니다.
- **서버 측 캡슐화**: 모든 외부 LLM과의 통신 및 API Credentials 정보 관리는 오직 서버(`server.mjs`) 수준에서 은닉 처리되므로 브라우저 클라이언트에는 어떠한 보안 키 정보도 누출되지 않습니다.

---

## 8. 보안 고려사항

- **자격 증명 은닉**: 클라이언트 번들이나 웹 브라우저 로컬 스토리지에 API Key를 주입하거나 영속화하지 않으며, API 요청을 중개하는 서버 측 엔드포인트에서만 인메모리로 인가 처리를 제어합니다.
- **WIKI_ACCESS_KEY 검증**: 공개 호스팅 환경에서의 오용을 방지하기 위해 서버 측 환경변수로 `WIKI_ACCESS_KEY`가 정의된 경우, 모든 API 호출 및 페이지 진입 시 HTTP Custom Header (`x-wiki-key`) 검증 루틴을 통과해야 합니다. (로컬 데모 목적 시 비워둘 경우 Open 접근을 제공합니다.)
- **정적 컴파일 인덱싱**: 서버 측 RAG 인덱스 갱신 API(`reindex`)는 외부 임의 노출에 따른 변조 방지를 위해 기본 `405 Method Not Allowed`로 차단되어 있습니다. 인덱스는 관리자가 터미널 환경에서 빌드 시점(`npm run build`) 또는 `npm run rag:index` 스크립트를 수동 실행하여 생성합니다.
- **민감정보 배제**: RTSP 인증 토큰, 비밀번호 등 하드코딩된 자격 증명 정보는 소스코드 및 Markdown 원문 데이터베이스에 작성하지 않고 `.env` 파일로 주입받거나 더미값으로 치환하여 관리합니다.

---

## 9. 한계

- **의미 검색의 깊이 한계**: 본 시스템은 별도의 딥러닝 기반 대형 Dense Embedding 모델을 호출하지 않고 local stable TF-IDF hash 기법에 의존하므로, 단어가 완전히 다르지만 맥락이 유기적으로 연결된 고도의 추상적 질문(의미론적 변형)에 대해서는 검색 감도가 상대적으로 저하될 수 있습니다.
- **메모리 적재형 JSON의 확장성 한계**: 인덱스 전체를 단일 JSON 파일(`data/ragVectorIndex.json`)에 로드되므로, 문서 수가 수만 개 이상으로 대규모 확장될 경우 서버 메모리 오버헤드와 검색 지연이 증가할 수 있습니다.
- **Hybrid 랭킹 연산의 Latency 소폭 증가**: BM25 연산과 RRF 랭킹 결합 처리가 병렬로 작동함에 따라, 극단적으로 가벼운 단독 Vector 검색에 비해 밀리초 단위의 연산 오버헤드가 발생합니다.
- **재인덱싱 동기화 지연**: Markdown 원문 수정 시 즉각적으로 검색 임베딩이 업데이트되지 않으며, `npm run generate:index`와 같은 별도 인덱싱 프로세스를 주기적 혹은 수동으로 트리거해 컴파일을 완료해야 반영됩니다.

---

## 10. 얻은 기술 역량과 배운 점

### 얻은 기술 역량
- **Markdown Ingestion & Parsing**: 구조화된 Markdown 문서의 메타데이터 파싱 및 Heading 계층에 따른 논리 섹션 가변 분할.
- **Local Embedded Search**: 256차원 stable hash vector 매핑 모델과 cosine similarity를 통한 경량 벡터 비교 로직 개발.
- **Hybrid RRF Search Engine**: BM25 검색과 벡터 유사도 순위를 병합하고 가중치 스케일링을 제공하는 RRF 융합 검색 최적화.
- **Search Result Diversification**: 상위 랭킹 결과의 다양성을 넓혀 중복 정보 누출을 제어하는 분산 어휘 파이프라인 구축.
- **Quantitative RAG Evaluation**: Hit@K, Recall@K, MRR, nDCG@5 지표 산출과 Golden Query 기반 테스트 오토메이션 파이프라인 구현.
- **Abstention Policy & Citation**: 근거 부족을 감지하는 무응답 로직 설계 및 UI 단에서 추적 클릭이 가능한 명확한 문서 출처 카드 렌더링 구현.

### 배운 점
RAG 시스템의 실제 현업 품질과 신뢰성을 결정하는 가장 핵심적인 요소는 고비용의 초거대 언어 모델(LLM)을 최신 모델로 업그레이드하는 것보다, **원천 데이터의 계층적 청킹(Chunking) 방식, 다양한 관점의 검색 융합(Hybrid RRF), 정보의 편중을 막는 다각화(Diversification) 및 근거 수준 검증을 통한 무응답 거부 정책(Abstention Policy)**과 같은 전·후처리 엔지니어링 파이프라인을 정교하게 다듬고 정량적으로 측정하는 일에 있음을 실증적으로 깨달았습니다.

# LLM Wiki

Smart Safety Monitoring 프로젝트 문서를 정적 Wiki와 서버 측 RAG 질의응답으로 제공한다.

## Portfolio Documentation

- [LLM Wiki RAG Technical Note](docs/rag-portfolio.md): LLM Wiki 프로젝트의 RAG 아키텍처, 구현 결정, 기술 선택 등을 설명한다. 포트폴리오 제출용으로 작성되었다.

## 실행

```bash
npm install
npm run build
npm start
```

- Wiki: `http://localhost:4173`
- RAG health check: `GET /api/rag/health`
- RAG question API: `POST /api/rag/ask`

개발 서버는 정적 화면 확인용이다.

```bash
npm run dev
```

RAG API까지 확인하려면 `npm run build && npm start`로 Node 서버를 실행한다.

## RAG 구조

질문 처리 흐름은 다음 순서를 따른다.

```text
사용자 질문
-> 질문 embedding 생성
-> vector search
-> 관련 문서 chunk 검색
-> LLM prompt에 context로 주입
-> 근거 기반 답변 생성
-> 참고 문서 표시
```

현재 저장 구조는 기존 DB를 바꾸지 않는 파일 기반 vector store다.

- 원문 문서: `content/*.md`
- 검색 인덱스: `src/generated/searchIndex.ts`
- RAG vector store: `data/ragVectorIndex.json`
- RAG 코어: `scripts/lib/rag-core.mjs`
- 서버 API: `server.mjs`

`npm run rag:index`는 `content/*.md`를 섹션 단위 chunk로 나누고 local hash embedding을 생성해 `data/ragVectorIndex.json`에 저장한다. 문서를 새로 등록하거나 수정한 뒤에는 아래 명령으로 embedding/vector store를 갱신한다.

```bash
npm run rag:index
```

`npm run build`는 Wiki 검색 인덱스와 RAG vector store를 모두 다시 생성하므로, 배포 전 문서 수정분이 반영된다.

## Grounded Answer Policy

- API key는 브라우저로 전달하지 않는다. LLM 호출은 `server.mjs` 내부에서만 수행한다.
- 외부 LLM에는 전체 원문이 아니라 vector search로 선택된 관련 chunk만 전달한다.
- 관련 chunk가 없으면 추측하지 않고 `관련 문서가 부족함. 문서에서 확인되지 않음.`을 반환한다.
- LLM API가 설정되지 않았거나 실패하면 로컬 추출형 답변을 사용한다. 이 답변도 검색된 chunk 문장만 사용한다.
- 답변에는 가능한 경우 문서 제목, 섹션명, 문서 ID, Wiki 링크를 `sources`로 반환한다.

## Environment Variables

외부 LLM은 선택 사항이다. 무료/저비용 운영을 위해 기본값은 로컬 embedding과 로컬 추출 답변이다.
또한 위키 페이지 접근 및 RAG 호출을 위한 Access Key를 환경변수로 지정할 수 있다.

```bash
PORT=4173
WIKI_ACCESS_KEY=smart-safety-2026 # 위키 및 RAG API 접근 제한용 키 (기본값: smart-safety-2026)
RAG_LLM_API_KEY=
RAG_LLM_ENDPOINT=https://api.openai.com/v1/chat/completions
RAG_LLM_MODEL=gpt-4o-mini
```

### 보안 범위 및 목적 안내 (Access Restriction Scope)

> [!WARNING]
> 본 프로젝트의 위키 접근 키(Access Key) 인증 기능은 **포트폴리오 데모 공개 및 팀원 간의 캐주얼한 접근 제한**을 위해 도입된 기능입니다.
> - Vite 빌드 프로세스는 마크다운 문서 내용을 정적 JSON 데이터(searchIndex.ts 등)로 변환하여 프론트엔드 자바스크립트 에셋에 정적으로 포함(번들링)시킵니다.
> - 따라서 네트워크나 프론트엔드 코드를 깊게 분석할 수 있는 고급 사용자라면 클라이언트 번들 파일에서 원문 텍스트를 추출할 수 있으므로, 이 보안 기능은 **데이터의 완전한 기밀성(Confidentiality) 보장이나 고성능 침입 방지 장치가 아닙니다.**
> - "민감한 기밀 정보 보호"가 아닌 **"데모 목적의 일반인 접근 제한 및 불필요한 크롤링/봇 트래픽 방지"** 수준임을 숙지하고 활용해 주세요.


OpenAI 호환 chat-completions API를 쓰는 저비용 provider를 사용할 경우 `RAG_LLM_ENDPOINT`와 `RAG_LLM_MODEL`만 바꾸면 된다.

## API Examples

```bash
curl -i http://localhost:4173/api/rag/health
```

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"yolo26n-pose를 선택한 근거는?\"}"
```

```bash
curl -i -X POST http://localhost:4173/api/rag/ask \
  -H "content-type: application/json" \
  --data "{\"question\":\"사내 급여 정책은 무엇인가요?\"}"
```

## Verification

```bash
npm test
npm run lint
npm run build
```

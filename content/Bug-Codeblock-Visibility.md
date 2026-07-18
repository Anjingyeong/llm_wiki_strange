---
title: Bug Codeblock Visibility
navTitle: "코드블록 표시"
shortTitle: "코드블록 표시"
category: Bugs
relatedDocs: [AI-Output-JSON, MQTT-Event-Schema]
relatedFiles: [src/styles.css, src/components/MarkdownRenderer.tsx]
updatedAt: 2026-07-15
type: incident
status: partial
evidenceLevel: unit-test
---

## 목적

Wiki에서 `text`, `json`, `code` 코드블록이 선택하기 전에는 거의 보이지 않던 문제의 원인과 수정 방향을 기록한다.

## 배경

LLM Wiki는 JSON payload와 실행 흐름을 많이 보여준다. 코드블록이 읽히지 않으면 MQTT schema, AI output, benchmark evidence를 사람이 확인하기 어렵고 LLM용 지식베이스 역할도 약해진다.

## 핵심 내용

원인은 코드블록 내부 `<code>`가 인라인 코드 스타일과 충돌할 수 있는 CSS 구조였다. `.markdown code`가 모든 code 요소에 배경과 padding을 주고, 코드블록 안쪽 `<code>`에 명시적인 `color: inherit`, `background: transparent`, `white-space: pre`가 부족했다.

수정 방향:

- `.codeBlock pre`에 명시적인 dark background와 text color를 부여한다.
- `.codeBlock pre code`는 인라인 코드 배경과 padding을 제거한다.
- `.language-json`, `.language-text`, `.hljs`, `.token`에도 상속 색상을 고정한다.
- 긴 JSON은 `overflow-x: auto`와 `min-width: max-content`로 가로 스크롤한다.

## 입력

```json
{
  "eventId": "evt-20260623-cam_01-000001",
  "streamId": "cam_01",
  "events": [
    {
      "type": "faint",
      "confidence": 0.87
    }
  ]
}
```

## 출력

선택이나 드래그 없이도 라이트모드와 다크모드에서 JSON 텍스트가 보여야 한다.

## 동작 흐름

```text
Markdown fenced code
-> MarkdownRenderer codeBlock figure
-> language-json class
-> CSS contrast override
-> readable pre/code block
```

## 관련 파일

- `src/styles.css`
- `src/components/MarkdownRenderer.tsx`

## 관련 문서

- [AI-Output-JSON](AI-Output-JSON.md)
- [MQTT-Event-Schema](MQTT-Event-Schema.md)

## 주의사항

새 syntax highlight 라이브러리는 추가하지 않았다. 이번 수정은 CSS 충돌 제거와 클래스 부여만으로 해결한다.

## 후속 작업

- 자동: `tests/codeblock-styles.test.mjs` — `--code-bg`/`--code-text`, `.codeBlock pre` 대비 규칙.
- 수동(선택): 브라우저에서 `AI-Output-JSON`, `MQTT-Event-Schema` 라이트/다크 스크린샷.
---
#bug #codeblock #css #json #dark-mode

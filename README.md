# OpenAI Web Research Desk

키워드를 입력하면 OpenAI Responses API의 `web_search` 도구로 최신 웹 자료를 찾고, 선택한 자료 유형만 구조화해서 정리하는 로컬 웹앱입니다.

## 실행

```powershell
$env:OPENAI_API_KEY="sk-..."
npm.cmd run dev
```

브라우저에서 서버 로그에 표시된 `http://127.0.0.1:포트` 주소를 여세요. 기본 모델은 `gpt-5.5`이고, 필요하면 `OPENAI_MODEL` 환경변수나 화면의 모델 입력값으로 바꿀 수 있습니다.

## 포함된 기능

- 자료 유형 체크박스: 뉴스, 공식 기관, 논문, 기업/IR, 시장 리포트, 데이터셋, 법/정책, 제품, 커뮤니티, 행사, 이미지
- 웹서치 옵션: 라이브 웹 접근, 이미지 결과, 긴 리서치 토큰 예산, 지역 정보, 검색 깊이, 도메인 허용/차단
- 결과 정리: 핵심 요약, 주요 발견, 자료 목록, 타임라인, URL 소스, 원문 JSON
- 내보내기: Markdown 복사, JSON 다운로드

## 참고

OpenAI 웹 검색은 임의 페이지 전체를 크롤링해 저장하는 범용 스크래퍼가 아니라, Responses API의 호스팅 `web_search` 도구로 검색 결과와 출처를 모델 응답에 반영하는 방식입니다. 앱은 API 응답의 citation/source/image metadata를 UI에 표시합니다.

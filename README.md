# RANDOM SHELF

국립세종도서관 사서들이 추천한 책 가운데 한 권을 고르고, 사서의 추천 글과 책 속 한 문장을 보여 줍니다. 

공공데이터를 활용한 학습용 개인 프로젝트입니다.

배포 주소: https://random-shelf.netlify.app/

## 기능

- 분야 필터: `아무거나`, `이야기와 문장`, `세상과 사람`, `과학과 기술` 중 하나를 고릅니다. 필터는 한국십진분류(KDC) 대분류로 책을 나눕니다.
- 책 룰렛: `책 한 권 뽑기`를 누르면 표지 룰렛이 2.2초 동안 돌다가 가운데 눈금에 걸린 책에서 멈춥니다.
- 상세 모달: 표지, 제목, 저자, 출판사, 출판연도, 책 속 한 문장, 사서의 추천 글을 보여 줍니다. `다른 책 만나기`로 같은 필터에서 다시 뽑습니다.

## 기술 스택

- HTML, CSS, JavaScript.
- Netlify Functions: API 키를 숨기는 중계 함수
- Netlify: 배포

## 폴더 구조

```
random-shelf/
├── public/                  # 배포되는 화면 파일
│   ├── index.html
│   ├── style.css
│   └── main.js              # 서지정보 분리, 룰렛, 모달
├── netlify/functions/
│   └── books.mjs            # API 중계 함수: 무작위 페이지에서 100권을 받아 돌려준다
├── docs/
│   ├── 기획서.md            # 기능과 데이터 규칙
│   ├── DESIGN.md            # 디자인 명세
│   └── 자료조사.md          # API 조사와 데이터 분석
├── netlify.toml
└── .env.example
```

## 로컬에서 실행하기

[문화공공데이터광장](https://www.culture.go.kr/data/openapi/openapiView.do?id=362)에서 국립세종도서관 사서추천도서 API 키를 발급받아야 합니다.

1. `.env.example`을 `.env`로 복사하고 `SEJONG_API_KEY`에 발급받은 키를 넣습니다. `.env`는 커밋하지 않습니다.

   ```bash
   cp .env.example .env
   ```

2. Netlify CLI로 화면과 중계 함수를 함께 띄웁니다.

   ```bash
   npx netlify-cli dev
   ```

3. 브라우저에서 http://localhost:8888 을 엽니다.

## 배포

GitHub 저장소가 Netlify 사이트와 연결되어 있어서, `main` 브랜치에 푸시하면 자동으로 배포됩니다. Netlify는 `public/`만 공개하고, 함수는 `netlify/functions/`에서 읽습니다.

Netlify 사이트 설정의 환경변수에 `SEJONG_API_KEY`를 넣어야 배포된 함수가 API를 부를 수 있습니다.

## 데이터 출처

책 정보, 사서의 추천 글, 표지 이미지는 [문화공공데이터광장 국립세종도서관 사서추천도서 API](https://www.culture.go.kr/data/openapi/openapiView.do?id=362)에서 가져옵니다.

API 응답의 `description` 필드에는 서지정보와 추천 글이 한 문자열로 섞여 있습니다. 앱은 정규식으로 저자, 출판사, 출판연도, KDC, 추천 글 본문, 책 속 한 문장을 나눕니다. 나누지 못한 책과 표지를 불러오지 못한 책은 뽑기에서 뺍니다. 2026-10-21 기준 전체 733권 중 714권을 분리했습니다. 분리 규칙은 `docs/자료조사.md` 3장에 있습니다.

API는 개발 계정 기준 하루 1,000건까지 호출할 수 있습니다. 화면을 한 번 열 때 2~3건을 호출합니다.

## 문서

- [`docs/기획서.md`](docs/기획서.md): 화면 구성, 필터, 뽑기 규칙, 데이터 처리 규칙, 출시 전 점검
- [`docs/DESIGN.md`](docs/DESIGN.md): 색상, 글꼴, 간격, 컴포넌트, 화면 문구
- [`docs/자료조사.md`](docs/자료조사.md): API 문서 확인, 실제 응답 분석, 서지정보 분리 결과

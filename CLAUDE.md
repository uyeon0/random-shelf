# RANDOM SHELF

책 표지가 가로로 늘어선 룰렛을 돌려 책 한 권을 무작위로 뽑아 주는 비회원 웹 서비스다. 외부 API를 활용하는 학습 과제다.

## 문서

- 기능과 데이터 규칙: `docs/기획서.md`
- 색상, 글꼴, 간격, 컴포넌트, 화면 문구: `docs/DESIGN.md`
- API 조사와 표본 분석 근거: `docs/자료조사.md`

구현은 위 문서를 따른다. 두 문서가 서로 어긋나면 한쪽을 골라 구현하지 말고 사용자에게 묻는다.

## 미확정 항목

`DESIGN.md` 14장에 미확정 항목이 있다. 구현하다 미확정 항목이나 문서에 없는 값에 걸리면 임의로 정하지 않고 사용자에게 묻는다. 사용자가 정한 내용은 해당 문서에 반영한다. 출시 전 점검 항목은 `기획서.md` 10장에 있다.

## 기술 스택과 파일 구성

- HTML, CSS, JavaScript만 쓴다. 프레임워크와 빌드 도구는 쓰지 않는다.
- 페이지는 `public/index.html` 하나다. 스타일은 `public/style.css`, 스크립트는 `public/main.js`로 나눈다. Netlify는 `public/`만 배포한다.
- API 중계는 Netlify Functions로 한다. 함수 파일은 `netlify/functions/` 아래에 둔다.
- 폰트는 Pretendard 하나만 CDN에서 불러온다. 세리프 글꼴은 쓰지 않는다.
- 아이콘은 Lucide outline에서 필요한 것만 SVG로 직접 넣는다.

## API 키

국립세종도서관 사서추천도서 API를 쓴다. 키는 환경변수 `SEJONG_API_KEY`에 두고, 중계 함수에서 `process.env.SEJONG_API_KEY`로만 읽는다.

- 로컬: `.env.example`을 `.env`로 복사하고 `SEJONG_API_KEY` 값을 채운다. `netlify dev`가 이 파일을 읽어 함수에 넘긴다. `.env`는 커밋하지 않는다.
- 배포: Netlify 사이트 환경변수에 같은 이름으로 둔다.
- 키를 `public/` 아래 파일, 함수 응답, 로그에 넣지 않는다.
- `.env`는 사용자가 직접 만든다. Claude는 `.env`를 읽거나 키 값을 출력하지 않는다.

## 로컬 확인과 배포

- 로컬에서는 `netlify dev`로 페이지와 함수를 함께 띄워 확인한다.
- 배포는 Netlify로 한다.

## Git

- 혼자 작업하므로 `main` 브랜치에 바로 커밋하고 푸시한다.
- 커밋은 `kocommit:commit` 스킬로 한다.

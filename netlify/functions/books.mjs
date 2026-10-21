// 국립세종도서관 사서추천도서 API 중계 함수.
// 무작위 페이지 하나에서 책 100권을 골라 돌려준다.
// 키는 환경변수에서만 읽고, 응답과 로그에 키를 남기지 않는다.

const API_URL = "https://api.kcisa.kr/openapi/service/rest/meta13/getNLSF0401";
const ROWS = 100;

class ApiError extends Error {}

async function fetchPage(key, pageNo, numOfRows) {
  const url = new URL(API_URL);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("pageNo", String(pageNo));

  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError("API에 연결하지 못했습니다.");
  }
  if (!res.ok) throw new ApiError(`API가 오류를 반환했습니다. (${res.status})`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new ApiError("API 응답을 해석하지 못했습니다.");
  }
  if (data?.response?.header?.resultCode !== "0000") {
    throw new ApiError("API가 오류를 반환했습니다.");
  }

  const body = data.response.body;
  const item = body?.items?.item ?? [];
  return {
    totalCount: Number(body?.totalCount) || 0,
    items: Array.isArray(item) ? item : [item],
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default async () => {
  const key = process.env.SEJONG_API_KEY;
  if (!key) return json({ error: "API 키가 설정되지 않았습니다." }, 500);

  try {
    const { totalCount } = await fetchPage(key, 1, 1);
    if (totalCount === 0) return json({ items: [] });

    const pageCount = Math.ceil(totalCount / ROWS);
    const pageNo = Math.floor(Math.random() * pageCount) + 1;
    let { items } = await fetchPage(key, pageNo, ROWS);

    // 마지막 페이지라 100권보다 적으면 1페이지 앞부분으로 채운다.
    if (items.length < ROWS && pageCount > 1) {
      const first = await fetchPage(key, 1, ROWS);
      items = items.concat(first.items.slice(0, ROWS - items.length));
    }

    return json({ items });
  } catch (err) {
    const message = err instanceof ApiError ? err.message : "책 목록을 가져오지 못했습니다.";
    return json({ error: message }, 502);
  }
};

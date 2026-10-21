"use strict";

const API_PATH = "/.netlify/functions/books";
const MAX_ROULETTE = 20;
const LOOPS = 5;
const SPIN_MS = 2200;
const SPIN_EASING = "cubic-bezier(.12, .8, .2, 1)";
const COVER_TIMEOUT_MS = 8000;

const FILTERS = {
  all: () => true,
  story: (kdc) => kdc[0] === "8",
  world: (kdc) => ["1", "2", "3", "9"].includes(kdc[0]),
  science: (kdc) => ["4", "5"].includes(kdc[0]),
};

const FILTER_DESC = {
  all: "분야 상관없이 모든 책에서 뽑아요",
  story: "소설, 시, 에세이 같은 문학 중에서 뽑아요",
  world: "철학, 종교, 사회, 역사 책 중에서 뽑아요",
  science: "자연과학과 기술·의학·공학 책 중에서 뽑아요",
};

const TEXT = {
  loading: "책장을 채우고 있어요",
  ready: "책장이 준비됐어요",
  emptyTitle: "이번 책장에는 이 분야 책이 없어요",
  emptyDesc: "다른 필터를 고르거나 책장을 새로 채워 보세요.",
  emptyBtn: "책장 새로 채우기",
  errorTitle: "책을 불러오지 못했어요",
  errorDesc: "잠시 후 다시 시도해 주세요.",
  errorBtn: "다시 시도",
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const $ = (id) => document.getElementById(id);
const el = {
  status: $("status"),
  roulette: $("roulette"),
  track: $("track"),
  notice: $("notice"),
  noticeTitle: $("notice-title"),
  noticeDesc: $("notice-desc"),
  noticeBtn: $("notice-btn"),
  draw: $("draw"),
  modal: $("modal"),
  modalClose: $("modal-close"),
  modalCover: $("modal-cover"),
  modalTitle: $("modal-title"),
  modalAuthor: $("modal-author"),
  modalPub: $("modal-pub"),
  modalReview: $("modal-review"),
  modalQuote: $("modal-quote"),
  modalQuoteText: $("modal-quote-text"),
  linkLibrary: $("link-library"),
  linkStore: $("link-store"),
  redraw: $("redraw"),
  chips: document.querySelectorAll(".chip"),
  filterDesc: $("filter-desc"),
};

const state = {
  books: [],
  filter: "all",
  set: [],
  centerIndex: 0,
  offset: 0,
  spinning: false,
  opener: null,
};

// ---------- 서지정보 분리 (docs/자료조사.md 3.3) ----------

const MARKER = /사서의\s*추천(\s*글)?/;
const CALL = /(?:(\d{4})[\s,]*)?(?:아\s*)?(\d{3})(?:\.\d+)?-\d+(?:-\d+)?/;
const SEP = /\s*[|｜ㅣ;]\s*/;
const ROLE = /(지음|엮음|글·그림|글|그림|저|편저|편|공저|씀|원작|기획|옮김)(\s|$)/;
const JUNK = /[<>="]|size:/;
const RELATED = /(책\s*)?함께\s*읽으면\s*좋[은을]\s*책/;
const CALL_ANY = /\d{3}(?:\.\d+)?-\d{2}-\d+/;

const isSig = (ch) => /[\p{L}\p{N}]/u.test(ch);
const sig = (s) => [...s].filter(isSig).join("");
const stripParen = (s) => s.replace(/^\([^)]*\)\s*/, "");

const ROLE_WORD = /(?<=^|\s)(지음|엮음|글·그림|글|그림|저|편저|편|공저|씀|원작|기획|옮김)(?=\s|$|,)/;
const SURNAMES = new Set("김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진지엄채원천방공현함변염여추도소석선설마길연위표명기반라왕금옥육인맹제모탁국어은편용예경봉사부");
const QUOTE = /[?!’‘'"“”:]/;
const COUNT_WORD = /\d+(개|가지|년|번|일|시간|페이지)|\d[가-힣]+로$/;
const nameToken = (t) => /^[가-힣]{1,6}$/.test(t) || /^[A-Z]\.$/.test(t);

// 부제가 섞였다고 보는 조건: 다섯 단어 이상, 따옴표·물음표, 수량 표현, '~의'로 끝나는 단어
function hasSubtitle(text) {
  const tokens = text.split(" ").filter(Boolean);
  return tokens.length >= 5 || QUOTE.test(text) || tokens.some((t) => COUNT_WORD.test(t) || /^[가-힣]+의$/.test(t));
}

// 저자 칸 앞에 섞인 부제를 떼어 낸다. 공동 저자 구분자(쉼표, ·)와 뒤쪽 역할어는 그대로 둔다.
// 이름이 몇 단어인지는 추천 글에 그 이름이 나오는지로 정하고, 안 나오면 한국 성씨인지로 추정한다.
function stripSubtitle(author, review) {
  const m = author.match(ROLE_WORD);
  if (!m) return author;
  const names = author.slice(0, m.index).trim();
  const rest = author.slice(m.index);
  const parts = names.split(/(,\s+|\s*·\s*)/);
  let last = -1;
  for (let i = 0; i < parts.length; i += 2) {
    if (hasSubtitle(parts[i])) last = i;
  }
  if (last < 0) return author;

  const tokens = parts[last].split(" ").filter(Boolean);
  let best = 0;
  for (let k = 1; k <= Math.min(4, tokens.length - 1); k++) {
    const suffix = tokens.slice(-k);
    if (!suffix.every(nameToken)) break;
    if (review.includes(suffix.join(" "))) best = k;
  }
  if (best === 0) {
    const tail = tokens[tokens.length - 1];
    best = /^[가-힣]{2,4}$/.test(tail) && SURNAMES.has(tail[0]) ? 1 : 2;
    while (best > 1 && !tokens.slice(-best).every(nameToken)) best--;
  }
  const kept = [tokens.slice(-best).join(" "), ...parts.slice(last + 1)].join("");
  return `${kept} ${rest}`.trim();
}

// 추천 글 뒤에 붙은 '함께 읽으면 좋은 책' 목록을 떼어 낸다.
// 제목 문구 없이 마지막 인용 쪽수 '(N쪽)' 뒤에 다른 책의 청구기호가 이어지는 경우도 자른다.
function cutRelated(review) {
  const i = review.search(RELATED);
  if (i >= 0) return review.slice(0, i).trim();
  const pages = [...review.matchAll(/\(\d+쪽\)/g)];
  const last = pages[pages.length - 1];
  if (last) {
    const end = last.index + last[0].length;
    if (CALL_ANY.test(review.slice(end))) return review.slice(0, end).trim();
  }
  return review;
}

// 추천 글은 대개 '본문 → 저자 소개 → 책 속 한 문장' 순서다.
// 저자 소개는 버리고, 본문과 책 속 한 문장을 나눠 돌려준다.
const AUTHOR_INTRO = /(저\s*자|작\s*가|지은이)\s*소\s*개/;
const QUOTE_HEAD = /책\s*속\s*한\s*문장/;

function splitReview(review) {
  const a = review.match(AUTHOR_INTRO);
  const q = review.match(QUOTE_HEAD);
  const cuts = [a?.index, q?.index].filter((i) => i !== undefined);
  const body = (cuts.length ? review.slice(0, Math.min(...cuts)) : review).trim();
  let quote = "";
  if (q) {
    const start = q.index + q[0].length;
    const end = a && a.index > q.index ? a.index : review.length;
    quote = review.slice(start, end).trim();
  }
  return { body, quote };
}

// text 앞쪽에서 title의 문자·숫자를 순서대로 맞춰 소비하고, 끝난 위치를 돌려준다.
function consumeTitle(text, title) {
  const target = sig(title);
  if (!target) return -1;
  let k = 0;
  for (let i = 0; i < text.length; i++) {
    if (!isSig(text[i])) continue;
    if (text[i] !== target[k]) return -1;
    k++;
    if (k === target.length) return i + 1;
  }
  return -1;
}

function parseBook(item) {
  const title = (item.title ?? "").trim();
  const desc = (item.description ?? "").replace(/\s+/g, " ").trim();
  const cover = (item.referenceIdentifier ?? "").replace(/\\/g, "").replace(/^http:/, "https:");
  if (!title || !cover) return null;

  const mk = desc.match(MARKER);
  if (!mk) return null;
  const head = desc.slice(0, mk.index).trim();
  const review = cutRelated(desc.slice(mk.index + mk[0].length).trim());
  if (!review) return null;

  const m = head.match(CALL);
  if (!m || !m[1]) return null;
  const before = head.slice(0, m.index).trim();
  const useComma = !/[|｜ㅣ;]/.test(before);
  const segs = before.split(useComma ? /\s*,\s*/ : SEP).filter(Boolean);
  if (segs.length < 2) return null;

  let first = segs[0];
  let end = -1;
  const attempts = [
    [first, title],
    [first, title.split(/\s*:\s*/)[0]],
    [stripParen(first), stripParen(title)],
    [stripParen(first), title],
  ];
  for (const [f, t] of attempts) {
    end = consumeTitle(f, t);
    if (end >= 0) {
      first = f;
      break;
    }
  }
  if (end < 0) return null;

  let author = first.slice(end)
    .replace(/^[\s:.!?)\]]+/, "")
    .replace(/^(저자|지은이|글쓴이)\s*:\s*/, "")
    .trim();
  if (!author || JUNK.test(author)) return null;
  if (!ROLE.test(author) && (useComma || author.length > 15)) return null;
  author = stripSubtitle(author, review);
  const { body, quote } = splitReview(review);
  if (!body) return null;

  const publisher = segs[segs.length - 1].split(/\s*,\s*/).filter(Boolean).pop();
  if (!publisher || JUNK.test(publisher)) return null;

  return { title, author, publisher, year: m[1], kdc: m[2], review: body, quote, cover };
}

// ---------- 데이터 ----------

function loadCover(book) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => done(false), COVER_TIMEOUT_MS);
    function done(ok) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok && img.naturalWidth > 0 ? book : null);
    }
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = book.cover;
  });
}

async function fetchBooks() {
  const res = await fetch(API_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.items)) throw new Error("bad response");
  const parsed = data.items.map(parseBook).filter(Boolean);
  const loaded = await Promise.all(parsed.map(loadCover));
  return loaded.filter(Boolean);
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 후보에서 최대 20권을 고르고, 모자라면 같은 책을 반복해 채운다.
function buildSet() {
  const pool = shuffle(state.books.filter((b) => FILTERS[state.filter](b.kdc)));
  if (pool.length === 0) return [];
  const set = pool.slice(0, MAX_ROULETTE);
  for (let i = 0; set.length < MAX_ROULETTE; i++) set.push(pool[i % pool.length]);
  return set;
}

// ---------- 화면 상태 ----------

function announce(text) {
  el.status.textContent = text;
}

function showNotice(kind) {
  const isEmpty = kind === "empty";
  el.noticeTitle.textContent = isEmpty ? TEXT.emptyTitle : TEXT.errorTitle;
  el.noticeDesc.textContent = isEmpty ? TEXT.emptyDesc : TEXT.errorDesc;
  el.noticeBtn.textContent = isEmpty ? TEXT.emptyBtn : TEXT.errorBtn;
  el.notice.hidden = false;
  el.roulette.hidden = true;
  el.draw.disabled = true;
  announce(`${el.noticeTitle.textContent}. ${el.noticeDesc.textContent}`);
}

function hideNotice() {
  el.notice.hidden = true;
  el.roulette.hidden = false;
}

function renderSkeleton() {
  hideNotice();
  el.track.style.transform = "";
  el.track.replaceChildren(
    ...Array.from({ length: 12 }, () => {
      const div = document.createElement("div");
      div.className = "skeleton";
      return div;
    })
  );
  centerOn(el.track.children[6]);
}

function renderRoulette() {
  state.set = buildSet();
  if (state.set.length === 0) {
    showNotice("empty");
    return;
  }
  hideNotice();

  const frag = document.createDocumentFragment();
  for (let loop = 0; loop < LOOPS; loop++) {
    for (const book of state.set) {
      const img = document.createElement("img");
      img.src = book.cover;
      img.alt = "";
      img.decoding = "async";
      frag.append(img);
    }
  }
  el.track.replaceChildren(frag);

  state.centerIndex = Math.floor(Math.random() * state.set.length);
  placeAt(state.centerIndex);
  el.draw.disabled = false;
}

// ---------- 룰렛 ----------

// 트랙의 index번째 표지 중심이 룰렛 가운데 선에 오도록 하는 translateX 값
function offsetFor(node) {
  const center = node.offsetLeft + node.offsetWidth / 2;
  return el.roulette.clientWidth / 2 - center;
}

function centerOn(node) {
  if (!node) return;
  state.offset = offsetFor(node);
  el.track.style.transform = `translateX(${state.offset}px)`;
}

// 첫 바퀴 다음 바퀴(loop 1)의 같은 책으로 위치를 맞춘다.
function placeAt(setIndex) {
  centerOn(el.track.children[state.set.length + setIndex]);
}

async function spin() {
  if (state.spinning || state.set.length === 0) return;
  state.spinning = true;
  el.draw.disabled = true;

  const pick = Math.floor(Math.random() * state.set.length);
  const target = el.track.children[(LOOPS - 1) * state.set.length + pick];
  const from = state.offset;
  const to = offsetFor(target);

  if (!reducedMotion.matches) {
    const anim = el.track.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      { duration: SPIN_MS, easing: SPIN_EASING, fill: "forwards" }
    );
    await anim.finished;
    el.track.style.transform = `translateX(${to}px)`;
    anim.cancel();
  }
  el.track.style.transform = `translateX(${to}px)`;
  state.offset = to;
  state.centerIndex = pick;
  state.spinning = false;

  openModal(state.set[pick]);
  // 같은 책이 가운데에 그대로 보이도록 앞쪽 바퀴의 같은 자리로 되돌린다.
  placeAt(pick);
}

// ---------- 모달 ----------

function searchUrl(base, param, title) {
  const url = new URL(base);
  url.searchParams.set(param, title);
  return url.href;
}

function openModal(book) {
  el.modalCover.src = book.cover;
  el.modalCover.alt = `${book.title} 표지`;
  el.modalTitle.textContent = book.title;
  el.modalAuthor.textContent = book.author;
  el.modalPub.textContent = `${book.publisher} · ${book.year}`;
  el.modalReview.textContent = book.review;
  el.modalQuoteText.textContent = book.quote;
  el.modalQuote.hidden = !book.quote;
  el.linkLibrary.href = searchUrl("https://www.data4library.kr/srch", "srchText", book.title);
  el.linkStore.href = searchUrl("https://search.kyobobook.co.kr/search", "keyword", book.title);

  state.opener = document.activeElement instanceof HTMLElement ? document.activeElement : el.draw;
  el.modal.showModal();
  el.modalReview.scrollTop = 0;
  el.modalClose.focus();
}

function closeModal() {
  if (el.modal.open) el.modal.close();
}

el.modal.addEventListener("close", () => {
  el.draw.disabled = state.set.length === 0;
  const target = state.opener && document.contains(state.opener) && !state.opener.disabled ? state.opener : el.draw;
  target.focus();
});

el.modalClose.addEventListener("click", closeModal);

el.redraw.addEventListener("click", () => {
  closeModal();
  renderRoulette();
  if (state.set.length > 0) spin();
});

// ---------- 필터와 버튼 ----------

function selectFilter(chip) {
  if (state.spinning) return;
  for (const c of el.chips) {
    const on = c === chip;
    c.setAttribute("aria-checked", String(on));
    c.tabIndex = on ? 0 : -1;
  }
  state.filter = chip.dataset.filter;
  el.filterDesc.textContent = FILTER_DESC[state.filter];
  if (state.books.length > 0) renderRoulette();
}

el.chips.forEach((chip, i) => {
  chip.tabIndex = chip.getAttribute("aria-checked") === "true" ? 0 : -1;
  chip.addEventListener("click", () => selectFilter(chip));
  chip.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = el.chips[(i + step + el.chips.length) % el.chips.length];
    next.focus();
    selectFilter(next);
  });
});

el.draw.addEventListener("click", spin);
el.noticeBtn.addEventListener("click", load);

window.addEventListener("resize", () => {
  if (!state.spinning && state.set.length > 0) placeAt(state.centerIndex);
});

// ---------- 시작 ----------

async function load() {
  el.draw.disabled = true;
  el.draw.setAttribute("aria-busy", "true");
  announce(TEXT.loading);
  renderSkeleton();
  try {
    state.books = await fetchBooks();
    renderRoulette();
    if (state.set.length > 0) announce(TEXT.ready);
  } catch {
    state.books = [];
    state.set = [];
    showNotice("error");
  } finally {
    el.draw.removeAttribute("aria-busy");
  }
}

load();

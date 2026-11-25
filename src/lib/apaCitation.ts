/**
 * APA 7th 스타일 출처 포맷 (이슈 #38).
 * HTML(저널명 이탤릭) + plain text 를 함께 제공한다.
 */

export type ApaSourceInput = {
  sourceTitle?: string | null;
  sourceAuthor?: string | null;
  sourceYear?: number | null;
  sourceUrl?: string | null;
  sourceJournal?: string | null;
  sourceVolume?: string | null;
  sourceIssue?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasHangul(s: string): boolean {
  return /[\uAC00-\uD7A3]/.test(s);
}

/** 저자 문자열을 개별 저자 목록으로 분리 */
export function splitAuthors(raw: string): string[] {
  const cleaned = raw
    .replace(/\bet\s*al\.?/gi, "")
    .replace(/외\s*$/g, "")
    .trim();
  if (!cleaned) return [];

  return cleaned
    .split(/\s*(?:,|;|\/|·|&|\band\b|\b그리고\b|및)\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

/**
 * 1~2명: 전체 표기
 * 3명 이상(또는 et al./외 포함): 국문 "홍길동 외" / 영문 "Author et al."
 */
export function formatApaAuthors(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const hasEtAl = /\bet\s*al\.?/i.test(raw) || /외/.test(raw);
  const authors = splitAuthors(raw);
  if (authors.length === 0) return raw.trim();

  if (authors.length >= 3 || hasEtAl) {
    const first = authors[0]!;
    return hasHangul(first) ? `${first} 외` : `${first} et al.`;
  }
  if (authors.length === 2) {
    const joiner = hasHangul(authors[0]!) || hasHangul(authors[1]!) ? ", " : " & ";
    return `${authors[0]}${joiner}${authors[1]}`;
  }
  return authors[0]!;
}

export type ApaCitation = {
  plain: string;
  html: string;
  empty: boolean;
};

/** APA 저널 기사 형식에 가깝게 조합 */
export function formatApaCitation(src: ApaSourceInput): ApaCitation {
  const author = formatApaAuthors(src.sourceAuthor);
  const year = src.sourceYear != null ? String(src.sourceYear) : "";
  const title = src.sourceTitle?.trim() ?? "";
  const journal = src.sourceJournal?.trim() ?? "";
  const volume = src.sourceVolume?.trim() ?? "";
  const issue = src.sourceIssue?.trim() ?? "";
  const url = src.sourceUrl?.trim() ?? "";

  if (!author && !year && !title && !journal && !volume && !issue && !url) {
    return { plain: "", html: "", empty: true };
  }

  const partsPlain: string[] = [];
  const partsHtml: string[] = [];

  if (author) {
    const a = author.endsWith(".") ? author : `${author}.`;
    partsPlain.push(a);
    partsHtml.push(escapeHtml(a));
  }

  if (year) {
    partsPlain.push(`(${year}).`);
    partsHtml.push(`(${escapeHtml(year)}).`);
  }

  if (title) {
    const t = title.endsWith(".") ? title : `${title}.`;
    partsPlain.push(t);
    partsHtml.push(escapeHtml(t));
  }

  if (journal || volume || issue) {
    let journalPlain = "";
    let journalHtml = "";
    if (journal) {
      journalPlain = journal;
      journalHtml = `<i>${escapeHtml(journal)}</i>`;
    }
    if (volume) {
      const volBit = issue ? `${volume}(${issue})` : volume;
      journalPlain = journalPlain ? `${journalPlain}, ${volBit}` : volBit;
      journalHtml = journalHtml
        ? `${journalHtml}, ${escapeHtml(volBit)}`
        : escapeHtml(volBit);
    } else if (issue) {
      journalPlain = journalPlain ? `${journalPlain}, (${issue})` : `(${issue})`;
      journalHtml = journalHtml
        ? `${journalHtml}, (${escapeHtml(issue)})`
        : `(${escapeHtml(issue)})`;
    }
    if (journalPlain && !/[.!?]$/.test(journalPlain)) {
      journalPlain += ".";
      journalHtml += ".";
    }
    partsPlain.push(journalPlain);
    partsHtml.push(journalHtml);
  }

  if (url) {
    partsPlain.push(url);
    partsHtml.push(escapeHtml(url));
  }

  return {
    plain: partsPlain.join(" "),
    html: partsHtml.join(" "),
    empty: false,
  };
}

/** 브라우저 클립보드에 HTML(이탤릭 유지) + plain 동시 기록 */
export async function copyApaToClipboard(citation: ApaCitation): Promise<void> {
  if (citation.empty) throw new Error("복사할 출처 정보가 없습니다.");

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const htmlBlob = new Blob([citation.html], { type: "text/html" });
    const plainBlob = new Blob([citation.plain], { type: "text/plain" });
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": plainBlob,
      }),
    ]);
    return;
  }

  // 폴백: plain text만
  await navigator.clipboard.writeText(citation.plain);
}

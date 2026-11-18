import defaultBeanCatalog from './beanCatalog.json';

/**
 * 豆マスタ1件のデータ構造（JSONカタログの各要素）
 */
export interface CoffeeBeanCatalogEntry {
  readonly id: string;
  readonly roaster: string;
  readonly roasterAliases: readonly string[];
  readonly name: string;
  readonly country: string;
  readonly countryAliases: readonly string[];
  readonly farmOrProducer: string;
  readonly producerAliases: readonly string[];
  readonly variety?: string;
  readonly process?: string;
  readonly roastLevel?: string;
  readonly displaySummary: string;
}

/**
 * 2段階ファジー照合の推論結果候補
 */
export interface BeanMatchCandidate {
  /** マッチした豆マスタデータ */
  readonly bean: CoffeeBeanCatalogEntry;
  /** 総合一致度スコア（0.0 〜 1.0、1.0が完全一致） */
  readonly confidence: number;
  /** Step 1: ロースター名の一致度スコア（0.0 〜 1.0） */
  readonly roasterScore: number;
  /** Step 2: 産地・農園・銘柄の一致度スコア（0.0 〜 1.0） */
  readonly originAndFarmScore: number;
  /** どのOCR単語がどのフィールドにヒットしたかの診断情報 */
  readonly matchedTokens: readonly string[];
}

export interface MatchCoffeeBeanResult {
  /** 最も確度の高い第1候補（閾値未満の場合は null） */
  readonly bestMatch: BeanMatchCandidate | null;
  /** スコア順の上位候補リスト */
  readonly candidates: readonly BeanMatchCandidate[];
  /** Step 1 で特定されたロースター名（特定できなかった場合は null） */
  readonly identifiedRoaster: string | null;
  /** OCR誤読補正後の正規化トークン一覧 */
  readonly normalizedTokens: readonly string[];
}

export interface MatchCoffeeBeanOptions {
  /** Step 1 でロースター特定とみなす最低類似度（0.0〜1.0、デフォルト: 0.65） */
  readonly roasterThreshold?: number;
  /** 最終候補として採用する最低総合信頼度（0.0〜1.0、デフォルト: 0.55） */
  readonly minConfidence?: number;
  /** 返却する最大候補数（デフォルト: 3） */
  readonly limit?: number;
}

/**
 * 豆袋パッケージ上で頻出するノイズ語（グラム数・日付・一般語など）
 * これらが農園名やロースター名に誤ヒットするのを防ぐ。
 */
const STOP_WORDS = new Set([
  'COFFEE',
  'ROASTERS',
  'ROASTER',
  'BEANS',
  'WHOLE',
  'BEAN',
  'ROASTED',
  'NET',
  'WEIGHT',
  '100G',
  '150G',
  '200G',
  '250G',
  '500G',
  'SINGLE',
  'ORIGIN',
  'SPECIALTY',
]);

/**
 * 光の反射やかすれによって英字単語内で頻発するOCR誤読（数字↔英字）を補正する。
 * 例: "GL1TCH" -> "GLITCH", "ETH10P1A" -> "ETHIOPIA", "COL0MBIA" -> "COLOMBIA"
 */
export function normalizeOcrToken(raw: string): string {
  const trimmed = raw
    .trim()
    .toUpperCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()[\]"'’‘|<>?+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!trimmed) {
    return '';
  }

  // 純粋な数値（品種番号 "74158" や標高 "2100" 等）は数字のまま保持する
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  // 英字主体トークン内の数字誤読を視覚類似の英字へ補正
  return trimmed
    .replace(/0/g, 'O')
    .replace(/1/g, 'I')
    .replace(/5/g, 'S')
    .replace(/8/g, 'B');
}

/**
 * OCR行配列を単語トークンに分割・正規化し、短すぎるゴミやストップワードを除外する。
 */
export function tokenizeOcrLines(ocrLines: readonly string[]): string[] {
  const tokenSet = new Set<string>();

  for (const line of ocrLines) {
    if (typeof line !== 'string') {
      continue;
    }
    // スペースやスラッシュで分割した個別単語と、行全体（複合語用）の両方を正規化
    const normalizedFullLine = normalizeOcrToken(line);
    const words = normalizedFullLine.split(' ').filter(Boolean);

    for (const word of words) {
      if (word.length >= 2 && !STOP_WORDS.has(word)) {
        tokenSet.add(word);
      }
    }
  }

  return Array.from(tokenSet);
}

/**
 * 2つの文字列間のレーベンシュタイン編集距離（Levenshtein Distance）を計算する。
 * OCRの1〜2文字の誤読（例: GL1TCH vs GLITCH, ETHIOPIA vs ETHLOP1A）を吸収する。
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const prevRow = new Array<number>(b.length + 1);
  const currRow = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    currRow[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // 挿入
        prevRow[j] + 1, // 削除
        prevRow[j - 1] + cost, // 置換
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prevRow[j] = currRow[j];
    }
  }

  return prevRow[b.length];
}

/**
 * 2つの文字列のファジー類似度（0.0 〜 1.0）を計算する。
 * Fuse.js の Bitap スコアと同様に、完全一致で 1.0、部分文字列または編集距離に応じて減衰する。
 */
export function calculateStringSimilarity(
  queryToken: string,
  targetPhrase: string,
): number {
  const q = normalizeOcrToken(queryToken);
  const t = normalizeOcrToken(targetPhrase);

  if (!q || !t) {
    return 0;
  }
  if (q === t) {
    return 1.0;
  }

  // ターゲット句が複数単語（例: "TAMIRU TADESSE"）の場合、各構成単語との最高一致度も評価
  const targetWords = t.split(' ').filter(w => w.length >= 2);
  let bestScore = 0;

  const candidatesToCompare =
    targetWords.length > 1 ? [t, ...targetWords] : [t];

  for (const candidate of candidatesToCompare) {
    if (q === candidate) {
      return 1.0;
    }

    const maxLen = Math.max(q.length, candidate.length);
    const dist = levenshteinDistance(q, candidate);
    const editSimilarity = Math.max(0, 1 - dist / maxLen);

    if (editSimilarity > bestScore) {
      bestScore = editSimilarity;
    }
  }

  return bestScore;
}

/**
 * OCRトークン群とターゲット候補群（エイリアス配列など）のベストマッチを計算する。
 */
function findBestTokenMatch(
  tokens: readonly string[],
  targetAliases: readonly string[],
): { score: number; matchedToken: string | null } {
  let bestScore = 0;
  let matchedToken: string | null = null;

  for (const token of tokens) {
    for (const alias of targetAliases) {
      const score = calculateStringSimilarity(token, alias);
      if (score > bestScore) {
        bestScore = score;
        matchedToken = token;
      }
    }
  }

  return { score: bestScore, matchedToken };
}

/**
 * 2段階ファジー検索によるコーヒー豆推論関数
 *
 * 【アルゴリズムの流れ】
 * 1. 前処理: OCR文字列配列（例: `['GL1TCH', 'ETH10P1A', 'TAMIRU']`）の数字/英字誤読を正規化しトークン化。
 * 2. Step 1（ロースター名のファジー特定と絞り込み）:
 *    全豆リストのロースター名（および別名）とファジー照合し、閾値（0.65）以上のロースターが見つかれば
 *    そのロースターの豆に検索範囲を絞り込む（残りのトークンからロースター名トークンを除外）。
 * 3. Step 2（農園名・生産者・国名・銘柄の重み付き一致度スコア計算）:
 *    残りのOCR単語を用いて、農園/生産者（重み 0.55）・生産国（重み 0.35）・品種/精製（重み 0.10）の
 *    ファジー一致度を計算し、ロースタースコアと合算して上位候補を返す。
 */
export function matchCoffeeBeanFromOcr(
  ocrLines: readonly string[],
  catalog: readonly CoffeeBeanCatalogEntry[] = defaultBeanCatalog,
  options: MatchCoffeeBeanOptions = {},
): MatchCoffeeBeanResult {
  const {
    roasterThreshold = 0.65,
    minConfidence = 0.55,
    limit = 3,
  } = options;

  const normalizedTokens = tokenizeOcrLines(ocrLines);
  if (normalizedTokens.length === 0 || catalog.length === 0) {
    return {
      bestMatch: null,
      candidates: [],
      identifiedRoaster: null,
      normalizedTokens,
    };
  }

  // --- Step 1: ロースター名をファジーマッチで特定し、検索範囲を絞る ---
  const uniqueRoasters = new Map<string, readonly string[]>();
  for (const entry of catalog) {
    if (!uniqueRoasters.has(entry.roaster)) {
      uniqueRoasters.set(entry.roaster, [
        entry.roaster,
        ...entry.roasterAliases,
      ]);
    }
  }

  let bestRoasterName: string | null = null;
  let bestRoasterScore = 0;
  let roasterMatchedToken: string | null = null;

  for (const [roasterName, aliases] of uniqueRoasters.entries()) {
    const { score, matchedToken } = findBestTokenMatch(
      normalizedTokens,
      aliases,
    );
    if (score > bestRoasterScore) {
      bestRoasterScore = score;
      bestRoasterName = roasterName;
      roasterMatchedToken = matchedToken;
    }
  }

  const isRoasterIdentified =
    bestRoasterName !== null && bestRoasterScore >= roasterThreshold;

  // ロースターが特定できた場合はそのロースターの豆に絞り込む（特定できなかった場合は全件対象）
  const scopedCatalog = isRoasterIdentified
    ? catalog.filter(entry => entry.roaster === bestRoasterName)
    : catalog;

  // Step 2 用の残りトークン（ロースター名に使われたトークンを除く。ただし1語しかなければ残す）
  const remainingTokens =
    isRoasterIdentified &&
    roasterMatchedToken &&
    normalizedTokens.length > 1
      ? normalizedTokens.filter(t => t !== roasterMatchedToken)
      : normalizedTokens;

  // --- Step 2: 残りの単語で農園名・国名・銘柄の一致度スコアを計算 ---
  const scoredCandidates: BeanMatchCandidate[] = scopedCatalog.map(bean => {
    const matchedTokenSet = new Set<string>();

    const roasterMatch = findBestTokenMatch(normalizedTokens, [
      bean.roaster,
      ...bean.roasterAliases,
    ]);
    if (roasterMatch.score >= roasterThreshold && roasterMatch.matchedToken) {
      matchedTokenSet.add(roasterMatch.matchedToken);
    }

    // 生産国（例: ETHIOPIA / エチオピア）の一致度
    const countryMatch = findBestTokenMatch(remainingTokens, [
      bean.country,
      ...bean.countryAliases,
    ]);
    if (countryMatch.score >= 0.65 && countryMatch.matchedToken) {
      matchedTokenSet.add(countryMatch.matchedToken);
    }

    // 農園・生産者（例: TAMIRU / ALO / EL DIVISO）の一致度
    const producerMatch = findBestTokenMatch(remainingTokens, [
      bean.farmOrProducer,
      ...bean.producerAliases,
      bean.name,
    ]);
    if (producerMatch.score >= 0.65 && producerMatch.matchedToken) {
      matchedTokenSet.add(producerMatch.matchedToken);
    }

    // 品種・精製方法（補助スコア）
    const extraTargets = [bean.variety ?? '', bean.process ?? ''].filter(
      Boolean,
    );
    const extraMatch =
      extraTargets.length > 0
        ? findBestTokenMatch(remainingTokens, extraTargets)
        : { score: 0, matchedToken: null };
    if (extraMatch.score >= 0.75 && extraMatch.matchedToken) {
      matchedTokenSet.add(extraMatch.matchedToken);
    }

    // Step 2 スコア: 農園/生産者を最重視しつつ、国名との組み合わせを高く評価
    const originAndFarmScore = Math.min(
      1.0,
      producerMatch.score * 0.6 +
        countryMatch.score * 0.35 +
        extraMatch.score * 0.05,
    );

    // 総合信頼度スコアの算出
    const confidence = isRoasterIdentified
      ? roasterMatch.score * 0.35 + originAndFarmScore * 0.65
      : originAndFarmScore * 0.85;

    return {
      bean,
      confidence: Number(confidence.toFixed(3)),
      roasterScore: Number(roasterMatch.score.toFixed(3)),
      originAndFarmScore: Number(originAndFarmScore.toFixed(3)),
      matchedTokens: Array.from(matchedTokenSet),
    };
  });

  const filteredAndSorted = scoredCandidates
    .filter(c => c.confidence >= minConfidence)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return b.originAndFarmScore - a.originAndFarmScore;
    })
    .slice(0, limit);

  return {
    bestMatch: filteredAndSorted[0] ?? null,
    candidates: filteredAndSorted,
    identifiedRoaster: isRoasterIdentified ? bestRoasterName : null,
    normalizedTokens,
  };
}

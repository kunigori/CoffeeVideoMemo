import {
  calculateStringSimilarity,
  matchCoffeeBeanFromOcr,
  normalizeOcrToken,
} from '../src/domain/beanMatcher';

describe('domain / beanMatcher（OCRあいまい検索・2段階豆推論）', () => {
  test('normalizeOcrToken は光の反射で生じる数字/英字誤読（1->I, 0->O, 5->S, 8->B）を正規化する', () => {
    expect(normalizeOcrToken('GL1TCH')).toBe('GLITCH');
    expect(normalizeOcrToken('ETH10P1A')).toBe('ETHIOPIA');
    expect(normalizeOcrToken('COL0MBIA')).toBe('COLOMBIA');
    // 品種番号など純粋な数字は変換しない
    expect(normalizeOcrToken('74158')).toBe('74158');
  });

  test("['GL1TCH', 'ETH10P1A', 'TAMIRU'] から Glitch の エチオピア・タミル を第1候補として推論する", () => {
    const result = matchCoffeeBeanFromOcr(['GL1TCH', 'ETH10P1A', 'TAMIRU']);

    expect(result.identifiedRoaster).toBe('GLITCH COFFEE & ROASTERS');
    expect(result.bestMatch).not.toBeNull();
    expect(result.bestMatch?.bean.id).toBe('glitch-ethiopia-tamiru');
    expect(result.bestMatch?.bean.displaySummary).toContain(
      'Glitch / エチオピア・タミル',
    );
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  test('1〜2文字の一般的なOCR文字化け（GLITGH / ETHIOPLA / TAMIRO）があってもファジーマッチで特定できる', () => {
    const result = matchCoffeeBeanFromOcr(['GLITGH', 'ETHIOPLA', 'TAMIRO']);

    expect(result.identifiedRoaster).toBe('GLITCH COFFEE & ROASTERS');
    expect(result.bestMatch?.bean.id).toBe('glitch-ethiopia-tamiru');
    expect(result.bestMatch?.confidence).toBeGreaterThanOrEqual(0.75);
  });

  test('グラム数や一般語ノイズが混ざったOCR配列から Leaves の コロンビア・エルパライソ を特定する', () => {
    const result = matchCoffeeBeanFromOcr([
      'WHOLE BEAN 150g',
      'SPECIALTY COFFEE',
      'LEAVES',
      'COL0MBIA',
      'EL PARA1SO',
    ]);

    expect(result.identifiedRoaster).toBe('LEAVES COFFEE ROASTERS');
    expect(result.bestMatch?.bean.id).toBe('leaves-colombia-el-paraiso');
  });

  test('日本語表記（カタカナ）のOCRトークンでもロースターと豆を特定できる', () => {
    const result = matchCoffeeBeanFromOcr(['グリッチ', 'エチオピア', 'タミル']);

    expect(result.identifiedRoaster).toBe('GLITCH COFFEE & ROASTERS');
    expect(result.bestMatch?.bean.id).toBe('glitch-ethiopia-tamiru');
  });

  test('ロースター名が袋の折れ等で読めなかった場合でも、国名と農園名からフォールバック推論できる', () => {
    const result = matchCoffeeBeanFromOcr(['ETH10P1A', 'TAMIRU', 'TADESSE']);

    expect(result.identifiedRoaster).toBeNull();
    expect(result.bestMatch?.bean.id).toBe('glitch-ethiopia-tamiru');
  });

  test('無関係な文字列や空配列の場合は偽のマッチを返さず bestMatch: null とする', () => {
    expect(matchCoffeeBeanFromOcr([]).bestMatch).toBeNull();
    expect(
      matchCoffeeBeanFromOcr(['200G', 'WHOLE BEAN', 'TOKYO JAPAN']).bestMatch,
    ).toBeNull();
  });

  test('calculateStringSimilarity は完全一致で 1.0、近似文字列で高い類似度を返す', () => {
    expect(calculateStringSimilarity('TAMIRU', 'TAMIRU TADESSE')).toBe(1.0);
    expect(
      calculateStringSimilarity('TAMIRO', 'TAMIRU TADESSE'),
    ).toBeGreaterThan(0.8);
  });
});

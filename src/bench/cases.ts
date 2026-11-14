// 오차 테스트 문자열. 전부 이 레포를 위해 직접 쓴 문장이다.

export interface Case {
  key: string
  label: string
  text: string
}

export const CASES: Case[] = [
  {
    key: 'ko-long',
    label: '긴 한글 문단',
    text: '측정값은한번재고끝나는숫자가아니라같은조건에서여러번다시재었을때비슷하게나와야쓸모가있다. 그래서이실험은화면에보이는글자의높이를세가지방법으로재고그차이를그대로기록한다. 차이가나지않으면좋은일이고차이가나면어디서부터달라졌는지를적어두면된다.',
  },
  {
    key: 'en-long',
    label: '긴 영어 문단',
    text: 'A measurement is only useful when someone else can repeat it and land close to the same number. This page lays out one paragraph three different ways, records how tall each one thinks the text is, and keeps the raw frames so nobody has to trust a summary table without the data behind it.',
  },
  {
    key: 'mixed',
    label: '한글·영문·숫자 혼합',
    text: '버전 2.14.0부터 layout 함수는 평균 0.35ms 안에 끝나고, API 응답 1건당 payload는 12KB를 넘지 않는다. 2026년 3분기 릴리스 노트(v3-beta)에는 breaking change가 4건 있다.',
  },
  {
    key: 'emoji',
    label: '이모지',
    text: '국기 🇰🇷🇺🇸🇯🇵 피부색 👍🏽👋🏿✌🏻 가족 👨‍👩‍👧‍👦👩‍👩‍👦 그리고 직업 🧑‍🚀👩🏾‍💻 이모지가 문장 사이에 섞여 있을 때 🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉 줄이 어디서 끊기는지 본다',
  },
  {
    key: 'long-url',
    label: '공백 없는 긴 URL',
    text: 'https://example.com/workspace/text-measure-bench/results/resize-pretext-200-5.json?download=true&format=raw&token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ#frame-29',
  },
  {
    key: 'punct',
    label: '문장부호·가격',
    text: '그는 말했다. “정말(진짜로) 끝났어?” 「네、끝났습니다。」 가격은 ₩12,000(부가세 포함)이고, 해외 결제는 $1,299.00… 또는 €1.150,50! 정말?! 그렇다면—좋다; 계속하자: [1], {2}, <3>.',
  },
  {
    key: 'fallback',
    label: '웹폰트에 없는 글리프',
    text: '漢字와 한글이 섞인 文章에서 特殊 기호 ⌘ ⏎ ∮ ℵ ☃ ⚙ ♞ 가 나오면 폴백 폰트로 그려진다. 測定값이 달라지는지 確認한다.',
  },
]

/** before-font 케이스가 쓰는 문장. 폰트 로드 전후로 같은 문장을 잰다 */
export const BEFORE_FONT_TEXT =
  '웹폰트가 도착하기 전에 잰 높이는 폴백 폰트의 높이다. Measure once before the font arrives and once after, then compare 1234567890.'

export const WIDTHS = [200, 320, 480]

/**
 * 手描き（コード）の SVG マスコット。フラットで可愛いカートゥーン路線。
 * フィン鉄＝金融×鉄道なので「コインのお腹＋車輪」の銀行員くん。
 * 後でプロ/AI のイラストに差し替え可能（同じ size API）。
 */

const INK = '#1b1d3a'; // 輪郭の濃紺

export function Mascot({
  size = 120,
  color = '#ffd44d',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="FinTetsu マスコット"
    >
      {/* 影 */}
      <ellipse cx="60" cy="110" rx="34" ry="6" fill="#000" opacity="0.18" />
      {/* バイザー（帽子） */}
      <path
        d="M22 40 Q60 12 98 40 L98 46 Q60 30 22 46 Z"
        fill="#36d6c3"
        stroke={INK}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle
        cx="60"
        cy="20"
        r="6"
        fill="#ff6fae"
        stroke={INK}
        strokeWidth="3"
      />
      {/* 体（コインのお腹） */}
      <rect
        x="20"
        y="40"
        width="80"
        height="62"
        rx="26"
        fill={color}
        stroke={INK}
        strokeWidth="4"
      />
      {/* ほっぺ */}
      <circle cx="34" cy="74" r="6" fill="#ff6fae" opacity="0.85" />
      <circle cx="86" cy="74" r="6" fill="#ff6fae" opacity="0.85" />
      {/* 目 */}
      <circle
        cx="46"
        cy="64"
        r="7"
        fill="#fff"
        stroke={INK}
        strokeWidth="2.5"
      />
      <circle
        cx="74"
        cy="64"
        r="7"
        fill="#fff"
        stroke={INK}
        strokeWidth="2.5"
      />
      <circle cx="47.5" cy="65" r="3.2" fill={INK} />
      <circle cx="75.5" cy="65" r="3.2" fill={INK} />
      <circle cx="46" cy="63" r="1.2" fill="#fff" />
      <circle cx="74" cy="63" r="1.2" fill="#fff" />
      {/* 口 */}
      <path
        d="M52 78 Q60 86 68 78"
        fill="none"
        stroke={INK}
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* ¥ コイン（お腹） */}
      <text
        x="60"
        y="98"
        textAnchor="middle"
        fontSize="16"
        fontWeight="800"
        fill={INK}
        fontFamily="'JetBrains Mono', monospace"
      >
        ¥
      </text>
      {/* 車輪 */}
      <circle cx="38" cy="104" r="8" fill={INK} />
      <circle cx="82" cy="104" r="8" fill={INK} />
      <circle cx="38" cy="104" r="3" fill={color} />
      <circle cx="82" cy="104" r="3" fill={color} />
    </svg>
  );
}

/** 小さなコイン（バッジ・装飾用）。 */
export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="#ffd44d"
        stroke={INK}
        strokeWidth="2"
      />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill={INK}
        fontFamily="'JetBrains Mono', monospace"
      >
        ¥
      </text>
    </svg>
  );
}

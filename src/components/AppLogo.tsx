interface AppLogoProps {
  size?: number;
  className?: string;
}

export default function AppLogo({ size = 32, className = '' }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 绿色圆角方形背景 */}
      <rect x="2" y="2" width="44" height="44" rx="10" fill="#22C55E" />
      {/* 白色抽象符号 f² */}
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="22"
        fill="#FFFFFF"
      >
        f²
      </text>
    </svg>
  );
}

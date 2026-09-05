interface AppLogoProps {
  size?: number;
  className?: string;
}

export default function AppLogo({ size = 32, className = '' }: AppLogoProps) {
  return (
    <img
      src="/favicon.png"
      alt="一闲笔记"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={className}
    />
  );
}
"use client";

import { CSSProperties } from "react";

export function Sprite({
  svg,
  className = "",
  style,
}: {
  svg: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`sprite ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  tone = "cream",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "cream" | "sun" | "coral" | "mint" | "sky";
  className?: string;
}) {
  return (
    <button
      className={`btn btn-${tone} ${className}`}
      onClick={(e) => {
        e.currentTarget.blur();
        onClick?.();
      }}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function HpBar({ hp, max }: { hp: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (hp / max) * 100));
  const color = pct > 50 ? "#5fae8e" : pct > 20 ? "#f2c94c" : "#ef6f6f";
  return (
    <div className="hpbar">
      <div className="hpbar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function CoinBadge({ coins }: { coins: number }) {
  return (
    <div className="coin-badge">
      <span className="coin-icon" />
      <span>{coins}</span>
    </div>
  );
}

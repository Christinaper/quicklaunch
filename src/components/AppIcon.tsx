import React from "react";

interface AppIconProps {
  name: string;
  size?: number;
}

// Generate a consistent color from app name
function nameToColor(name: string): string {
  const colors = [
    "#0078D4", "#107C10", "#D13438", "#FF8C00",
    "#5C2D91", "#008272", "#E3008C", "#004B87",
    "#32CD32", "#8B0000", "#FF6347", "#4169E1",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export const AppIcon: React.FC<AppIconProps> = ({ name, size = 36 }) => {
  const letter = name.charAt(0).toUpperCase();
  const bg = nameToColor(name);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.45,
        fontWeight: 600,
        color: "#fff",
        flexShrink: 0,
        letterSpacing: "-0.5px",
      }}
    >
      {letter}
    </div>
  );
};

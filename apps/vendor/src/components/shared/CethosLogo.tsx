interface CethosLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function CethosLogo({ size = "md", showText = true }: CethosLogoProps) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 48 : 36;
  const fontSize =
    size === "sm"
      ? "text-lg"
      : size === "lg"
        ? "text-3xl"
        : "text-2xl";

  return (
    <div className="flex items-center justify-center gap-2.5">
      {/* Icon mark — teal circle with stylized C */}
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="24" fill="#0F9DA0" />
        <path
          d="M26.5 14C20.15 14 15 19.15 15 25.5C15 31.85 20.15 37 26.5 37C29.5 37 32.2 35.8 34.2 33.8L31.4 31C30.1 32.3 28.4 33 26.5 33C22.36 33 19 29.64 19 25.5C19 21.36 22.36 18 26.5 18C28.4 18 30.1 18.7 31.4 20L34.2 17.2C32.2 15.2 29.5 14 26.5 14Z"
          fill="white"
        />
      </svg>
      {showText && (
        <span
          className={`${fontSize} font-bold text-gray-900 tracking-tight`}
        >
          CETHOS
        </span>
      )}
    </div>
  );
}

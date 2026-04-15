const LOGO_URL =
  "https://lmzoyezvsjgsxveoakdr.supabase.co/storage/v1/object/public/web-assets/png_logo_cethos_light_bg.png";

interface CethosLogoProps {
  size?: "sm" | "md" | "lg";
}

export function CethosLogo({ size = "md" }: CethosLogoProps) {
  const height = size === "sm" ? "h-7" : size === "lg" ? "h-14" : "h-9";

  return (
    <img
      src={LOGO_URL}
      alt="CETHOS Translation Services"
      className={`${height} w-auto object-contain mx-auto mb-4`}
    />
  );
}

import Image from "next/image";

/** The zyro logo: the glass Z emblem and the ZYRO wordmark in one picture (684 x 168, transparent). */
export function Logo() {
  return (
    <Image
      src="/brand/zyro-logo.png"
      alt="zyro"
      width={684}
      height={168}
      priority
      className="block h-[30px] w-auto"
    />
  );
}

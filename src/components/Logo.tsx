import Image from "next/image";

/** The glass Z emblem and the zyro.ai wordmark. */
export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <Image
        src="/brand/z-emblem.png"
        alt=""
        width={72}
        height={73}
        priority
        className="h-[30px] w-[29.6px] object-cover sm:h-[36.56px] sm:w-9"
      />
      <span className="text-[20px] leading-none tracking-[-1px] text-foreground sm:text-[25px]">zyro.ai</span>
    </span>
  );
}

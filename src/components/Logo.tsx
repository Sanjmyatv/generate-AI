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
        className="h-[36.56px] w-9 object-cover"
      />
      <span className="text-[25px] leading-none tracking-[-1px] text-foreground">zyro.ai</span>
    </span>
  );
}

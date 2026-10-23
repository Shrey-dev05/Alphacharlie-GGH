"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompareRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/consumer?tab=compare");
  }, [router]);

  return null;
}

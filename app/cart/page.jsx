"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "../../components/StoreContext";

export default function CartPage() {
  const { setIsCartOpen } = useStore();
  const router = useRouter();

  useEffect(() => {
    setIsCartOpen(true);
    router.replace("/");
  }, [setIsCartOpen, router]);

  return null;
}

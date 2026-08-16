"use client";
import type { ReactNode } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
export default function StocksLayout({ children }: { children: ReactNode }) {
  return <ProtectedPage featureName="phân tích chi tiết cổ phiếu">{children}</ProtectedPage>;
}

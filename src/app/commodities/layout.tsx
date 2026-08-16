"use client";
import type { ReactNode } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
export default function CommoditiesLayout({ children }: { children: ReactNode }) {
  return <ProtectedPage featureName="giá và phân tích hàng hóa">{children}</ProtectedPage>;
}

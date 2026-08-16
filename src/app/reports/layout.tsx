"use client";
import type { ReactNode } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
export default function ReportsLayout({ children }: { children: ReactNode }) {
  return <ProtectedPage featureName="báo cáo Morning Brief và Market Summary">{children}</ProtectedPage>;
}

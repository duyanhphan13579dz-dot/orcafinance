"use client";
import type { ReactNode } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
export default function NewsLayout({ children }: { children: ReactNode }) {
  return <ProtectedPage featureName="tin tức và sentiment thị trường">{children}</ProtectedPage>;
}

"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/context";

export default function LandingPage() {
  const { isLoggedIn } = useAuth();

  const features = [
    { icon: "🔍", title: "Bộ lọc cổ phiếu", desc: "CANSLIM, Minervini, Wyckoff, Elliott Wave" },
    { icon: "📦", title: "Hàng hóa", desc: "31 loại hàng hóa ảnh hưởng đến VN" },
    { icon: "📰", title: "Báo cáo", desc: "Morning Brief & Market Summary tự động" },
    { icon: "🤖", title: "AI Agent", desc: "Phân tích thông minh từ dữ liệu thật" },
    { icon: "📊", title: "Biểu đồ", desc: "TradingView-style charts" },
    { icon: "🔔", title: "Cảnh báo", desc: "Real-time price alerts" },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/10 via-transparent to-[#0073a8]/10" />
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] text-sm font-medium mb-6">
            🐋 ORCA FINANCIAL
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-extrabold text-white tracking-tight leading-tight">
            Intelligent
            <span className="text-[#00d4ff]"> Investment</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-400 max-w-3xl mx-auto">
            Nền tảng phân tích tài chính AI với dữ liệu thị trường thật, 
            bộ lọc cổ phiếu chuyên sâu, và báo cáo tự động hàng ngày.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-orca px-8 py-4 text-base md:text-lg">Vào hệ thống →</Link>
            ) : (
              <>
                <Link href="/auth/register" className="btn-orca px-8 py-4 text-base md:text-lg">Đăng ký miễn phí →</Link>
                <Link href="/auth/login" className="btn-orca-outline px-8 py-4 text-base md:text-lg">Đăng nhập</Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-[#0e2e4f]/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
              Tính năng nổi bật
            </h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Tất cả công cụ bạn cần để ra quyết định đầu tư thông minh
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div
                key={i}
                className="panel p-6 hover:border-[#00d4ff]/50 transition-all group"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-bold text-white group-hover:text-[#00d4ff] transition-colors">
                  {f.title}
                </h3>
                <p className="mt-2 text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white">
            Sẵn sàng bắt đầu?
          </h2>
          <p className="mt-4 text-slate-400 text-lg">
            Đăng ký ngay để truy cập tất cả tính năng phân tích chuyên sâu
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link href={isLoggedIn ? "/dashboard" : "/auth/register"} className="btn-orca px-8 py-4 text-lg">
              {isLoggedIn ? "Mở Dashboard" : "Đăng ký miễn phí"}
            </Link>
            {!isLoggedIn && <Link href="/auth/login" className="btn-orca-outline px-8 py-4 text-lg">Đăng nhập →</Link>}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#1a3558]">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          © 2026 ORCA FINANCIAL — Intelligent Investment. 
          Dữ liệu thật từ VNDirect, Yahoo Finance, CoinGecko. Không phải lời khuyên đầu tư.
        </div>
      </footer>
    </div>
  );
}

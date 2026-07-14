import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "심리척도 설문·분석 플랫폼",
  description:
    "심리척도를 등록하고 설문을 배포하며 응답을 자동 채점·분석하는 연구 특화 플랫폼",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

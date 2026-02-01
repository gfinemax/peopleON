import type { Metadata } from "next";
import { Public_Sans, Noto_Sans_KR } from "next/font/google";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

const publicSans = Public_Sans({
    variable: "--font-public-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

const notoSansKR = Noto_Sans_KR({
    variable: "--font-noto-sans-kr",
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "People On - 통합 CRM & ERP",
    description: "지역주택조합을 위한 통합 조합원 관리 시스템",
    icons: {
        icon: "/favicon.ico",
    },
    viewport: {
        width: "device-width",
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
        viewportFit: "cover",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <head>
                {/* Material Symbols */}
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
                />
            </head>
            <body
                className={`${publicSans.variable} ${notoSansKR.variable} font-display antialiased`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem={true}
                    disableTransitionOnChange
                >
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}

import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
    title: "People On - 통합 CRM & ERP",
    description: "지역주택조합을 위한 통합 조합원 관리 시스템",
    icons: {
        icon: "/favicon.ico",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <body className="font-display antialiased">
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

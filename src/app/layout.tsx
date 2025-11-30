import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourseSmart - Sabanci University Course Advisor",
  description: "Find the perfect courses tailored to your interests and career goals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={GeistSans.className}>
        {children}
        <Toaster 
          position="bottom-right" 
          richColors 
          closeButton
          toastOptions={{
            className: 'rounded-xl',
          }}
        />
      </body>
    </html>
  );
}

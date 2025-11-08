export const metadata = { title: "Tools MVP", description: "Next.js App Router minimal layout" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24 }}>
        {children}
      </body>
    </html>
  );
}

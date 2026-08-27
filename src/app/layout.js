import "./globals.css";

export const metadata = {
  title: {
    default: "ระบบเกียรติบัตรออนไลน์",
    template: "%s | ระบบเกียรติบัตรออนไลน์",
  },
  description: "Certificate Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

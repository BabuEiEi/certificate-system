import "sweetalert2/dist/sweetalert2.min.css";
import "./globals.css";
import { certificateFontVariables } from "./certificate-fonts";

export const metadata = {
  title: {
    default: "ระบบเกียรติบัตรออนไลน์",
    template: "%s | ระบบเกียรติบัตรออนไลน์",
  },
  description: "Certificate Management System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`h-full antialiased ${certificateFontVariables}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

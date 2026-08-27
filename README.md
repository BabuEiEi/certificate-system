# Certificate Management System

ระบบค้นหา ตรวจสอบ และจัดการเกียรติบัตร พัฒนาด้วย Next.js App Router, JavaScript, JSX และ Tailwind CSS

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 0.0.0.0
```

เปิด `http://localhost:3000` หรือ `http://192.168.1.11:3000` ภายในเครือข่ายที่กำหนดไว้สำหรับ development

## คำสั่งตรวจสอบ

```bash
npm run lint
npm run build
```

Production build ใช้ Webpack เพื่อหลีกเลี่ยงข้อจำกัดการเปิดพอร์ตภายในของ Turbopack ในบาง sandbox environment

## Environment variables

ดูชื่อตัวแปรที่ต้องใช้ใน `.env.example` โดย Phase ปัจจุบันยังไม่เชื่อมต่อ Supabase หรือ Authentication

# Supabase integration

- `client.js` สร้าง browser client สำหรับ Client Components
- `server.js` สร้าง client ใหม่ต่อ request สำหรับ Server Components และ Server Actions
- `proxy.js` ตรวจและ refresh JWT cookies ก่อนเข้าเส้นทางที่ต้องยืนยันตัวตน
- `config.js` ตรวจ environment variables โดยไม่เก็บ secret key ใน source code

ใช้เฉพาะ publishable key ในแอป ห้ามเพิ่ม `service_role` หรือ secret key ที่มี prefix `NEXT_PUBLIC_`

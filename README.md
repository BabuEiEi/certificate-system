# Certificate Management System

ระบบค้นหา ตรวจสอบ และจัดการเกียรติบัตร พัฒนาด้วย Next.js App Router, Supabase Auth/Postgres, JavaScript, JSX และ Tailwind CSS

## เริ่มต้นใช้งาน

การรัน Supabase ในเครื่องต้องมี Docker Desktop หรือ Podman ก่อน

```bash
npm install
cp .env.example .env.local
npm run supabase:start
npm run db:reset
npm run db:test
npm run dev -- --hostname 0.0.0.0
```

เปิด `http://localhost:3000` หรือ `http://192.168.1.11:3000` ภายในเครือข่ายที่กำหนดไว้สำหรับ development

## คำสั่งตรวจสอบ

```bash
npm run lint
npm run build
npm run db:test
```

Production build ใช้ Webpack เพื่อหลีกเลี่ยงข้อจำกัดการเปิดพอร์ตภายในของ Turbopack ในบาง sandbox environment

## ตั้งค่า Supabase

1. สร้างหรือเลือก Supabase project และนำ Project URL กับ Publishable key ใส่ใน `.env.local`
2. เชื่อม CLI กับ project แล้วส่ง migration:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

3. ปิด public sign-up ใน Supabase Auth สำหรับ production
4. สร้างผู้ใช้ผ่าน Supabase Dashboard แล้วกำหนดผู้ดูแลคนแรกใน SQL Editor:

```sql
update public.profiles
set role = 'ADMIN'
where id = '<auth-user-uuid>';
```

ระบบไม่ใช้ `user_metadata` เพื่ออนุญาตสิทธิ์ Admin การอนุญาตทั้งหมดตรวจจาก `profiles` และ RLS

## โครงสร้างความปลอดภัย

- `/admin/*` ตรวจ JWT ใน `src/proxy.js` และตรวจบทบาทซ้ำใน Data Access Layer
- ทุกตารางใน `public` เปิด RLS และกำหนด Postgres grants อย่างชัดเจน
- ผู้ใช้ทั่วไปไม่มีสิทธิ์อ่านตารางภายใน แม้ล็อกอินสำเร็จ
- หน้า Search/Verify อ่านเฉพาะ `published_certificates` ซึ่งไม่มีอีเมล metadata หรือ internal user ID
- migration และ pgTAP tests อยู่ใน `supabase/migrations` และ `supabase/tests`

# Certificate Management System

ระบบค้นหา ตรวจสอบ และจัดการเกียรติบัตร พัฒนาด้วย Next.js App Router, Firebase Authentication, Cloud Firestore, Cloud Storage, JavaScript, JSX และ Tailwind CSS

## Firebase Project

- Project name: `Certificate System`
- Project ID: `certificate-system-th-2026`
- Web App ID: `1:569944352739:web:5655a61dd742c459aa22d6`
- Firestore: Standard edition, `asia-southeast1` (Singapore), delete protection enabled
- Production hosting: Firebase App Hosting, `asia-southeast1` (requires Blaze)

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.example .env.local
npm run dev -- --hostname 0.0.0.0
```

เปิด `http://localhost:3000` หรือ `http://192.168.1.11:3000` ภายในเครือข่าย development

การใช้ Firebase Admin SDK ในเครื่องต้องเลือกอย่างใดอย่างหนึ่ง:

- ตั้ง `FIREBASE_ADMIN_CLIENT_EMAIL` และ `FIREBASE_ADMIN_PRIVATE_KEY` ใน `.env.local`; หรือ
- ใช้ Firebase Local Emulator Suite

เมื่อ deploy บน Firebase App Hosting ระบบจะใช้ Application Default Credentials ของ App Hosting โดยอัตโนมัติ ไม่ต้องเก็บ service-account key ใน repository

## ตั้งค่า Firebase Authentication

1. เปิด Firebase Console ของโปรเจกต์ `certificate-system-th-2026`
2. ไปที่ **Build > Authentication > Get started**
3. เปิด provider **Email/Password**
4. สร้างผู้ใช้ผู้ดูแลในแท็บ **Users**
5. คัดลอก UID ของผู้ใช้ แล้วสร้างเอกสาร `profiles/{UID}` ใน Firestore:

```text
display_name: "ชื่อผู้ดูแล"  (string)
role: "ADMIN"               (string)
is_active: true              (boolean)
created_at: <server timestamp>
updated_at: <server timestamp>
```

ระบบใช้ Firebase ID token เฉพาะขั้นตอน login แล้วแลกเป็นคุกกี้ `httpOnly` ฝั่งเซิร์ฟเวอร์ ทุกหน้า `/admin/*` ตรวจทั้ง session และเอกสาร `profiles` ซ้ำก่อนอ่านข้อมูล

## โครงสร้าง Firestore

| Collection | หน้าที่ |
| --- | --- |
| `profiles` | โปรไฟล์และบทบาท `ADMIN`/`STAFF`; document ID เท่ากับ Firebase Auth UID |
| `events` | กิจกรรมและสถานะ |
| `participants` | ผู้รับเกียรติบัตร |
| `signers` | ผู้ลงนาม |
| `templates` | ข้อมูลแม่แบบและ Storage path |
| `certificateSettings` | การตั้งค่าเลขที่เกียรติบัตร |
| `certificates` | เกียรติบัตรฉบับภายใน |
| `publishedCertificates` | snapshot สาธารณะที่ไม่มีอีเมลหรือข้อมูลภายใน; document ID เท่ากับ verification token |
| `auditLogs` | ประวัติการทำรายการ |

เอกสาร `publishedCertificates` ต้องมี `search_terms` ซึ่งสร้างได้ด้วย `createSearchTerms()` ใน `src/lib/firebase/search.js` เพื่อรองรับการค้นหาชื่อและเลขที่เกียรติบัตร

## ระบบจัดการกิจกรรมและการตั้งค่า

- เมนู **กิจกรรม** รองรับการสร้าง แก้ไข และกำหนดสถานะ `DRAFT`, `ACTIVE`, `CLOSED`
- ทุกการสร้างหรือแก้ไขกิจกรรมบันทึกผู้ดำเนินการและเวลาจากเซิร์ฟเวอร์
- เมนู **Settings** บันทึกรูปแบบเลขเกียรติบัตรที่ `certificateSettings/default`
- การเปลี่ยนแปลงกิจกรรมและ Settings บันทึกใน `auditLogs` ด้วย transaction/batch เดียวกับข้อมูลหลัก
- Server Actions ตรวจ session, สิทธิ์ `ADMIN` และข้อมูลด้วย Zod ทุกครั้งก่อนเขียน Firestore

## Security Rules และ Indexes

แอปอ่านเขียน Firestore/Storage ผ่าน Next.js server และ Firebase Admin SDK เท่านั้น ดังนั้น client rules ปฏิเสธทุกคำขอโดยค่าเริ่มต้น

```bash
npm run firebase:deploy:rules
```

ไฟล์ที่เกี่ยวข้อง:

- `firestore.rules`
- `firestore.indexes.json`
- `storage.rules`
- `firebase.json`
- `apphosting.yaml`

## Firebase App Hosting

Firebase Hosting แบบ static ไม่รองรับ Server Actions และ session ฝั่งเซิร์ฟเวอร์ของระบบนี้ จึงใช้ Firebase App Hosting ซึ่งรัน Next.js บน Cloud Run โปรเจกต์นี้ตั้งค่าให้ deploy จาก local source ผ่าน Firebase CLI

ก่อนสร้าง backend ต้องอัปเกรดโปรเจกต์เป็น Blaze แล้วเลือก:

- Region: `asia-southeast1`
- Repository root: `/`
- Backend ID: `certificate-system`

เผยแพร่แอปเวอร์ชันใหม่ด้วยคำสั่ง:

```bash
npm run firebase:deploy:app
```

## คำสั่งตรวจสอบ

```bash
npm run lint
npm run build
npm run firebase:deploy:app
npm run firebase:emulators
```

Production build ใช้ Webpack เพื่อหลีกเลี่ยงข้อจำกัดการเปิดพอร์ตของ Turbopack ในบาง sandbox environment

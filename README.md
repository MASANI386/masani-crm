# Masani Finsure CRM — chalu karne ke steps

## 1. Supabase me tables banayein (ek baar)
1. supabase.com → apna project → **SQL Editor → New query**
2. `setup.sql` ka poora text paste karke **RUN**. (Dobara chalane par bhi error nahi aata.)

## 2. Apna login banayein
Supabase → **Authentication → Users → Add user → Create new user**
Email + password daalein, **Auto Confirm User** ON rakhein.
Phir **Authentication → Sign In / Providers** me “Allow new users to sign up” **OFF** kar dein, taaki koi aur account na bana sake.

## 3. App ko online daalein (GitHub Pages — free)
Apni repo `Masani-finsure-` me ek folder **crm** banayein aur is folder ki saari files (index.html, app.js, styles.css, sw.js, manifest.webmanifest, config.js, logo.png, icons/) us folder me upload karein.
App ka link: `https://masani386.github.io/Masani-finsure-/crm/`

## 4. Pehli baar kholein
Link kholne par “Pehli baar setup” dikhega → Supabase ki **anon public key** paste karein
(Supabase → Project Settings → API Keys → anon / publishable key). Phir apne email-password se login.

## 5. Install
Android Chrome: ⋮ → Install app. iPhone Safari: Share → Add to Home Screen. Laptop Chrome: address bar me install icon.

## 6. Login chalne ke baad (zaroori) — data lock
Supabase SQL Editor me `setup_lock.sql` RUN karein. Isse purane tables bhi sirf login walon ke liye ho jaate hain.
Test: browser ki incognito window me app kholkar bina login data nahi dikhna chahiye.

## Purana AI Studio app
Uska “Quick Demo” button bina password andar le jata hai. Use Publish/Share se hata dein.

# Elite Store Mobile App (React Native + Expo)

Same backend as elite-story.vercel.app — uses the same Supabase database.

## Setup

```bash
npm install -g expo-cli
npx create-expo-app EliteStoreMobile --template blank
cd EliteStoreMobile
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill
```

## Key files to create

### src/lib/supabase.js
```js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://rdqfwwscinqhqdflstxm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Sn-GC8IzI...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### app/(tabs)/pos.tsx — POS screen
Same business logic as web POS — connects to same Supabase tables.

## Shared between web and mobile
- All Supabase tables (sales, inventory, customers, etc.)
- Auth (same email/password or OTP)
- Real-time sync between devices

## Run
```bash
npx expo start
# Press 'a' for Android, 'i' for iOS, 'w' for web
```

## Build for production
```bash
npx expo build:android  # APK for Android
npx expo build:ios      # IPA for iOS (requires Apple developer account)
```

## Recommended libraries
- Navigation: expo-router
- UI: react-native-paper or NativeWind (Tailwind for RN)
- Camera/Barcode: expo-barcode-scanner
- PDF: react-native-pdf

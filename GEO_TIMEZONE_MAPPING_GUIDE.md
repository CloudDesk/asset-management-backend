# 🌍 Geo-Timezone Mapping Guide

## 📋 Overview

This guide explains how the promotion system handles geographic regions and timezone mapping for proper promotion filtering and display.

---

## 🔧 Problem Solved

### **Issue:**
- **API Parameter**: `geo=IN` (country code)
- **Database Field**: `timezone=Asia/Kolkata` (timezone name)
- **Mismatch**: Direct comparison between geo codes and timezone values

### **Solution:**
- **Geo-to-Timezone Mapping**: Convert country codes to timezone names
- **Consistent Filtering**: Filter promotions by timezone based on user's geo location
- **Proper Localization**: Show region-appropriate promotions

---

## 🗺️ Geo Code to Timezone Mapping

### **File: `src/utils/geoUtils.ts`**

```typescript
export const geoToTimezoneMap: Record<string, string> = {
  'IN': 'Asia/Kolkata',      // India
  'US': 'America/New_York',  // United States
  'UK': 'Europe/London',     // United Kingdom
  'CA': 'America/Toronto',   // Canada
  'AU': 'Australia/Sydney',  // Australia
  'DE': 'Europe/Berlin',     // Germany
  'FR': 'Europe/Paris',      // France
  'JP': 'Asia/Tokyo',        // Japan
  'CN': 'Asia/Shanghai',     // China
  'SG': 'Asia/Singapore',    // Singapore
  'AE': 'Asia/Dubai',        // UAE
  'SA': 'Asia/Riyadh',       // Saudi Arabia
  // ... and many more
};
```

---

## 🔄 How It Works

### **1. API Request Flow:**

```javascript
// Frontend Request
GET /v1/promotions/public?geo=IN&channel=web&limit=10

// Backend Processing
const timezone = getTimezoneFromGeo('IN'); // Returns 'Asia/Kolkata'

// Database Query
const filters = {
  is_active: 'true',
  status: 'active',
  visibility: 'public',
  timezone: 'Asia/Kolkata' // Filter by timezone
};
```

### **2. Database Filtering:**

```sql
-- Promotions table has timezone field
SELECT * FROM promotions 
WHERE is_active = true 
  AND status = 'active' 
  AND visibility = 'public'
  AND timezone = 'Asia/Kolkata'  -- Filtered by timezone
ORDER BY priority, discount_value;
```

---

## 📊 Supported Geo Codes

| Geo Code | Country | Timezone | Region |
|----------|---------|----------|--------|
| `IN` | India | `Asia/Kolkata` | Asia |
| `US` | United States | `America/New_York` | North America |
| `UK` | United Kingdom | `Europe/London` | Europe |
| `CA` | Canada | `America/Toronto` | North America |
| `AU` | Australia | `Australia/Sydney` | Oceania |
| `DE` | Germany | `Europe/Berlin` | Europe |
| `FR` | France | `Europe/Paris` | Europe |
| `JP` | Japan | `Asia/Tokyo` | Asia |
| `CN` | China | `Asia/Shanghai` | Asia |
| `SG` | Singapore | `Asia/Singapore` | Asia |
| `AE` | UAE | `Asia/Dubai` | Middle East |
| `SA` | Saudi Arabia | `Asia/Riyadh` | Middle East |

---

## 🛠️ Implementation Details

### **1. Service Layer Updates:**

```typescript
// src/services/promotions.service.ts
import { getTimezoneFromGeo } from '../utils/geoUtils.js';

async getPublicPromotions(options: { channel: string; geo: string; limit: number }) {
  // Convert geo code to timezone
  const timezone = getTimezoneFromGeo(options.geo);
  
  const filters: FilterOptions = {
    is_active: 'true',
    status: 'active',
    visibility: 'public',
    timezone: timezone // Filter by timezone
  };
  
  // ... rest of the logic
}
```

### **2. Utility Functions:**

```typescript
// Get timezone from geo code
export const getTimezoneFromGeo = (geo: string): string => {
  return geoToTimezoneMap[geo.toUpperCase()] || 'UTC';
};

// Get geo code from timezone
export const getGeoFromTimezone = (timezone: string): string => {
  const entry = Object.entries(geoToTimezoneMap).find(([_, tz]) => tz === timezone);
  return entry ? entry[0] : 'US';
};

// Validate geo code
export const isValidGeoCode = (geo: string): boolean => {
  return geo.toUpperCase() in geoToTimezoneMap;
};
```

---

## 🧪 Testing Examples

### **Test Different Geo Codes:**

```bash
# India - Should return promotions with timezone = 'Asia/Kolkata'
curl -X GET "http://localhost:5600/v1/promotions/public?geo=IN&channel=web&limit=5"

# United States - Should return promotions with timezone = 'America/New_York'
curl -X GET "http://localhost:5600/v1/promotions/public?geo=US&channel=web&limit=5"

# United Kingdom - Should return promotions with timezone = 'Europe/London'
curl -X GET "http://localhost:5600/v1/promotions/public?geo=UK&channel=web&limit=5"

# Invalid geo code - Should default to UTC
curl -X GET "http://localhost:5600/v1/promotions/public?geo=XX&channel=web&limit=5"
```

### **Expected Database Queries:**

```sql
-- For geo=IN
SELECT * FROM promotions 
WHERE is_active = true 
  AND status = 'active' 
  AND visibility = 'public'
  AND timezone = 'Asia/Kolkata';

-- For geo=US
SELECT * FROM promotions 
WHERE is_active = true 
  AND status = 'active' 
  AND visibility = 'public'
  AND timezone = 'America/New_York';
```

---

## 📈 Benefits

### **1. Proper Localization:**
- Users see promotions relevant to their timezone
- Festival offers (like Diwali) only show in appropriate regions
- Time-sensitive promotions respect local time

### **2. Consistent Data:**
- API uses standard country codes (IN, US, UK)
- Database stores standard timezone names (Asia/Kolkata, America/New_York)
- No data inconsistency between API and database

### **3. Scalability:**
- Easy to add new countries and timezones
- Centralized mapping in utility file
- Consistent behavior across all endpoints

---

## 🔧 Adding New Geo Codes

### **Step 1: Add to Mapping**
```typescript
// src/utils/geoUtils.ts
export const geoToTimezoneMap: Record<string, string> = {
  // ... existing mappings
  'BR': 'America/Sao_Paulo',  // Brazil
  'MX': 'America/Mexico_City', // Mexico
  'RU': 'Europe/Moscow',      // Russia
  'IT': 'Europe/Rome',        // Italy
  'ES': 'Europe/Madrid',      // Spain
  // ... add more as needed
};
```

### **Step 2: Test the Mapping**
```bash
# Test new geo code
curl -X GET "http://localhost:5600/v1/promotions/public?geo=BR&channel=web&limit=5"
```

### **Step 3: Update Database**
```sql
-- Insert promotions for new timezone
INSERT INTO promotions (..., timezone, ...) 
VALUES (..., 'America/Sao_Paulo', ...);
```

---

## 🚨 Error Handling

### **Invalid Geo Code:**
```typescript
// If geo code is not found, defaults to UTC
const timezone = getTimezoneFromGeo('INVALID'); // Returns 'UTC'
```

### **Missing Timezone in Database:**
```sql
-- If no promotions exist for the timezone, returns empty array
SELECT * FROM promotions WHERE timezone = 'Asia/Kolkata';
-- Returns: [] (empty result)
```

---

## 📝 Database Schema

### **Promotions Table:**
```sql
CREATE TABLE promotions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  description TEXT,
  type VARCHAR(50),
  -- ... other fields
  timezone VARCHAR(50), -- Stores timezone like 'Asia/Kolkata'
  -- ... other fields
);
```

### **Sample Data:**
```sql
-- India promotions
INSERT INTO promotions (..., timezone, ...) 
VALUES (..., 'Asia/Kolkata', ...);

-- US promotions  
INSERT INTO promotions (..., timezone, ...) 
VALUES (..., 'America/New_York', ...);

-- UK promotions
INSERT INTO promotions (..., timezone, ...) 
VALUES (..., 'Europe/London', ...);
```

---

## 🎯 Key Features

✅ **Geo-to-Timezone Mapping**: Automatic conversion of country codes to timezones  
✅ **Consistent Filtering**: Promotions filtered by user's timezone  
✅ **Scalable Design**: Easy to add new countries and timezones  
✅ **Error Handling**: Graceful fallback for invalid geo codes  
✅ **Performance**: Efficient database queries with timezone filtering  
✅ **Localization**: Region-appropriate promotions for users  

---

## 🔍 Debugging

### **Check Geo Mapping:**
```typescript
import { getTimezoneFromGeo, getSupportedGeoCodes } from '../utils/geoUtils.js';

console.log('IN ->', getTimezoneFromGeo('IN')); // Asia/Kolkata
console.log('US ->', getTimezoneFromGeo('US')); // America/New_York
console.log('Supported codes:', getSupportedGeoCodes());
```

### **Check Database Timezones:**
```sql
-- See all unique timezones in promotions table
SELECT DISTINCT timezone FROM promotions ORDER BY timezone;

-- Count promotions per timezone
SELECT timezone, COUNT(*) as count 
FROM promotions 
GROUP BY timezone 
ORDER BY count DESC;
```

---

**Your promotion system now properly handles geo-timezone mapping for accurate regional promotion filtering!** 🌍

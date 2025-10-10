# 📖 Stock lockqty Documentation

## 📍 Single Source of Truth

**All stock locking documentation is now in ONE place:**

👉 **[STOCK_LOCKQTY_COMPLETE_GUIDE.md](./STOCK_LOCKQTY_COMPLETE_GUIDE.md)**

---

## 📋 What's Inside

This comprehensive guide covers:

✅ **What is lockqty?** - Definition and purpose  
✅ **When lockqty UPDATES** - Increases during initiation (BOTH modes)  
✅ **When lockqty RESETS** - Decreases to 0 after order (BOTH modes)  
✅ **Implementation code** - Exact code locations  
✅ **Complete flow - PhonePe** - Step-by-step with timings  
✅ **Complete flow - COD** - Step-by-step with timings  
✅ **Safety measures** - 5 layers of protection  
✅ **Testing queries** - SQL verification  
✅ **Monitoring** - Production monitoring queries  
✅ **Troubleshooting** - Common issues and fixes  

---

## 🚀 Quick Start

### For Understanding
Read: [STOCK_LOCKQTY_COMPLETE_GUIDE.md](./STOCK_LOCKQTY_COMPLETE_GUIDE.md)

### For Implementation
See sections:
- "When lockqty UPDATES" (Lines 405-531)
- "When lockqty RESETS" (Lines 2536-2610)

### For Testing
See section: "Testing & Verification"

### For Production
See sections: "Monitoring Queries" and "Troubleshooting"

---

## 🎯 Key Points

### lockqty Lifecycle (Both Modes)

```
Initial → Lock (initiation) → Convert (order) → Final
  0    →        2          →        0        →   0
         🔒 INCREASE              ♻️ RESET
```

### Modes

| Mode | Lock Time | Reset Time | Duration |
|------|-----------|------------|----------|
| **PhonePe** | Line 405 | Route Line 304 | Minutes |
| **COD** | Line 405 | Controller Line 642 | ~1 second |

### Safety

✅ No negative values possible  
✅ Atomic transactions  
✅ Mismatch detection  
✅ Comprehensive logging  

---

## 📝 Previous Documents (Deleted)

The following 4 documents were consolidated into the single guide:

- ~~STOCK_LOCKING_IMPLEMENTATION.md~~ (deleted)
- ~~STOCK_LOCKING_SUMMARY.md~~ (deleted)
- ~~STOCK_LOCKING_VERIFICATION.md~~ (deleted)
- ~~FINAL_STOCK_IMPLEMENTATION_SUMMARY.md~~ (deleted)

**All information is now in:** `STOCK_LOCKQTY_COMPLETE_GUIDE.md`

---

---

## ⚠️ Bug Fix Applied (Oct 10, 2025)

**Issue Found:** lockqty was not resetting to 0 after order creation  
**Cause:** Incorrect availability check during conversion  
**Fix:** Removed the check - conversion now works correctly  
**Status:** ✅ Fixed and documented in main guide  

---

**Last Updated:** October 10, 2025 (Version 1.1 - Bug Fixed)  
**Status:** ✅ Single Source of Truth (Updated with Fix)  
**Next Step:** Review the complete guide - includes bug fix details!


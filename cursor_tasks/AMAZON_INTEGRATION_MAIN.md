# Amazon-Nivaana Integration Guide
## Main Overview & Quick Start

**Version:** 1.0  
**Date:** November 7, 2025  
**Marketplace:** Amazon India (Marketplace ID: A21TJRUUN4KGV)

---

## 📚 Documentation Structure

This integration has **two separate implementation paths** with different requirements:

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| **[Sandbox Implementation Guide](./AMAZON_INTEGRATION_SANDBOX.md)** | Testing & Development | ✅ Use this first - No verification needed, test all APIs |
| **[Production Implementation Guide](./AMAZON_INTEGRATION_PRODUCTION.md)** | Live Integration | ⏳ Use after sandbox testing - Requires verification, connects to real inventory |

---

## 🎯 Quick Decision: Which Guide Should I Follow?

### Choose Sandbox Guide If:
- ✅ You're just starting development
- ✅ You want to test APIs without verification
- ✅ You don't have business documents yet
- ✅ You want to validate your integration code first
- ✅ You're a developer building for a client

### Choose Production Guide If:
- ✅ You've completed sandbox testing
- ✅ You're ready to connect to real seller account
- ✅ You have identity verification documents ready
- ✅ You want to sync real inventory and orders
- ✅ You're ready to go live

---

## 🔄 Recommended Workflow

```
┌─────────────────────────────────────────────────────────┐
│                    START HERE                             │
│                                                           │
│  Step 1: Follow SANDBOX Guide                            │
│  ├─ Create sandbox app                                   │
│  ├─ Get LWA credentials                                  │
│  ├─ Set up AWS (no verification needed)                  │
│  ├─ Test all APIs                                        │
│  └─ Validate integration code                            │
│                                                           │
│  ✅ All APIs work in sandbox                             │
│  ✅ No identity verification needed                      │
│  ✅ Test with mock/test data                             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  Step 2: When Ready, Follow PRODUCTION Guide            │
│  ├─ Complete identity verification                      │
│  ├─ Get production credentials                          │
│  ├─ Connect to real seller account                      │
│  └─ Start syncing real inventory                        │
│                                                           │
│  ✅ Access to real NIVAANA inventory                    │
│  ✅ Real customer orders                                │
│  ✅ Live production data                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Key Differences: Sandbox vs Production

| Aspect | Sandbox | Production |
|--------|---------|------------|
| **Identity Verification** | ❌ Not Required | ✅ Required |
| **API Roles** | ✅ Auto-enabled (all APIs) | ⏳ Need to request/approve |
| **Setup Time** | ⚡ Immediate | ⏳ 20 mins - 10 days |
| **Data** | Test/mock data | Real seller account data |
| **Inventory** | Test inventory | Real NIVAANA inventory |
| **Orders** | Test orders | Real customer orders |
| **Credentials** | Sandbox Client ID/Secret | Production Client ID/Secret |
| **When to Use** | Development & Testing | Live Operations |

---

## 🚀 Quick Start

### For Development/Testing:
👉 **[Go to Sandbox Implementation Guide](./AMAZON_INTEGRATION_SANDBOX.md)**

### For Production/Live Integration:
👉 **[Go to Production Implementation Guide](./AMAZON_INTEGRATION_PRODUCTION.md)**

---

## 📖 Common Sections (Both Guides)

Both guides cover:
- ✅ Authentication & Configuration
- ✅ System Architecture
- ✅ Integration Flows (Inventory, Orders, Shipments)
- ✅ API Reference
- ✅ Data Model & Field Mappings
- ✅ Error Handling & Retry Strategy
- ✅ Troubleshooting
- ✅ Support & References

**Difference:** Setup steps, verification requirements, and credential management differ between sandbox and production.

---

## 🎓 Account Types

**Solution Provider Portal** (Recommended for developers building for clients):
- Register as individual developer or company
- Can connect to multiple seller accounts
- Personal mobile number acceptable
- Business docs needed only for production

**Private App** (For your own seller account):
- Direct integration with your seller account
- Simpler setup
- Business docs needed only for production

---

## 📞 Support

- **Amazon SP-API Docs:** https://developer-docs.amazon.com/sp-api/
- **Seller Central (India):** https://sellercentral.amazon.in
- **SP-API Support:** https://developer.amazonservices.com/support

---

**Next Steps:**
1. If you're starting development → **[Sandbox Guide](./AMAZON_INTEGRATION_SANDBOX.md)**
2. If you're ready for production → **[Production Guide](./AMAZON_INTEGRATION_PRODUCTION.md)**

---

**Document Version:** 1.0  
**Last Updated:** November 7, 2025


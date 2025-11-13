# Amazon SP-API SDK Packages Explanation

## Question: Why So Many Packages? `@api/sp-api` vs `@sp-api-sdk/*`

### The Confusion

You've seen documentation examples like:
```javascript
import spApi from '@api/sp-api';

spApi.getListingsItem({
  marketplaceIds: '',
  includedData: 'summaries',
  sellerId: 'sellerId',
  sku: 'sku'
})
```

But we're installing multiple packages:
- `@sp-api-sdk/auth`
- `@sp-api-sdk/listings-items-api-2021-08-01`
- `@sp-api-sdk/catalog-items-api-2020-12-01`
- `@sp-api-sdk/sellers-api-v1`

### The Answer

**`@api/sp-api` is NOT a real npm package!**

It's a **pseudocode/example** used in Amazon's API documentation tool (api.tools.amazon.com). The documentation generator creates simplified examples that don't reflect the actual SDK structure.

### The Real Official SDK

The **official Amazon SP-API SDK** uses a **modular package structure**:

#### Official Package Structure

```
@sp-api-sdk/
├── auth                          # Authentication & token management
├── listings-items-api-2021-08-01  # Listings Items API (v2021-08-01)
├── catalog-items-api-2020-12-01  # Catalog Items API (v2020-12-01)
├── orders-api-v0                  # Orders API
├── sellers-api-v1                 # Sellers API
├── fees-api-v0                    # Fees API
└── ... (many more API-specific packages)
```

### Why Modular Packages?

**Benefits:**
1. ✅ **Tree-shaking** - Only import what you need (smaller bundle size)
2. ✅ **Version independence** - Each API can have different versions
3. ✅ **Type safety** - Each package has its own TypeScript types
4. ✅ **Maintainability** - Easier to update individual APIs
5. ✅ **Official support** - Maintained by Amazon

**Example:**
```typescript
// Only import what you need
import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { ListingsItemsApiClient } from '@sp-api-sdk/listings-items-api-2021-08-01';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2020-12-01';

// Each client is independent
const auth = new SellingPartnerApiAuth({ ... });
const listingsClient = new ListingsItemsApiClient({ auth, region: 'eu' });
const catalogClient = new CatalogItemsApiClient({ auth, region: 'eu' });
```

### Alternative Packages (Not Recommended)

There are some **third-party** packages that try to provide a unified interface:

1. **`amazon-sp-api`** (in your package.json)
   - Third-party wrapper
   - Not officially maintained by Amazon
   - May not support all APIs or latest versions

2. **`@amazon-sp-api-release/amazon-sp-api-sdk-js`**
   - This is the **old/unified** version (deprecated)
   - Amazon moved to modular packages

### Our Implementation (Correct & Future-Proof)

We're using the **official modular SDK** (`@sp-api-sdk/*`), which is:

✅ **Official** - Maintained by Amazon  
✅ **Current** - Latest version and features  
✅ **Type-safe** - Full TypeScript support  
✅ **Modular** - Only install what you need  
✅ **Future-proof** - Active development  

### Package Breakdown

| Package | Purpose | Why We Need It |
|---------|---------|----------------|
| `@sp-api-sdk/auth` | Authentication & token management | Handles LWA token refresh automatically |
| `@sp-api-sdk/listings-items-api-2021-08-01` | Listings Items API | Get/update your own product listings |
| `@sp-api-sdk/catalog-items-api-2020-12-01` | Catalog Items API | Search Amazon catalog, get product details |
| `@sp-api-sdk/sellers-api-v1` | Sellers API | Get seller info, marketplace participations |

### Do We Use Fetch or Axios?

**Neither!** The SDK handles HTTP requests internally. You don't need to:
- ❌ Import `fetch` or `axios`
- ❌ Make manual HTTP requests
- ❌ Handle authentication headers
- ❌ Manage token refresh

The SDK does all of this automatically:

```typescript
// SDK handles everything internally
const client = new ListingsItemsApiClient({ auth, region: 'eu' });
const response = await client.getListingsItem({ ... });
// ↑ SDK automatically:
//   - Adds access token to headers
//   - Refreshes token if needed
//   - Makes HTTP request
//   - Parses response
```

### Summary

| Question | Answer |
|----------|--------|
| **Is `@api/sp-api` a real package?** | ❌ No, it's pseudocode from documentation |
| **What's the official SDK?** | ✅ `@sp-api-sdk/*` (modular packages) |
| **Why so many packages?** | ✅ Modular design for better tree-shaking and versioning |
| **Do we use fetch/axios?** | ❌ No, SDK handles HTTP internally |
| **Is this future-proof?** | ✅ Yes, this is the official current approach |

### References

- [Official Amazon SP-API SDK Documentation](https://developer-docs.amazon.com/sp-api/docs/automate-your-sp-api-calls-using-a-prebuilt-javascript-sdk)
- [SDK GitHub Repository](https://github.com/amzn/selling-partner-api-sdk)
- [npm: @sp-api-sdk/auth](https://www.npmjs.com/package/@sp-api-sdk/auth)


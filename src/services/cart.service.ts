import { 
  CreateCartInput, 
  UpdateCartInput, 
  UpsertCartInput
} from '../schemas/cart.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindManyWithFilters,
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

export class CartService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic cart findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: carts, total } = await dynamicFindManyWithFilters('cart', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        cartCount: carts.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: carts.length > 0 ? Object.keys(carts[0]) : []
      }, 'Dynamic cart findMany with filters completed');

      return createPaginationResult(carts, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic cart findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ cartId: id }, 'Starting dynamic cart findById operation');

      const cart = await dynamicFindUnique('cart', { id: parseInt(id) });

      if (!cart) {
        throw new Error('Cart item not found');
      }

      logger.debug({ 
        cartId: id, 
        availableFields: Object.keys(cart) 
      }, 'Dynamic cart findById completed');

      return cart;
    } catch (error) {
      logger.error({ error, cartId: id }, 'Error in cart findById operation');
      throw error;
    }
  }

  async create(data: CreateCartInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic cart create operation');

      // Add timestamps
      const cartData = {
        ...data,
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      };

      const cart = await dynamicCreate('cart', cartData);

      if (!cart) {
        throw new Error('Failed to create cart item - no valid fields provided');
      }

      logger.info({ 
        cartId: cart.id, 
        availableFields: Object.keys(cart) 
      }, 'Dynamic cart create completed');

      return cart;
    } catch (error) {
      logger.error({ error, data }, 'Error in cart create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateCartInput & Record<string, any>) {
    try {
      // Check if cart item exists
      await this.findById(id);

      logger.debug({ originalData: data, cartId: id }, 'Starting dynamic cart update operation');

      // Add modified timestamp
      const cartData = {
        ...data,
        modifieddate: BigInt(Date.now())
      };

      const cart = await dynamicUpdate('cart', { id: parseInt(id) }, cartData);

      if (!cart) {
        throw new Error('Failed to update cart item - no valid fields provided');
      }

      logger.info({ 
        cartId: id, 
        availableFields: Object.keys(cart) 
      }, 'Dynamic cart update completed');

      return cart;
    } catch (error) {
      logger.error({ error, data, cartId: id }, 'Error in cart update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if cart item exists
      await this.findById(id);

      logger.debug({ cartId: id }, 'Starting dynamic cart delete operation');

      const success = await dynamicDelete('cart', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete cart item');
      }

      logger.info({ cartId: id }, 'Dynamic cart delete completed successfully');
    } catch (error) {
      logger.error({ error, cartId: id }, 'Error in cart delete operation');
      throw error;
    }
  }

  /**
   * Upsert cart/wishlist item with duplicate prevention
   * Business Rules:
   * - If ID provided: UPDATE that specific record by ID (direct update)
   * - If no ID:
   *   - Cart items (iscart=true): UPDATE quantity if exists, INSERT if not
   *   - Wishlist items (iswishlist=true): SKIP if exists, INSERT if not
   * - Same product CAN be in both cart and wishlist (different records)
   * - Uniqueness check at service level, not database level
   */
  async upsert(data: UpsertCartInput & Record<string, any>) {
    try {
      // STEP 1: Check if ID is provided (direct update by ID)
      const { id, ...restData } = data;

      if (id) {
        // DIRECT UPDATE BY ID
        logger.info({ cartId: id, updateData: restData }, 'Updating cart item by ID');
        
        // Validate the update data
        this.validateCartRequest(restData);
        
        // Check if cart item exists
        const existingItem = await this.findById(id.toString());
        if (!existingItem) {
          throw new Error(`Cart item with ID ${id} not found`);
        }

        // Update the item
        const updateData = {
          ...restData,
          modifieddate: BigInt(Date.now())
        };

        const updatedCart = await dynamicUpdate('cart', { id: parseInt(id.toString()) }, updateData);

        logger.info({ 
          cartId: id,
          userid: updatedCart.userid,
          productid: updatedCart.productid
        }, 'Cart item updated successfully by ID');

        return updatedCart;
      }

      // STEP 2: No ID provided - Use duplicate prevention logic
      this.validateCartRequest(restData);

      const { userid, productid, quantity, iscart, iswishlist } = restData;

      logger.debug({ 
        userid, 
        productid, 
        quantity, 
        iscart, 
        iswishlist 
      }, 'Starting cart upsert with duplicate prevention (no ID provided)');

      // STEP 3: Check for existing record based on combination
      let existingRecord = null;

      if (iscart === true) {
        // CART ITEM: Check for existing cart record (userid, productid, iscart=true)
        const filters = {
          userid: userid,
          productid: productid,
          iscart: true
        };

        const { data: cartItems } = await dynamicFindManyWithFilters('cart', filters, {
          useAllColumns: true
        });

        existingRecord = cartItems.length > 0 ? cartItems[0] : null;

        if (existingRecord) {
          // UPDATE: Cart record exists, update quantity
          logger.info({ 
            cartId: existingRecord.id,
            userid, 
            productid, 
            oldQuantity: existingRecord.quantity, 
            newQuantity: quantity 
          }, 'Cart item exists - Updating quantity');

          const updateData = {
            quantity: quantity,
            modifieddate: BigInt(Date.now())
          };

          const updatedCart = await dynamicUpdate('cart', { id: existingRecord.id }, updateData);

          logger.info({ 
            cartId: existingRecord.id, 
            userid, 
            productid 
          }, 'Cart item updated successfully');

          return updatedCart;
        } else {
          // INSERT: Create new cart record
          logger.info({ 
            userid, 
            productid, 
            quantity 
          }, 'Cart item does not exist - Creating new record');

          const newCartItem = {
            userid: userid,
            productid: productid,
            quantity: quantity,
            iscart: true,
            iswishlist: false,
            createddate: BigInt(Date.now()),
            modifieddate: BigInt(Date.now())
          };

          const createdCart = await dynamicCreate('cart', newCartItem);

          logger.info({ 
            cartId: createdCart.id, 
            userid, 
            productid 
          }, 'Cart item created successfully');

          return createdCart;
        }
      } 
      else if (iswishlist === true) {
        // WISHLIST ITEM: Check for existing wishlist record (userid, productid, iswishlist=true)
        const filters = {
          userid: userid,
          productid: productid,
          iswishlist: true
        };

        const { data: wishlistItems } = await dynamicFindManyWithFilters('cart', filters, {
          useAllColumns: true
        });

        existingRecord = wishlistItems.length > 0 ? wishlistItems[0] : null;

        if (existingRecord) {
          // SKIP: Wishlist record already exists, return existing
          logger.info({ 
            wishlistId: existingRecord.id,
            userid, 
            productid 
          }, 'Wishlist item already exists - Returning existing record (no update)');

          return existingRecord;
        } else {
          // INSERT: Create new wishlist record
          logger.info({ 
            userid, 
            productid 
          }, 'Wishlist item does not exist - Creating new record');

          const newWishlistItem = {
            userid: userid,
            productid: productid,
            quantity: 1, // Always 1 for wishlist
            iscart: false,
            iswishlist: true,
            createddate: BigInt(Date.now()),
            modifieddate: BigInt(Date.now())
          };

          const createdWishlist = await dynamicCreate('cart', newWishlistItem);

          logger.info({ 
            wishlistId: createdWishlist.id, 
            userid, 
            productid 
          }, 'Wishlist item created successfully');

          return createdWishlist;
        }
      }

      // This should never be reached due to validation, but handle it anyway
      throw new Error('Invalid cart/wishlist flags');

    } catch (error) {
      logger.error({ error, data }, 'Error in cart upsert operation');
      throw error;
    }
  }

  /**
   * Validate cart/wishlist request
   * Ensures data integrity before insert/update
   */
  private validateCartRequest(data: any): void {
    // 1. Validate userid exists
    if (!data.userid) {
      throw new Error('userid is required');
    }

    // 2. Validate productid exists
    if (!data.productid) {
      throw new Error('productid is required');
    }

    // 3. Validate quantity for cart items
    if (data.iscart === true && (!data.quantity || data.quantity < 1)) {
      throw new Error('quantity must be at least 1 for cart items');
    }

    // 4. Validate flags (at least one must be true)
    if (!data.iscart && !data.iswishlist) {
      throw new Error('Either iscart or iswishlist must be true');
    }

    // 5. Validate mutual exclusivity (both cannot be true)
    if (data.iscart === true && data.iswishlist === true) {
      throw new Error('iscart and iswishlist cannot both be true');
    }

    // 6. Force quantity = 1 for wishlist items
    if (data.iswishlist === true) {
      data.quantity = 1;
      logger.debug({ userid: data.userid, productid: data.productid }, 'Forced quantity to 1 for wishlist item');
    }
  }

  // Additional cart-specific methods
  async findByUserId(userId: string, isCart: boolean = true) {
    try {
      logger.debug({ userId, isCart }, 'Starting find cart items by user ID');

      const filters = {
        userid: parseInt(userId),
        iscart: isCart
      };

      const { data: carts } = await dynamicFindManyWithFilters('cart', filters, {
        useAllColumns: true
      });

      logger.info({ userId, cartCount: carts.length }, 'Cart items by user ID retrieved');

      return carts;
    } catch (error) {
      logger.error({ error, userId }, 'Error finding cart items by user ID');
      throw error;
    }
  }

  async findWishlistByUserId(userId: string) {
    try {
      logger.debug({ userId }, 'Starting find wishlist items by user ID');

      const filters = {
        userid: parseInt(userId),
        iswishlist: true
      };

      const { data: wishlist } = await dynamicFindManyWithFilters('cart', filters, {
        useAllColumns: true
      });

      logger.info({ userId, wishlistCount: wishlist.length }, 'Wishlist items by user ID retrieved');

      return wishlist;
    } catch (error) {
      logger.error({ error, userId }, 'Error finding wishlist items by user ID');
      throw error;
    }
  }

  async clearCartByUserId(userId: string) {
    try {
      logger.debug({ userId }, 'Starting clear cart for user');

      const filters = {
        userid: parseInt(userId),
        iscart: true
      };

      // Find all cart items for the user
      const { data: cartItems } = await dynamicFindManyWithFilters('cart', filters, {
        useAllColumns: true
      });

      // Delete each cart item
      for (const item of cartItems) {
        await dynamicDelete('cart', { id: item.id });
      }

      logger.info({ userId, deletedCount: cartItems.length }, 'Cart cleared for user');

      return { deletedCount: cartItems.length };
    } catch (error) {
      logger.error({ error, userId }, 'Error clearing cart for user');
      throw error;
    }
  }
} 
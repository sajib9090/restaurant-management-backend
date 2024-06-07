import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  menuItemsCollection,
  categoriesCollection,
} from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import slugify from "slugify";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";

export const handleCreateMenuItem = async (req, res, next) => {
  const { user } = req.user;
  const { item_name, category, item_price } = req.body;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }

    requiredField(item_name, "Item name is required");
    requiredField(category, "Category id is required");
    requiredField(item_price, "Item price is required");

    const processedItemName = validateString(item_name, "Item Name", 2, 100);
    const processedCategoryName = validateString(
      category,
      "Category Name",
      2,
      100
    );

    const itemPrice = parseFloat(item_price);
    if (typeof itemPrice !== "number" || itemPrice <= 0 || isNaN(itemPrice)) {
      throw createError(400, "Item price must be a positive number");
    }

    const existingItem = await menuItemsCollection.findOne({
      $and: [{ item_name: processedItemName }, { brand: user?.brand_id }],
    });

    if (existingItem) {
      throw createError(400, "Item already exists in this brand");
    }

    const existingCategory = await categoriesCollection.findOne({
      category: processedCategoryName,
    });
    if (!existingCategory) {
      throw createError(400, "Category not found");
    }

    const itemSlug = slugify(processedItemName);
    const count = await menuItemsCollection.countDocuments();
    const generateCode = crypto.randomBytes(12).toString("hex");
    const newItem = {
      item_id: count + 1 + "-" + generateCode,
      item_name: processedItemName,
      item_slug: itemSlug,
      brand: user?.brand_id,
      category: existingCategory?.category,
      discount: true,
      item_price: itemPrice,
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    await menuItemsCollection.insertOne(newItem);

    res.status(200).send({
      success: true,
      message: "Menu item created",
      data: newItem,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetMenuItems = async (req, res, next) => {
  try {
    const { user } = req.user;

    if (!user) {
      throw createError(401, "User not found. Login Again");
    }

    const search = req.query.search || "";
    const category = req.query.category || "";
    const price = req.query.price || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit);

    const regExSearch = new RegExp(".*" + search + ".*", "i");
    const regExCategory = new RegExp(".*" + category + ".*", "i");

    let query;
    if (user?.role == "super admin") {
      if (search) {
        query = {
          $or: [
            { item_name: regExSearch },
            { item_slug: regExSearch },
            { category: regExSearch },
          ],
        };
      } else if (category) {
        query = {
          $or: [{ category: regExCategory }],
        };
      } else {
        query = {};
      }
    } else {
      if (search) {
        console.log(search);
        query = {
          $and: [
            {
              brand: user?.brand_id,
            },
          ],
          $or: [
            { item_name: regExSearch },
            { item_slug: regExSearch },
            { category: regExSearch },
          ],
        };
      } else if (category) {
        query = {
          $and: [{ category: regExCategory }, { brand: user?.brand_id }],
        };
      } else {
        query = { brand: user?.brand_id };
      }
    }

    let sortCriteria = { item_name: 1 };

    if (price === "high-to-low") {
      sortCriteria = { item_price: -1 };
    } else if (price === "low-to-high") {
      sortCriteria = { item_price: 1 };
    }

    const menus = await menuItemsCollection
      .find(query)
      .sort(sortCriteria)
      .limit(limit)
      .skip((page - 1) * limit)
      .toArray();

    const count = await menuItemsCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Menu items retrieved successfully",
      data_found: count,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        previousPage: page - 1 > 0 ? page - 1 : null,
        nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
      },
      data: menus,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteMenuItem = async (req, res, next) => {
  const { ids } = req.body;

  try {
    if (!Array.isArray(ids)) {
      throw createError("ids must be an array");
    }

    const criteria = { item_id: { $in: ids } };

    const result = await menuItemsCollection.deleteMany(criteria);
    if (result.deletedCount == 0) {
      throw createError(404, "Document not found for deletion");
    }
    res.status(200).send({
      success: true,
      message: "Menu item deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleEditMenuItem = async (req, res, next) => {
  const { item_name, category, discount, item_price } = req.body;
  const id = req.params;
  const { user } = req.user;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }

    const existingMenuItem = await menuItemsCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!existingMenuItem) {
      throw createError(404, "Item not found");
    }

    let updateFields = {};

    if (item_name) {
      const processedItemName = validateString(item_name, "Item Name", 2, 100);
      const existingItemName = await menuItemsCollection.findOne({
        $and: [{ brand: user?.brand_id }, { item_name: processedItemName }],
      });
      if (existingItemName) {
        throw createError(404, "Item name already exists.");
      }
      const itemNameSlug = slugify(processedItemName);
      updateFields.item_name = processedItemName;
      updateFields.item_slug = itemNameSlug;
    }
    if (category) {
      const processedCategoryName = validateString(
        category,
        "Category",
        2,
        100
      );
      const existingCategory = await categoriesCollection.findOne({
        $and: [{ brand: user?.brand_id }, { category: processedCategoryName }],
      });
      if (!existingCategory) {
        throw createError(404, "Category not found");
      }
      updateFields.category = processedCategoryName;
    }

    if (discount !== undefined) {
      const discountValue =
        discount === "true"
          ? true
          : discount === "false"
          ? false
          : existingMenuItem?.discount;
      updateFields.discount = discountValue;
    }
    if (item_price) {
      const price = parseFloat(item_price);
      if (typeof price !== "number" || price <= 0 || isNaN(price)) {
        throw createError(400, "Item price must be a positive number");
      }
      updateFields.item_price = price;
    }

    await menuItemsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    res.status(200).send({
      success: true,
      message: "Menu item edited",
    });
  } catch (error) {
    next(error);
  }
};

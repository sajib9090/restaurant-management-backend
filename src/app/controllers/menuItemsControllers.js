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
      $and: [
        { item_name: processedItemName },
        { brand: user?.brand_id },
        { category: processedCategoryName },
      ],
    });

    if (existingItem) {
      throw createError(
        400,
        "Item already exist with same category in this brand"
      );
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
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit);

    const regExSearch = new RegExp(".*" + search + ".*", "i");

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
      } else {
        query = {};
      }
    } else {
      if (search) {
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
      } else {
        query = { brand: user?.brand_id };
      }
    }

    const menus = await menuItemsCollection
      .find(query)
      .sort({ item_name: 1 })
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

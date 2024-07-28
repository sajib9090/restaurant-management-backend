import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  categoriesCollection,
  removedUsersCollection,
} from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import slugify from "slugify";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";
import { removedUserChecker } from "../helpers/removedUserChecker.js";

export const handleCreateCategory = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { category } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    requiredField(category, "Category name is required");
    const processedCategory = validateString(category, "Category Name", 2, 50);

    const existingCategory = await categoriesCollection.findOne({
      $and: [{ category: processedCategory }, { brand: user?.brand_id }],
    });

    if (existingCategory) {
      throw createError(400, "Category name already exists");
    }

    const categorySlug = slugify(processedCategory);
    const count = await categoriesCollection.countDocuments();
    const generateCode = crypto.randomBytes(12).toString("hex");

    const newCategory = {
      category_id: count + 1 + "-" + generateCode,
      category: processedCategory,
      category_slug: categorySlug,
      brand: user?.brand_id,
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    await categoriesCollection.insertOne(newCategory);

    res.status(200).send({
      success: true,
      message: "Category created",
      data: newCategory,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetCategories = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const search = req.query.search || "";
  const brandFilter = req.query.brand || "";
  const page = Number(req.query.page) || 1;
  const limit = req.query.limit ? Number(req.query.limit) : null;

  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    const regExSearch = new RegExp(".*" + search + ".*", "i");

    let query;
    if (user?.role === "super admin") {
      if (search) {
        query = {
          $or: [{ category: regExSearch }, { category_slug: regExSearch }],
        };
      } else if (brandFilter) {
        query = {
          brand: brandFilter,
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
          $or: [{ category: regExSearch }, { category_slug: regExSearch }],
        };
      } else {
        query = { brand: user?.brand_id };
      }
    }

    let sortCriteria = { category: 1 };

    let categories;
    if (user?.role === "super admin") {
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: "brands",
            localField: "brand",
            foreignField: "brand_id",
            as: "brand_info",
          },
        },
        { $unwind: "$brand_info" },
        {
          $project: {
            _id: 1,
            category_id: 1,
            category: 1,
            category_slug: 1,
            brand: 1,
            createdBy: 1,
            createdAt: 1,
            "brand_info.brand_id": 1,
            "brand_info.brand_name": 1,
            "brand_info.brand_logo": 1,
          },
        },
        { $sort: sortCriteria },
      ];

      if (limit) {
        pipeline.push({ $skip: (page - 1) * limit });
        pipeline.push({ $limit: limit });
      }

      categories = await categoriesCollection.aggregate(pipeline).toArray();
    } else {
      const findQuery = categoriesCollection.find(query).sort(sortCriteria);

      if (limit) {
        findQuery.limit(limit).skip((page - 1) * limit);
      }

      categories = await findQuery.toArray();
    }

    const count = await categoriesCollection.countDocuments(query);
    res.status(200).send({
      success: true,
      message: "Categories retrieved successfully",
      data_found: count,
      pagination: limit
        ? {
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            previousPage: page - 1 > 0 ? page - 1 : null,
            nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
          }
        : null,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const handleEditCategory = async (req, res, next) => {
  const { category } = req.body;
  const id = req.params;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }
    requiredField(category, "Category Name is required");
    const processedCategory = validateString(category, "Category Name", 2, 30);

    const existingCategory = await categoriesCollection.findOne({
      $and: [{ category: processedCategory }, { brand: user?.brand_id }],
    });

    if (existingCategory) {
      throw createError(400, "Category name already exists");
    }

    const categorySlug = slugify(processedCategory);

    const editedFields = {
      category: processedCategory,
      category_slug: categorySlug,
      updatedBy: user?.user_id,
      updatedAt: new Date(),
    };

    const filter = { _id: new ObjectId(id) };
    const result = await categoriesCollection.findOneAndUpdate(filter, {
      $set: editedFields,
    });

    if (!result) {
      throw createError(400, "Category not updated. Try again");
    }
    res.status(200).send({
      success: true,
      message: "Category updated",
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteCategory = async (req, res, next) => {
  const { ids } = req.body;
  const { user } = req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (!Array.isArray(ids)) {
      throw createError("ids must be an array");
    }

    const criteria = { category_id: { $in: ids } };

    const result = await categoriesCollection.deleteMany(criteria);
    if (result.deletedCount == 0) {
      throw createError(404, "Document not found for deletion");
    }
    res.status(200).send({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

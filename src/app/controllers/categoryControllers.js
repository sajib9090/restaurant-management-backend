import createError from "http-errors";
import { ObjectId } from "mongodb";
import { categoriesCollection } from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import slugify from "slugify";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";

export const handleCreateCategory = async (req, res, next) => {
  const { user } = req.user;
  const { category } = req.body;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }

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
  const { user } = req.user;

  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }

    const categories = await categoriesCollection
      .find({ brand: user?.brand_id })
      .sort({ category: 1 })
      .toArray();
    res.status(200).send({
      success: true,
      message: "Categories retrieved successfully",
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

export const handleEditCategory = async (req, res, next) => {
  const { category } = req.body;
  const id = req.params;
  const { user } = req.user;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }
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
  try {
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

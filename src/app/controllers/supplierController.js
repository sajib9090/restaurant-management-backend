import {
  removedUsersCollection,
  suppliersCollection,
} from "../collections/collections.js";
import { removedUserChecker } from "../helpers/removedUserChecker.js";
import { requiredField } from "../helpers/requiredField.js";
import createError from "http-errors";
import { validateString } from "../helpers/validateString.js";
import validator from "validator";
import crypto from "crypto";

export const handleAddSupplier = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const body = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    await removedUserChecker(removedUsersCollection, "user_id", user?.user_id);
    if (user?.role !== "chairman" && user?.role !== "admin") {
      throw createError(403, "Forbidden request. You are not permitted");
    }

    requiredField(body?.name, "Supplier name is required");
    requiredField(body?.mobile1, "Mobile number is required");

    const processedName = validateString(body?.name, "Name", 3, 30);
    const processedCompanyName =
      body?.company_name &&
      validateString(body?.company_name, "Company name", 3, 30);
    const processedEmail = body?.email && body?.email?.toLowerCase();

    if (
      body?.mobile1?.length !== 11 ||
      (body?.mobile2 && body?.mobile2?.length !== 11)
    ) {
      throw createError(400, "Mobile number should be 11 characters");
    }

    if (body?.email && !validator.isEmail(processedEmail)) {
      throw createError(400, "Invalid email address");
    }

    if (body?.mobile1 && !validator.isMobilePhone(body?.mobile1, "any")) {
      throw createError(400, "Invalid mobile number");
    }

    const duplicateCheck = await suppliersCollection.findOne({
      $and: [{ mobile1: body?.mobile1 }, { brand_id: user?.brand_id }],
    });

    if (duplicateCheck) {
      throw createError(404, "Supplier already exist with this phone number");
    }
    const generateSupplierCode = crypto.randomBytes(12).toString("hex");
    const newSupplier = {
      supplier_id: generateSupplierCode,
      name: processedName,
      company_name: processedCompanyName || null,
      mobile1: body?.mobile1,
      mobile2: body?.mobile2 || null,
      email: body?.email || null,
      createdBy: user?.user_id,
      createdAt: new Date(),
      brand_id: user?.brand_id,
    };

    const result = await suppliersCollection.insertOne(newSupplier);
    if (!result?.insertedId) {
      throw createError(500, "Supplier not added");
    }
    res.status(200).send({
      success: true,
      message: "Supplier added successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetSuppliers = async (req, res, next) => {
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
          $or: [
            { name: regExSearch },
            { company_name: regExSearch },
            { mobile1: regExSearch },
            { mobile2: regExSearch },
          ],
        };
      } else if (brandFilter) {
        query = {
          brand_id: brandFilter,
        };
      } else {
        query = {};
      }
    } else {
      if (search) {
        query = {
          $and: [
            {
              brand_id: user?.brand_id,
            },
          ],
          $or: [
            { name: regExSearch },
            { company_name: regExSearch },
            { mobile1: regExSearch },
            { mobile2: regExSearch },
          ],
        };
      } else {
        query = { brand_id: user?.brand_id };
      }
    }

    let sortCriteria = { name: 1 };

    let suppliers;
    if (user?.role === "super admin") {
      const pipeline = [
        { $match: query },
        {
          $lookup: {
            from: "brands",
            localField: "brand_id",
            foreignField: "brand_id",
            as: "brand_info",
          },
        },
        { $unwind: "$brand_info" },
        {
          $project: {
            _id: 1,
            supplier_id: 1,
            name: 1,
            company_name: 1,
            mobile1: 1,
            mobile2: 1,
            email: 1,
            createdBy: 1,
            createdAt: 1,
            brand_id: 1,
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

      suppliers = await suppliersCollection.aggregate(pipeline).toArray();
    } else {
      const findQuery = suppliersCollection.find(query).sort(sortCriteria);

      if (limit) {
        findQuery.limit(limit).skip((page - 1) * limit);
      }

      suppliers = await findQuery.toArray();
    }

    const count = await suppliersCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Suppliers retrieved successfully",
      data_found: count,
      pagination: limit
        ? {
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            previousPage: page - 1 > 0 ? page - 1 : null,
            nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
          }
        : null,
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
};
